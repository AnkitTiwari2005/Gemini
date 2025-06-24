// utils/error_handler.js

/**
 * @module ErrorHandler
 * @description Centralized error logging and handling utility.
 * Ensures consistent error reporting across the extension,
 * aids debugging, and can be extended for remote logging.
 */

class ErrorHandler {
    /**
     * Logs an error to the console with additional context.
     * @param {string} message - A descriptive message about the error.
     * @param {Error|*} error - The error object or any data related to the error.
     * @param {...*} context - Any additional context arguments to log.
     */
    static logError(message, error, ...context) {
        console.error(`[Coursera Gemini Solver Error] ${message}`, error, ...context);
        // In a production environment, you might send this error to a remote logging service (e.g., Sentry, Bugsnag)
        // Ensure user privacy is maintained if sending remote logs (e.g., anonymize data).
        // Example: Sentry.captureException(error, { extra: { message, context } });
    }

    /**
     * Handles an error and provides feedback to the user if possible.
     * This might be called from popup or content scripts.
     * @param {string} userMessage - A user-friendly message to display.
     * @param {Error|*} error - The actual error object.
     * @param {function} [uiFeedbackFunc] - An optional function to display UI feedback (e.g., a toast).
     */
    static handleError(userMessage, error, uiFeedbackFunc = null) {
        ErrorHandler.logError(userMessage, error);

        if (uiFeedbackFunc && typeof uiFeedbackFunc === 'function') {
            uiFeedbackFunc(userMessage, 'error');
        }
        // Further actions:
        // - Disable functionality if a critical error (e.g., invalid API key).
        // - Guide user to extension options/help.
    }
}

export { ErrorHandler };