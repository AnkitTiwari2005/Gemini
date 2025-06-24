// utils/constants.js

/**
 * @module CONSTANTS
 * @description Centralized module for all global constants used throughout the extension.
 * Ensures consistency and easy modification of critical values.
 */

const CONSTANTS = {
    // Gemini API Configuration
    // --- UPDATED: Changed model from 'gemini-pro' to 'gemini-2.0-flash' ---
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    
    // Chrome Storage Keys
    STORAGE_KEYS: {
        GEMINI_API_KEY: 'geminiApiKey',
        SETTINGS_GROUP: 'solverSettings', // Stores all settings as one object
        SETTINGS: { // Individual setting keys within SETTINGS_GROUP
            AUTO_SOLVE: 'autoSolve',
            EXPLANATIONS: 'showExplanations',
            MIN_CONFIDENCE: 'minConfidence',
            DELAY_SOLVE_MS: 'delayBeforeSolveMs'
            // Add more settings keys here
        },
        CACHED_ANSWERS: 'cachedAnswers' // Key for the local storage cache
    },

    // Inter-script Message Types
    MESSAGES: {
        SOLVE_QUESTION_REQUEST: 'SOLVE_QUESTION_REQUEST',    // Content Script -> Background
        SOLVER_STATUS_UPDATE: 'SOLVER_STATUS_UPDATE',        // Content Script -> Popup, Background -> Popup (optional)
        TRIGGER_SOLVER: 'TRIGGER_SOLVER',                    // Popup -> Content Script
        FETCH_SETTINGS_REQUEST: 'FETCH_SETTINGS_REQUEST',    // Content Script -> Background
        REPORT_INCORRECT_ANSWER: 'REPORT_INCORRECT_ANSWER'   // Future: Content Script -> Background (for feedback)
    },

    // Other configurations
    TOAST_DURATION_MS: 3000,
    TOOLTIP_DURATION_MS: 3000,
    DEBOUNCE_DELAY_MS: 1000 // For MutationObserver
};

export { CONSTANTS };