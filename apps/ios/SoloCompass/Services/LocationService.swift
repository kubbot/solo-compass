import Foundation
import CoreLocation
import Observation

/// Wraps CLLocationManager. Single shared instance — there is one device GPS,
/// so one manager. UI reads `currentLocation` and `authorizationStatus` directly.
@Observable
public final class LocationService: NSObject {
    public static let shared = LocationService()

    public private(set) var currentLocation: CLLocation?
    public private(set) var authorizationStatus: CLAuthorizationStatus
    public private(set) var lastError: Error?

    /// Optional preferences sink — when set, geofence enter events record
    /// pending check-ins so the app can prompt the user later.
    public weak var preferences: UserPreferences?
    public var onRegionEnter: ((String) -> Void)?
    public var onRegionExit: ((String) -> Void)?

    private let manager: CLLocationManager
    /// Identifiers we've actively asked to monitor — so we can stop a previous
    /// set without touching regions other code may have registered.
    private var monitoredIdentifiers: Set<String> = []
    /// Most recent visit list — kept so identifier→experience lookup is cheap
    /// during region callbacks.
    private var monitoredVisits: [String: Experience] = [:]

    public init(manager: CLLocationManager = CLLocationManager()) {
        self.manager = manager
        self.authorizationStatus = manager.authorizationStatus
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        self.manager.distanceFilter = 50 // refresh after 50m of movement
    }

    public func requestPermission() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdating()
        default:
            break
        }
    }

    public func startUpdating() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            return
        }
        manager.startUpdatingLocation()
    }

    public func stopUpdating() {
        manager.stopUpdatingLocation()
    }

    /// Register CLCircularRegions (200m radius) for each experience so the OS
    /// wakes us when the user enters/exits. Replaces any previously-monitored
    /// set this service installed. iOS caps simultaneous regions at 20 per app.
    public func startMonitoring(visits: [Experience]) {
        // Clear what we previously installed.
        for id in monitoredIdentifiers {
            if let region = manager.monitoredRegions.first(where: { $0.identifier == id }) {
                manager.stopMonitoring(for: region)
            }
        }
        monitoredIdentifiers.removeAll()
        monitoredVisits.removeAll()

        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }

        for exp in visits.prefix(20) {
            guard let coord = exp.coordinate else { continue }
            let region = CLCircularRegion(center: coord, radius: 200, identifier: exp.id)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            manager.startMonitoring(for: region)
            monitoredIdentifiers.insert(exp.id)
            monitoredVisits[exp.id] = exp
        }
    }

    public func stopMonitoringAll() {
        for id in monitoredIdentifiers {
            if let region = manager.monitoredRegions.first(where: { $0.identifier == id }) {
                manager.stopMonitoring(for: region)
            }
        }
        monitoredIdentifiers.removeAll()
        monitoredVisits.removeAll()
    }

    /// Distance in meters from the current location to a coordinate.
    /// Returns `.greatestFiniteMagnitude` if no current location is known.
    public func distance(to coordinate: CLLocationCoordinate2D) -> CLLocationDistance {
        guard let here = currentLocation else { return .greatestFiniteMagnitude }
        let target = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        return here.distance(from: target)
    }

    /// Test-only: inject a simulated location. Bypasses CLLocationManager so
    /// tests can exercise ViewModel logic synchronously without real GPS.
    /// Not called in production code — harmless to ship.
    public func simulate(location: CLLocation) {
        self.currentLocation = location
    }
}

extension LocationService: CLLocationManagerDelegate {
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorizationStatus = status
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                self.startUpdating()
            }
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in
            self.currentLocation = last
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.lastError = error
        }
    }

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard monitoredIdentifiers.contains(region.identifier) else { return }
        Task { @MainActor in
            self.preferences?.recordPendingCheckIn(region.identifier)
            self.onRegionEnter?(region.identifier)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        guard monitoredIdentifiers.contains(region.identifier) else { return }
        Task { @MainActor in
            self.onRegionExit?(region.identifier)
        }
    }
}
