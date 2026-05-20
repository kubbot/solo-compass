import SwiftUI

/// Hacker-aesthetic dark theme. Background #0D1117, accent #39FF14 (neon green).
public struct ObsidianTheme: Theme {
    public let name = "Obsidian"
    public var background: Color { Color(red: 0x0D / 255.0, green: 0x11 / 255.0, blue: 0x17 / 255.0) }
    public var surface: Color { Color(red: 0x16 / 255.0, green: 0x1B / 255.0, blue: 0x22 / 255.0) }
    // #39FF14 — WCAG AA contrast ratio vs background is > 4.5:1
    public var accent: Color { Color(red: 0x39 / 255.0, green: 0xFF / 255.0, blue: 0x14 / 255.0) }
    public var secondary: Color { Color(red: 0x58 / 255.0, green: 0xA6 / 255.0, blue: 0xFF / 255.0) }
    public var primaryText: Color { Color(red: 0xE6 / 255.0, green: 0xED / 255.0, blue: 0xF3 / 255.0) }
    public var secondaryText: Color { Color(red: 0x89 / 255.0, green: 0x93 / 255.0, blue: 0x9E / 255.0) }

    public init() {}
}
