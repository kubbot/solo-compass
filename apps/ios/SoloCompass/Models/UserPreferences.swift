import Foundation
import Observation

/// User preferences persisted to UserDefaults.
///
/// Designed as a single Codable blob — small, atomic writes; easy to migrate.
/// We store under a single key (`UserPreferences.storageKey`) and re-encode on
/// every mutation. With <100 entries this stays well under the 4MB practical
/// limit on UserDefaults.
@Observable
public final class UserPreferences {
    public enum SoloTravelStyle: String, Codable, CaseIterable, Identifiable {
        case explorer, worker, foodie, cultureSeeker
        public var id: String { rawValue }
    }

    /// Snapshot used for Codable persistence. Mirrors the @Observable surface.
    private struct Snapshot: Codable {
        var preferredCategories: [ExperienceCategory] = []
        var dislikedCategories: [ExperienceCategory] = []
        var soloTravelStyle: SoloTravelStyle = .explorer
        var maxDistanceKm: Double = 5.0
        var visitHistory: [String: Date] = [:]
        var completedExperiences: Set<String> = []
        var favoritedExperiences: Set<String> = []
        var favoritedAt: [String: Date] = [:]
        var pendingCheckIns: [String: Date] = [:]
        var lastSelectedCity: String? = nil
        var hasCompletedOnboarding: Bool = false
        var notificationsEnabled: Bool = false
        var quietHoursStart: Int = 22
        var quietHoursEnd: Int = 8

        enum CodingKeys: String, CodingKey {
            case preferredCategories, dislikedCategories, soloTravelStyle, maxDistanceKm
            case visitHistory, completedExperiences, favoritedExperiences, favoritedAt, pendingCheckIns
            case lastSelectedCity, hasCompletedOnboarding, notificationsEnabled
            case quietHoursStart, quietHoursEnd
        }

        init() {}

        init(
            preferredCategories: [ExperienceCategory],
            dislikedCategories: [ExperienceCategory],
            soloTravelStyle: SoloTravelStyle,
            maxDistanceKm: Double,
            visitHistory: [String: Date],
            completedExperiences: Set<String>,
            favoritedExperiences: Set<String>,
            favoritedAt: [String: Date],
            pendingCheckIns: [String: Date],
            lastSelectedCity: String?,
            hasCompletedOnboarding: Bool,
            notificationsEnabled: Bool,
            quietHoursStart: Int,
            quietHoursEnd: Int
        ) {
            self.preferredCategories = preferredCategories
            self.dislikedCategories = dislikedCategories
            self.soloTravelStyle = soloTravelStyle
            self.maxDistanceKm = maxDistanceKm
            self.visitHistory = visitHistory
            self.completedExperiences = completedExperiences
            self.favoritedExperiences = favoritedExperiences
            self.favoritedAt = favoritedAt
            self.pendingCheckIns = pendingCheckIns
            self.lastSelectedCity = lastSelectedCity
            self.hasCompletedOnboarding = hasCompletedOnboarding
            self.notificationsEnabled = notificationsEnabled
            self.quietHoursStart = quietHoursStart
            self.quietHoursEnd = quietHoursEnd
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.preferredCategories = try c.decodeIfPresent([ExperienceCategory].self, forKey: .preferredCategories) ?? []
            self.dislikedCategories = try c.decodeIfPresent([ExperienceCategory].self, forKey: .dislikedCategories) ?? []
            self.soloTravelStyle = try c.decodeIfPresent(SoloTravelStyle.self, forKey: .soloTravelStyle) ?? .explorer
            self.maxDistanceKm = try c.decodeIfPresent(Double.self, forKey: .maxDistanceKm) ?? 5.0
            self.visitHistory = try c.decodeIfPresent([String: Date].self, forKey: .visitHistory) ?? [:]
            self.completedExperiences = try c.decodeIfPresent(Set<String>.self, forKey: .completedExperiences) ?? []
            self.favoritedExperiences = try c.decodeIfPresent(Set<String>.self, forKey: .favoritedExperiences) ?? []
            self.favoritedAt = try c.decodeIfPresent([String: Date].self, forKey: .favoritedAt) ?? [:]
            self.pendingCheckIns = try c.decodeIfPresent([String: Date].self, forKey: .pendingCheckIns) ?? [:]
            self.lastSelectedCity = try c.decodeIfPresent(String.self, forKey: .lastSelectedCity)
            self.hasCompletedOnboarding = try c.decodeIfPresent(Bool.self, forKey: .hasCompletedOnboarding) ?? false
            self.notificationsEnabled = try c.decodeIfPresent(Bool.self, forKey: .notificationsEnabled) ?? false
            self.quietHoursStart = try c.decodeIfPresent(Int.self, forKey: .quietHoursStart) ?? 22
            self.quietHoursEnd = try c.decodeIfPresent(Int.self, forKey: .quietHoursEnd) ?? 8
        }
    }

    public var preferredCategories: [ExperienceCategory] { didSet { persist() } }
    public var dislikedCategories: [ExperienceCategory] { didSet { persist() } }
    public var soloTravelStyle: SoloTravelStyle { didSet { persist() } }
    public var maxDistanceKm: Double { didSet { persist() } }
    public var visitHistory: [String: Date] { didSet { persist() } }
    public var completedExperiences: Set<String> { didSet { persist() } }
    public var favoritedExperiences: Set<String> { didSet { persist() } }
    public var favoritedAt: [String: Date] { didSet { persist() } }
    public var pendingCheckIns: [String: Date] { didSet { persist() } }
    public var lastSelectedCity: String? { didSet { persist() } }
    public var hasCompletedOnboarding: Bool { didSet { persist() } }
    public var notificationsEnabled: Bool { didSet { persist() } }
    public var quietHoursStart: Int { didSet { persist() } }
    public var quietHoursEnd: Int { didSet { persist() } }

    private static let storageKey = "com.solocompass.userPreferences.v1"
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let snapshot = Self.load(from: defaults)
        self.preferredCategories = snapshot.preferredCategories
        self.dislikedCategories = snapshot.dislikedCategories
        self.soloTravelStyle = snapshot.soloTravelStyle
        self.maxDistanceKm = snapshot.maxDistanceKm
        self.visitHistory = snapshot.visitHistory
        self.completedExperiences = snapshot.completedExperiences
        self.favoritedExperiences = snapshot.favoritedExperiences
        self.favoritedAt = snapshot.favoritedAt
        self.pendingCheckIns = snapshot.pendingCheckIns
        self.lastSelectedCity = snapshot.lastSelectedCity
        self.hasCompletedOnboarding = snapshot.hasCompletedOnboarding
        self.notificationsEnabled = snapshot.notificationsEnabled
        self.quietHoursStart = snapshot.quietHoursStart
        self.quietHoursEnd = snapshot.quietHoursEnd
    }

    private static func load(from defaults: UserDefaults) -> Snapshot {
        guard let data = defaults.data(forKey: storageKey) else { return Snapshot() }
        do {
            return try JSONDecoder.iso8601Decoder.decode(Snapshot.self, from: data)
        } catch {
            #if DEBUG
            print("[UserPreferences] decode error — returning defaults. error=\(error)")
            #endif
            return Snapshot()
        }
    }

    private func persist() {
        let snapshot = Snapshot(
            preferredCategories: preferredCategories,
            dislikedCategories: dislikedCategories,
            soloTravelStyle: soloTravelStyle,
            maxDistanceKm: maxDistanceKm,
            visitHistory: visitHistory,
            completedExperiences: completedExperiences,
            favoritedExperiences: favoritedExperiences,
            favoritedAt: favoritedAt,
            pendingCheckIns: pendingCheckIns,
            lastSelectedCity: lastSelectedCity,
            hasCompletedOnboarding: hasCompletedOnboarding,
            notificationsEnabled: notificationsEnabled,
            quietHoursStart: quietHoursStart,
            quietHoursEnd: quietHoursEnd
        )
        do {
            let data = try JSONEncoder.iso8601Encoder.encode(snapshot)
            defaults.set(data, forKey: Self.storageKey)
        } catch {
            #if DEBUG
            print("[UserPreferences] encode error: \(error)")
            #endif
        }
    }

    // MARK: - Convenience mutations

    public func markCompleted(_ id: String, at date: Date = Date()) {
        completedExperiences.insert(id)
        visitHistory[id] = date
    }

    public func toggleFavorite(_ id: String, at date: Date = Date()) {
        if favoritedExperiences.contains(id) {
            favoritedExperiences.remove(id)
            favoritedAt.removeValue(forKey: id)
        } else {
            favoritedExperiences.insert(id)
            favoritedAt[id] = date
        }
    }

    public func completeOnboarding() {
        hasCompletedOnboarding = true
    }

    /// Auto-clear pending check-ins older than 7 days.
    public func pruneStaleCheckIns(olderThan days: Int = 7) {
        let cutoff = Date().addingTimeInterval(Double(-days) * 86_400)
        for (id, date) in pendingCheckIns where date < cutoff {
            pendingCheckIns.removeValue(forKey: id)
        }
    }

    /// True if current hour is inside the quiet-hours window.
    public var isQuietHours: Bool {
        let hour = Calendar.current.component(.hour, from: Date())
        if quietHoursStart > quietHoursEnd {
            return hour >= quietHoursStart || hour < quietHoursEnd
        } else {
            return hour >= quietHoursStart && hour < quietHoursEnd
        }
    }

    public func isFavorited(_ id: String) -> Bool { favoritedExperiences.contains(id) }
    public func isCompleted(_ id: String) -> Bool { completedExperiences.contains(id) }

    public func recordPendingCheckIn(_ id: String, at date: Date = Date()) {
        pendingCheckIns[id] = date
    }

    public func clearPendingCheckIn(_ id: String) {
        pendingCheckIns.removeValue(forKey: id)
    }
}

// MARK: - JSON helpers (shared, ISO8601 dates)

extension JSONDecoder {
    static let iso8601Decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

extension JSONEncoder {
    static let iso8601Encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
