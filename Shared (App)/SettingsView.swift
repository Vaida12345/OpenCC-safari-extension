//
//  SettingsView.swift
//  OpenCC
//
//  Created by Vaida on 2026-04-27.
//

import SwiftUI

struct OpenCCSettingsView: View {
    @ObservedObject var viewModel: OpenCCSettingsViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        ContainerView {
            HStack(alignment: .top, spacing: 16) {
#if os(macOS)
                appIcon
                    .frame(maxHeight: 80)
#endif

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
#if os(macOS)
                        Text("CC Converter")
                            .font(.largeTitle.weight(.bold))
                            .fixedSize()
#else
                        Label {
                            Text("CC Converter")
                        } icon: {
                            Text("字")
                        }
                        .font(.headline)
#endif
                        
                        Button {
                            if let url = URL(string: "https://github.com/Vaida12345/OpenCC-safari-extension") {
                                openURL(url)
                            }
                        } label: {
                            Label("Github", systemImage: "link")
#if os(iOS)
                                .labelStyle(.titleOnly)
#endif
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .foregroundStyle(.secondary)
                                .background(.secondary.opacity(0.14), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    }

                    Text("Convert Traditional and Simplified Chinese directly in Safari with OpenCC.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .modifier(SectionModifier())

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("Safari Extension", systemImage: "safari")
                        .font(.headline)

#if os(macOS)
                    Spacer(minLength: 0)
                    
                    Button {
                        Task {
                            await viewModel.refreshSafariExtensionState()
                        }
                    } label: {
                        Label(extensionStatusTitle, systemImage: extensionStatusSymbol)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .foregroundStyle(extensionStatusTint)
                            .background(extensionStatusTint.opacity(0.14), in: Capsule())
                    }
                    .buttonStyle(.plain)
#endif
                }

                extensionStatusMessage
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

#if os(macOS)
                Button {
                    Task {
                        await viewModel.openSafariPreferences()
                    }
                } label: {
                    Label(viewModel.preferencesButtonTitle, systemImage: "gearshape")
                }
                .buttonStyle(.borderedProminent)
#endif
                
                Label("You can change conversion configuration in the Safari extension popup.", systemImage: "info.circle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .modifier(SectionModifier())
            
            privacySection
                .modifier(SectionModifier())
            
            creditsSection
                .modifier(SectionModifier())
        }
#if os(macOS)
        .padding(24)
        .frame(width: 480)
        .alert(isPresented: $viewModel.isErrorPresented, error: viewModel.error) {
            
        }
#endif
    }

    /// Displays privacy details for local-only conversion and stored data scope.
    private var privacySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Privacy", systemImage: "hand.raised")
                .font(.headline)

            Text("All conversions run completely offline. CC Converter makes no internet connection.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("The app stores nothing except your conversion configurations.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Displays attribution for open-source components used by the app.
    private var creditsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Credits", systemImage: "person.2")
                .font(.headline)

            Text("Powered by [opencc-js](https://github.com/nk2028/opencc-js) by [nk2028](https://github.com/nk2028) and [OpenCC](https://github.com/byvoid/opencc) by [BYVoid](https://github.com/BYVoid).")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Provides the GitHub repository URL displayed in settings.
    private var githubRepositoryURL: URL? {
        URL(string: "https://github.com")
    }

    @ViewBuilder
    private var appIcon: some View {
#if os(iOS)
        if let image = UIImage(named: "Icon") {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "character.book.closed")
                .resizable()
                .scaledToFit()
                .padding(16)
                .foregroundStyle(.secondary)
        }
#elseif os(macOS)
        if let image = NSImage(named: "Icon") {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
        } else {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .scaledToFit()
        }
#endif
    }

#if os(macOS)
    private var extensionStatusTitle: LocalizedStringResource {
        switch viewModel.extensionState {
        case .on:
            return "Enabled"
        case .off:
            return "Disabled"
        case .unknown:
            return "Unknown"
        }
    }

    private var extensionStatusSymbol: String {
        switch viewModel.extensionState {
        case .on:
            return "checkmark.circle.fill"
        case .off:
            return "xmark.circle.fill"
        case .unknown:
            return "questionmark.circle.fill"
        }
    }

    private var extensionStatusTint: Color {
        switch viewModel.extensionState {
        case .on:
            return .green
        case .off:
            return .orange
        case .unknown:
            return .secondary
        }
    }

    private var extensionStatusMessage: Text {
        Text(viewModel.extensionMessage)
    }
#else
    private var extensionStatusTitle: String { "Unavailable" }

    private var extensionStatusSymbol: String { "minus.circle.fill" }

    private var extensionStatusTint: Color { .secondary }

    private var extensionStatusMessage: Text {
        Text("You can manage CC Converter in Settings > Safari > Extensions.")
    }
#endif
}


struct SectionModifier: ViewModifier {
    func body(content: Content) -> some View {
#if os(macOS)
        content
            .padding(20)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
#else
        Section {
            content
                .padding(10)
        }
#endif
    }
}

struct ContainerView<ChildView: View>: View {
    
    let childView: () -> ChildView
    
    
    var body: some View {
        #if os(macOS)
        VStack(spacing: 20) {
            childView()
        }
        #else
        List {
            childView()
        }
        #endif
    }
    
    init(@ViewBuilder childView: @escaping () -> ChildView) {
        self.childView = childView
    }
    
}

#Preview {
    OpenCCSettingsView(viewModel: .init())
}
