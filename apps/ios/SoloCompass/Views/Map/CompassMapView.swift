import SwiftUI
import MapKit

/// THE root view. Map-first means: this is what the app *is*. No tabs. No
/// drawer. Filters and the bottom info bar overlay it; an experience card
/// floats up when a marker is tapped.
public struct CompassMapView: View {
    @Environment(LocationService.self) private var locationService
    @Environment(ExperienceService.self) private var experienceService
    @Environment(AIService.self) private var aiService
    @Environment(UserPreferences.self) private var preferences

    @State private var viewModel: MapViewModel?
    @State private var voiceService = VoiceService()
    @State private var dismissedAIError: String? = nil

    public init() {}

    public var body: some View {
        ZStack {
            if let viewModel {
                mapLayer(viewModel: viewModel)
                    .ignoresSafeArea()

                VStack {
                    FilterBarView(
                        selectedCategory: viewModel.selectedCategory,
                        isNowSelected: viewModel.isNowFilter,
                        onSelectNow: { viewModel.selectNowFilter() },
                        onSelectAll: { viewModel.clearFilters() },
                        onSelectCategory: { viewModel.selectCategory($0) }
                    )
                    .padding(.top, 4)

                    // AI / voice error banner — dismissible, shown below filter bar.
                    if let errorText = viewModel.lastAIError, errorText != dismissedAIError {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                            Text(errorText)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                            Spacer()
                            Button {
                                dismissedAIError = errorText
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                            }
                            .accessibilityLabel(Text(NSLocalizedString("common.dismiss", comment: "Dismiss error")))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 12)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(Text(errorText))
                    }

                    Spacer()

                    // AI processing indicator — shown above the bottom info bar.
                    if aiService.isProcessing {
                        HStack(spacing: 6) {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text(NSLocalizedString("ai.processing", comment: "AI is processing"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.thinMaterial, in: Capsule())
                        .transition(.opacity)
                    }

                    BottomInfoBar(text: viewModel.bottomInfoText, nearbySoloCount: viewModel.nearbySoloCount)
                        .padding(.bottom, 8)
                }

                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        VoiceButton(voiceService: voiceService) { transcript in
                            Task { await viewModel.handleVoiceTranscript(transcript) }
                        }
                        .padding(.trailing, 20)
                        .padding(.bottom, 80)
                    }
                }

                if let selected = viewModel.selectedExperience, !viewModel.isShowingDetail {
                    VStack {
                        Spacer()
                        ExperienceCardView(
                            experience: selected,
                            onExpand: { viewModel.isShowingDetail = true },
                            onDismiss: { viewModel.selectedExperience = nil }
                        )
                        .padding(.bottom, 80)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                if viewModel.visibleExperiences.isEmpty {
                    VStack(spacing: 6) {
                        Image(systemName: "mappin.slash")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text(NSLocalizedString("map.empty.title", comment: "No experiences nearby"))
                            .font(.subheadline.weight(.medium))
                        Text(NSLocalizedString("map.empty.hint", comment: "Try adjusting filters or zooming out"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(16)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 32)
                    .accessibilityElement(children: .combine)
                }
            } else {
                ProgressView()
                    .accessibilityLabel(Text(NSLocalizedString("map.loading", comment: "Loading map")))
            }
        }
        .background(Color(.systemBackground))
        .onAppear {
            locationService.requestPermission()
            if viewModel == nil {
                viewModel = MapViewModel(
                    locationService: locationService,
                    experienceService: experienceService,
                    aiService: aiService,
                    preferences: preferences
                )
            }
        }
        .onChange(of: locationService.currentLocation) { _, _ in
            viewModel?.bindToLocation()
        }
        .alert(
            NSLocalizedString("addExperience.confirm.title", comment: "Add an experience here?"),
            isPresented: Binding(
                get: { (viewModel?.pendingAddCoordinate != nil) && (viewModel?.isRecordingNewExperience == false) },
                set: { if !$0 { viewModel?.cancelAddExperience() } }
            )
        ) {
            Button(NSLocalizedString("common.cancel", comment: "Cancel"), role: .cancel) {
                viewModel?.cancelAddExperience()
            }
            Button(NSLocalizedString("addExperience.confirm.add", comment: "Add")) {
                viewModel?.confirmAddExperience()
            }
        } message: {
            Text(NSLocalizedString("addExperience.confirm.message", comment: "Describe it with your voice"))
        }
        .sheet(isPresented: Binding(
            get: { viewModel?.isRecordingNewExperience ?? false },
            set: { if !$0 { viewModel?.cancelAddExperience() } }
        )) {
            VStack(spacing: 24) {
                Text(NSLocalizedString("addExperience.record.title", comment: "Tell us about this place"))
                    .font(.headline)
                Text(NSLocalizedString("addExperience.record.hint", comment: "Hold the mic and describe what makes it worth a solo visit"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                VoiceButton(voiceService: voiceService) { transcript in
                    Task { await viewModel?.handleNewExperienceTranscript(transcript) }
                }
            }
            .padding(32)
            .presentationDetents([.medium])
        }
        .sheet(isPresented: Binding(
            get: { viewModel?.isShowingDetail ?? false },
            set: { if !$0 { viewModel?.isShowingDetail = false } }
        )) {
            if let exp = viewModel?.selectedExperience {
                NavigationStack {
                    ExperienceDetailView(
                        viewModel: ExperienceDetailViewModel(
                            experience: exp,
                            experienceService: experienceService,
                            aiService: aiService,
                            preferences: preferences
                        ),
                        onClose: { viewModel?.dismissDetail() }
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func mapLayer(viewModel: MapViewModel) -> some View {
        let bindingCamera = Binding<MapCameraPosition>(
            get: { viewModel.cameraPosition },
            set: { viewModel.cameraPosition = $0 }
        )

        MapReader { proxy in
            Map(position: bindingCamera) {
                UserAnnotation()
                ForEach(viewModel.visibleExperiences) { exp in
                    if let coord = exp.coordinate {
                        Annotation(exp.title, coordinate: coord) {
                            Button {
                                viewModel.selectExperience(exp)
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            } label: {
                                VStack(spacing: 2) {
                                    MarkerIconView(category: exp.category, state: viewModel.markerState(for: exp))
                                    if case .footprinted = viewModel.markerState(for: exp) {
                                        Text("\(viewModel.footprintCount(for: exp))")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(.white)
                                            .padding(.horizontal, 4)
                                            .padding(.vertical, 1)
                                            .background(Capsule().fill(Color.gray.opacity(0.85)))
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                ForEach(viewModel.candidateExperiences) { cand in
                    if let coord = cand.coordinate {
                        Annotation(cand.title, coordinate: coord) {
                            Circle()
                                .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [4, 3]))
                                .frame(width: 36, height: 36)
                                .foregroundStyle(Color.gray)
                                .background(Circle().fill(Color.white.opacity(0.6)))
                                .overlay(
                                    Image(systemName: "plus")
                                        .font(.subheadline.bold())
                                        .foregroundStyle(.gray)
                                )
                                .accessibilityLabel(Text(String(
                                    format: NSLocalizedString("map.candidate.label", comment: "Candidate experience: %@"),
                                    cand.title
                                )))
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
            .mapControls {
                MapCompass()
                MapUserLocationButton()
            }
            .onMapCameraChange(frequency: .onEnd) { context in
                viewModel.refreshForLocation(context.region.center)
            }
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.6)
                    .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
                    .onEnded { value in
                        if case .second(true, let drag?) = value,
                           let coord = proxy.convert(drag.location, from: .local) {
                            viewModel.handleMapLongPress(at: coord)
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        }
                    }
            )
        }
    }
}

#Preview {
    CompassMapView()
        .environment(LocationService.shared)
        .environment(ExperienceService())
        .environment(AIService())
        .environment(UserPreferences())
}
