import Foundation
import Observation

/// State + intent for the experience detail sheet.
///
/// @MainActor isolation ensures aiExplanation and other UI-bound properties
/// are always mutated on the main thread after awaiting async calls.
@MainActor
@Observable
public final class ExperienceDetailViewModel {
    public let experience: Experience

    public var isCompleted: Bool
    public var isFavorited: Bool
    public var aiExplanation: String?
    public var isLoadingAIExplanation: Bool = false
    public var nearbyExperiences: [Experience] = []
    public var visitCount: Int

    private let experienceService: ExperienceService
    private let aiService: AIService
    private let preferences: UserPreferences

    public init(
        experience: Experience,
        experienceService: ExperienceService,
        aiService: AIService,
        preferences: UserPreferences
    ) {
        self.experience = experience
        self.experienceService = experienceService
        self.aiService = aiService
        self.preferences = preferences
        self.isCompleted = preferences.isCompleted(experience.id)
        self.isFavorited = preferences.isFavorited(experience.id)
        self.visitCount = experience.stats.completionCount
        loadNearby()
    }

    public func toggleComplete() {
        if isCompleted {
            preferences.completedExperiences.remove(experience.id)
            preferences.visitHistory.removeValue(forKey: experience.id)
            isCompleted = false
        } else {
            preferences.markCompleted(experience.id)
            experienceService.markCompleted(experience.id)
            visitCount += 1
            isCompleted = true
        }
    }

    public func toggleFavorite() {
        preferences.toggleFavorite(experience.id)
        isFavorited = preferences.isFavorited(experience.id)
    }

    public func loadAIExplanation() async {
        isLoadingAIExplanation = true
        defer { isLoadingAIExplanation = false }
        do {
            aiExplanation = try await aiService.explainRecommendation(for: experience.id)
        } catch {
            aiExplanation = nil
            #if DEBUG
            print("[ExperienceDetailViewModel] loadAIExplanation failed for id=\(experience.id): \(error)")
            #endif
        }
    }

    public func loadNearby() {
        nearbyExperiences = experience.nearbyExperienceIds.compactMap {
            experienceService.getExperience(id: $0)
        }
    }
}
