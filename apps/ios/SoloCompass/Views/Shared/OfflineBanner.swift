import SwiftUI

/// Amber pill banner shown in CompassMapView when the app is offline and showing cached data (US-041).
struct OfflineBanner: View {
    var body: some View {
        GlassmorphismCapsule(
            verticalPadding: 8,
            leading: {
                Image(systemName: "wifi.slash")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.orange)
            },
            content: {
                Text(NSLocalizedString("offline.banner", comment: "Offline mode banner"))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.orange)
            }
        )
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

#Preview {
    ZStack {
        Color(.systemBackground).ignoresSafeArea()
        OfflineBanner()
            .padding(.top, 60)
    }
}
