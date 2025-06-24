// settings/settings.js

/**
 * @module SettingsPage
 * @description Manages all interactions on the dedicated settings page.
 * Loads and saves user preferences, handles API key management, and cache operations.
 */

import { StorageManager } from '../utils/storage_manager.js';
import { CacheManager } from '../utils/cache_manager.js';
import { CONSTANTS } from '../utils/constants.js';
import { ErrorHandler } from '../utils/error_handler.js';

document.addEventListener('DOMContentLoaded', initializeSettingsPage);

/**
 * Initializes the settings page by loading saved preferences, API key,
 * and setting up all event listeners.
 */
async function initializeSettingsPage() {
    // UI Elements
    const autoSolveToggle = document.getElementById('autoSolveToggle');
    const explanationToggle = document.getElementById('explanationToggle');
    const confidenceThreshold = document.getElementById('confidenceThreshold');
    const confidenceValueSpan = document.getElementById('confidenceValue');
    const delayBeforeSolveInput = document.getElementById('delayBeforeSolve');

    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const apiKeyStatusDiv = document.getElementById('apiKeyStatus');

    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const cacheStatusDiv = document.getElementById('cacheStatus');

    // --- Internationalization (i18n) ---
    applyI18n();

    // --- Load Initial State ---
    await loadAllSettingsAndApiKey({
        autoSolveToggle, explanationToggle, confidenceThreshold,
        confidenceValueSpan, delayBeforeSolveInput, geminiApiKeyInput
    });

    // --- Event Listeners for Settings ---
    autoSolveToggle.addEventListener('change', () => {
        saveSetting(CONSTANTS.STORAGE_KEYS.SETTINGS.AUTO_SOLVE, autoSolveToggle.checked);
        toggleCheckboxClass(autoSolveToggle, 'toggle-switch-base');
    });
    explanationToggle.addEventListener('change', () => {
        saveSetting(CONSTANTS.STORAGE_KEYS.SETTINGS.EXPLANATIONS, explanationToggle.checked);
        toggleCheckboxClass(explanationToggle, 'toggle-switch-base');
    });
    
    confidenceThreshold.addEventListener('input', () => {
        confidenceValueSpan.textContent = `${confidenceThreshold.value}%`;
        saveSetting(CONSTANTS.STORAGE_KEYS.SETTINGS.MIN_CONFIDENCE, parseInt(confidenceThreshold.value));
    });
    
    delayBeforeSolveInput.addEventListener('change', () => {
        const delay = Math.max(0, parseInt(delayBeforeSolveInput.value) || 0);
        delayBeforeSolveInput.value = delay; // Ensure non-negative integer
        saveSetting(CONSTANTS.STORAGE_KEYS.SETTINGS.DELAY_SOLVE_MS, delay);
    });

    // --- API Key Management Listeners ---
    saveApiKeyBtn.addEventListener('click', async () => {
        await handleSaveApiKey(geminiApiKeyInput, apiKeyStatusDiv);
    });

    // --- Cache Management Listeners ---
    clearCacheBtn.addEventListener('click', async () => {
        await handleClearCache(cacheStatusDiv);
    });
}

/**
 * Applies internationalization strings to elements with `data-i18n` attributes.
 */
function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const messageKey = element.dataset.i18n;
        try {
            const message = chrome.i18n.getMessage(messageKey);
            if (message) {
                element.textContent = message;
            } else {
                console.warn(`i18n: Message key "${messageKey}" not found.`);
            }
        } catch (error) {
            ErrorHandler.logError(`i18n: Error getting message for key "${messageKey}"`, error);
        }
    });
}


/**
 * Loads all settings and the API key from storage and updates the UI.
 * @param {object} elements - Object containing references to all relevant UI elements.
 */
async function loadAllSettingsAndApiKey(elements) {
    try {
        // Load API Key
        const apiKey = await StorageManager.get(CONSTANTS.STORAGE_KEYS.GEMINI_API_KEY);
        if (apiKey) {
            elements.geminiApiKeyInput.value = apiKey;
            displayStatus(elements.apiKeyStatusDiv, 'API key loaded.', 'success');
        } else {
            displayStatus(elements.apiKeyStatusDiv, 'No API key found. Please enter yours.', 'error');
        }

        // Load Settings
        const settings = await StorageManager.get(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP) || {};
        elements.autoSolveToggle.checked = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.AUTO_SOLVE] ?? true;
        elements.explanationToggle.checked = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.EXPLANATIONS] ?? false;
        elements.confidenceThreshold.value = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.MIN_CONFIDENCE] ?? 70;
        elements.confidenceValueSpan.textContent = `${elements.confidenceThreshold.value}%`;
        elements.delayBeforeSolveInput.value = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.DELAY_SOLVE_MS] ?? 500;

        // Apply toggle switch visual class
        toggleCheckboxClass(elements.autoSolveToggle, 'toggle-switch-base');
        toggleCheckboxClass(elements.explanationToggle, 'toggle-switch-base');

    } catch (error) {
        ErrorHandler.logError('Failed to load settings or API key on settings page', error);
        displayStatus(elements.apiKeyStatusDiv, 'Error loading settings/API key.', 'error');
    }
}

/**
 * Toggles the 'checked' class on the associated toggle switch span.
 * @param {HTMLInputElement} checkbox - The checkbox input element.
 * @param {string} toggleClass - The class name of the toggle switch span.
 */
function toggleCheckboxClass(checkbox, toggleClass) {
    const toggleSpan = checkbox.nextElementSibling;
    if (toggleSpan && toggleSpan.classList.contains(toggleClass)) {
        if (checkbox.checked) {
            toggleSpan.classList.add('checked');
        } else {
            toggleSpan.classList.remove('checked');
        }
    }
}

/**
 * Saves a single setting to storage.
 * @param {string} key - The storage key for the setting.
 * @param {*} value - The value to save.
 */
async function saveSetting(key, value) {
    try {
        const settings = await StorageManager.get(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP) || {};
        settings[key] = value;
        await StorageManager.set(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP, settings);
        console.log(`Setting saved: ${key} = ${value}`);
    } catch (error) {
        ErrorHandler.logError(`Failed to save setting: ${key}`, error);
        // Display error to user if relevant, maybe via a global toast on settings page
    }
}

/**
 * Handles saving the API key.
 * @param {HTMLInputElement} apiKeyInputEl - The API key input element.
 * @param {HTMLElement} apiKeyStatusEl - The status message element.
 */
async function handleSaveApiKey(apiKeyInputEl, apiKeyStatusEl) {
    const apiKey = apiKeyInputEl.value.trim();
    if (!apiKey) {
        displayStatus(apiKeyStatusEl, chrome.i18n.getMessage('apiKeyEmptyError'), 'error');
        return;
    }

    if (!isValidGeminiApiKey(apiKey)) {
        displayStatus(apiKeyStatusEl, chrome.i18n.getMessage('apiKeyInvalidFormatError'), 'error');
        return;
    }

    try {
        await StorageManager.set(CONSTANTS.STORAGE_KEYS.GEMINI_API_KEY, apiKey);
        displayStatus(apiKeyStatusEl, chrome.i18n.getMessage('apiKeySavedSuccess'), 'success');
    } catch (error) {
        ErrorHandler.logError('Failed to save API key from settings page', error);
        displayStatus(apiKeyStatusEl, chrome.i18n.getMessage('apiKeySaveError'), 'error');
    }
}

/**
 * Performs a basic format validation for a Gemini API key.
 * @param {string} key - The API key to validate.
 * @returns {boolean} - True if the key format is valid, false otherwise.
 */
function isValidGeminiApiKey(key) {
    return typeof key === 'string' && key.startsWith('AIza') && key.length > 30;
}

/**
 * Handles clearing the question cache.
 * @param {HTMLElement} cacheStatusEl - The status message element for cache operations.
 */
async function handleClearCache(cacheStatusEl) {
    if (!confirm(chrome.i18n.getMessage('confirmClearCache'))) {
        return;
    }
    try {
        await CacheManager.clearCache();
        displayStatus(cacheStatusEl, chrome.i18n.getMessage('cacheClearedSuccess'), 'success');
    } catch (error) {
        ErrorHandler.logError('Failed to clear cache from settings page', error);
        displayStatus(cacheStatusEl, chrome.i18n.getMessage('cacheClearError'), 'error');
    }
}

/**
 * Displays a status message in the dedicated status element.
 * @param {HTMLElement} element - The element to display the message in.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|''} type - The type of message (for styling).
 */
function displayStatus(element, message, type = '') {
    element.textContent = message;
    element.className = `status-message ${type}`;
    clearTimeout(element.dataset.statusTimeout);
    element.dataset.statusTimeout = setTimeout(() => {
        element.textContent = '';
        element.className = 'status-message';
    }, 5000);
}