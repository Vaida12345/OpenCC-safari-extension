//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Vaida on 2026-04-27.
//

import Foundation
import SafariServices

private let appGroupSuiteName = "group.Vaida.app.OpenCC"
private let openCCEnabledKey = "opencc.enabled"
private let openCCConfigKey = "opencc.config"
private let openCCFontOverrideKey = "opencc.fontOverride"
private let openCCLegacyFontOverrideKey = "opencc.overrideFont"
private let defaultOpenCCConfig = "t2s"
private let supportedOpenCCConfigs: Set<String> = [
    "s2t", "t2s", "s2tw", "tw2s", "s2hk", "hk2s", "s2twp", "tw2sp",
    "t2tw", "tw2t", "t2twp", "tw2tp", "t2hk", "hk2t", "t2jp", "jp2t"
]

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    /// Returns shared defaults used by popup/background/content via native messaging.
    private var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroupSuiteName) ?? .standard
    }

    /// Reads a boolean setting from a dictionary and supports legacy key aliases.
    private func boolValue(in dictionary: [String: Any], forKeys keys: [String]) -> Bool? {
        for key in keys {
            if let value = dictionary[key] as? Bool {
                return value
            }
        }

        return nil
    }

    /// Loads persisted font override preference and falls back to a legacy key when needed.
    private func loadFontOverrideSetting() -> Bool {
        if let value = sharedDefaults.object(forKey: openCCFontOverrideKey) as? Bool {
            return value
        }

        return sharedDefaults.object(forKey: openCCLegacyFontOverrideKey) as? Bool ?? false
    }

    /// Reads persisted settings and validates config code.
    private func loadSettings() -> [String: Any] {
        let enabled = sharedDefaults.object(forKey: openCCEnabledKey) as? Bool ?? true
        let rawConfig = sharedDefaults.string(forKey: openCCConfigKey) ?? defaultOpenCCConfig
        let config = supportedOpenCCConfigs.contains(rawConfig) ? rawConfig : defaultOpenCCConfig
        let fontOverride = loadFontOverrideSetting()

        return [
            "enabled": enabled,
            "config": config,
            "fontOverride": fontOverride
        ]
    }

    /// Validates and persists settings received from JavaScript.
    private func saveSettings(_ dictionary: [String: Any]?) -> [String: Any] {
        guard let dictionary else {
            return loadSettings()
        }

        let currentSettings = loadSettings()
        let enabled = boolValue(in: dictionary, forKeys: ["enabled"])
            ?? (currentSettings["enabled"] as? Bool ?? true)
        let config = dictionary["config"] as? String
            ?? (currentSettings["config"] as? String ?? defaultOpenCCConfig)
        let fontOverride = boolValue(in: dictionary, forKeys: ["fontOverride", "overrideFont", "font_override"])
            ?? (currentSettings["fontOverride"] as? Bool ?? false)

        guard supportedOpenCCConfigs.contains(config) else {
            return loadSettings()
        }

        sharedDefaults.set(enabled, forKey: openCCEnabledKey)
        sharedDefaults.set(config, forKey: openCCConfigKey)
        sharedDefaults.set(fontOverride, forKey: openCCFontOverrideKey)
        sharedDefaults.set(fontOverride, forKey: openCCLegacyFontOverrideKey)

        return [
            "enabled": enabled,
            "config": config,
            "fontOverride": fontOverride
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

    /// Handles an incoming native message from the Safari Web Extension runtime.
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

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
