# OpenCC (CC Converter)

## Overview

OpenCC is a Safari extension project with iOS and macOS host apps.

- Extension name: `CC Converter`
- Core conversion engine: `opencc-js` bundled locally as `opencc-full.js`
- Conversion scope: Web page text in Safari tabs
- Privacy model: Offline conversion, with only user configuration persisted

## Features

- Convert Chinese text between Traditional and Simplified variants directly in Safari.
- Configure conversion options from the extension popup.
- Manage extension state from the host app (especially on macOS).
- Sync/read settings through the native bridge (`SafariWebExtensionHandler`).

## Installation
Please [download from App Store](https://apps.apple.com/us/app/cc-converter/id6764072003) or [see release page](https://github.com/Vaida12345/OpenCC-safari-extension/releases).

## Project Layout

- `Shared (App)/`
- `Shared (Extension)/`
- `iOS (App)/`, `macOS (App)/`
- `iOS (Extension)/`, `macOS (Extension)/`
- `WORKFLOW.md` for detailed extension data flow and preset maintenance notes

## Key Files

- `Shared (App)/App.swift`: SwiftUI app entry point
- `Shared (App)/SettingsView.swift`: Settings and status UI
- `Shared (App)/ViewModel.swift`: macOS Safari extension state handling
- `Shared (Extension)/SafariWebExtensionHandler.swift`: native messaging bridge
- `Shared (Extension)/Resources/manifest.json`: extension registration and permissions
- `Shared (Extension)/Resources/content.js`: in-page conversion logic
- `Shared (Extension)/Resources/background.js`: settings propagation and tab messaging
- `Shared (Extension)/Resources/popup.js`: popup settings UI behavior

## Supported OpenCC Presets

`s2t`, `t2s`, `s2tw`, `tw2s`, `s2hk`, `hk2s`, `s2twp`, `tw2sp`, `t2tw`, `tw2t`, `t2twp`, `tw2tp`, `t2hk`, `hk2t`, `t2jp`, `jp2t`

## Development

1. Open the Xcode project/workspace.
2. Select iOS or macOS app scheme.
3. Build and run the host app.
4. Enable the Safari extension:
- macOS: Safari > Settings > Extensions
- iOS: Settings > Safari > Extensions
5. Use the extension popup to change conversion configuration.

## Notes

- Extension resources are in `Shared (Extension)/Resources`.
- You need to download opencc-full.js from [opencc-js](https://github.com/nk2028/opencc-js) and put in `Shared (Extension)/Resources`.
- For shared settings reliability across app/extension, use matching App Group setup (see `WORKFLOW.md`).
- If you add a new conversion preset, update the files listed in `WORKFLOW.md`.

## Credits

- [opencc-js](https://github.com/nk2028/opencc-js) by [nk2028](https://github.com/nk2028)
- [OpenCC](https://github.com/BYVoid/OpenCC) by [BYVoid](https://github.com/BYVoid)
