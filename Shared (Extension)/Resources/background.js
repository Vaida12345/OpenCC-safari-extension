const NATIVE_APP_IDENTIFIER = "Vaida.app.OpenCC.Extension";

const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    config: "t2s",
    fontOverride: false
});

const SUPPORTED_CONFIGS = new Set([
    "s2t", "t2s", "s2tw", "tw2s", "s2hk", "hk2s", "s2twp", "tw2sp",
    "t2tw", "tw2t", "t2twp", "tw2tp", "t2hk", "hk2t", "t2jp", "jp2t"
]);

/**
 * Returns true when running in an iPadOS Web Extension context.
 *
 * iPadOS may present itself as MacIntel, so touch-point probing is required.
 * @returns {boolean} True when current runtime is iPadOS.
 */
function isIPadWebExtensionRuntime() {
    const navigatorObject = globalThis.navigator;
    if (!navigatorObject) {
        return false;
    }

    const userAgent = navigatorObject.userAgent ?? "";
    if (/iPad/.test(userAgent)) {
        return true;
    }

    const platform = navigatorObject.platform ?? "";
    const maxTouchPoints = Number(navigatorObject.maxTouchPoints ?? 0);
    return platform === "MacIntel" && maxTouchPoints > 1;
}

const shouldUseNativeMessaging = !isIPadWebExtensionRuntime();

/**
 * Ensures external inputs become a safe settings object.
 * @param {unknown} rawSettings Untrusted settings payload.
 * @returns {{enabled: boolean, config: string, fontOverride: boolean}} Normalized OpenCC settings.
 */
function normalizeSettings(rawSettings) {
    const candidate = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const enabled = typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled;
    const config = typeof candidate.config === "string" && SUPPORTED_CONFIGS.has(candidate.config)
        ? candidate.config
        : DEFAULT_SETTINGS.config;
    const fontOverride = typeof candidate.fontOverride === "boolean"
        ? candidate.fontOverride
        : DEFAULT_SETTINGS.fontOverride;

    return { enabled, config, fontOverride };
}

/**
 * Reads settings from the native extension handler.
 *
 * Native messaging is skipped on iOS/iPadOS to avoid popup startup crashes.
 * @returns {Promise<{enabled: boolean, config: string, fontOverride: boolean} | null>} Native settings, or null when unavailable.
 */
async function getNativeSettings() {
    if (!shouldUseNativeMessaging) {
        return null;
    }

    try {
        const response = await browser.runtime.sendNativeMessage(NATIVE_APP_IDENTIFIER, { action: "getSettings" });
        return normalizeSettings(response?.settings);
    } catch {
        return null;
    }
}

/**
 * Persists settings to the native extension handler.
 *
 * Native messaging is skipped on iOS/iPadOS to avoid popup startup crashes.
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} settings Normalized settings.
 * @returns {Promise<boolean>} True if native persistence succeeded.
 */
async function setNativeSettings(settings) {
    if (!shouldUseNativeMessaging) {
        return false;
    }

    try {
        const response = await browser.runtime.sendNativeMessage(NATIVE_APP_IDENTIFIER, {
            action: "setSettings",
            settings
        });
        return Boolean(response?.ok);
    } catch {
        return false;
    }
}

/**
 * Reads settings using native storage first, then browser storage fallback.
 * @returns {Promise<{enabled: boolean, config: string, fontOverride: boolean}>} Effective extension settings.
 */
async function getEffectiveSettings() {
    const native = await getNativeSettings();
    if (native) {
        await browser.storage.local.set({ openccSettings: native });
        return native;
    }

    const local = await browser.storage.local.get("openccSettings");
    const normalized = normalizeSettings(local.openccSettings);
    return normalized;
}

/**
 * Writes settings to native storage when available and always mirrors to browser storage.
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} nextSettings Settings to persist.
 * @returns {Promise<{enabled: boolean, config: string, fontOverride: boolean}>} Persisted settings.
 */
async function persistSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    await setNativeSettings(normalized);
    await browser.storage.local.set({ openccSettings: normalized });
    return normalized;
}

/**
 * Broadcasts settings to all tabs so content scripts can re-convert immediately.
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} settings Updated settings.
 * @returns {Promise<void>}
 */
async function broadcastSettings(settings) {
    const tabs = await browser.tabs.query({});

    await Promise.all(tabs.map(async (tab) => {
        if (typeof tab.id !== "number") {
            return;
        }

        try {
            await browser.tabs.sendMessage(tab.id, {
                type: "opencc.settingsChanged",
                settings
            });
        } catch {
            // Ignore tabs without injected content scripts.
        }
    }));
}

/**
 * Applies settings changes from popup/app requests.
 * @param {unknown} requestedSettings Input payload from caller.
 * @returns {Promise<{enabled: boolean, config: string, fontOverride: boolean}>} Updated settings.
 */
async function updateSettings(requestedSettings) {
    const settings = await persistSettings(requestedSettings);
    await broadcastSettings(settings);
    return settings;
}

/**
 * Sends an immediate conversion request to the active tab.
 * @returns {Promise<{enabled: boolean, config: string, fontOverride: boolean}>} Effective settings used for conversion.
 */
async function convertActiveTabNow() {
    const settings = await getEffectiveSettings();
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (activeTab && typeof activeTab.id === "number") {
        try {
            await browser.tabs.sendMessage(activeTab.id, { type: "opencc.convertNow", settings });
        } catch {
            // Ignore unavailable tabs.
        }
    }

    return settings;
}

/**
 * Opens extension settings in a regular tab when popover presentation is unavailable.
 * @returns {Promise<void>}
 */
async function openSettingsTab() {
    const url = browser.runtime.getURL("popup.html");
    await browser.tabs.create({ url });
}

/**
 * Returns true when the runtime can attempt programmatic popover presentation.
 * @returns {boolean}
 */
function canAttemptPopoverPresentation() {
    return Boolean(
        browser.action
        && typeof browser.action.setPopup === "function"
        && typeof browser.action.openPopup === "function"
    );
}

/**
 * Tries to open popover first and falls back to tab settings when popover is unavailable.
 * @returns {Promise<void>}
 */
async function openPopoverOrFallback() {
    if (!canAttemptPopoverPresentation()) {
        await openSettingsTab();
        return;
    }

    try {
        await browser.action.setPopup({ popup: "popup.html" });
        await browser.action.openPopup();
    } catch {
        await openSettingsTab();
    } finally {
        try {
            await browser.action.setPopup({ popup: "" });
        } catch {
            // Ignore popup reset failures.
        }
    }
}

/**
 * Configures iOS/iPadOS action behavior: prefer popover, fallback to a new tab.
 *
 * Safari with compact tab bar can fail to anchor extension popovers on iPad.
 * @returns {Promise<void>}
 */
async function configureActionForRuntime() {
    if (!isIPadWebExtensionRuntime()) {
        return;
    }

    try {
        await browser.action.setPopup({ popup: "" });
    } catch {
        // Ignore environments where popup override is unavailable.
    }

    browser.action.onClicked.addListener(() => {
        openPopoverOrFallback()
            .catch(() => {
                // Ignore runtime failures.
            });
    });
}

browser.runtime.onInstalled.addListener(async () => {
    const settings = await getEffectiveSettings();
    await persistSettings(settings);
});

browser.runtime.onStartup.addListener(() => {
    getEffectiveSettings()
        .catch(() => {
            // Ignore startup bootstrap failures.
        });
});

configureActionForRuntime()
    .catch(() => {
        // Ignore runtime action configuration failures.
    });

getEffectiveSettings()
    .catch(() => {
        // Ignore bootstrap failures.
    });

browser.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
        return undefined;
    }

    if (message.type === "opencc.getSettings") {
        return getEffectiveSettings().then((settings) => ({ settings }));
    }

    if (message.type === "opencc.updateSettings") {
        return updateSettings(message.settings).then((settings) => ({ settings }));
    }

    if (message.type === "opencc.convertNow") {
        return convertActiveTabNow().then((settings) => ({ settings }));
    }

    return undefined;
});
