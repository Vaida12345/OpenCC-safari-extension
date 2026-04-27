//
//  App.swift
//  OpenCC
//
//  Created by Vaida on 2026-04-27.
//

import SwiftUI

@main
struct OpenCCApp: App {
#if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
#elseif os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
#endif
    
    @StateObject private var viewModel: OpenCCSettingsViewModel
    
    /// Creates the SwiftUI app and wires persistent settings storage.
    init() {
        _viewModel = StateObject(
            wrappedValue: OpenCCSettingsViewModel(initialSettings: OpenCCSettingsStore.load()) {
                OpenCCSettingsStore.save($0)
            }
        )
    }
    
    var body: some Scene {
        WindowGroup {
            OpenCCSettingsView(viewModel: viewModel)
#if os(macOS)
                .task {
                    viewModel.refreshSafariExtensionState()
                }
#endif
        }
        .windowResizability(.contentSize)
    }
}
