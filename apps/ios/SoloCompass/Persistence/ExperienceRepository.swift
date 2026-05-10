import Foundation
import CoreLocation
import SwiftData

/// SwiftData-backed CRUD for experiences and the user-action records that
/// orbit them. Owns the `ModelContext`; never lets a raw `ModelContext`
/// leak above (`ExperienceService` is the only caller, and it forwards a
/// thin facade upward).
///
/// `@MainActor` because SwiftData ModelContext is single-actor and the
/// rest of the iOS code is main-thread-bound anyway. Heavy queries can
/// later move to a background actor if profiling demands it.
@MainActor
public final class ExperienceRepository {
    private let context: ModelContext
    private let preferences: UserPreferences?

    public init(context: ModelContext, preferences: UserPreferences? = nil) {
        self.context = context
        self.preferences = preferences
    }

    /// Convenience init that grabs the main context from the shared
    /// container.
    public convenience init(preferences: UserPreferences? = nil) {
        self.init(context: ModelContext(SoloCompassModelContainer.shared), preferences: preferences)
    }

    // MARK: - Seed import

    /// On a first launch with empty store, decode the bundled JSON seed
    /// and insert each row. The flag lives on `UserPreferences` so we
    /// can opt out for tests by passing `preferences: nil`.
    @discardableResult
    public func importSeedIfNeeded() -> Int {
        if preferences?.seedImported == true { return 0 }

        let seed = Self.loadBundledSeed() ?? ExperienceService.hardcodedSeed
        let existingIds = Set(allRecords().map(\.id))
        var added = 0
        for exp in seed where !existingIds.contains(exp.id) {
            context.insert(ExperienceRecord(from: exp))
            added += 1
        }
        try? context.save()
        preferences?.seedImported = true
        return added
    }

    private static func loadBundledSeed() -> [Experience]? {
        guard let url = Bundle.main.url(forResource: "seed_experiences", withExtension: "json") else {
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder.iso8601Decoder.decode([Experience].self, from: data)
        } catch {
            #if DEBUG
            print("[ExperienceRepository] seed decode failed: \(error)")
            #endif
            return nil
        }
    }

    // MARK: - Experience CRUD

    public func allExperiences() -> [Experience] {
        allRecords().map(\.asValue)
    }

    public func experience(id: String) -> Experience? {
        let descriptor = FetchDescriptor<ExperienceRecord>(
            predicate: #Predicate { $0.id == id }
        )
        return (try? context.fetch(descriptor))?.first?.asValue
    }

    /// Spatial query within `radiusKm` of `coordinate`, sorted ascending
    /// by distance. We fetch all rows then filter in Swift — fine at
    /// v1.0 scale (< 1k experiences); promote to a SQL spatial query if
    /// the dataset grows past that.
    public func nearby(
        coordinate: CLLocationCoordinate2D,
        radiusKm: Double
    ) -> [Experience] {
        let here = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let radiusMeters = radiusKm * 1000
        return allRecords()
            .compactMap { record -> (Experience, Double)? in
                let there = CLLocation(latitude: record.latitude, longitude: record.longitude)
                let d = here.distance(from: there)
                guard d <= radiusMeters else { return nil }
                return (record.asValue, d)
            }
            .sorted { $0.1 < $1.1 }
            .map { $0.0 }
    }

    /// Idempotent merge — skip duplicates by id, return how many were
    /// freshly inserted.
    @discardableResult
    public func appendGenerated(_ experiences: [Experience]) -> Int {
        let existingIds = Set(allRecords().map(\.id))
        var added = 0
        for exp in experiences where !existingIds.contains(exp.id) {
            context.insert(ExperienceRecord(from: exp))
            added += 1
        }
        if added > 0 { try? context.save() }
        return added
    }

    /// Replace an existing record's mutable fields. Idempotent: if no
    /// matching record exists we silently skip.
    public func update(_ experience: Experience) {
        let id = experience.id
        let descriptor = FetchDescriptor<ExperienceRecord>(
            predicate: #Predicate { $0.id == id }
        )
        guard let record = (try? context.fetch(descriptor))?.first else { return }
        let fresh = ExperienceRecord(from: experience)
        record.title = fresh.title
        record.oneLiner = fresh.oneLiner
        record.whyItMatters = fresh.whyItMatters
        record.category = fresh.category
        record.longitude = fresh.longitude
        record.latitude = fresh.latitude
        record.cityCode = fresh.cityCode
        record.addressHint = fresh.addressHint
        record.placeNameLocal = fresh.placeNameLocal
        record.placeNameRomanized = fresh.placeNameRomanized
        record.durationMin = fresh.durationMin
        record.durationMax = fresh.durationMax
        record.status = fresh.status
        record.updatedAt = fresh.updatedAt
        record.bestTimesBlob = fresh.bestTimesBlob
        record.howToBlob = fresh.howToBlob
        record.realInconveniencesBlob = fresh.realInconveniencesBlob
        record.sourcesBlob = fresh.sourcesBlob
        record.soloScoreBlob = fresh.soloScoreBlob
        record.confidenceBlob = fresh.confidenceBlob
        record.statsBlob = fresh.statsBlob
        record.nearbyExperienceIdsBlob = fresh.nearbyExperienceIdsBlob
        try? context.save()
    }

    // MARK: - User-action records (US-009 wires UserPreferences to these)

    public func isCompleted(experienceId: String) -> Bool {
        let id = experienceId
        let descriptor = FetchDescriptor<UserCompletionRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        return ((try? context.fetchCount(descriptor)) ?? 0) > 0
    }

    public func recordCompletion(experienceId: String, at date: Date = Date()) {
        context.insert(UserCompletionRecord(experienceId: experienceId, completedAt: date))
        try? context.save()
        // Epic E US-029: queue an upsert to user_completions. The
        // outbox is durable; if FF_BACKEND_SYNC is off this still
        // records the row so we can flush historical data once the
        // flag flips on.
        if let userId = SupabaseClient.shared.currentSession?.userId {
            SyncService.shared.enqueue(
                tableName: "user_completions",
                operation: "upsert",
                payload: SyncCompletionPayload(
                    user_id: userId,
                    experience_id: experienceId,
                    completed_at: date
                ),
                context: context
            )
        }
    }

    public func completionCount(experienceId: String) -> Int {
        let id = experienceId
        let descriptor = FetchDescriptor<UserCompletionRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        return (try? context.fetchCount(descriptor)) ?? 0
    }

    public func isFavorited(experienceId: String) -> Bool {
        let id = experienceId
        let descriptor = FetchDescriptor<UserFavoriteRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        return ((try? context.fetchCount(descriptor)) ?? 0) > 0
    }

    /// Toggle favorite. Returns the new state (true = favorited).
    @discardableResult
    public func toggleFavorite(experienceId: String, at date: Date = Date()) -> Bool {
        let id = experienceId
        let descriptor = FetchDescriptor<UserFavoriteRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        let existing = (try? context.fetch(descriptor)) ?? []
        let nowFavorited: Bool
        if let row = existing.first {
            context.delete(row)
            try? context.save()
            nowFavorited = false
        } else {
            context.insert(UserFavoriteRecord(experienceId: experienceId, favoritedAt: date))
            try? context.save()
            nowFavorited = true
        }
        // Epic E US-029: queue the favorite mutation. We send an
        // upsert with a `removed_at` flag the server interprets as
        // tombstone vs active, so a single table handles both states.
        if let userId = SupabaseClient.shared.currentSession?.userId {
            SyncService.shared.enqueue(
                tableName: "user_favorites",
                operation: "upsert",
                payload: SyncFavoritePayload(
                    user_id: userId,
                    experience_id: experienceId,
                    favorited_at: nowFavorited ? date : nil
                ),
                context: context
            )
        }
        return nowFavorited
    }

    public func allFavorites() -> [String] {
        let descriptor = FetchDescriptor<UserFavoriteRecord>(
            sortBy: [SortDescriptor(\.favoritedAt, order: .reverse)]
        )
        return ((try? context.fetch(descriptor)) ?? []).map(\.experienceId)
    }

    public func allCompletions() -> [String] {
        let descriptor = FetchDescriptor<UserCompletionRecord>(
            sortBy: [SortDescriptor(\.completedAt, order: .reverse)]
        )
        return ((try? context.fetch(descriptor)) ?? []).map(\.experienceId)
    }

    // MARK: - Micro-survey writeback (Epic C US-020)

    /// Record one micro-survey row. Comfort/pressure/recommend are all
    /// independent dimensions; we don't pre-aggregate at write time so
    /// later changes to the formula don't require migrating rows.
    public func recordSurvey(
        experienceId: String,
        comfort: Int,
        pressure: Int,
        recommend: String,
        anonDeviceId: String,
        at date: Date = Date()
    ) {
        context.insert(
            MicroSurveyRecord(
                experienceId: experienceId,
                comfort: comfort,
                pressure: pressure,
                recommend: recommend,
                submittedAt: date,
                anonDeviceId: anonDeviceId
            )
        )
        try? context.save()
    }

    public func surveyCount(experienceId: String) -> Int {
        let id = experienceId
        let descriptor = FetchDescriptor<MicroSurveyRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        return (try? context.fetchCount(descriptor)) ?? 0
    }

    /// Aggregate the local survey signals into a Solo-Score-like value.
    /// Formula: localSurveyMean = mean of (comfort + pressure) / 2, on a
    /// 0–10 scale (raw 1–5 doubled). recommendBoost = +0.5 when ≥ 50 %
    /// of recommendations are "yes". Final = clamp(0...10, original/2 +
    /// localSurveyMean/2 + recommendBoost). Returns `nil` if no surveys
    /// exist (caller falls back to the seed/AI score). Cached for 60 s
    /// per experience id to avoid recomputing on every render.
    public func aggregatedSoloScore(
        experienceId: String,
        seedOverall: Double
    ) -> (overall: Double, count: Int)? {
        if let cached = aggregatedScoreCache[experienceId],
           Date().timeIntervalSince(cached.cachedAt) < 60 {
            return (cached.overall, cached.count)
        }
        let id = experienceId
        let descriptor = FetchDescriptor<MicroSurveyRecord>(
            predicate: #Predicate { $0.experienceId == id }
        )
        guard let surveys = try? context.fetch(descriptor), !surveys.isEmpty else {
            return nil
        }
        let comfortAvg = Double(surveys.map(\.comfort).reduce(0, +)) / Double(surveys.count)
        let pressureAvg = Double(surveys.map(\.pressure).reduce(0, +)) / Double(surveys.count)
        // 1–5 → 0–10 scale: ((comfort + pressure) / 2) * 2
        let localOnTen = ((comfortAvg + pressureAvg) / 2.0) * 2.0
        let yesCount = surveys.filter { $0.recommend == "yes" }.count
        let recommendBoost = (Double(yesCount) / Double(surveys.count)) >= 0.5 ? 0.5 : 0.0
        let blended = (seedOverall * 0.5 + localOnTen * 0.5) + recommendBoost
        let clamped = max(0.0, min(10.0, blended))
        aggregatedScoreCache[experienceId] = (clamped, surveys.count, Date())
        return (clamped, surveys.count)
    }

    /// 60-second per-experience cache for aggregatedSoloScore. Cleared
    /// on app foreground (caller responsibility) so a freshly synced
    /// signal lights up.
    private var aggregatedScoreCache: [String: (overall: Double, count: Int, cachedAt: Date)] = [:]

    // MARK: - Discovered cities (Epic C US-016/017)

    /// Upsert a discovered city. Idempotent by `cityCode`.
    public func recordDiscoveredCity(
        cityCode: String,
        name: String,
        countryCode: String,
        center: (lat: Double, lon: Double)
    ) {
        let descriptor = FetchDescriptor<DiscoveredCityRecord>(
            predicate: #Predicate { $0.cityCode == cityCode }
        )
        if let existing = (try? context.fetch(descriptor))?.first {
            // Refresh fields if metadata changed (e.g. localized name in
            // a new locale).
            existing.name = name
            existing.countryCode = countryCode
            existing.centerLat = center.lat
            existing.centerLon = center.lon
            try? context.save()
            return
        }
        context.insert(
            DiscoveredCityRecord(
                cityCode: cityCode,
                name: name,
                countryCode: countryCode,
                centerLat: center.lat,
                centerLon: center.lon
            )
        )
        try? context.save()
    }

    public func allDiscoveredCities() -> [DiscoveredCityRecord] {
        let descriptor = FetchDescriptor<DiscoveredCityRecord>(
            sortBy: [SortDescriptor(\.discoveredAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Bulk operations

    /// Wipe every user-data row. Does NOT delete experiences (they reseed
    /// from bundle). Used by GDPR delete and the Settings reset.
    public func clearUserData() {
        try? context.delete(model: UserCompletionRecord.self)
        try? context.delete(model: UserFavoriteRecord.self)
        try? context.delete(model: MicroSurveyRecord.self)
        try? context.delete(model: PendingCheckInRecord.self)
        try? context.save()
    }

    // MARK: - Internals

    private func allRecords() -> [ExperienceRecord] {
        let descriptor = FetchDescriptor<ExperienceRecord>()
        return (try? context.fetch(descriptor)) ?? []
    }
}

// MARK: - Sync payloads (Epic E US-029)

/// Sent to Supabase `user_completions` table on every completion mutation.
/// snake_case field names match the Postgres column names exactly so the
/// JSON body serializes 1:1 with no remap.
struct SyncCompletionPayload: Encodable {
    let user_id: String
    let experience_id: String
    let completed_at: Date
}

/// Sent to Supabase `user_favorites`. `favorited_at` is nil when the row
/// represents an unfavorite (the server's RLS + check constraint allow
/// the null + we treat null as tombstone in nightly cleanup).
struct SyncFavoritePayload: Encodable {
    let user_id: String
    let experience_id: String
    let favorited_at: Date?
}
