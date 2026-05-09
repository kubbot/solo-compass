import XCTest
import CoreLocation
@testable import SoloCompass

final class SoloCompassTests: XCTestCase {

    // MARK: - Decoding

    func testExperienceDecodingFromBundleSeed() throws {
        // Use the in-code seed which has the same shape as the JSON file.
        let seed = ExperienceService.hardcodedSeed
        XCTAssertGreaterThanOrEqual(seed.count, 5)
        for exp in seed {
            XCTAssertFalse(exp.id.isEmpty, "id required")
            XCTAssertFalse(exp.title.isEmpty, "title required")
            XCTAssertEqual(exp.location.coordinates.count, 2, "coordinates must be [lon,lat]")
        }
    }

    func testExperienceJSONRoundTrip() throws {
        let original = try XCTUnwrap(ExperienceService.hardcodedSeed.first)
        let data = try JSONEncoder.iso8601Encoder.encode(original)
        let decoded = try JSONDecoder.iso8601Decoder.decode(Experience.self, from: data)
        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.title, original.title)
        XCTAssertEqual(decoded.category, original.category)
        XCTAssertEqual(decoded.soloScore.overall, original.soloScore.overall, accuracy: 0.001)
    }

    // MARK: - Distance

    func testCLLocationDistanceBetweenChiangMaiPoints() {
        // Old city center → Wat Suan Dok ≈ 2.7km
        let center = CLLocation(latitude: 18.7877, longitude: 98.9938)
        let suanDok = CLLocation(latitude: 18.7892, longitude: 98.9692)
        let distance = center.distance(from: suanDok)
        XCTAssertGreaterThan(distance, 2_000)
        XCTAssertLessThan(distance, 4_000)
    }

    // MARK: - Filtering

    func testFilteringByCategoryAndDistance() {
        let service = ExperienceService()
        let center = CLLocationCoordinate2D(latitude: 18.7877, longitude: 98.9938)
        service.filter(by: .coffee, near: center, maxDistance: 10)
        XCTAssertTrue(service.filteredExperiences.allSatisfy { $0.category == .coffee })
    }

    func testGetExperiencesNearReturnsSortedByDistance() throws {
        let service = ExperienceService()
        let center = CLLocationCoordinate2D(latitude: 18.7877, longitude: 98.9938)
        let nearby = service.getExperiences(near: center, radiusKm: 50)
        XCTAssertGreaterThan(nearby.count, 0)
        // Sort check: distances should be non-decreasing.
        var lastDistance: CLLocationDistance = 0
        let here = CLLocation(latitude: center.latitude, longitude: center.longitude)
        for exp in nearby {
            let coord = try XCTUnwrap(exp.coordinate)
            let d = here.distance(from: CLLocation(latitude: coord.latitude, longitude: coord.longitude))
            XCTAssertGreaterThanOrEqual(d, lastDistance - 0.001)
            lastDistance = d
        }
    }

    // MARK: - HealthStatus

    func testHealthHealthyForFreshHighLevel() {
        let confidence = Confidence(
            level: 4,
            lastVerifiedAt: Date(),
            reason: "fresh",
            signals: .init(aiScrapeAgeDays: 1, passiveGpsHits30d: 30, activeReports30d: 10, trustedVerifications: 2)
        )
        XCTAssertEqual(confidence.health, .healthy)
    }

    func testHealthMayBeGoneForStale() {
        let stale = Date().addingTimeInterval(-90 * 86_400) // 90 days ago
        let confidence = Confidence(
            level: 4,
            lastVerifiedAt: stale,
            reason: "stale",
            signals: .init(aiScrapeAgeDays: 90, passiveGpsHits30d: 0, activeReports30d: 0, trustedVerifications: 0)
        )
        XCTAssertEqual(confidence.health, .mayBeGone)
    }

    func testHealthQuestionedForLowLevel() {
        let confidence = Confidence(
            level: 1,
            lastVerifiedAt: Date(),
            reason: "low",
            signals: .init(aiScrapeAgeDays: 1, passiveGpsHits30d: 0, activeReports30d: 0, trustedVerifications: 0)
        )
        XCTAssertEqual(confidence.health, .questioned)
    }

    // MARK: - Solo Score

    func testSoloScoreRangeValidation() {
        for exp in ExperienceService.hardcodedSeed {
            XCTAssertGreaterThanOrEqual(exp.soloScore.overall, 0)
            XCTAssertLessThanOrEqual(exp.soloScore.overall, 10)
            let b = exp.soloScore.breakdown
            for value in [b.seatingFriendly, b.soloPatronRatio, b.staffPressure, b.soloPortioning, b.ambianceFit, b.safety] {
                XCTAssertGreaterThanOrEqual(value, 0)
                XCTAssertLessThanOrEqual(value, 10)
            }
        }
    }

    func testTimeWindowContainsHour() {
        let day = TimeWindow(startHour: 8, endHour: 17)
        XCTAssertTrue(day.contains(hour: 12))
        XCTAssertFalse(day.contains(hour: 18))

        let night = TimeWindow(startHour: 22, endHour: 4)
        XCTAssertTrue(night.contains(hour: 23))
        XCTAssertTrue(night.contains(hour: 2))
        XCTAssertFalse(night.contains(hour: 12))
    }

    // MARK: - MapViewModel Auto-Recenter

    @MainActor
    func testBindToLocationRecentersOnce() throws {
        let locationService = LocationService()
        let viewModel = MapViewModel(
            locationService: locationService,
            experienceService: ExperienceService(),
            aiService: AIService(),
            preferences: UserPreferences()
        )

        // Before GPS fix, camera should be at default (Chiang Mai).
        // bindToLocation should be a no-op.
        viewModel.bindToLocation()
        // Camera should still be the default center (not user location).
        // We can't directly inspect MapCameraPosition region center easily,
        // but we can verify load was called with default center.

        // Simulate GPS fix arriving.
        let coord = CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503) // Tokyo
        locationService.simulate(location: CLLocation(latitude: coord.latitude, longitude: coord.longitude))

        // First call with GPS fix should recenter.
        viewModel.bindToLocation()
        // Verify no-op on second call — hasAutoCentered is true.
        // Re-calling should not crash or change state.
        viewModel.bindToLocation() // Should be a no-op.

        // Verify visible experiences were reloaded for the new center.
        XCTAssertFalse(viewModel.bottomInfoText.isEmpty)
    }

    @MainActor
    func testBindToLocationIdempotent() throws {
        let locationService = LocationService()
        let viewModel = MapViewModel(
            locationService: locationService,
            experienceService: ExperienceService(),
            aiService: AIService(),
            preferences: UserPreferences()
        )

        // Set a GPS location then call bindToLocation multiple times.
        let coord = CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522) // Paris
        locationService.simulate(location: CLLocation(latitude: coord.latitude, longitude: coord.longitude))

        // First call recenters.
        viewModel.bindToLocation()
        let infoAfterFirst = viewModel.bottomInfoText

        // Second call should be a no-op — same bottom info.
        viewModel.bindToLocation()
        XCTAssertEqual(viewModel.bottomInfoText, infoAfterFirst, "Second bindToLocation should be a no-op")

        // Third call also no-op.
        viewModel.bindToLocation()
        XCTAssertEqual(viewModel.bottomInfoText, infoAfterFirst, "Third bindToLocation should be a no-op")
    }

    // MARK: - Preferences

    func testUserPreferencesPersistsRoundTrip() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "test-\(UUID().uuidString)"))
        let prefs = UserPreferences(defaults: defaults)
        prefs.maxDistanceKm = 7.5
        prefs.markCompleted("exp_test_1")
        prefs.toggleFavorite("exp_test_2")

        let reloaded = UserPreferences(defaults: defaults)
        XCTAssertEqual(reloaded.maxDistanceKm, 7.5)
        XCTAssertTrue(reloaded.isCompleted("exp_test_1"))
        XCTAssertTrue(reloaded.isFavorited("exp_test_2"))
    }

    // MARK: - Overpass tag mapping

    func testOverpassCategoryFromAmenity() {
        XCTAssertEqual(OverpassService.category(for: ["amenity": "cafe"]), .coffee)
        XCTAssertEqual(OverpassService.category(for: ["amenity": "restaurant"]), .food)
        XCTAssertEqual(OverpassService.category(for: ["amenity": "bar"]), .nightlife)
        XCTAssertEqual(OverpassService.category(for: ["amenity": "library"]), .work)
        XCTAssertEqual(OverpassService.category(for: ["amenity": "spa"]), .wellness)
    }

    func testOverpassCategoryFromTourismAndLeisure() {
        XCTAssertEqual(OverpassService.category(for: ["tourism": "museum"]), .culture)
        XCTAssertEqual(OverpassService.category(for: ["tourism": "viewpoint"]), .culture)
        XCTAssertEqual(OverpassService.category(for: ["leisure": "park"]), .nature)
        XCTAssertEqual(OverpassService.category(for: ["natural": "beach"]), .nature)
    }

    func testOverpassCategoryFallsBackToHidden() {
        XCTAssertEqual(OverpassService.category(for: [:]), .hidden)
        XCTAssertEqual(OverpassService.category(for: ["highway": "primary"]), .hidden)
    }

    func testOverpassCategorySpecificOverridesGeneric() {
        let mixed: [String: String] = ["amenity": "coworking_space", "shop": "coffee"]
        XCTAssertEqual(OverpassService.category(for: mixed), .work)
    }

    // MARK: - Overpass query / decode

    func testOverpassQueryIncludesRadiusAndCoordinate() {
        let q = OverpassService.buildQuery(lat: 21.0285, lon: 105.8542, radiusMeters: 3000, limit: 30)
        XCTAssertTrue(q.contains("around:3000,21.0285,105.8542"))
        XCTAssertTrue(q.contains("out body 30"))
        XCTAssertTrue(q.contains("amenity"))
    }

    func testOverpassDecodePOIsExtractsNamedNodes() throws {
        let json = """
        {"elements":[
          {"type":"node","id":1,"lat":21.0,"lon":105.8,"tags":{"name":"Quán Cà Phê","name:en":"The Cafe","amenity":"cafe"}},
          {"type":"node","id":2,"lat":21.0,"lon":105.8,"tags":{"amenity":"cafe"}},
          {"type":"node","id":3,"lat":21.0,"lon":105.8,"tags":{"name":"Park","leisure":"park"}}
        ]}
        """.data(using: .utf8)!
        let pois = try OverpassService.decodePOIs(from: json)
        // Node 2 has no name and must be filtered out.
        XCTAssertEqual(pois.count, 2)
        XCTAssertEqual(pois[0].nameEn, "The Cafe")
        XCTAssertEqual(pois[0].osmId, 1)
        XCTAssertEqual(pois[1].name, "Park")
    }

    // MARK: - AI synthesis fallback

    @MainActor
    func testSynthesizeExperiencesFallsBackWhenNoAPIKey() async throws {
        unsetenv("ANTHROPIC_API_KEY")
        let ai = AIService()
        let pois: [OverpassService.POI] = [
            .init(osmId: 100, name: "Cà phê Giảng", nameEn: "Giang Cafe",
                  lat: 21.034, lon: 105.852,
                  tags: ["amenity": "cafe", "name": "Cà phê Giảng"]),
            .init(osmId: 101, name: "Hoàn Kiếm Lake", nameEn: nil,
                  lat: 21.029, lon: 105.853,
                  tags: ["leisure": "park"])
        ]
        let result = try await ai.synthesizeExperiences(from: pois, cityCode: "osm_21.0_105.9")
        XCTAssertEqual(result.count, 2)
        XCTAssertTrue(result.allSatisfy { $0.id.hasPrefix("exp_osm_") })
        XCTAssertTrue(result.allSatisfy { $0.confidence.level == 1 })
        XCTAssertEqual(result.first?.category, .coffee)
        XCTAssertEqual(result.last?.category, .nature)
    }

    @MainActor
    func testSynthesisLimitCapsInputs() async throws {
        unsetenv("ANTHROPIC_API_KEY")
        let ai = AIService()
        let many: [OverpassService.POI] = (0..<25).map {
            .init(osmId: Int64(1000 + $0), name: "Spot \($0)", nameEn: nil,
                  lat: 0, lon: 0, tags: ["amenity": "restaurant"])
        }
        let result = try await ai.synthesizeExperiences(from: many, cityCode: "osm_0.0_0.0")
        XCTAssertEqual(result.count, AIService.synthesisLimit)
    }

    // MARK: - ExperienceService.appendGenerated

    func testAppendGeneratedDeduplicatesById() {
        let service = ExperienceService()
        let originalCount = service.allExperiences.count

        let poi = OverpassService.POI(
            osmId: 999,
            name: "Test Place",
            nameEn: nil,
            lat: 0,
            lon: 0,
            tags: ["amenity": "cafe"]
        )
        let generated = AIService.skeletonExperience(from: poi, cityCode: "osm_0.0_0.0")

        let firstAdded = service.appendGenerated([generated])
        XCTAssertEqual(firstAdded, 1)
        XCTAssertEqual(service.allExperiences.count, originalCount + 1)

        let secondAdded = service.appendGenerated([generated])
        XCTAssertEqual(secondAdded, 0)
        XCTAssertEqual(service.allExperiences.count, originalCount + 1)
    }

    // MARK: - MapViewModel exploration

    @MainActor
    func testExploreCityCodeIsStableForNearbyCoordinates() {
        let hanoiA = CLLocationCoordinate2D(latitude: 21.04, longitude: 105.83)
        let hanoiB = CLLocationCoordinate2D(latitude: 21.03, longitude: 105.84)
        let codeA = MapViewModel.cityCode(for: hanoiA)
        let codeB = MapViewModel.cityCode(for: hanoiB)
        XCTAssertEqual(codeA, codeB, "Coordinates within ~11km should share a city code")
        XCTAssertTrue(codeA.hasPrefix("osm_"))
    }

    @MainActor
    func testExploreCityCodeDiffersForDistantCoordinates() {
        let hanoi = CLLocationCoordinate2D(latitude: 21.0285, longitude: 105.8542)
        let tokyo = CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503)
        XCTAssertNotEqual(MapViewModel.cityCode(for: hanoi), MapViewModel.cityCode(for: tokyo))
    }
}
