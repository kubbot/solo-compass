import SwiftUI

/// Floating capsule with a `.regularMaterial` background, configurable padding/shadow,
/// and optional leading/trailing content slots.
public struct GlassmorphismCapsule<Leading: View, Trailing: View>: View {
    private let horizontalPadding: CGFloat
    private let verticalPadding: CGFloat
    private let shadowRadius: CGFloat
    private let shadowY: CGFloat
    private let leading: Leading
    private let trailing: Trailing
    private let content: AnyView

    public var body: some View {
        HStack(spacing: 8) {
            leading
            content
            trailing
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.15), radius: shadowRadius, x: 0, y: shadowY)
    }
}

// MARK: - Initialisers

extension GlassmorphismCapsule {
    /// Full-flexibility init with leading, center, and trailing slots.
    public init(
        horizontalPadding: CGFloat = 16,
        verticalPadding: CGFloat = 10,
        shadowRadius: CGFloat = 8,
        shadowY: CGFloat = 4,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder content: () -> some View,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.horizontalPadding = horizontalPadding
        self.verticalPadding = verticalPadding
        self.shadowRadius = shadowRadius
        self.shadowY = shadowY
        self.leading = leading()
        self.trailing = trailing()
        self.content = AnyView(content())
    }
}

extension GlassmorphismCapsule where Leading == EmptyView {
    /// No-leading-slot convenience init.
    public init(
        horizontalPadding: CGFloat = 16,
        verticalPadding: CGFloat = 10,
        shadowRadius: CGFloat = 8,
        shadowY: CGFloat = 4,
        @ViewBuilder content: () -> some View,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            horizontalPadding: horizontalPadding,
            verticalPadding: verticalPadding,
            shadowRadius: shadowRadius,
            shadowY: shadowY,
            leading: { EmptyView() },
            content: content,
            trailing: trailing
        )
    }
}

extension GlassmorphismCapsule where Trailing == EmptyView {
    /// No-trailing-slot convenience init.
    public init(
        horizontalPadding: CGFloat = 16,
        verticalPadding: CGFloat = 10,
        shadowRadius: CGFloat = 8,
        shadowY: CGFloat = 4,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder content: () -> some View
    ) {
        self.init(
            horizontalPadding: horizontalPadding,
            verticalPadding: verticalPadding,
            shadowRadius: shadowRadius,
            shadowY: shadowY,
            leading: leading,
            content: content,
            trailing: { EmptyView() }
        )
    }
}

extension GlassmorphismCapsule where Leading == EmptyView, Trailing == EmptyView {
    /// Content-only convenience init.
    public init(
        horizontalPadding: CGFloat = 16,
        verticalPadding: CGFloat = 10,
        shadowRadius: CGFloat = 8,
        shadowY: CGFloat = 4,
        @ViewBuilder content: () -> some View
    ) {
        self.init(
            horizontalPadding: horizontalPadding,
            verticalPadding: verticalPadding,
            shadowRadius: shadowRadius,
            shadowY: shadowY,
            leading: { EmptyView() },
            content: content,
            trailing: { EmptyView() }
        )
    }
}

// MARK: - Previews

#Preview("Default padding") {
    ZStack {
        LinearGradient(colors: [.blue.opacity(0.4), .purple.opacity(0.4)], startPoint: .topLeading, endPoint: .bottomTrailing)
            .ignoresSafeArea()

        VStack(spacing: 24) {
            GlassmorphismCapsule {
                Text(NSLocalizedString("glassmorphism.preview.search", comment: "Search"))
                    .font(.subheadline)
            }

            GlassmorphismCapsule(
                leading: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                },
                content: {
                    Text(NSLocalizedString("glassmorphism.preview.findPlace", comment: "Find a place…"))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                },
                trailing: {
                    Image(systemName: "mic.fill")
                        .foregroundStyle(.blue)
                }
            )

            GlassmorphismCapsule(
                horizontalPadding: 20,
                verticalPadding: 14,
                shadowRadius: 12,
                shadowY: 6,
                content: {
                    Text(NSLocalizedString("glassmorphism.preview.customPadding", comment: "Custom padding & shadow"))
                        .font(.headline)
                },
                trailing: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.secondary)
                }
            )
        }
        .padding()
    }
}
