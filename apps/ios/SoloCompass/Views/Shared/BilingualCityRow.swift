import SwiftUI
import CoreLocation

/// Displays a city as "Local Name System Name" (e.g. 万象 Vientiane) with
/// distance from current user location on the right.
struct BilingualCityRow: View {
    let city: City
    var userLocation: CLLocation?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(city.nameLocal)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(city.nameSystem)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(distanceLabel)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .monospacedDigit()
        }
    }

    private var distanceLabel: String {
        guard let userLoc = userLocation else {
            return NSLocalizedString("city.distanceUnknown", comment: "Distance unknown")
        }
        let cityLoc = CLLocation(latitude: city.lat, longitude: city.lon)
        let km = userLoc.distance(from: cityLoc) / 1_000
        if Locale.current.measurementSystem == .us {
            let mi = km * 0.621371
            return String(format: NSLocalizedString("city.distanceAway.mi", comment: "%.1f mi away"), mi)
        }
        return String(format: NSLocalizedString("city.distanceAway", comment: "%.1f km away"), km)
    }
}

#Preview {
    let city = City(
        geonameId: 1154689,
        nameLocal: "ວຽງຈັນ",
        nameSystem: "Vientiane",
        lat: 17.9757,
        lon: 102.6331,
        countryCode: "LA"
    )
    return List {
        BilingualCityRow(city: city, userLocation: CLLocation(latitude: 18.7877, longitude: 98.9938))
        BilingualCityRow(city: city, userLocation: nil)
    }
}
