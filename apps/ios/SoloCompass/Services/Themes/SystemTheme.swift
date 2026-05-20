import SwiftUI

/// Default theme: mirrors iOS system appearance.
public struct SystemTheme: Theme {
    public let name = "System"
    public var background: Color { Color(.systemBackground) }
    public var surface: Color { Color(.secondarySystemBackground) }
    public var accent: Color { Color.accentColor }
    public var secondary: Color { Color(.systemIndigo) }
    public var primaryText: Color { Color(.label) }
    public var secondaryText: Color { Color(.secondaryLabel) }

    public init() {}
}
