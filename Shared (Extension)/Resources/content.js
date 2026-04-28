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
    config: "t2s",
    fontOverride: false
});

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

let currentSettings = { ...DEFAULT_SETTINGS };
let hasAppliedSettings = false;
let activeConverter = null;
let observer = null;
let isApplying = false;
let isAwaitingDocumentElement = false;

const SELF_MUTATION_FLAG = "__openccSelfMutation";
const ORIGINAL_FONT_FAMILY_FLAG = "__openccOriginalFontFamily";

const OVERRIDDEN_FONT_ELEMENTS = new Set();

const LOCALE_FONT_PROFILE = Object.freeze({
    cn: {
        regionToken: "SC",
        scriptToken: "Hans",
        fallbackSans: "PingFang SC",
        fallbackSerif: "Songti SC",
        fallbackKai: "Kaiti SC",
        fallbackMono: "SF Mono"
    },
    t: {
        regionToken: "TC",
        scriptToken: "Hant",
        fallbackSans: "PingFang TC",
        fallbackSerif: "Songti TC",
        fallbackKai: "Kaiti TC",
        fallbackMono: "SF Mono"
    },
    tw: {
        regionToken: "TC",
        scriptToken: "Hant",
        fallbackSans: "PingFang TC",
        fallbackSerif: "Songti TC",
        fallbackKai: "Kaiti TC",
        fallbackMono: "SF Mono"
    },
    twp: {
        regionToken: "TC",
        scriptToken: "Hant",
        fallbackSans: "PingFang TC",
        fallbackSerif: "Songti TC",
        fallbackKai: "Kaiti TC",
        fallbackMono: "SF Mono"
    },
    hk: {
        regionToken: "HK",
        scriptToken: "Hant",
        fallbackSans: "PingFang HK",
        fallbackSerif: "Songti TC",
        fallbackKai: "Kaiti TC",
        fallbackMono: "SF Mono"
    },
    jp: {
        regionToken: "JP",
        scriptToken: "Jpan",
        fallbackSans: "Hiragino Sans",
        fallbackSerif: "Hiragino Mincho ProN",
        fallbackKai: "Klee One",
        fallbackMono: "SF Mono"
    }
});

/**
 * Starts observing DOM mutations for incremental conversion updates.
 */
function startObserving() {
    if (!observer) {
        return;
    }

    if (!document.documentElement) {
        if (isAwaitingDocumentElement) {
            return;
        }

        isAwaitingDocumentElement = true;
        document.addEventListener("DOMContentLoaded", () => {
            isAwaitingDocumentElement = false;
            startObserving();
        }, { once: true });
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
 * @returns {{enabled: boolean, config: string, fontOverride: boolean}} Normalized settings.
 */
function normalizeSettings(rawSettings) {
    const candidate = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const config = typeof candidate.config === "string" && CONFIG_TO_LOCALE[candidate.config]
        ? candidate.config
        : DEFAULT_SETTINGS.config;
    const enabled = typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled;
    const fontOverride = typeof candidate.fontOverride === "boolean"
        ? candidate.fontOverride
        : DEFAULT_SETTINGS.fontOverride;

    return { enabled, config, fontOverride };
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
 *
 * Editable regions are ignored to avoid mutating user input while typing.
 * @param {Text} textNode Node being evaluated.
 * @returns {boolean} Whether this node must be skipped.
 */
function shouldSkipTextNode(textNode) {
    const parent = textNode.parentElement;
    if (!parent) {
        return true;
    }

    return parent.isContentEditable
        || Boolean(parent.closest(".ignore-opencc"))
        || SKIP_TAGS.has(parent.tagName);
}

/**
 * Escapes regular-expression metacharacters in a literal string.
 * @param {string} value Source string.
 * @returns {string} Escaped string for regex construction.
 */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determines whether a font-family appears region-specific for the source locale.
 * @param {string} fontFamily Computed font-family string.
 * @param {string} fromLocale Source locale key.
 * @returns {boolean} True when the font stack appears locale-specific.
 */
function isSourceNativeFont(fontFamily, fromLocale) {
    const profile = LOCALE_FONT_PROFILE[fromLocale];
    if (!profile) {
        return false;
    }

    const sample = fontFamily.toLowerCase();
    const regionPattern = new RegExp(`\\b${escapeRegExp(profile.regionToken)}\\b`, "i");
    const scriptPattern = new RegExp(`\\b${escapeRegExp(profile.scriptToken)}\\b`, "i");

    return regionPattern.test(fontFamily)
        || scriptPattern.test(fontFamily)
        || sample.includes("traditional")
        || sample.includes("simplified")
        || sample.includes("hant")
        || sample.includes("hans");
}

/**
 * Replaces locale tokens in a font-family list.
 * @param {string} fontFamily Computed font-family string.
 * @param {string} fromLocale Source locale key.
 * @param {string} toLocale Destination locale key.
 * @returns {string} Remapped font-family string.
 */
function remapFontFamily(fontFamily, fromLocale, toLocale) {
    const fromProfile = LOCALE_FONT_PROFILE[fromLocale];
    const toProfile = LOCALE_FONT_PROFILE[toLocale];
    if (!fromProfile || !toProfile) {
        return fontFamily;
    }

    let remapped = fontFamily;
    const localeTokenPattern = new RegExp(`\\b${escapeRegExp(fromProfile.regionToken)}\\b`, "gi");
    const scriptTokenPattern = new RegExp(`\\b${escapeRegExp(fromProfile.scriptToken)}\\b`, "gi");

    remapped = remapped.replace(localeTokenPattern, toProfile.regionToken);
    remapped = remapped.replace(scriptTokenPattern, toProfile.scriptToken);

    if (fromProfile.scriptToken === "Hans") {
        remapped = remapped.replace(/\bSimplified\b/gi, "Traditional");
    }

    if (fromProfile.scriptToken === "Hant") {
        remapped = remapped.replace(/\bTraditional\b/gi, "Simplified");
    }

    return remapped;
}

/**
 * Chooses a destination system fallback font using the original font traits.
 * @param {string} fontFamily Computed font-family string.
 * @param {string} toLocale Destination locale key.
 * @returns {string} System fallback font family.
 */
function chooseFallbackFont(fontFamily, toLocale) {
    const profile = LOCALE_FONT_PROFILE[toLocale] ?? LOCALE_FONT_PROFILE["cn"];
    const sample = fontFamily.toLowerCase();

    if (sample.includes("kai")) {
        return profile.fallbackKai;
    }

    if (sample.includes("serif") || sample.includes("song") || sample.includes("ming")) {
        return profile.fallbackSerif;
    }

    if (sample.includes("mono")) {
        return profile.fallbackMono;
    }

    return profile.fallbackSans;
}

/**
 * Applies a reversible inline font-family override to an element.
 * @param {HTMLElement} element Target element.
 * @param {string} fontFamily New font-family value.
 */
function applyFontOverride(element, fontFamily) {
    if (typeof element[ORIGINAL_FONT_FAMILY_FLAG] !== "string") {
        element[ORIGINAL_FONT_FAMILY_FLAG] = element.style.fontFamily ?? "";
    }

    if (element.style.fontFamily === fontFamily) {
        OVERRIDDEN_FONT_ELEMENTS.add(element);
        return;
    }

    element.style.fontFamily = fontFamily;
    OVERRIDDEN_FONT_ELEMENTS.add(element);
}

/**
 * Applies font override to a converted text node when rules are satisfied.
 * @param {Text} textNode Converted text node.
 * @param {string} original Original text content.
 * @param {string} converted Converted text content.
 */
function maybeOverrideFontForConvertedText(textNode, original, converted) {
    if (!currentSettings.fontOverride || original === converted) {
        return;
    }

    const parent = textNode.parentElement;
    if (!(parent instanceof HTMLElement)) {
        return;
    }

    const localePair = CONFIG_TO_LOCALE[currentSettings.config];
    if (!localePair) {
        return;
    }

    const computedFontFamily = globalThis.getComputedStyle(parent).fontFamily ?? "";
    if (!isSourceNativeFont(computedFontFamily, localePair.from)) {
        return;
    }

    const remapped = remapFontFamily(computedFontFamily, localePair.from, localePair.to);
    const destinationFont = remapped === computedFontFamily
        ? chooseFallbackFont(computedFontFamily, localePair.to)
        : remapped;

    applyFontOverride(parent, destinationFont);
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
    const hasChanged = guardConvertedText(textNode, converted);
    if (!hasChanged) {
        return;
    }

    maybeOverrideFontForConvertedText(textNode, original, converted);
}

/**
 * Applies converted text only when needed and marks extension-originated writes.
 * @param {Text} textNode Text node to update.
 * @param {string} converted Converted text.
 * @returns {boolean} True when text node content changed.
 */
function guardConvertedText(textNode, converted) {
    if (converted === textNode.nodeValue) {
        return false;
    }

    textNode[SELF_MUTATION_FLAG] = true;
    textNode.nodeValue = converted;
    return true;
}

/**
 * Captures latest original text and converts immediately when enabled.
 * @param {Text} textNode Text node to snapshot and optionally convert.
 */
function captureAndMaybeConvertTextNode(textNode) {
    textNode.__openccOriginal = textNode.nodeValue ?? "";
    if (!currentSettings.enabled) {
        return;
    }

    convertTextNode(textNode);
}

/**
 * Restores a text node to the value captured before conversion.
 * @param {Text} textNode Text node to restore.
 */
function restoreTextNode(textNode) {
    if (typeof textNode.__openccOriginal !== "string") {
        return;
    }

    textNode[SELF_MUTATION_FLAG] = true;
    textNode.nodeValue = textNode.__openccOriginal;
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
 * Restores all font overrides applied by this extension.
 */
function restoreOverriddenFonts() {
    OVERRIDDEN_FONT_ELEMENTS.forEach((element) => {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        const originalFontFamily = element[ORIGINAL_FONT_FAMILY_FLAG];
        if (typeof originalFontFamily !== "string") {
            return;
        }

        if (originalFontFamily) {
            element.style.fontFamily = originalFontFamily;
        } else {
            element.style.removeProperty("font-family");
        }

        delete element[ORIGINAL_FONT_FAMILY_FLAG];
    });

    OVERRIDDEN_FONT_ELEMENTS.clear();
}

/**
 * Restores the complete document to original text values.
 */
function restoreDocument() {
    if (!document.documentElement) {
        return;
    }

    isApplying = true;
    walkTextNodes(document.documentElement, restoreTextNode);
    restoreOverriddenFonts();
    isApplying = false;
}

/**
 * Converts the complete document using the current converter.
 */
function convertDocument() {
    if (!activeConverter || !document.documentElement) {
        return;
    }

    isApplying = true;
    walkTextNodes(document.documentElement, convertTextNode);
    isApplying = false;
}

/**
 * Builds a converter from an OpenCC config code.
 * @param {string} config OpenCC config key.
 * @returns {((text: string) => string) | null} Converter function when available.
 */
function createConverter(config) {
    if (typeof OpenCC === "undefined" || typeof OpenCC.Converter !== "function") {
        return null;
    }

    const locale = CONFIG_TO_LOCALE[config] ?? CONFIG_TO_LOCALE[DEFAULT_SETTINGS.config];
    return OpenCC.Converter({ from: locale.from, to: locale.to });
}

/**
 * Applies settings by restoring text first, then converting if enabled.
 *
 * Converter initialization is lazy and only occurs when conversion is enabled.
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} settings New settings.
 */
function applySettings(settings) {
    const normalized = normalizeSettings(settings);
    currentSettings = normalized;
    hasAppliedSettings = true;
    activeConverter = normalized.enabled ? createConverter(normalized.config) : null;

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
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} lhs Left settings.
 * @param {{enabled: boolean, config: string, fontOverride: boolean}} rhs Right settings.
 * @returns {boolean} True when both settings represent the same mode.
 */
function areSettingsEqual(lhs, rhs) {
    return lhs.enabled === rhs.enabled
        && lhs.config === rhs.config
        && lhs.fontOverride === rhs.fontOverride;
}

/**
 * Pulls latest settings from background/native and applies them.
 *
 * The first sync always applies settings so the converter is initialized,
 * even when the stored values match in-memory defaults.
 * @returns {Promise<void>}
 */
async function syncSettingsFromBackground() {
    const { settings } = await browser.runtime.sendMessage({ type: "opencc.getSettings" });
    const normalized = normalizeSettings(settings);

    if (hasAppliedSettings && areSettingsEqual(normalized, currentSettings)) {
        return;
    }

    applySettings(normalized);
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

                if (node[SELF_MUTATION_FLAG]) {
                    node[SELF_MUTATION_FLAG] = false;
                    return;
                }

                captureAndMaybeConvertTextNode(node);
                return;
            }

            mutation.addedNodes.forEach((addedNode) => {
                if (addedNode.nodeType === Node.TEXT_NODE) {
                    captureAndMaybeConvertTextNode(addedNode);
                    return;
                }

                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    walkTextNodes(addedNode, captureAndMaybeConvertTextNode);
                }
            });
        });
    });

    startObserving();
}

/**
 * Bootstraps content script with initial settings and mutation observation.
 */
async function initContentScript() {
    try {
        await syncSettingsFromBackground();
    } catch {
        applySettings(DEFAULT_SETTINGS);
    }

    ensureObserver();
}

browser.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
        return undefined;
    }

    if (message.type === "opencc.settingsChanged") {
        applySettings(message.settings);
        return Promise.resolve({ ok: true });
    }

    return undefined;
});

initContentScript().catch(() => {
    // Ignore initialization failures.
});
