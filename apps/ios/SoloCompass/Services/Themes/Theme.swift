import SwiftUI

/// Color contract every theme must fulfill.
public protocol Theme {
    var background: Color { get }
    var surface: Color { get }
    var accent: Color { get }
    var secondary: Color { get }
    var primaryText: Color { get }
    var secondaryText: Color { get }
    var name: String { get }
}
