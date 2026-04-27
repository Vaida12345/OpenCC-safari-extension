//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Vaida on 2026-04-27.
//

import Foundation
import SafariServices
import os.log

private let appGroupSuiteName = "group.Vaida.app.OpenCC"
private let openCCEnabledKey = "opencc.enabled"
private let openCCConfigKey = "opencc.config"
private let defaultOpenCCConfig = "s2t"
private let supportedOpenCCConfigs: Set<String> = [
    "s2t", "t2s", "s2tw", "tw2s", "s2hk", "hk2s", "s2twp", "tw2sp",
    "t2tw", "tw2t", "t2twp", "tw2tp", "t2hk", "hk2t", "t2jp", "jp2t"
]

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    /// Returns shared defaults used by popup/background/content via native messaging.
    private var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroupSuiteName) ?? .standard
    }

    /// Reads persisted settings and validates config code.
    private func loadSettings() -> [String: Any] {
        let enabled = sharedDefaults.object(forKey: openCCEnabledKey) as? Bool ?? true
        let rawConfig = sharedDefaults.string(forKey: openCCConfigKey) ?? defaultOpenCCConfig
        let config = supportedOpenCCConfigs.contains(rawConfig) ? rawConfig : defaultOpenCCConfig

        return [
            "enabled": enabled,
            "config": config
        ]
    }

    /// Validates and persists settings received from JavaScript.
    private func saveSettings(_ dictionary: [String: Any]?) -> [String: Any] {
        guard
            let dictionary,
            let enabled = dictionary["enabled"] as? Bool,
            let config = dictionary["config"] as? String,
            supportedOpenCCConfigs.contains(config)
        else {
            return loadSettings()
        }

        sharedDefaults.set(enabled, forKey: openCCEnabledKey)
        sharedDefaults.set(config, forKey: openCCConfigKey)

        return [
            "enabled": enabled,
            "config": config
        ]
    }

    /// Builds response payload for a native message action.
    private func handleNativeMessage(_ message: Any?) -> [String: Any] {
        guard let dictionary = message as? [String: Any],
              let action = dictionary["action"] as? String else {
            return ["ok": false, "settings": loadSettings()]
        }

        if action == "getSettings" {
            return ["ok": true, "settings": loadSettings()]
        }

        if action == "setSettings" {
            let settings = saveSettings(dictionary["settings"] as? [String: Any])
            return ["ok": true, "settings": settings]
        }

        return ["ok": false, "settings": loadSettings()]
    }

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(
            .default,
            "Received native message: %@ (profile: %@)",
            String(describing: message),
            profile?.uuidString ?? "none"
        )

        let responsePayload = handleNativeMessage(message)
        let response = NSExtensionItem()

        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responsePayload]
        } else {
            response.userInfo = ["message": responsePayload]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
