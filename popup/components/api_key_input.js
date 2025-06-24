// popup/components/api_key_input.js

/**
 * @module ApiKeyInput
 * @description Manages the API key input field, saving, and status display in the popup.
 */

import { StorageManager } from '../../utils/storage_manager.js';
import { CONSTANTS } from '../../utils/constants.js';
import { ErrorHandler } from '../../utils/error_handler.js';

class ApiKeyInput {
    /**
     * @param {HTMLElement} apiKeyInputEl - The input element for the API key.
     * @param {HTMLElement} saveApiKeyBtnEl - The button to save the API key.
     * @param {HTMLElement} apiKeyStatusEl - The element to display API key status messages.
     * @param {HTMLElement} triggerSolverBtnEl - The button to trigger the solver (to enable/disable based on key).
     */
    constructor(apiKeyInputEl, saveApiKeyBtnEl, apiKeyStatusEl, triggerSolverBtnEl) {
        this.apiKeyInputEl = apiKeyInputEl;
        this.saveApiKeyBtnEl = saveApiKeyBtnEl;
        this.apiKeyStatusEl = apiKeyStatusEl;
        this.triggerSolverBtnEl = triggerSolverBtnEl;
        this.init();
    }

    /**
     * Initializes the API key input component by loading the saved key and setting up event listeners.
     */
    async init() {
        this.saveApiKeyBtnEl.addEventListener('click', this.handleSaveApiKey.bind(this));
        await this.loadApiKey();
    }

    /**
     * Loads the stored API key and updates the input field and solver button state.
     */
    async loadApiKey() {
        try {
            const apiKey = await StorageManager.get(CONSTANTS.STORAGE_KEYS.GEMINI_API_KEY);
            if (apiKey) {
                this.apiKeyInputEl.value = apiKey;
                this.displayStatus('API key loaded.', 'success');
                this.triggerSolverBtnEl.disabled = false; // Enable solver if key exists
            } else {
                this.displayStatus('No API key found. Please enter yours.', 'error');
                this.triggerSolverBtnEl.disabled = true; // Disable solver if no key
            }
        } catch (error) {
            ErrorHandler.logError('Failed to load API key from storage', error);
            this.displayStatus('Error loading API key.', 'error');
            this.triggerSolverBtnEl.disabled = true;
        }
    }

    /**
     * Handles saving the API key when the save button is clicked.
     * Validates the key and stores it securely.
     */
    async handleSaveApiKey() {
        const apiKey = this.apiKeyInputEl.value.trim();
        if (!apiKey) {
            this.displayStatus('API Key cannot be empty.', 'error');
            this.triggerSolverBtnEl.disabled = true;
            return;
        }

        if (!this.isValidGeminiApiKey(apiKey)) { // Basic validation
            this.displayStatus('Invalid API Key format. Must start with "AIza".', 'error');
            this.triggerSolverBtnEl.disabled = true;
            return;
        }

        try {
            await StorageManager.set(CONSTANTS.STORAGE_KEYS.GEMINI_API_KEY, apiKey);
            this.displayStatus('API Key saved successfully!', 'success');
            this.triggerSolverBtnEl.disabled = false;
        } catch (error) {
            ErrorHandler.logError('Failed to save API key to storage', error);
            this.displayStatus('Error saving API key.', 'error');
            this.triggerSolverBtnEl.disabled = true;
        }
    }

    /**
     * Performs a basic format validation for a Gemini API key.
     * Note: Full validation requires an API call, which can be added later if needed.
     * @param {string} key - The API key to validate.
     * @returns {boolean} - True if the key format is valid, false otherwise.
     */
    isValidGeminiApiKey(key) {
        // Basic check: Gemini API keys typically start with 'AIza'
        return typeof key === 'string' && key.startsWith('AIza') && key.length > 30; // A reasonable minimum length
    }

    /**
     * Displays a status message in the dedicated status element.
     * @param {string} message - The message to display.
     * @param {'success'|'error'|''} type - The type of message (for styling).
     */
    displayStatus(message, type = '') {
        this.apiKeyStatusEl.textContent = message;
        this.apiKeyStatusEl.className = `status-message ${type}`;
        // Clear message after a few seconds
        clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            this.apiKeyStatusEl.textContent = '';
            this.apiKeyStatusEl.className = 'status-message';
        }, 5000);
    }
}
export { ApiKeyInput };