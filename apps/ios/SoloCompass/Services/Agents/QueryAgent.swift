import Foundation
import CoreLocation

// MARK: - ExperienceFilter

/// Structured filter extracted from natural language by QueryAgent.
public struct ExperienceFilter: Sendable, Equatable {
    public let category: String?
    public let maxDistanceMeters: Double?
    public let openNow: Bool
    public let soloScoreMin: Double?

    public init(
        category: String? = nil,
        maxDistanceMeters: Double? = nil,
        openNow: Bool = false,
        soloScoreMin: Double? = nil
    ) {
        self.category = category
        self.maxDistanceMeters = maxDistanceMeters
        self.openNow = openNow
        self.soloScoreMin = soloScoreMin
    }
}

// MARK: - QueryAgent

/// Translates natural-language queries into structured ExperienceFilter using
/// Claude function-calling. Falls back to keyword matching when LLM is unavailable.
public final class QueryAgent: Agent, @unchecked Sendable {

    private let session: URLSession
    private let apiKey: String?
    private let apiURL: URL?
    private let modelName: String

    public init(
        session: URLSession = .shared,
        apiKey: String? = nil,
        apiURL: URL? = nil,
        modelName: String = "claude-opus-4-7"
    ) {
        self.session = session
        self.apiKey = apiKey ?? ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"]
        self.apiURL = apiURL ?? URL(string: "https://api.anthropic.com/v1/messages")
        self.modelName = modelName
    }

    // MARK: - Agent

    public func handle(_ message: AgentMessage) async throws -> AgentResponse {
        let filter = try await extractFilter(from: message.text)
        var meta: [String: String] = [:]
        if let cat = filter.category { meta["category"] = cat }
        if let dist = filter.maxDistanceMeters { meta["maxDistanceMeters"] = String(dist) }
        meta["openNow"] = filter.openNow ? "true" : "false"
        if let score = filter.soloScoreMin { meta["soloScoreMin"] = String(score) }
        return AgentResponse(text: nil, metadata: meta)
    }

    // MARK: - Filter Extraction

    public func extractFilter(from text: String) async throws -> ExperienceFilter {
        guard let key = apiKey, let url = apiURL else {
            return keywordFilter(text)
        }
        do {
            return try await remoteExtract(text, key: key, url: url)
        } catch {
            return keywordFilter(text)
        }
    }

    // MARK: - Remote (Claude function-calling)

    private func remoteExtract(_ text: String, key: String, url: URL) async throws -> ExperienceFilter {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.timeoutInterval = 15

        let tool: [String: Any] = [
            "name": "extract_experience_filter",
            "description": "Extract structured search filters from a natural language query about places or experiences.",
            "input_schema": [
                "type": "object",
                "properties": [
                    "category": [
                        "type": "string",
                        "enum": ["culture", "nature", "food", "coffee", "work", "wellness", "nightlife", "hidden"],
                        "description": "Category of place the user is looking for"
                    ],
                    "max_distance_m": [
                        "type": "number",
                        "description": "Maximum search radius in meters"
                    ],
                    "open_now": [
                        "type": "boolean",
                        "description": "Whether to filter for places open right now"
                    ],
                    "solo_score_min": [
                        "type": "number",
                        "description": "Minimum solo-traveler score (0-10)"
                    ]
                ]
            ] as [String: Any]
        ]

        let body: [String: Any] = [
            "model": modelName,
            "max_tokens": 256,
            "temperature": 0,
            "tools": [tool],
            "tool_choice": ["type": "auto"],
            "messages": [["role": "user", "content": "Extract search filters from: \"\(text)\""]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return keywordFilter(text)
        }
        return parseToolResponse(data) ?? keywordFilter(text)
    }

    private func parseToolResponse(_ data: Data) -> ExperienceFilter? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let toolUse = content.first(where: { $0["type"] as? String == "tool_use" }),
            let input = toolUse["input"] as? [String: Any]
        else { return nil }

        return ExperienceFilter(
            category: input["category"] as? String,
            maxDistanceMeters: input["max_distance_m"] as? Double,
            openNow: (input["open_now"] as? Bool) ?? false,
            soloScoreMin: input["solo_score_min"] as? Double
        )
    }

    // MARK: - Keyword fallback

    private func keywordFilter(_ text: String) -> ExperienceFilter {
        let lower = text.lowercased()

        var category: String?
        let categoryMap: [(String, String)] = [
            ("cafe", "coffee"), ("coffee", "coffee"), ("work", "work"),
            ("food", "food"), ("eat", "food"), ("restaurant", "food"),
            ("culture", "culture"), ("museum", "culture"), ("temple", "culture"),
            ("nature", "nature"), ("park", "nature"), ("hike", "nature"),
            ("wellness", "wellness"), ("spa", "wellness"), ("yoga", "wellness"),
            ("nightlife", "nightlife"), ("bar", "nightlife"), ("club", "nightlife"),
            ("hidden", "hidden"), ("secret", "hidden")
        ]
        for (keyword, cat) in categoryMap {
            if lower.contains(keyword) { category = cat; break }
        }

        let openNow = lower.contains("open") || lower.contains("now") || lower.contains("right now")

        var maxDistance: Double?
        if lower.contains("nearby") || lower.contains("near me") || lower.contains("close") {
            maxDistance = 1000
        } else if lower.contains("within") {
            // Basic heuristic for "within X km/m"
            maxDistance = 2000
        }

        var soloScoreMin: Double?
        if lower.contains("best") || lower.contains("top") || lower.contains("great") {
            soloScoreMin = 7.0
        }

        return ExperienceFilter(
            category: category,
            maxDistanceMeters: maxDistance,
            openNow: openNow,
            soloScoreMin: soloScoreMin
        )
    }
}
