const NATIVE_APP_IDENTIFIER = "Vaida.app.OpenCC.Extension";

const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    config: "t2s"
});

const SUPPORTED_CONFIGS = new Set([
    "s2t", "t2s", "s2tw", "tw2s", "s2hk", "hk2s", "s2twp", "tw2sp",
    "t2tw", "tw2t", "t2twp", "tw2tp", "t2hk", "hk2t", "t2jp", "jp2t"
]);

/**
 * Ensures external inputs become a safe settings object.
 * @param {unknown} rawSettings Untrusted settings payload.
 * @returns {{enabled: boolean, config: string}} Normalized OpenCC settings.
 */
function normalizeSettings(rawSettings) {
    const candidate = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const enabled = typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled;
    const config = typeof candidate.config === "string" && SUPPORTED_CONFIGS.has(candidate.config)
        ? candidate.config
        : DEFAULT_SETTINGS.config;

    return { enabled, config };
}

/**
 * Reads settings from the native extension handler.
 * @returns {Promise<{enabled: boolean, config: string} | null>} Native settings, or null when unavailable.
 */
async function getNativeSettings() {
    try {
        const response = await browser.runtime.sendNativeMessage(NATIVE_APP_IDENTIFIER, { action: "getSettings" });
        return normalizeSettings(response?.settings);
    } catch {
        return null;
    }
}

/**
 * Persists settings to the native extension handler.
 * @param {{enabled: boolean, config: string}} settings Normalized settings.
 * @returns {Promise<boolean>} True if native persistence succeeded.
 */
async function setNativeSettings(settings) {
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
 * @returns {Promise<{enabled: boolean, config: string}>} Effective extension settings.
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
 * @param {{enabled: boolean, config: string}} nextSettings Settings to persist.
 * @returns {Promise<{enabled: boolean, config: string}>} Persisted settings.
 */
async function persistSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    await setNativeSettings(normalized);
    await browser.storage.local.set({ openccSettings: normalized });
    return normalized;
}

/**
 * Broadcasts settings to all tabs so content scripts can re-convert immediately.
 * @param {{enabled: boolean, config: string}} settings Updated settings.
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
 * @returns {Promise<{enabled: boolean, config: string}>} Updated settings.
 */
async function updateSettings(requestedSettings) {
    const settings = await persistSettings(requestedSettings);
    await broadcastSettings(settings);
    return settings;
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
        return getEffectiveSettings().then(async (settings) => {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (activeTab && typeof activeTab.id === "number") {
                try {
                    await browser.tabs.sendMessage(activeTab.id, { type: "opencc.convertNow", settings });
                } catch {
                    // Ignore unavailable tabs.
                }
            }

            return { settings };
        });
    }

    return undefined;
});
