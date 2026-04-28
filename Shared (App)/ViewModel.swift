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

let extensionBundleIdentifier = "Vaida.app.OpenCC.Extension"


@MainActor
final class OpenCCSettingsViewModel: ObservableObject {
    
#if os(macOS)
    enum ExtensionState {
        case unknown
        case on
        case off
    }
    
    @Published var extensionState: ExtensionState = .unknown
    @Published var useSafariSettingsCopy = false
#endif
    
    /// Creates the view model with previously stored settings and a persistence callback.
    init() {
        
    }
    
#if os(macOS)
    var extensionMessage: LocalizedStringResource {
        switch extensionState {
        case .on:
            if useSafariSettingsCopy {
                return "This app’s extension is currently on. You can turn it off in the Extensions section of Safari Settings."
            }
            
            return "This app’s extension is currently on. You can turn it off in Safari Extensions preferences."
        case .off:
            if useSafariSettingsCopy {
                return "This app’s extension is currently off. You can turn it on in the Extensions section of Safari Settings."
            }
            
            return "This app’s extension is currently off. You can turn it on in Safari Extensions preferences."
        case .unknown:
            if useSafariSettingsCopy {
                return "You can turn on this app’s extension in the Extensions section of Safari Settings."
            }
            
            return "You can turn on this app’s extension in Safari Extensions preferences."
        }
    }
    
    var preferencesButtonTitle: LocalizedStringResource {
        useSafariSettingsCopy ? "Quit and Open Safari Settings..." : "Quit and Open Safari Extensions Preferences..."
    }
    
    /// Loads Safari extension state and updates macOS-specific status messaging.
    func refreshSafariExtensionState() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [self] state, error in
            Task { @MainActor in
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
