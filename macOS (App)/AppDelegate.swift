//
//  AppDelegate.swift
//  macOS (App)
//
//  Created by Vaida on 2026-04-27.
//

import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    /// Handles post-launch setup for the SwiftUI app lifecycle.
    func applicationDidFinishLaunching(_ notification: Notification) {
    }

    /// Closes the app when its last window is closed.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
