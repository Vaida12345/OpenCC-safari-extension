const CONFIG_TO_LOCALE = Object.freeze({
    s2t: { from: "cn", to: "t" },
    t2s: { from: "t", to: "cn" },
    s2tw: { from: "cn", to: "tw" },
    tw2s: { from: "tw", to: "cn" },
    s2hk: { from: "cn", to: "hk" },
    hk2s: { from: "hk", to: "cn" },
    s2twp: { from: "cn", to: "twp" },
    tw2sp: { from: "twp", to: "cn" },
    t2tw: { from: "t", to: "tw" },
    tw2t: { from: "tw", to: "t" },
    t2twp: { from: "t", to: "twp" },
    tw2tp: { from: "twp", to: "t" },
    t2hk: { from: "t", to: "hk" },
    hk2t: { from: "hk", to: "t" },
    t2jp: { from: "t", to: "jp" },
    jp2t: { from: "jp", to: "t" }
});

const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    config: "t2s"
});

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);
const SETTINGS_SYNC_INTERVAL_MS = 3000;

let currentSettings = { ...DEFAULT_SETTINGS };
let activeConverter = null;
let observer = null;
let settingsSyncTimer = null;
let isApplying = false;

/**
 * Starts observing DOM mutations for incremental conversion updates.
 */
function startObserving() {
    if (!observer) {
        return;
    }

    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        characterDataOldValue: true
    });
}

/**
 * Temporarily pauses DOM observation while extension-originated updates run.
 */
function stopObserving() {
    if (!observer) {
        return;
    }

    observer.disconnect();
}

/**
 * Ensures settings received from extension background are safe.
 * @param {unknown} rawSettings Incoming settings.
 * @returns {{enabled: boolean, config: string}} Normalized settings.
 */
function normalizeSettings(rawSettings) {
    const candidate = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const config = typeof candidate.config === "string" && CONFIG_TO_LOCALE[candidate.config]
        ? candidate.config
        : DEFAULT_SETTINGS.config;
    const enabled = typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled;

    return { enabled, config };
}

/**
 * Lazily stores and returns the original text value for a text node.
 * @param {Text} textNode The text node to snapshot.
 * @returns {string} Original text content before conversion.
 */
function getOriginalText(textNode) {
    if (typeof textNode.__openccOriginal !== "string") {
        textNode.__openccOriginal = textNode.nodeValue ?? "";
    }

    return textNode.__openccOriginal;
}

/**
 * Returns true when a text node should be excluded from conversion.
 * @param {Text} textNode Node being evaluated.
 * @returns {boolean} Whether this node must be skipped.
 */
function shouldSkipTextNode(textNode) {
    const parent = textNode.parentElement;

    if (!parent) {
        return true;
    }

    if (parent.closest(".ignore-opencc")) {
        return true;
    }

    if (SKIP_TAGS.has(parent.tagName)) {
        return true;
    }

    return false;
}

/**
 * Converts a single text node from its stored original value.
 * @param {Text} textNode Text node to convert.
 */
function convertTextNode(textNode) {
    if (!activeConverter || shouldSkipTextNode(textNode)) {
        return;
    }

    const original = getOriginalText(textNode);
    if (!original.trim()) {
        return;
    }

    const converted = activeConverter(original);
    guardConvertedText(textNode, converted);
}

/**
 * Avoids redundant node assignments that can generate unnecessary mutation churn.
 * @param {Text} textNode Text node to update.
 * @param {string} converted Converted text.
 */
function guardConvertedText(textNode, converted) {
    if (converted === textNode.nodeValue) {
        return;
    }

    textNode.nodeValue = converted;
}

/**
 * Restores a text node to the value captured before conversion.
 * @param {Text} textNode Text node to restore.
 */
function restoreTextNode(textNode) {
    if (typeof textNode.__openccOriginal === "string") {
        textNode.nodeValue = textNode.__openccOriginal;
    }
}

/**
 * Traverses all text nodes under root and applies callback.
 * @param {Node} root Root node to process.
 * @param {(node: Text) => void} callback Callback per text node.
 */
function walkTextNodes(root, callback) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    let textNode = walker.nextNode();
    while (textNode) {
        callback(textNode);
        textNode = walker.nextNode();
    }
}

/**
 * Restores the complete document to original text values.
 */
function restoreDocument() {
    isApplying = true;
    walkTextNodes(document.documentElement, restoreTextNode);
    isApplying = false;
}

/**
 * Converts the complete document using the current converter.
 */
function convertDocument() {
    if (!activeConverter) {
        return;
    }

    isApplying = true;
    walkTextNodes(document.documentElement, convertTextNode);
    isApplying = false;
}

/**
 * Builds a converter from an OpenCC config code.
 * @param {string} config OpenCC config key.
 * @returns {(text: string) => string} Converter function.
 */
function createConverter(config) {
    const locale = CONFIG_TO_LOCALE[config] ?? CONFIG_TO_LOCALE[DEFAULT_SETTINGS.config];
    return OpenCC.Converter({ from: locale.from, to: locale.to });
}

/**
 * Applies settings by restoring text first, then converting if enabled.
 * @param {{enabled: boolean, config: string}} settings New settings.
 */
function applySettings(settings) {
    const normalized = normalizeSettings(settings);
    currentSettings = normalized;
    activeConverter = createConverter(normalized.config);

    const hadObserver = Boolean(observer);
    if (hadObserver) {
        stopObserving();
    }

    restoreDocument();

    if (normalized.enabled) {
        convertDocument();
    }

    if (hadObserver) {
        startObserving();
    }
}

/**
 * Compares two settings objects for semantic equality.
 * @param {{enabled: boolean, config: string}} lhs Left settings.
 * @param {{enabled: boolean, config: string}} rhs Right settings.
 * @returns {boolean} True when both settings represent the same mode.
 */
function areSettingsEqual(lhs, rhs) {
    return lhs.enabled === rhs.enabled && lhs.config === rhs.config;
}

/**
 * Pulls latest settings from background/native and applies them when changed.
 * @returns {Promise<void>}
 */
async function syncSettingsFromBackground() {
    const { settings } = await browser.runtime.sendMessage({ type: "opencc.getSettings" });
    const normalized = normalizeSettings(settings);

    if (areSettingsEqual(normalized, currentSettings)) {
        return;
    }

    applySettings(normalized);
}

/**
 * Starts periodic settings synchronization so app-side changes propagate to tabs.
 */
function startSettingsSync() {
    if (settingsSyncTimer !== null) {
        return;
    }

    settingsSyncTimer = window.setInterval(() => {
        syncSettingsFromBackground().catch(() => {
            // Ignore transient background/native messaging failures.
        });
    }, SETTINGS_SYNC_INTERVAL_MS);
}

/**
 * Handles dynamic DOM changes while preserving original text snapshots.
 */
function ensureObserver() {
    if (observer) {
        return;
    }

    observer = new MutationObserver((mutations) => {
        if (isApplying) {
            return;
        }

        mutations.forEach((mutation) => {
            if (mutation.type === "characterData") {
                const node = mutation.target;
                if (!(node instanceof Text)) {
                    return;
                }

                if (typeof node.__openccOriginal === "string" && mutation.oldValue === node.__openccOriginal) {
                    return;
                }

                node.__openccOriginal = node.nodeValue ?? "";
                if (currentSettings.enabled) {
                    convertTextNode(node);
                }
                return;
            }

            mutation.addedNodes.forEach((addedNode) => {
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    const textNode = addedNode;
                    textNode.__openccOriginal = textNode.nodeValue ?? "";
                    if (currentSettings.enabled) {
                        convertTextNode(textNode);
                    }
                    return;
                }

                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    walkTextNodes(addedNode, (textNode) => {
                        textNode.__openccOriginal = textNode.nodeValue ?? "";
                        if (currentSettings.enabled) {
                            convertTextNode(textNode);
                        }
                    });
                }
            });
        });
    });

    startObserving();
}

/**
 * Bootstraps content script and starts ongoing settings synchronization.
 */
async function initContentScript() {
    try {
        await syncSettingsFromBackground();
    } catch {
        applySettings(DEFAULT_SETTINGS);
    }

    ensureObserver();
    startSettingsSync();
}

browser.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
        return undefined;
    }

    if (message.type === "opencc.settingsChanged") {
        applySettings(message.settings);
        return Promise.resolve({ ok: true });
    }

    if (message.type === "opencc.convertNow") {
        applySettings(message.settings ?? currentSettings);
        return Promise.resolve({ ok: true });
    }

    return undefined;
});

initContentScript().catch(() => {
    // Ignore initialization failures.
});
