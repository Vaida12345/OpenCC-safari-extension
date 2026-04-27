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

const inputSelect = document.getElementById("app-input-select");
const outputSelect = document.getElementById("app-output-select");
const enabledToggle = document.getElementById("app-enabled-toggle");
const settingsStatus = document.getElementById("app-settings-status");
const openPreferencesButton = document.querySelector("button.open-preferences");

/**
 * Finds preset by config key.
 * @param {string | undefined} config OpenCC config key.
 * @returns {{value: string, inputValue: string, inputLabel: string, outputLabel: string} | undefined}
 */
function getPreset(config) {
    return OPENCC_PRESETS.find((item) => item.value === config);
}

/**
 * Renders all distinct input options.
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
 * Renders output options that are valid for the selected input.
 * @param {string} inputValue Selected input key.
 * @param {string | undefined} preferredConfig Config key to preselect when available.
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
 * Sends a command payload to the native app host via WKWebView bridge.
 * @param {Record<string, unknown> | string} payload Message payload.
 */
function sendNativeCommand(payload) {
    webkit.messageHandlers.controller.postMessage(payload);
}

/**
 * Updates status copy based on selected preset.
 * @param {string | undefined} config OpenCC config key.
 */
function setStatus(config) {
    const preset = getPreset(config);

    if (!preset) {
        settingsStatus.textContent = "Saved";
        return;
    }

    settingsStatus.textContent = `${preset.inputLabel} -> ${preset.outputLabel}`;
}

/**
 * Updates app controls to reflect current OpenCC settings.
 * This function is called from native Swift using evaluateJavaScript.
 * @param {{enabled: boolean, config: string}} settings Current settings.
 */
function setOpenCCSettings(settings) {
    const preset = getPreset(settings.config) ?? OPENCC_PRESETS[0];
    enabledToggle.checked = Boolean(settings.enabled);
    inputSelect.value = preset.inputValue;
    renderOutputOptions(preset.inputValue, preset.value);
    setStatus(outputSelect.value);
}

/**
 * Persists updated settings to the native app host.
 */
function saveSettings() {
    const selectedConfig = outputSelect.value;
    sendNativeCommand({
        command: "set-opencc-settings",
        settings: {
            enabled: enabledToggle.checked,
            config: selectedConfig
        }
    });

    setStatus(selectedConfig);
}

/**
 * Requests settings from native app host.
 */
function requestSettings() {
    sendNativeCommand({ command: "get-opencc-settings" });
}

/**
 * Handles the "Open Safari Preferences" action on macOS.
 */
function openPreferences() {
    sendNativeCommand("open-preferences");
}

/**
 * Configures initial app DOM behavior.
 */
function initialize() {
    renderInputOptions();
    renderOutputOptions(inputSelect.value, OPENCC_PRESETS[0].value);
    requestSettings();

    inputSelect.addEventListener("change", () => {
        renderOutputOptions(inputSelect.value, outputSelect.value);
        saveSettings();
    });
    outputSelect.addEventListener("change", saveSettings);
    enabledToggle.addEventListener("change", saveSettings);

    if (openPreferencesButton) {
        openPreferencesButton.addEventListener("click", openPreferences);
    }
}

function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName("platform-mac state-on")[0].innerText = "OpenCC’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName("platform-mac state-off")[0].innerText = "OpenCC’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName("platform-mac state-unknown")[0].innerText = "You can turn on OpenCC’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName("platform-mac open-preferences")[0].innerText = "Quit and Open Safari Settings...";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle("state-on", enabled);
        document.body.classList.toggle("state-off", !enabled);
    } else {
        document.body.classList.remove("state-on");
        document.body.classList.remove("state-off");
    }
}

initialize();
window.setOpenCCSettings = setOpenCCSettings;
