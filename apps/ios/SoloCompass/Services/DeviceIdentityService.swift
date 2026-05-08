import Foundation
import Security

/// Generates and persists an anonymous device UUID in the iOS Keychain (US-038).
/// The UUID is created once, never changes, and survives app reinstalls on the
/// same device (Keychain is not wiped on uninstall by default).
///
/// Attach the ID as `X-Device-ID` on every outbound API request via
/// `URLRequest.attachDeviceID()`.
@MainActor
public final class DeviceIdentityService {
    public static let shared = DeviceIdentityService()

    private let keychainService = "com.solocompass.device"
    private let keychainAccount = "device-id"

    private init() {}

    /// Returns the stable anonymous device UUID, creating it on first call.
    public var deviceID: String {
        if let existing = readFromKeychain() { return existing }
        let new = UUID().uuidString
        writeToKeychain(new)
        return new
    }

    // MARK: - Keychain

    private func readFromKeychain() -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: keychainService,
            kSecAttrAccount: keychainAccount,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func writeToKeychain(_ value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let addQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: keychainService,
            kSecAttrAccount: keychainAccount,
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let updateQuery: [CFString: Any] = [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: keychainService,
                kSecAttrAccount: keychainAccount,
            ]
            SecItemUpdate(updateQuery as CFDictionary, [kSecValueData: data] as CFDictionary)
        }
    }
}

// MARK: - URLRequest convenience

extension URLRequest {
    /// Attaches the anonymous device ID as `X-Device-ID`. Call on every outbound API request.
    @MainActor
    mutating func attachDeviceID() {
        setValue(DeviceIdentityService.shared.deviceID, forHTTPHeaderField: "X-Device-ID")
    }
}
