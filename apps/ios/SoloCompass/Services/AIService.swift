import Foundation
import CoreLocation
import Observation

/// Talks to Claude via the Anthropic Messages API. Reads the API key from
/// `Secrets.plist` (key `ANTHROPIC_API_KEY`) or the `ANTHROPIC_API_KEY` env var.
/// If neither is present, calls return a fallback that ranks by Solo Score.
///
/// We keep this surface minimal — three intents the rest of the app actually
/// needs. Adding more should require a real product reason.
@Observable
public final class AIService {
    public struct UserContext {
        public let location: CLLocationCoordinate2D?
        public let date: Date
        public let style: UserPreferences.SoloTravelStyle
        public let preferredCategories: [ExperienceCategory]
        public let dislikedCategories: [ExperienceCategory]

        public init(
            location: CLLocationCoordinate2D?,
            date: Date,
            style: UserPreferences.SoloTravelStyle,
            preferredCategories: [ExperienceCategory],
            dislikedCategories: [ExperienceCategory]
        ) {
            self.location = location
            self.date = date
            self.style = style
            self.preferredCategories = preferredCategories
            self.dislikedCategories = dislikedCategories
        }
    }

    public struct AIResponse: Codable, Hashable {
        public let recommendedIds: [String]
        public let explanation: String
        public let filterSuggestion: ExperienceCategory?

        public init(recommendedIds: [String], explanation: String, filterSuggestion: ExperienceCategory? = nil) {
            self.recommendedIds = recommendedIds
            self.explanation = explanation
            self.filterSuggestion = filterSuggestion
        }
    }

    public enum AIError: Error, LocalizedError {
        case missingAPIKey
        case requestFailed(status: Int, body: String)
        case decodingFailed(String)

        public var errorDescription: String? {
            switch self {
            case .missingAPIKey:
                return NSLocalizedString("ai.error.missingKey", comment: "Missing API key")
            case .requestFailed(let status, _):
                return String(format: NSLocalizedString("ai.error.request", comment: "Request failed status %d"), status)
            case .decodingFailed(let msg):
                return msg
            }
        }
    }

    public private(set) var isProcessing: Bool = false
    public private(set) var lastError: Error?

    private let session: URLSession
    private let apiURL = URL(string: "https://api.anthropic.com/v1/messages")
    private let model = "claude-opus-4-7"

    public init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Public

    public func recommendExperiences(
        from candidates: [Experience],
        context: UserContext
    ) async throws -> [String] {
        let prompt = Self.recommendationPrompt(candidates: candidates, context: context)
        do {
            let raw = try await sendMessage(prompt: prompt)
            return Self.parseIDList(raw, validIDs: Set(candidates.map(\.id)))
        } catch AIError.missingAPIKey {
            // Local fallback: rank by solo score, then by best-now boost.
            return candidates
                .sorted { lhs, rhs in
                    let lScore = lhs.soloScore.overall + (lhs.isBestNow(at: context.date) ? 2 : 0)
                    let rScore = rhs.soloScore.overall + (rhs.isBestNow(at: context.date) ? 2 : 0)
                    return lScore > rScore
                }
                .prefix(5)
                .map(\.id)
        }
    }

    public func explainRecommendation(for experienceId: String) async throws -> String {
        let prompt = """
        Explain in one warm, concrete sentence why a solo traveler would value the experience with id \"\(experienceId)\". \
        Avoid superlatives. Focus on a sensory detail.
        """
        do {
            return try await sendMessage(prompt: prompt)
        } catch AIError.missingAPIKey {
            return NSLocalizedString("ai.fallback.explanation", comment: "Default AI explanation")
        }
    }

    public func processVoiceIntent(transcript: String, near coordinate: CLLocationCoordinate2D) async throws -> AIResponse {
        let prompt = """
        A solo traveler said: \"\(transcript)\".
        Their current coordinates are \(coordinate.latitude), \(coordinate.longitude).
        Respond as JSON: {"recommendedIds":[],"explanation":"...","filterSuggestion":"culture|nature|food|coffee|work|wellness|nightlife|hidden|null"}
        """
        do {
            let raw = try await sendMessage(prompt: prompt)
            return try Self.parseAIResponse(raw)
        } catch AIError.missingAPIKey {
            return AIResponse(
                recommendedIds: [],
                explanation: NSLocalizedString("ai.fallback.voice", comment: "Voice fallback"),
                filterSuggestion: nil
            )
        }
    }

    // MARK: - HTTP

    private func sendMessage(prompt: String) async throws -> String {
        guard let key = Self.resolveAPIKey() else { throw AIError.missingAPIKey }
        guard let apiURL else { throw AIError.requestFailed(status: 0, body: "bad URL") }

        await MainActor.run { self.isProcessing = true }
        defer { Task { @MainActor [weak self] in self?.isProcessing = false } }

        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 1024,
            "messages": [["role": "user", "content": prompt]],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AIError.requestFailed(status: 0, body: "no response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let bodyText = String(data: data, encoding: .utf8) ?? ""
            throw AIError.requestFailed(status: http.statusCode, body: bodyText)
        }

        // Anthropic Messages API: content is an array of blocks; we want the
        // first text block.
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let first = content.first,
            let text = first["text"] as? String
        else {
            throw AIError.decodingFailed("Unexpected response shape")
        }
        return text
    }

    // MARK: - Helpers

    private static func resolveAPIKey() -> String? {
        if let env = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"], !env.isEmpty {
            return env
        }
        guard let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist") else {
            return nil
        }
        do {
            let data = try Data(contentsOf: url)
            guard let plist = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else {
                #if DEBUG
                print("[AIService] Secrets.plist is not a [String: Any] dictionary")
                #endif
                return nil
            }
            guard let key = plist["ANTHROPIC_API_KEY"] as? String, !key.isEmpty else {
                #if DEBUG
                print("[AIService] ANTHROPIC_API_KEY missing or empty in Secrets.plist")
                #endif
                return nil
            }
            return key
        } catch {
            #if DEBUG
            print("[AIService] Failed to read Secrets.plist: \(error)")
            #endif
            return nil
        }
    }

    private static func recommendationPrompt(candidates: [Experience], context: UserContext) -> String {
        let candidateLines = candidates.map { exp in
            "- \(exp.id): \(exp.title) [\(exp.category.rawValue), solo=\(String(format: "%.1f", exp.soloScore.overall))]"
        }.joined(separator: "\n")
        let preferred = context.preferredCategories.map(\.rawValue).joined(separator: ",")
        let disliked = context.dislikedCategories.map(\.rawValue).joined(separator: ",")
        let coords = context.location.map { "\($0.latitude),\($0.longitude)" } ?? "unknown"
        return """
        You are ranking experiences for a solo traveler. Return up to 5 ids, one per line, in priority order. No prose.

        Time: \(context.date.ISO8601Format())
        Location: \(coords)
        Style: \(context.style.rawValue)
        Preferred: [\(preferred)]
        Disliked: [\(disliked)]

        Candidates:
        \(candidateLines)
        """
    }

    private static func parseIDList(_ raw: String, validIDs: Set<String>) -> [String] {
        raw.split(whereSeparator: { $0.isNewline })
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .compactMap { line -> String? in
                // Strip leading bullet/number/dash.
                let trimmed = line.drop(while: { !$0.isLetter })
                let candidate = String(trimmed)
                return candidate.isEmpty ? nil : candidate
            }
            .filter { validIDs.contains($0) }
    }

    private static func parseAIResponse(_ raw: String) throws -> AIResponse {
        // Find first {...} block.
        guard
            let start = raw.firstIndex(of: "{"),
            let end = raw.lastIndex(of: "}"),
            start <= end
        else { throw AIError.decodingFailed("no JSON in response") }
        let jsonText = String(raw[start...end])
        guard let data = jsonText.data(using: .utf8) else {
            throw AIError.decodingFailed("invalid utf8")
        }
        return try JSONDecoder().decode(AIResponse.self, from: data)
    }

    // MARK: - Synthesize from OSM POIs (Explore Here)

    /// Maximum POIs sent to the model in one call. Keeps prompt size and cost
    /// predictable, and matches the product cap of 15 generated experiences.
    public static let synthesisLimit = 15

    /// Convert a batch of OSM POIs into Experiences. Sends a single Claude
    /// request that returns a JSON array of experiences. Falls back to a
    /// skeleton derived from OSM tags when the API key is missing or the
    /// request fails — so users without an API key still get pins on the map.
    public func synthesizeExperiences(
        from pois: [OverpassService.POI],
        cityCode: String,
        locale: Locale = .current
    ) async throws -> [Experience] {
        let capped = Array(pois.prefix(Self.synthesisLimit))
        guard !capped.isEmpty else { return [] }

        let prompt = Self.synthesisPrompt(pois: capped, cityCode: cityCode, locale: locale)
        do {
            let raw = try await sendMessage(prompt: prompt)
            return try Self.parseSynthesizedExperiences(raw, pois: capped, cityCode: cityCode)
        } catch {
            return capped.map { Self.skeletonExperience(from: $0, cityCode: cityCode) }
        }
    }

    // MARK: - Synthesize helpers

    private static func synthesisPrompt(pois: [OverpassService.POI], cityCode: String, locale: Locale) -> String {
        let langTag = locale.language.languageCode?.identifier ?? "en"
        let lines = pois.map { poi -> String in
            let displayName = poi.nameEn ?? poi.name
            let tagSummary = poi.tags
                .filter { ["amenity", "tourism", "leisure", "natural", "shop", "cuisine", "opening_hours"].contains($0.key) }
                .map { "\($0.key)=\($0.value)" }
                .sorted()
                .joined(separator: ", ")
            return "- osmId=\(poi.osmId) name=\"\(poi.name)\" nameEn=\"\(displayName)\" lat=\(poi.lat) lon=\(poi.lon) tags=[\(tagSummary)]"
        }.joined(separator: "\n")

        return """
        You are writing solo-traveler-focused entries for real places sourced from OpenStreetMap.

        For each POI below, return ONE JSON object with these fields and nothing else:
        {
          "osmId": <int>,
          "title": "<action-oriented sensory line, less than 14 words>",
          "oneLiner": "<one concrete detail, less than 25 words>",
          "whyItMatters": "<2-3 sentences for someone alone>",
          "category": "food|coffee|culture|nature|work|wellness|nightlife|hidden",
          "bestStartHour": <0-23>,
          "bestEndHour": <0-23>,
          "durationMinMinutes": <int>,
          "durationMaxMinutes": <int>,
          "howTo": ["step 1", "step 2", "step 3"],
          "soloHint": "<one short hint for solo visitors>",
          "soloOverall": <number 6.0-9.5>
        }

        Output a JSON array containing one object per POI, in input order. No prose. No markdown fences.

        Output language: \(langTag).
        City code: \(cityCode).

        POIs:
        \(lines)
        """
    }

    private static func parseSynthesizedExperiences(
        _ raw: String,
        pois: [OverpassService.POI],
        cityCode: String
    ) throws -> [Experience] {
        guard
            let start = raw.firstIndex(of: "["),
            let end = raw.lastIndex(of: "]"),
            start <= end,
            let data = String(raw[start...end]).data(using: .utf8)
        else {
            throw AIError.decodingFailed("no JSON array in synthesis response")
        }

        struct Item: Decodable {
            let osmId: Int64
            let title: String
            let oneLiner: String
            let whyItMatters: String
            let category: String
            let bestStartHour: Int?
            let bestEndHour: Int?
            let durationMinMinutes: Int?
            let durationMaxMinutes: Int?
            let howTo: [String]?
            let soloHint: String?
            let soloOverall: Double?
        }
        let items = try JSONDecoder().decode([Item].self, from: data)
        let poiById = Dictionary(uniqueKeysWithValues: pois.map { ($0.osmId, $0) })
        let now = Date()

        return items.compactMap { item in
            guard let poi = poiById[item.osmId] else { return nil }
            let category = ExperienceCategory(rawValue: item.category) ?? OverpassService.category(for: poi.tags)
            let startHour = item.bestStartHour.map { max(0, min(23, $0)) } ?? 9
            let endHour = item.bestEndHour.map { max(0, min(23, $0)) } ?? 21
            let dMin = item.durationMinMinutes ?? 30
            let dMax = max(dMin, item.durationMaxMinutes ?? 90)
            let overall = max(6.0, min(9.5, item.soloOverall ?? 7.0))
            let breakdown = SoloScore.Breakdown(
                seatingFriendly: overall, soloPatronRatio: overall, staffPressure: overall,
                soloPortioning: overall, ambianceFit: overall, safety: overall
            )
            let howTo = (item.howTo ?? []).enumerated().map { HowToStep(order: $0.offset + 1, text: $0.element) }
            return Experience(
                id: "exp_osm_\(poi.osmId)",
                title: item.title,
                oneLiner: item.oneLiner,
                whyItMatters: item.whyItMatters,
                category: category,
                location: ExperienceLocation(
                    coordinates: [poi.lon, poi.lat],
                    cityCode: cityCode,
                    addressHint: nil,
                    placeNameLocal: poi.name,
                    placeNameRomanized: poi.nameEn
                ),
                bestTimes: [TimeWindow(startHour: startHour, endHour: endHour)],
                durationMinutes: .init(min: dMin, max: dMax),
                howTo: howTo,
                realInconveniences: [],
                soloScore: SoloScore(overall: overall, breakdown: breakdown, hint: item.soloHint, basedOnCount: 0),
                sources: [
                    InformationSource(
                        type: .user,
                        url: URL(string: "https://www.openstreetmap.org/node/\(poi.osmId)"),
                        attribution: "© OpenStreetMap contributors + AI",
                        verifiedAt: now
                    )
                ],
                confidence: Confidence(
                    level: 1,
                    lastVerifiedAt: now,
                    reason: "AI-synthesized from OpenStreetMap, unverified",
                    signals: .init(aiScrapeAgeDays: 0, passiveGpsHits30d: 0, activeReports30d: 0, trustedVerifications: 0)
                ),
                nearbyExperienceIds: [],
                stats: .init(completionCount: 0, averageRating: 0),
                status: .candidate,
                createdAt: now,
                updatedAt: now
            )
        }
    }

    /// Build a minimal Experience from raw OSM data, used when AI is unavailable.
    /// Preserves coordinate + name + category; everything else is conservative defaults.
    static func skeletonExperience(from poi: OverpassService.POI, cityCode: String) -> Experience {
        let now = Date()
        let category = OverpassService.category(for: poi.tags)
        let displayName = poi.nameEn ?? poi.name
        let breakdown = SoloScore.Breakdown(
            seatingFriendly: 7, soloPatronRatio: 7, staffPressure: 7,
            soloPortioning: 7, ambianceFit: 7, safety: 7
        )
        return Experience(
            id: "exp_osm_\(poi.osmId)",
            title: displayName,
            oneLiner: NSLocalizedString("explore.skeleton.oneLiner", comment: "Generic OSM POI tagline"),
            whyItMatters: NSLocalizedString("explore.skeleton.why", comment: "Generic OSM POI rationale"),
            category: category,
            location: ExperienceLocation(
                coordinates: [poi.lon, poi.lat],
                cityCode: cityCode,
                addressHint: nil,
                placeNameLocal: poi.name,
                placeNameRomanized: poi.nameEn
            ),
            bestTimes: [TimeWindow(startHour: 9, endHour: 21)],
            durationMinutes: .init(min: 30, max: 90),
            howTo: [],
            realInconveniences: [],
            soloScore: SoloScore(overall: 7.0, breakdown: breakdown, hint: nil, basedOnCount: 0),
            sources: [
                InformationSource(
                    type: .user,
                    url: URL(string: "https://www.openstreetmap.org/node/\(poi.osmId)"),
                    attribution: "© OpenStreetMap contributors",
                    verifiedAt: now
                )
            ],
            confidence: Confidence(
                level: 1,
                lastVerifiedAt: now,
                reason: "OpenStreetMap entry, no AI enrichment",
                signals: .init(aiScrapeAgeDays: 0, passiveGpsHits30d: 0, activeReports30d: 0, trustedVerifications: 0)
            ),
            nearbyExperienceIds: [],
            stats: .init(completionCount: 0, averageRating: 0),
            status: .candidate,
            createdAt: now,
            updatedAt: now
        )
    }
}
