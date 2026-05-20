import Foundation

/// Generates an Obsidian-compatible Markdown note for an Experience.
public enum MarkdownExporter {
    public static func export(_ experience: Experience, date: Date = .now) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let dateStr = iso.string(from: date)

        let coords = experience.location.coordinates
        let lat = coords.count >= 2 ? coords[1] : 0.0
        let lon = coords.count >= 2 ? coords[0] : 0.0

        let tags = [experience.category.rawValue, experience.location.cityCode]
            .map { "  - \($0)" }
            .joined(separator: "\n")

        let frontmatter = """
        ---
        title: "\(experience.title)"
        date: \(dateStr)
        latitude: \(lat)
        longitude: \(lon)
        city: \(experience.location.cityCode)
        category: \(experience.category.rawValue)
        solo_score: \(String(format: "%.1f", experience.soloScore.overall))
        tags:
        \(tags)
        ---
        """

        var body = "\n# \(experience.title)\n\n"
        body += "> \(experience.oneLiner)\n\n"
        body += "## Why it matters\n\n\(experience.whyItMatters)\n\n"

        if !experience.howTo.isEmpty {
            body += "## How to\n\n"
            for step in experience.howTo.sorted(by: { $0.order < $1.order }) {
                body += "\(step.order). \(step.text)\n"
            }
            body += "\n"
        }

        if !experience.realInconveniences.isEmpty {
            body += "## Real inconveniences\n\n"
            for inc in experience.realInconveniences {
                body += "- **\(inc.category.rawValue)**: \(inc.text)\n"
            }
            body += "\n"
        }

        if !experience.sources.isEmpty {
            body += "## Sources\n\n"
            for src in experience.sources {
                if let url = src.url {
                    body += "- [\(src.type.rawValue)](\(url.absoluteString))\n"
                } else if let attr = src.attribution {
                    body += "- \(src.type.rawValue): \(attr)\n"
                }
            }
            body += "\n"
        }

        return frontmatter + body
    }

    /// Encodes a Notion Web Clipper URL for opening a new Notion page pre-filled with the title.
    public static func notionWebClipperURL(title: String) -> URL? {
        var comps = URLComponents(string: "https://www.notion.so/new")
        comps?.queryItems = [
            URLQueryItem(name: "source", value: "web_clipper"),
            URLQueryItem(name: "title", value: title),
        ]
        return comps?.url
    }
}
