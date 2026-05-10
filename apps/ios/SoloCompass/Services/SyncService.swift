import Foundation
import SwiftData
import Observation
import UIKit

/// Outbox sync (Epic E US-029). Local mutations enqueue
/// `PendingSyncRecord` rows; this service drains them to Supabase
/// every 30 seconds while in foreground and on willEnterForeground.
///
/// Design choices:
/// - The outbox is the single source of truth for "what needs to
///   reach the server." Direct sync calls aren't allowed; everything
///   goes through `enqueue(...)`. This makes the sync layer fully
///   resumable across app kills.
/// - When `FF_BACKEND_SYNC` is off, `enqueue` still records rows
///   (cheap; lets us flip the flag on later without losing pre-flag
///   activity) but `flush` is a no-op.
/// - Failures bump retryCount; we never throw out a row from the
///   outbox in v1.0 (dead-letter handling is post-launch).
@MainActor
@Observable
public final class SyncService {
    public static let shared = SyncService()

    public private(set) var isFlushing: Bool = false
    public private(set) var lastFlushAt: Date?
    public private(set) var pendingCount: Int = 0

    nonisolated(unsafe) private var foregroundTimer: Timer?
    nonisolated(unsafe) private var foregroundObserver: NSObjectProtocol?

    private init() {}

    deinit {
        foregroundTimer?.invalidate()
        if let observer = foregroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    /// Wire up the 30-second timer + foreground observer. Idempotent.
    /// Called once from `SoloCompassApp.onAppear`.
    public func start() {
        guard foregroundTimer == nil else { return }
        foregroundTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            Task { @MainActor [weak self] in await self?.flush() }
        }
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil, queue: .main
        ) { _ in
            Task { @MainActor [weak self] in await self?.flush() }
        }
    }

    // MARK: - Enqueue

    /// Enqueue a payload for `tableName`. Caller is responsible for
    /// constructing a body the PostgREST endpoint understands. The
    /// payload is stored verbatim (no re-serialization on flush).
    public func enqueue(
        tableName: String,
        operation: String,
        payload: any Encodable,
        context: ModelContext
    ) {
        guard let data = try? JSONEncoder.iso8601Encoder.encode(AnyEncodable(payload)) else {
            return
        }
        context.insert(
            PendingSyncRecord(tableName: tableName, operation: operation, payloadJSON: data)
        )
        try? context.save()
        refreshCount(context: context)
    }

    // MARK: - Flush

    /// Drain the outbox. Returns the number of rows successfully
    /// sent + deleted. No-op when `FF_BACKEND_SYNC` is off.
    @discardableResult
    public func flush(context override: ModelContext? = nil) async -> Int {
        guard FeatureFlags.backendSync else { return 0 }
        guard !isFlushing else { return 0 }
        isFlushing = true
        defer { isFlushing = false; lastFlushAt = Date() }

        let context = override ?? ModelContext(SoloCompassModelContainer.shared)
        let descriptor = FetchDescriptor<PendingSyncRecord>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        guard let rows = try? context.fetch(descriptor), !rows.isEmpty else {
            refreshCount(context: context)
            return 0
        }

        var sent = 0
        for row in rows {
            let result: Result<Data, SupabaseClient.SupabaseError>
            switch row.operation {
            case "upsert":
                result = await SupabaseClient.shared.post(table: row.tableName, body: row.payloadJSON)
            default:
                row.retryCount += 1
                continue
            }
            switch result {
            case .success:
                context.delete(row)
                sent += 1
            case .failure:
                row.retryCount += 1
            }
        }
        try? context.save()
        refreshCount(context: context)
        return sent
    }

    private func refreshCount(context: ModelContext) {
        let count = (try? context.fetchCount(FetchDescriptor<PendingSyncRecord>())) ?? 0
        self.pendingCount = count
    }
}

// MARK: - AnyEncodable wrapper for heterogeneous payloads

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ value: any Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
