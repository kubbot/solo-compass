import SwiftUI

/// Report an issue with an experience (US-034).
/// Shown via overflow menu in ExperienceDetailView toolbar.
public struct ReportIssueSheet: View {
    let experience: Experience
    var onSubmit: (_ reason: ReportReason, _ detail: String) -> Void
    var onCancel: () -> Void

    public enum ReportReason: String, CaseIterable, Identifiable {
        case closedPermanently = "closed_permanently"
        case moved
        case hoursWrong = "hours_wrong"
        case vibeDifferent = "vibe_different"
        case factuallyWrong = "factually_wrong"
        case other

        public var id: String { rawValue }

        var label: String {
            NSLocalizedString("report.reason.\(rawValue)", comment: "Report reason")
        }
        var symbol: String {
            switch self {
            case .closedPermanently: return "door.left.hand.closed"
            case .moved:             return "arrow.triangle.turn.up.right.diamond"
            case .hoursWrong:        return "clock.badge.xmark"
            case .vibeDifferent:     return "person.crop.circle.badge.questionmark"
            case .factuallyWrong:    return "exclamationmark.circle"
            case .other:             return "ellipsis.circle"
            }
        }
    }

    @State private var selectedReason: ReportReason?
    @State private var detail: String = ""
    @FocusState private var detailFocused: Bool

    private let detailLimit = 200

    public init(
        experience: Experience,
        onSubmit: @escaping (_ reason: ReportReason, _ detail: String) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.experience = experience
        self.onSubmit = onSubmit
        self.onCancel = onCancel
    }

    public var body: some View {
        NavigationStack {
            List {
                reasonSection
                if selectedReason != nil { detailSection }
            }
            .navigationTitle(NSLocalizedString("report.title", comment: "Report an Issue"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(NSLocalizedString("report.cancel", comment: "Cancel"), action: onCancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(NSLocalizedString("report.submit", comment: "Submit")) {
                        guard let reason = selectedReason else { return }
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        onSubmit(reason, detail.trimmingCharacters(in: .whitespacesAndNewlines))
                    }
                    .fontWeight(.semibold)
                    .disabled(selectedReason == nil)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: - Sections

    private var reasonSection: some View {
        Section {
            ForEach(ReportReason.allCases) { reason in
                HStack(spacing: 12) {
                    Image(systemName: reason.symbol)
                        .frame(width: 24)
                        .foregroundStyle(reason == selectedReason ? .red : .secondary)
                    Text(reason.label)
                    Spacer()
                    if reason == selectedReason {
                        Image(systemName: "checkmark").foregroundStyle(.red).fontWeight(.semibold)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    selectedReason = reason
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
                .listRowBackground(reason == selectedReason
                    ? Color.red.opacity(0.06)
                    : Color(.secondarySystemGroupedBackground))
            }
        } header: {
            Text(NSLocalizedString("report.reason.header", comment: "What's wrong?"))
        }
    }

    private var detailSection: some View {
        Section {
            ZStack(alignment: .topLeading) {
                if detail.isEmpty {
                    Text(NSLocalizedString("report.detail.placeholder", comment: "Optional details (200 chars)"))
                        .foregroundStyle(.tertiary)
                        .padding(.top, 8)
                        .padding(.leading, 4)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $detail)
                    .focused($detailFocused)
                    .frame(minHeight: 80)
                    .onChange(of: detail) { _, new in
                        if new.count > detailLimit {
                            detail = String(new.prefix(detailLimit))
                        }
                    }
            }
            HStack {
                Spacer()
                Text("\(detail.count)/\(detailLimit)")
                    .font(.caption2)
                    .foregroundStyle(detail.count >= detailLimit ? .red : .secondary)
                    .monospacedDigit()
            }
        } header: {
            Text(NSLocalizedString("report.detail.header", comment: "Additional details (optional)"))
        }
    }
}

#Preview {
    Text("Preview requires Experience seed")
}
