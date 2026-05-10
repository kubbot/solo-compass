import Foundation
import SwiftData

/// Outbox row for the SyncService (Epic E US-029). Every local
/// mutation that needs to reach Supabase is enqueued as one of these;
/// `SyncService.flush()` drains them in createdAt order.
///
/// `payloadJSON` is the body of the upsert (or delete query params,
/// depending on `operation`). Storing the body verbatim means the
/// outbox survives changes to upstream model shapes — replay just
/// re-sends what was queued.
@Model
public final class PendingSyncRecord {
    @Attribute(.unique) public var id: UUID
    public var tableName: String
    /// "upsert" or "delete". Service uses Supabase Prefer:
    /// resolution=merge-duplicates for upsert idempotency.
    public var operation: String
    public var payloadJSON: Data
    public var createdAt: Date
    /// Bumped on every flush attempt so we can backoff/dead-letter
    /// later if a row stays stuck.
    public var retryCount: Int

    public init(
        id: UUID = UUID(),
        tableName: String,
        operation: String,
        payloadJSON: Data,
        createdAt: Date = Date(),
        retryCount: Int = 0
    ) {
        self.id = id
        self.tableName = tableName
        self.operation = operation
        self.payloadJSON = payloadJSON
        self.createdAt = createdAt
        self.retryCount = retryCount
    }
}
