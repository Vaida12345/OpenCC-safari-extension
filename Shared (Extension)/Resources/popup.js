const OPENCC_PRESETS = [
    { value: "s2t", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Traditional Chinese (OpenCC)" },
    { value: "t2s", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Simplified Chinese" },
    { value: "s2tw", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Taiwan Traditional" },
    { value: "tw2s", inputValue: "taiwan", inputLabel: "Taiwan Traditional", outputLabel: "Simplified Chinese" },
    { value: "s2hk", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Hong Kong Traditional" },
    { value: "hk2s", inputValue: "hongkong", inputLabel: "Hong Kong Traditional", outputLabel: "Simplified Chinese" },
    { value: "s2twp", inputValue: "simplified", inputLabel: "Simplified Chinese", outputLabel: "Taiwan Traditional + idioms" },
    { value: "tw2sp", inputValue: "taiwan-idioms", inputLabel: "Taiwan Traditional + idioms", outputLabel: "Simplified Chinese" },
    { value: "t2tw", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Taiwan Traditional" },
    { value: "tw2t", inputValue: "taiwan", inputLabel: "Taiwan Traditional", outputLabel: "Traditional Chinese (OpenCC)" },
    { value: "t2twp", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Taiwan Traditional + idioms" },
    { value: "tw2tp", inputValue: "taiwan-idioms", inputLabel: "Taiwan Traditional + idioms", outputLabel: "Traditional Chinese (OpenCC)" },
    { value: "t2hk", inputValue: "traditional", inputLabel: "Traditional Chinese (OpenCC)", outputLabel: "Hong Kong Traditional" },
    { value: "hk2t", inputValue: "hongkong", inputLabel: "Hong Kong Traditional", outputLabel: "Traditional Chinese (OpenCC)" },
    { value: "t2jp", inputValue: "traditional-kyujitai", inputLabel: "Traditional (Kyujitai)", outputLabel: "Japanese (Shinjitai)" },
    { value: "jp2t", inputValue: "japanese-shinjitai", inputLabel: "Japanese (Shinjitai)", outputLabel: "Traditional (Kyujitai)" }
];

const DEFAULT_CONFIG = "t2s";

const enabledToggle = document.getElementById("enabled-toggle");
const inputSelect = document.getElementById("input-select");
const outputSelect = document.getElementById("output-select");
const convertNowButton = document.getElementById("convert-now");
const status = document.getElementById("status");

/**
 * Finds preset by config key.
 * @param {string | undefined} config OpenCC config key.
 * @returns {{value: string, inputValue: string, inputLabel: string, outputLabel: string} | undefined}
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
        option.textContent = item.inputLabel;
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
        option.textContent = item.outputLabel;
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

    const modeText = `${preset.inputLabel} → ${preset.outputLabel}`;
    status.textContent = suffix ? `${modeText} • ${suffix}` : modeText;
}

/**
 * Updates popup widgets to match current settings.
 * @param {{enabled: boolean, config: string}} settings OpenCC settings.
 */
function applySettingsToUI(settings) {
    const preset = getPreset(settings.config) ?? getPreset(DEFAULT_CONFIG) ?? OPENCC_PRESETS[0];
    enabledToggle.checked = Boolean(settings.enabled);
    inputSelect.value = preset.inputValue;
    renderOutputOptions(preset.inputValue, preset.value);
    setModeStatus(outputSelect.value);
}

/**
 * Reads current form values into settings payload.
 * @returns {{enabled: boolean, config: string}} Form settings.
 */
function readSettingsFromUI() {
    return {
        enabled: enabledToggle.checked,
        config: outputSelect.value
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
    setModeStatus(settings.config, "Saved");
}

/**
 * Requests content script conversion on the active tab.
 */
async function convertNow() {
    await browser.runtime.sendMessage({ type: "opencc.convertNow" });
    setModeStatus(outputSelect.value, "Conversion requested for active tab");
}

/**
 * Initializes popup state and event handlers.
 */
async function initPopup() {
    renderInputOptions();
    renderOutputOptions(inputSelect.value, DEFAULT_CONFIG);

    const { settings } = await browser.runtime.sendMessage({ type: "opencc.getSettings" });
    applySettingsToUI(settings);

    enabledToggle.addEventListener("change", saveSettings);
    inputSelect.addEventListener("change", () => {
        renderOutputOptions(inputSelect.value, outputSelect.value);
        saveSettings();
    });
    outputSelect.addEventListener("change", saveSettings);
    convertNowButton.addEventListener("click", convertNow);
}

initPopup().catch(() => {
    status.textContent = "Failed to load settings";
});
