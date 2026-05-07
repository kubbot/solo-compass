import Foundation
import CoreLocation
import MapKit
import Observation
import SwiftUI

/// State + intent for the root `CompassMapView`.
///
/// MVVM rule of thumb: services do I/O, the view model decides what's on
/// screen. Filters, the selected experience, the bottom info text — all live
/// here so the View can stay thin.
///
/// @MainActor isolation ensures all @Observable property mutations happen on
/// the main thread, preventing data-race crashes under Swift 6 strict concurrency.
@MainActor
@Observable
public final class MapViewModel {
    // Default: Chiang Mai old city center.
    public static let defaultCenter = CLLocationCoordinate2D(latitude: 18.7877, longitude: 98.9938)

    // MARK: - Dependencies
    private let locationService: LocationService
    private let experienceService: ExperienceService
    private let aiService: AIService
    private let preferences: UserPreferences

    // MARK: - Auto-recenter

    /// Set to true after the first successful auto-recenter so we don't fight
    /// subsequent user pan/zoom gestures.
    private var hasAutoCentered = false

    /// Recenter the camera to the user's current location ONCE, on the first
    /// non-nil GPS fix. Subsequent calls are no-ops so the user's manual
    /// pan/zoom is preserved.
    public func bindToLocation() {
        guard !hasAutoCentered,
              let coordinate = locationService.currentLocation?.coordinate else { return }
        hasAutoCentered = true
        recenter(on: coordinate)
    }

    // MARK: - Published state
    // @ObservationIgnored avoids @Observable macro expanding MapCameraPosition
    // into a synthetic file that lacks `import MapKit`, causing build errors.
    @ObservationIgnored private var _cameraPosition: MapCameraPosition
    public var cameraPosition: MapCameraPosition {
        get { _cameraPosition }
        set {
            withMutation(keyPath: \.cameraPositionVersion) {
                _cameraPosition = newValue
                cameraPositionVersion &+= 1
            }
        }
    }
    // Observers watch this instead of cameraPosition directly.
    private var cameraPositionVersion: UInt8 = 0
    public var selectedCategory: ExperienceCategory?
    public var visibleExperiences: [Experience] = []
    public var selectedExperience: Experience?
    public var isShowingDetail: Bool = false
    public var bottomInfoText: String = ""
    public var nearbySoloCount: Int = 0
    public var aiExplanation: String?
    public var lastAIError: String?

    // True when a "Now" filter is active (best-now experiences only).
    public var isNowFilter: Bool = false

    // MARK: - Add-experience flow (long-press on map)

    /// Coordinate the user long-pressed; non-nil while we're prompting to confirm.
    public var pendingAddCoordinate: CLLocationCoordinate2D?
    /// Set once the user confirms — drives the voice-input sheet.
    public var isRecordingNewExperience: Bool = false
    /// Candidate experiences added via long-press → voice → AI. Rendered with
    /// `.hidden` category and a distinct (dashed) marker.
    public var candidateExperiences: [Experience] = []

    public init(
        locationService: LocationService,
        experienceService: ExperienceService,
        aiService: AIService,
        preferences: UserPreferences
    ) {
        self.locationService = locationService
        self.experienceService = experienceService
        self.aiService = aiService
        self.preferences = preferences
        self._cameraPosition = .region(MKCoordinateRegion(
            center: Self.defaultCenter,
            span: MKCoordinateSpan(latitudeDelta: 0.06, longitudeDelta: 0.06)
        ))
        loadNearbyExperiences()
        updateBottomInfo()
    }

    // MARK: - Loading

    public func loadNearbyExperiences() {
        let center = locationService.currentLocation?.coordinate ?? Self.defaultCenter
        let radiusKm = max(1.0, preferences.maxDistanceKm)
        var nearby = experienceService.getExperiences(near: center, radiusKm: radiusKm)

        if let category = selectedCategory {
            nearby = nearby.filter { $0.category == category }
        }
        if isNowFilter {
            nearby = nearby.filter { $0.isBestNow() }
        }
        if !preferences.dislikedCategories.isEmpty {
            let disliked = Set(preferences.dislikedCategories)
            nearby = nearby.filter { !disliked.contains($0.category) }
        }
        visibleExperiences = nearby
        nearbySoloCount = computeNearbySoloCount(in: nearby)
    }

    public func selectCategory(_ category: ExperienceCategory?) {
        selectedCategory = category
        isNowFilter = false
        loadNearbyExperiences()
        updateBottomInfo()
    }

    public func selectNowFilter() {
        isNowFilter = true
        selectedCategory = nil
        loadNearbyExperiences()
        updateBottomInfo()
    }

    public func clearFilters() {
        selectedCategory = nil
        isNowFilter = false
        loadNearbyExperiences()
        updateBottomInfo()
    }

    public func selectExperience(_ experience: Experience) {
        selectedExperience = experience
        // isShowingDetail stays false — card shows first, detail sheet on expand
    }

    public func dismissDetail() {
        isShowingDetail = false
    }

    /// Recenter the camera and refresh experiences for the given coordinate.
    /// Use this for explicit recentering (e.g. "locate me" button), NOT for
    /// reacting to user pan/zoom — that would create a feedback loop where
    /// every gesture resets the zoom level.
    public func recenter(on coordinate: CLLocationCoordinate2D) {
        cameraPosition = .region(MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.04)
        ))
        loadNearbyExperiences()
        updateBottomInfo()
    }

    /// Refresh visible experiences when the user pans/zooms the map. Does NOT
    /// touch `cameraPosition`, to avoid fighting the user's gesture.
    public func refreshForLocation(_ coordinate: CLLocationCoordinate2D) {
        let radiusKm = max(1.0, preferences.maxDistanceKm)
        var nearby = experienceService.getExperiences(near: coordinate, radiusKm: radiusKm)

        if let category = selectedCategory {
            nearby = nearby.filter { $0.category == category }
        }
        if isNowFilter {
            nearby = nearby.filter { $0.isBestNow() }
        }
        if !preferences.dislikedCategories.isEmpty {
            let disliked = Set(preferences.dislikedCategories)
            nearby = nearby.filter { !disliked.contains($0.category) }
        }
        visibleExperiences = nearby
        nearbySoloCount = computeNearbySoloCount(in: nearby)
        updateBottomInfo()
    }

    /// Marker state derivation — the map view consults this for each pin.
    public func markerState(for experience: Experience, now: Date = Date()) -> ExperienceMarkerState {
        if preferences.isCompleted(experience.id) { return .completed }
        if preferences.isFavorited(experience.id) { return .favorited }
        if experience.isBestNow(at: now) { return .bestNow }
        if let upcoming = minutesUntilBestTime(for: experience, from: now), upcoming > 0, upcoming <= 120 {
            return .upcoming(minutes: upcoming)
        }
        if experience.confidence.signals.passiveGpsHits30d > 0 {
            return .footprinted
        }
        return .default
    }

    /// Footprint count (passive GPS hits in last 30 days) for the marker badge.
    public func footprintCount(for experience: Experience) -> Int {
        experience.confidence.signals.passiveGpsHits30d
    }

    private func minutesUntilBestTime(for experience: Experience, from date: Date) -> Int? {
        let cal = Calendar.current
        let hour = cal.component(.hour, from: date)
        let minute = cal.component(.minute, from: date)
        let nowMinutes = hour * 60 + minute

        let upcomingStarts: [Int] = experience.bestTimes.compactMap { window in
            let startMin = window.startHour * 60
            return startMin > nowMinutes ? (startMin - nowMinutes) : nil
        }
        return upcomingStarts.min()
    }

    // MARK: - Bottom info bar

    public func updateBottomInfo() {
        let hour = Calendar.current.component(.hour, from: Date())
        let count = visibleExperiences.count

        switch hour {
        case 6..<12:
            let coffeeCount = visibleExperiences.filter { $0.category == .coffee && $0.isBestNow() }.count
            bottomInfoText = String(
                format: NSLocalizedString("info.morning", comment: "Morning info"),
                coffeeCount > 0 ? coffeeCount : count
            )
        case 12..<17:
            bottomInfoText = String(
                format: NSLocalizedString("info.afternoon", comment: "Afternoon info"),
                count
            )
        case 17..<22:
            bottomInfoText = String(
                format: NSLocalizedString("info.evening", comment: "Evening info"),
                count
            )
        default:
            let openLate = visibleExperiences.filter { $0.isBestNow() }.count
            bottomInfoText = String(
                format: NSLocalizedString("info.night", comment: "Night info"),
                openLate
            )
        }
    }

    // MARK: - AI

    public func runAIRanking() async {
        let candidates = visibleExperiences
        guard !candidates.isEmpty else { return }
        let context = AIService.UserContext(
            location: locationService.currentLocation?.coordinate,
            date: Date(),
            style: preferences.soloTravelStyle,
            preferredCategories: preferences.preferredCategories,
            dislikedCategories: preferences.dislikedCategories
        )
        do {
            let ranked = try await aiService.recommendExperiences(from: candidates, context: context)
            let rank = Dictionary(uniqueKeysWithValues: ranked.enumerated().map { ($0.element, $0.offset) })
            visibleExperiences = candidates.sorted { lhs, rhs in
                (rank[lhs.id] ?? Int.max) < (rank[rhs.id] ?? Int.max)
            }
            lastAIError = nil
        } catch {
            // Unranked list is still useful — keep it visible, just record the error.
            lastAIError = error.localizedDescription
        }
    }

    /// Step 1 happens in the view (screen point → coordinate). Steps 2-3 live
    /// here: stash the coordinate so the view can show a confirmation, then
    /// `confirmAddExperience()` flips into recording mode for the voice flow.
    public func handleMapLongPress(at coordinate: CLLocationCoordinate2D) {
        pendingAddCoordinate = coordinate
    }

    public func cancelAddExperience() {
        pendingAddCoordinate = nil
        isRecordingNewExperience = false
    }

    public func confirmAddExperience() {
        guard pendingAddCoordinate != nil else { return }
        isRecordingNewExperience = true
    }

    /// Use AIService to structure a free-form transcript into a candidate
    /// Experience anchored at `pendingAddCoordinate`. The candidate is added
    /// with category `.hidden` so the marker layer can render it distinctly.
    public func handleNewExperienceTranscript(_ transcript: String) async {
        guard let coordinate = pendingAddCoordinate else { return }
        defer { cancelAddExperience() }
        do {
            let response = try await aiService.processVoiceIntent(transcript: transcript, near: coordinate)
            let now = Date()
            let candidate = Experience(
                id: "candidate_\(UUID().uuidString)",
                title: transcript,
                oneLiner: response.explanation,
                whyItMatters: response.explanation,
                category: .hidden,
                location: ExperienceLocation(
                    coordinates: [coordinate.longitude, coordinate.latitude],
                    cityCode: "user"
                ),
                bestTimes: [],
                durationMinutes: .init(min: 30, max: 60),
                howTo: [],
                realInconveniences: [],
                soloScore: SoloScore(
                    overall: 0,
                    breakdown: .init(seatingFriendly: 0, soloPatronRatio: 0, staffPressure: 0, soloPortioning: 0, ambianceFit: 0, safety: 0),
                    basedOnCount: 0
                ),
                sources: [InformationSource(type: .user, attribution: "you", verifiedAt: now)],
                confidence: Confidence(
                    level: 0,
                    lastVerifiedAt: now,
                    reason: "Self-reported, unverified",
                    signals: .init(aiScrapeAgeDays: 0, passiveGpsHits30d: 0, activeReports30d: 0, trustedVerifications: 0)
                ),
                nearbyExperienceIds: [],
                stats: .init(completionCount: 0, averageRating: 0),
                status: .candidate,
                createdAt: now,
                updatedAt: now
            )
            candidateExperiences.append(candidate)
            aiExplanation = response.explanation
            lastAIError = nil
        } catch {
            lastAIError = error.localizedDescription
        }
    }

    public func handleVoiceTranscript(_ transcript: String) async {
        let coordinate = locationService.currentLocation?.coordinate ?? Self.defaultCenter
        do {
            let response = try await aiService.processVoiceIntent(transcript: transcript, near: coordinate)
            aiExplanation = response.explanation
            if let suggestion = response.filterSuggestion {
                selectCategory(suggestion)
            }
            if !response.recommendedIds.isEmpty {
                let ids = Set(response.recommendedIds)
                visibleExperiences = experienceService.allExperiences.filter { ids.contains($0.id) }
            }
            bottomInfoText = response.explanation
            lastAIError = nil
        } catch {
            // Keep current state on error; record for UI to optionally surface.
            lastAIError = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func computeNearbySoloCount(in experiences: [Experience]) -> Int {
        // Approximation for MVP: completion count in last 24h is unknown locally,
        // so we use a heuristic — average reports/30d divided down.
        let signals = experiences.reduce(0) { $0 + $1.confidence.signals.passiveGpsHits30d }
        return max(0, signals / 30) // per-day estimate
    }
}
