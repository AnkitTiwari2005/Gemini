// utils/api_client.js

/**
 * @module ApiClient
 * @description Centralized module for interacting with the Google Gemini API.
 * Handles API requests, headers, and basic error mapping.
 */

import { CONSTANTS } from './constants.js';
import { ErrorHandler } from './error_handler.js';

class ApiClient {
    /**
     * Adds random jitter so repeated retries from multiple requests don't align.
     * @param {number} ms
     * @returns {number}
     */
    static addJitter(ms) {
        const jitter = Math.floor(Math.random() * 500);
        return ms + jitter;
    }

    /**
     * Reads retry delay hints from response headers/body.
     * @param {Response} response
     * @param {object} errorData
     * @returns {number|null} Delay in ms.
     */
    static getRetryDelayMs(response, errorData) {
        const retryAfterHeader = response.headers.get('retry-after');
        if (retryAfterHeader) {
            const retryAfterSeconds = Number(retryAfterHeader);
            if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
                return retryAfterSeconds * 1000;
            }
        }

        const suggestedDelay = errorData?.error?.details?.find(detail =>
            detail?.retryDelay
        )?.retryDelay;

        if (typeof suggestedDelay === 'string') {
            const seconds = Number.parseFloat(suggestedDelay.replace('s', ''));
            if (!Number.isNaN(seconds) && seconds > 0) {
                return seconds * 1000;
            }
        }

        return null;
    }

    /**
     * Calls the Google Gemini API with the provided prompt.
     * Implements basic retry logic for transient network issues.
     * @param {string} apiKey - The user's Google Gemini API key.
     * @param {Array<object>} prompt - The prompt array for the Gemini API.
     * @param {number} [retries=3] - Number of retry attempts for transient errors.
     * @param {number} [delay=1000] - Initial delay in milliseconds for exponential backoff.
     * @returns {Promise<object>} The parsed JSON response from the Gemini API.
     * @throws {Error} If the API call fails after retries, or returns a non-OK status.
     */
    static async callGeminiApi(apiKey, prompt, retries = 5, delay = 1500) {
        if (!apiKey) {
            throw new Error('APIClient: Gemini API Key is missing.');
        }
        if (!Array.isArray(prompt) || prompt.length === 0) {
            throw new Error('APIClient: Invalid or empty prompt provided.');
        }

        const url = CONSTANTS.GEMINI_API_URL;
        const body = JSON.stringify({
            contents: prompt,
            generationConfig: {
                // Ensure the model is optimized for text generation
                // Example settings, adjust as needed for quiz solving
                temperature: 0.1, // Lower temperature for more deterministic answers
                topK: 1,
                topP: 1,
                maxOutputTokens: 500 // Adjust max tokens for expected response size (answer + explanation)
            }
        });

        for (let i = 0; i <= retries; i++) {
            try {
                const response = await fetch(`${url}?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: body
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({})); // Try to parse error body
                    let errorMessage = `Gemini API Error: ${response.status} ${response.statusText}`;

                    if (response.status === 400 && errorData.error?.message) {
                        errorMessage = `Gemini API Error (400): ${errorData.error.message}`;
                    } else if (response.status === 401 || response.status === 403) {
                        errorMessage = `Gemini API Error: Invalid or Unauthorized API Key. Please check your key.`;
                    } else if (response.status === 429) {
                        errorMessage = `Gemini API Error (429): Rate limit exceeded. Retrying automatically...`;
                    } else if (errorData.error?.message) {
                        errorMessage = `Gemini API Error: ${errorData.error.message}`;
                    }
                    
                    const error = new Error(errorMessage);
                    error.statusCode = response.status;
                    error.details = errorData; // Attach full error response for debugging
                    error.retryDelayMs = ApiClient.getRetryDelayMs(response, errorData);
                    throw error;
                }

                const data = await response.json();
                if (!data || !data.candidates || data.candidates.length === 0) {
                    throw new Error('Gemini API returned no candidates or empty response.');
                }
                return data;

            } catch (error) {
                // Only retry for network errors or specific API transient errors (e.g., 429)
                if (i < retries && (error instanceof TypeError || error.statusCode === 429 || error.statusCode >= 500)) {
                    const backoffDelay = error.retryDelayMs || delay * Math.pow(2, i);
                    const waitMs = ApiClient.addJitter(Math.min(backoffDelay, 60000));
                    console.warn(`APIClient: Retrying API call (${i + 1}/${retries}) in ${Math.round(waitMs / 1000)}s. Error: ${error.message}`);
                    await new Promise(res => setTimeout(res, waitMs));
                } else {
                    if (error.statusCode === 429) {
                        error.message = 'Gemini API Error (429): Rate limit exceeded after retries. Wait a minute and try again, or use a higher-quota API key.';
                    }
                    ErrorHandler.logError('APIClient: Failed to call Gemini API after retries:', error);
                    throw error; // Re-throw the error if no more retries or non-retryable error
                }
            }
        }
    }
}

export { ApiClient };
