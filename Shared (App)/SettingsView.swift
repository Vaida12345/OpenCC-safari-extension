//
//  SettingsView.swift
//  OpenCC
//
//  Created by Vaida on 2026-04-27.
//

import SwiftUI


struct OpenCCSettingsView: View {
    @ObservedObject var viewModel: OpenCCSettingsViewModel
    
    var body: some View {
        TabView {
            Tab {
                VStack(alignment: .leading, spacing: 16) {
                    Section {
#if os(iOS)
                        Text("You can turn on OpenCC’s Safari extension in Settings.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .padding(.bottom)
#elseif os(macOS)
                        Button {
                            viewModel.openSafariPreferences()
                        } label: {
                            Label(viewModel.preferencesButtonTitle, systemImage: "safari")
                                .labelStyle(.titleOnly)
                        }
                        .buttonStyle(.bordered)
                        
                        Text(viewModel.extensionMessage)
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .padding(.bottom)
#endif
                    }
                }
            } label: {
                Label("Extension", systemImage: "safari")
            }
            
            Tab {
                VStack(alignment: .leading, spacing: 16) {
                    Form {
                        Section {
                            Toggle("Enable Conversion", isOn: Binding(
                                get: { viewModel.enabled },
                                set: { viewModel.updateEnabled($0) }
                            ))
                            
                            Picker("Input Text", selection: Binding(
                                get: { viewModel.selectedInput },
                                set: { viewModel.updateInput($0) }
                            )) {
                                ForEach(viewModel.inputOptions, id: \.value) { input in
                                    Text(input.label).tag(input.value)
                                }
                            }
                            
                            Picker("Output Text", selection: Binding(
                                get: { viewModel.selectedConfig },
                                set: { viewModel.updateOutput($0) }
                            )) {
                                ForEach(viewModel.outputOptions, id: \.value) { output in
                                    Text(output.outputLabel).tag(output.value)
                                }
                            }
                        } header: {
                            Text("Conversion Settings")
                        }
                    }
                    
                    Text(viewModel.statusText)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
                .padding(20)
            } label: {
                Label("Settings", systemImage: "gear")
            }
        }
#if os(macOS)
        .frame(width: 420, height: 280)
#endif
    }
}


#Preview {
    OpenCCSettingsView(
        viewModel: OpenCCSettingsViewModel(initialSettings: .init(enabled: true, config: defaultOpenCCConfig)) { _ in }
    )
}
