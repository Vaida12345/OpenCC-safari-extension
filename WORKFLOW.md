# OpenCC Safari Extension Workflow

## What this app now does
- Bundles `opencc-js` locally as `Shared (Extension)/Resources/opencc-full.js`.
- Converts page text in content scripts using OpenCC presets.
- Keeps settings in native storage via `SafariWebExtensionHandler.swift`.
- Lets users change options from:
  - Extension popup (`popup.html`, `popup.js`, `popup.css`)
  - Host app UI (`Shared (App)/Resources/Main.html/Base`, `Script.js`, `Style.css`)

## Data flow
1. User changes preset or enabled state in popup/app UI.
2. Change is saved through native messaging action `setSettings`.
3. Background script mirrors settings to browser storage and broadcasts to tabs.
4. Content script receives `opencc.settingsChanged` and re-applies conversion.

## Files and responsibilities
- `Shared (Extension)/Resources/manifest.json`
  - Registers content scripts and permissions.
- `Shared (Extension)/Resources/opencc-full.js`
  - Bundled OpenCC engine (`opencc-js` UMD build).
- `Shared (Extension)/Resources/content.js`
  - DOM text conversion, restore logic, and mutation observer.
- `Shared (Extension)/Resources/background.js`
  - Settings orchestration and tab broadcast.
- `Shared (Extension)/Resources/popup.js`
  - Popup settings UI behavior.
- `Shared (Extension)/SafariWebExtensionHandler.swift`
  - Native `getSettings` and `setSettings` implementation.
- `Shared (App)/ViewController.swift`
  - App-side web bridge and settings persistence.
- `Shared (App)/Resources/Script.js`
  - App settings UI behavior and native bridge calls.

## OpenCC presets included
- `s2t`, `t2s`, `s2tw`, `tw2s`, `s2hk`, `hk2s`, `s2twp`, `tw2sp`
- `t2tw`, `tw2t`, `t2twp`, `tw2tp`, `t2hk`, `hk2t`, `t2jp`, `jp2t`

## How to add a new preset
1. Add the key to `SUPPORTED_CONFIGS` in `background.js`.
2. Add the key and locale mapping to `CONFIG_TO_LOCALE` in `content.js`.
3. Add the option entry in both `popup.js` and app `Script.js`.
4. Add the key to `supportedOpenCCConfigs` in:
   - `Shared (App)/ViewController.swift`
   - `Shared (Extension)/SafariWebExtensionHandler.swift`

## Important note about shared storage
- This implementation uses suite name `group.Vaida.app.OpenCC`.
- To ensure reliable cross-process sharing on-device, enable App Groups for app + extension targets with the same identifier.
