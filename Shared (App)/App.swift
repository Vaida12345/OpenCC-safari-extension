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
    
    @StateObject private var viewModel = OpenCCSettingsViewModel()
    
    
    var body: some Scene {
        WindowGroup {
            OpenCCSettingsView(viewModel: viewModel)
#if os(macOS)
                .task {
                    await viewModel.refreshSafariExtensionState()
                }
#endif
        }
#if os(macOS)
        .windowResizability(.contentSize)
        .windowStyle(.hiddenTitleBar)
#endif
    }
}
