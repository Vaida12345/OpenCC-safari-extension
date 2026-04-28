const OPENCC_PRESETS = [
    {
        value: "s2t",
        inputValue: "simplified",
        inputLabelKey: "preset_simplified_chinese",
        inputLabelFallback: "Simplified Chinese",
        outputLabelKey: "preset_traditional_chinese_opencc",
        outputLabelFallback: "Traditional Chinese (OpenCC)"
    },
    {
        value: "t2s",
        inputValue: "traditional",
        inputLabelKey: "preset_traditional_chinese_opencc",
        inputLabelFallback: "Traditional Chinese (OpenCC)",
        outputLabelKey: "preset_simplified_chinese",
        outputLabelFallback: "Simplified Chinese"
    },
    {
        value: "s2tw",
        inputValue: "simplified",
        inputLabelKey: "preset_simplified_chinese",
        inputLabelFallback: "Simplified Chinese",
        outputLabelKey: "preset_taiwan_traditional",
        outputLabelFallback: "Taiwan Traditional"
    },
    {
        value: "tw2s",
        inputValue: "taiwan",
        inputLabelKey: "preset_taiwan_traditional",
        inputLabelFallback: "Taiwan Traditional",
        outputLabelKey: "preset_simplified_chinese",
        outputLabelFallback: "Simplified Chinese"
    },
    {
        value: "s2hk",
        inputValue: "simplified",
        inputLabelKey: "preset_simplified_chinese",
        inputLabelFallback: "Simplified Chinese",
        outputLabelKey: "preset_hong_kong_traditional",
        outputLabelFallback: "Hong Kong Traditional"
    },
    {
        value: "hk2s",
        inputValue: "hongkong",
        inputLabelKey: "preset_hong_kong_traditional",
        inputLabelFallback: "Hong Kong Traditional",
        outputLabelKey: "preset_simplified_chinese",
        outputLabelFallback: "Simplified Chinese"
    },
    {
        value: "s2twp",
        inputValue: "simplified",
        inputLabelKey: "preset_simplified_chinese",
        inputLabelFallback: "Simplified Chinese",
        outputLabelKey: "preset_taiwan_traditional_idioms",
        outputLabelFallback: "Taiwan Traditional + idioms"
    },
    {
        value: "tw2sp",
        inputValue: "taiwan-idioms",
        inputLabelKey: "preset_taiwan_traditional_idioms",
        inputLabelFallback: "Taiwan Traditional + idioms",
        outputLabelKey: "preset_simplified_chinese",
        outputLabelFallback: "Simplified Chinese"
    },
    {
        value: "t2tw",
        inputValue: "traditional",
        inputLabelKey: "preset_traditional_chinese_opencc",
        inputLabelFallback: "Traditional Chinese (OpenCC)",
        outputLabelKey: "preset_taiwan_traditional",
        outputLabelFallback: "Taiwan Traditional"
    },
    {
        value: "tw2t",
        inputValue: "taiwan",
        inputLabelKey: "preset_taiwan_traditional",
        inputLabelFallback: "Taiwan Traditional",
        outputLabelKey: "preset_traditional_chinese_opencc",
        outputLabelFallback: "Traditional Chinese (OpenCC)"
    },
    {
        value: "t2twp",
        inputValue: "traditional",
        inputLabelKey: "preset_traditional_chinese_opencc",
        inputLabelFallback: "Traditional Chinese (OpenCC)",
        outputLabelKey: "preset_taiwan_traditional_idioms",
        outputLabelFallback: "Taiwan Traditional + idioms"
    },
    {
        value: "tw2tp",
        inputValue: "taiwan-idioms",
        inputLabelKey: "preset_taiwan_traditional_idioms",
        inputLabelFallback: "Taiwan Traditional + idioms",
        outputLabelKey: "preset_traditional_chinese_opencc",
        outputLabelFallback: "Traditional Chinese (OpenCC)"
    },
    {
        value: "t2hk",
        inputValue: "traditional",
        inputLabelKey: "preset_traditional_chinese_opencc",
        inputLabelFallback: "Traditional Chinese (OpenCC)",
        outputLabelKey: "preset_hong_kong_traditional",
        outputLabelFallback: "Hong Kong Traditional"
    },
    {
        value: "hk2t",
        inputValue: "hongkong",
        inputLabelKey: "preset_hong_kong_traditional",
        inputLabelFallback: "Hong Kong Traditional",
        outputLabelKey: "preset_traditional_chinese_opencc",
        outputLabelFallback: "Traditional Chinese (OpenCC)"
    },
    {
        value: "t2jp",
        inputValue: "traditional-kyujitai",
        inputLabelKey: "preset_traditional_kyujitai",
        inputLabelFallback: "Traditional (Kyujitai)",
        outputLabelKey: "preset_japanese_shinjitai",
        outputLabelFallback: "Japanese (Shinjitai)"
    },
    {
        value: "jp2t",
        inputValue: "japanese-shinjitai",
        inputLabelKey: "preset_japanese_shinjitai",
        inputLabelFallback: "Japanese (Shinjitai)",
        outputLabelKey: "preset_traditional_kyujitai",
        outputLabelFallback: "Traditional (Kyujitai)"
    }
];

const DEFAULT_CONFIG = "tw2sp";
const DEFAULT_FONT_OVERRIDE = false;

const enabledToggle = document.getElementById("enabled-toggle");
const inputSelect = document.getElementById("input-select");
const outputSelect = document.getElementById("output-select");
const fontOverrideToggle = document.getElementById("font-override-toggle");
const convertNowButton = document.getElementById("convert-now");
const status = document.getElementById("status");

/**
 * Returns a localized extension string with fallback text.
 * @param {string} key Localization key.
 * @param {string} fallback Fallback text when key is missing.
 * @returns {string} Localized text.
 */
function t(key, fallback) {
    const localized = browser.i18n.getMessage(key);
    return localized || fallback;
}

/**
 * Resolves localized input label for a preset.
 * @param {{inputLabelKey: string, inputLabelFallback: string}} preset OpenCC preset.
 * @returns {string} Localized input label.
 */
function getInputLabel(preset) {
    return t(preset.inputLabelKey, preset.inputLabelFallback);
}

/**
 * Resolves localized output label for a preset.
 * @param {{outputLabelKey: string, outputLabelFallback: string}} preset OpenCC preset.
 * @returns {string} Localized output label.
 */
function getOutputLabel(preset) {
    return t(preset.outputLabelKey, preset.outputLabelFallback);
}

/**
 * Localizes static popup labels declared in markup.
 */
function localizeStaticText() {
    const elements = document.querySelectorAll("[data-i18n]");

    elements.forEach((element) => {
        const key = element.dataset.i18n;
        if (typeof key !== "string") {
            return;
        }

        const fallback = element.textContent?.trim() ?? "";
        element.textContent = t(key, fallback);
    });
}

/**
 * Finds preset by config key.
 * @param {string | undefined} config OpenCC config key.
 * @returns {{value: string, inputValue: string, inputLabelKey: string, inputLabelFallback: string, outputLabelKey: string, outputLabelFallback: string} | undefined}
 */
function getPreset(config) {
    return OPENCC_PRESETS.find((item) => item.value === config);
}

/**
 * Populates input picker.
 */
function renderInputOptions() {
    const seenInputs = new Set();
    const fragment = document.createDocumentFragment();

    OPENCC_PRESETS.forEach((item) => {
        if (seenInputs.has(item.inputValue)) {
            return;
        }

        seenInputs.add(item.inputValue);
        const option = document.createElement("option");
        option.value = item.inputValue;
        option.textContent = getInputLabel(item);
        fragment.appendChild(option);
    });

    inputSelect.appendChild(fragment);
}

/**
 * Populates output picker based on selected input.
 * @param {string} inputValue Selected input value.
 * @param {string | undefined} preferredConfig Config key to preselect when possible.
 */
function renderOutputOptions(inputValue, preferredConfig) {
    outputSelect.textContent = "";
    const fragment = document.createDocumentFragment();
    const supportedOutputs = OPENCC_PRESETS.filter((item) => item.inputValue === inputValue);

    supportedOutputs.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = getOutputLabel(item);
        fragment.appendChild(option);
    });

    outputSelect.appendChild(fragment);

    if (supportedOutputs.length === 0) {
        return;
    }

    const hasPreferredConfig = supportedOutputs.some((item) => item.value === preferredConfig);
    outputSelect.value = hasPreferredConfig ? preferredConfig : supportedOutputs[0].value;
}

/**
 * Writes concise mode status.
 * @param {string | undefined} config OpenCC config key.
 * @param {string | undefined} suffix Optional suffix.
 */
function setModeStatus(config, suffix) {
    const preset = getPreset(config);

    if (!preset) {
        status.textContent = suffix ?? "";
        return;
    }

    const modeText = `${getInputLabel(preset)} → ${getOutputLabel(preset)}`;
    status.textContent = suffix ? `${modeText} • ${suffix}` : modeText;
}

/**
 * Updates popup widgets to match current settings.
 * @param {{enabled: boolean, config: string, fontOverride?: boolean}} settings OpenCC settings.
 */
function applySettingsToUI(settings) {
    const preset = getPreset(settings.config) ?? getPreset(DEFAULT_CONFIG) ?? OPENCC_PRESETS[0];
    enabledToggle.checked = Boolean(settings.enabled);
    fontOverrideToggle.checked = Boolean(settings.fontOverride ?? DEFAULT_FONT_OVERRIDE);
    inputSelect.value = preset.inputValue;
    renderOutputOptions(preset.inputValue, preset.value);
    setModeStatus(outputSelect.value);
}

/**
 * Reads current form values into settings payload.
 * @returns {{enabled: boolean, config: string, fontOverride: boolean}} Form settings.
 */
function readSettingsFromUI() {
    return {
        enabled: enabledToggle.checked,
        config: outputSelect.value,
        fontOverride: fontOverrideToggle.checked
    };
}

/**
 * Saves popup form settings via background script.
 */
async function saveSettings() {
    const { settings } = await browser.runtime.sendMessage({
        type: "opencc.updateSettings",
        settings: readSettingsFromUI()
    });

    applySettingsToUI(settings);
    setModeStatus(settings.config, t("popup_status_saved", "Saved"));
}

/**
 * Requests content script conversion on the active tab.
 */
async function convertNow() {
    await browser.runtime.sendMessage({ type: "opencc.convertNow" });
    setModeStatus(
        outputSelect.value,
        t("popup_status_conversion_requested", "Conversion requested for active tab")
    );
}

/**
 * Initializes popup state and event handlers.
 */
async function initPopup() {
    localizeStaticText();
    renderInputOptions();
    renderOutputOptions(inputSelect.value, DEFAULT_CONFIG);

    const { settings } = await browser.runtime.sendMessage({ type: "opencc.getSettings" });
    applySettingsToUI(settings);

    enabledToggle.addEventListener("change", saveSettings);
    fontOverrideToggle.addEventListener("change", saveSettings);
    inputSelect.addEventListener("change", () => {
        renderOutputOptions(inputSelect.value, outputSelect.value);
        saveSettings();
    });
    outputSelect.addEventListener("change", saveSettings);
    convertNowButton.addEventListener("click", convertNow);
}

initPopup().catch(() => {
    status.textContent = t("popup_status_failed_load_settings", "Failed to load settings");
});
