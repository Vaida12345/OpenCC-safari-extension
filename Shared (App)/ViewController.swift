//
//  ViewController.swift
//  Shared (App)
//
//  Created by Vaida on 2026-04-27.
//

import Foundation
import SwiftUI
import Combine

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
import SafariServices
#endif

let extensionBundleIdentifier = "Vaida.app.OpenCC.Extension"

let appGroupSuiteName = "group.Vaida.app.OpenCC"
let openCCEnabledKey = "opencc.enabled"
let openCCConfigKey = "opencc.config"
let defaultOpenCCConfig = "t2s"

struct OpenCCPreset: Hashable, Sendable {
    let value: String
    let inputValue: String
    let inputLabel: String
    let outputLabel: String
}

let openCCPresets: [OpenCCPreset] = [
    OpenCCPreset(value: "s2t", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Traditional Chinese (OpenCC)"),
    OpenCCPreset(value: "t2s", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Simplified Chinese"),
    OpenCCPreset(value: "s2tw", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Taiwan Traditional"),
    OpenCCPreset(value: "tw2s", inputValue: "taiwan", inputLabel: "Taiwan Traditional", outputLabel: "Simplified Chinese"),
    OpenCCPreset(value: "s2hk", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Hong Kong Traditional"),
    OpenCCPreset(value: "hk2s", inputValue: "hongkong", inputLabel: "Hong Kong Traditional", outputLabel: "Simplified Chinese"),
    OpenCCPreset(value: "s2twp", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Taiwan Traditional + idioms"),
    OpenCCPreset(value: "tw2sp", inputValue: "taiwan-idioms", inputLabel: "Taiwan Traditional + idioms", outputLabel: "Simplified Chinese"),
    OpenCCPreset(value: "t2tw", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Taiwan Traditional"),
    OpenCCPreset(value: "tw2t", inputValue: "taiwan", inputLabel: "Taiwan Traditional", outputLabel: "Traditional Chinese (OpenCC)"),
    OpenCCPreset(value: "t2twp", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Taiwan Traditional + idioms"),
    OpenCCPreset(value: "tw2tp", inputValue: "taiwan-idioms", inputLabel: "Taiwan Traditional + idioms", outputLabel: "Traditional Chinese (OpenCC)"),
    OpenCCPreset(value: "t2hk", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Hong Kong Traditional"),
    OpenCCPreset(value: "hk2t", inputValue: "hongkong", inputLabel: "Hong Kong Traditional", outputLabel: "Traditional Chinese (OpenCC)"),
    OpenCCPreset(value: "t2jp", inputValue: "traditional-kyujitai", inputLabel: "Traditional (Kyujitai)", outputLabel: "Japanese (Shinjitai)"),
    OpenCCPreset(value: "jp2t", inputValue: "japanese-shinjitai", inputLabel: "Japanese (Shinjitai)", outputLabel: "Traditional (Kyujitai)")
]

let supportedOpenCCConfigs: Set<String> = Set(openCCPresets.map(\.value))

struct OpenCCSettings: Codable {
    let enabled: Bool
    let config: String
}

enum OpenCCSettingsStore {
    /// Returns shared defaults used by both the host app and extension native handler.
    static var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: appGroupSuiteName) ?? .standard
    }

    /// Reads persisted OpenCC settings and guarantees valid values.
    static func load() -> OpenCCSettings {
        let enabled = sharedDefaults.object(forKey: openCCEnabledKey) as? Bool ?? true
        let storedConfig = sharedDefaults.string(forKey: openCCConfigKey) ?? defaultOpenCCConfig
        let config = supportedOpenCCConfigs.contains(storedConfig) ? storedConfig : defaultOpenCCConfig
        return OpenCCSettings(enabled: enabled, config: config)
    }

    /// Stores OpenCC settings for use by both the app UI and extension native messaging.
    static func save(_ settings: OpenCCSettings) {
        sharedDefaults.set(settings.enabled, forKey: openCCEnabledKey)
        sharedDefaults.set(settings.config, forKey: openCCConfigKey)
    }
}

