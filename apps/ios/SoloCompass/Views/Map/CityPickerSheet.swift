import SwiftUI

/// Bottom sheet for selecting a city (or "All Cities").
/// Displayed when the user taps the city pill in the top-left of the map.
public struct CityPickerSheet: View {
    @Bindable var viewModel: MapViewModel
    let onDismiss: () -> Void

    public var body: some View {
        NavigationStack {
            List {
                // "All Cities" option
                Button {
                    viewModel.selectCity(nil)
                    onDismiss()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(NSLocalizedString("city.all", comment: "All cities option"))
                                .font(.body)
                                .foregroundStyle(.primary)
                        }
                        Spacer()
                        if viewModel.selectedCity == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.accentColor)
                                .font(.body.weight(.semibold))
                        }
                    }
                }

                ForEach(viewModel.availableCities, id: \.code) { city in
                    Button {
                        viewModel.selectCity(city.code)
                        onDismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(city.name)
                                    .font(.body)
                                    .foregroundStyle(.primary)
                                Text(String(
                                    format: NSLocalizedString("city.experienceCount", comment: "Experience count in city"),
                                    viewModel.experienceCount(for: city.code)
                                ))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if viewModel.selectedCity == city.code {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.accentColor)
                                    .font(.body.weight(.semibold))
                            }
                        }
                    }
                }
            }
            .navigationTitle(NSLocalizedString("city.picker.title", comment: "City picker sheet title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("common.cancel", comment: "Cancel")) {
                        onDismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    CityPickerSheet(
        viewModel: MapViewModel(
            locationService: LocationService.shared,
            experienceService: ExperienceService(),
            aiService: AIService(),
            preferences: UserPreferences()
        ),
        onDismiss: {}
    )
}
