//
//  ViewModel.swift
//  OpenCC
//
//  Created by Vaida on 2026-04-27.
//

import SwiftUI
import Combine
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
import SafariServices
#endif


@MainActor
final class OpenCCSettingsViewModel: ObservableObject {
    @Published var enabled: Bool
    @Published var selectedInput: String
    @Published var selectedConfig: String
    @Published var statusText: String
    
#if os(macOS)
    enum ExtensionState {
        case unknown
        case on
        case off
    }
    
    @Published var extensionState: ExtensionState = .unknown
    @Published var useSafariSettingsCopy = false
#endif
    
    private let saveHandler: (OpenCCSettings) -> Void
    
    var inputOptions: [(value: String, label: String)] {
        var seen = Set<String>()
        return openCCPresets.compactMap { preset in
            guard !seen.contains(preset.inputValue) else { return nil }
            seen.insert(preset.inputValue)
            return (preset.inputValue, preset.inputLabel)
        }
    }
    
    var outputOptions: [OpenCCPreset] {
        openCCPresets.filter { $0.inputValue == selectedInput }
    }
    
    /// Creates the view model with previously stored settings and a persistence callback.
    init(initialSettings: OpenCCSettings, saveHandler: @escaping (OpenCCSettings) -> Void) {
        let preset = openCCPresets.first { $0.value == initialSettings.config } ?? openCCPresets[0]
        self.enabled = initialSettings.enabled
        self.selectedInput = preset.inputValue
        self.selectedConfig = preset.value
        self.statusText = ""
        self.saveHandler = saveHandler
        updateStatusText()
    }
    
    /// Updates the conversion enabled toggle and persists the new state.
    func updateEnabled(_ isEnabled: Bool) {
        enabled = isEnabled
        persistSettings()
    }
    
    /// Updates selected input type and normalizes selected output to a compatible value.
    func updateInput(_ inputValue: String) {
        selectedInput = inputValue
        
        if !outputOptions.contains(where: { $0.value == selectedConfig }),
           let firstOutput = outputOptions.first {
            selectedConfig = firstOutput.value
        }
        
        persistSettings()
    }
    
    /// Updates selected output configuration and persists settings.
    func updateOutput(_ config: String) {
        selectedConfig = config
        persistSettings()
    }
    
    /// Persists current settings and refreshes the visible status copy.
    private func persistSettings() {
        saveHandler(OpenCCSettings(enabled: enabled, config: selectedConfig))
        updateStatusText()
    }
    
    /// Recomputes the summary line shown under conversion settings.
    private func updateStatusText() {
        guard let preset = openCCPresets.first(where: { $0.value == selectedConfig }) else {
            statusText = "Saved"
            return
        }
        
        statusText = "\(preset.inputLabel) -> \(preset.outputLabel)"
    }
    
#if os(macOS)
    var extensionMessage: String {
        switch extensionState {
        case .on:
            if useSafariSettingsCopy {
                return "OpenCC’s extension is currently on. You can turn it off in the Extensions section of Safari Settings."
            }
            
            return "OpenCC’s extension is currently on. You can turn it off in Safari Extensions preferences."
        case .off:
            if useSafariSettingsCopy {
                return "OpenCC’s extension is currently off. You can turn it on in the Extensions section of Safari Settings."
            }
            
            return "OpenCC’s extension is currently off. You can turn it on in Safari Extensions preferences."
        case .unknown:
            if useSafariSettingsCopy {
                return "You can turn on OpenCC’s extension in the Extensions section of Safari Settings."
            }
            
            return "You can turn on OpenCC’s extension in Safari Extensions preferences."
        }
    }
    
    var preferencesButtonTitle: String {
        useSafariSettingsCopy ? "Quit and Open Safari Settings..." : "Quit and Open Safari Extensions Preferences..."
    }
    
    /// Loads Safari extension state and updates macOS-specific status messaging.
    func refreshSafariExtensionState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] state, error in
            DispatchQueue.main.async {
                guard let self else { return }
                
                self.useSafariSettingsCopy = {
                    if #available(macOS 13, *) {
                        return true
                    }
                    return false
                }()
                
                guard let state, error == nil else {
                    self.extensionState = .unknown
                    return
                }
                
                self.extensionState = state.isEnabled ? .on : .off
            }
        }
    }
    
    /// Opens Safari preferences at the extension pane and quits the host app on success.
    func openSafariPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            guard error == nil else { return }
            DispatchQueue.main.async { NSApp.terminate(self) }
        }
    }
#endif
}
