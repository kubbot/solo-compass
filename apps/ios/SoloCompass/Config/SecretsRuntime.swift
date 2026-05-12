import Foundation

// MARK: - Runtime Key Resolution
//
// `GeneratedSecrets.swift` is gitignored and re-emitted on every build by
// `scripts/generate_secrets.sh` from the repo-root `.env`.
//
// `SecretsRuntime.swift` is committed and provides computed properties that
// prefer a UserDefaults-stored key (entered by the user in Settings) over the
// build-time baked-in value. This lets open-source / TestFlight users supply
// their own DeepSeek key without re-building.

extension Secrets {
    enum RuntimeKeys {
        static let deepSeekApiKey = "runtimeDeepSeekKey"
    }

    /// Effective DeepSeek API key. UserDefaults override > GeneratedSecrets.
    /// Returns "" when neither is set; callers map empty → `AIError.missingAPIKey`.
    static var resolvedDeepSeekApiKey: String {
        if let override = UserDefaults.standard.string(forKey: RuntimeKeys.deepSeekApiKey),
           !override.isEmpty {
            return override
        }
        return deepSeekApiKey
    }

    static var resolvedDeepSeekBaseURL: String {
        deepSeekBaseURL.isEmpty ? "https://api.deepseek.com/v1" : deepSeekBaseURL
    }

    static var resolvedDeepSeekModel: String {
        deepSeekModel.isEmpty ? "deepseek-chat" : deepSeekModel
    }
}
