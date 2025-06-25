// background/background.js
console.log("Service Worker Started - Attempt 5! (Module Loader Injection)"); // Updated log for clarity

/**
 * @module BackgroundServiceWorker
 * @description The main background service worker for the Coursera Gemini Solver.
 * Handles inter-script communication, Gemini API calls, and global extension logic.
 */
import { ApiClient } from '../utils/api_client.js';
import { StorageManager } from '../utils/storage_manager.js';
import { CONSTANTS } from '../utils/constants.js';
import { ErrorHandler } from '../utils/error_handler.js';
import { PromptBuilder } from '../utils/prompt_builder.js';
import { ResponseParser } from '../utils/response_parser.js';

// Define the patterns for Coursera quiz/assignment pages
const courseraQuizPatterns = [
  "https://www.coursera.org/learn/*/*/*/*/attempt*",
  "https://www.coursera.org/learn/*/*/*/*/quiz*", // Added for quiz pages generally
  "https://www.coursera.org/learn/*/*/*/*/exam*", // Added for exam pages
  "https://www.coursera.org/learn/*/*/*/*/assessment*" // Added for assessment pages
];

// Function to check if a URL matches any of our patterns
function matchesCourseraQuiz(url) {
  for (const pattern of courseraQuizPatterns) {
    // Convert glob pattern to a regex pattern
    // Escapes special regex characters, replaces '*' with '.*?' (non-greedy match for any chars)
    const regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*?');
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(url)) {
      return true;
    }
  }
  return false;
}

// Listen for tab updates (when a tab's URL changes or it completes loading)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // We only care when the tab finishes loading and has a URL
  // 'tab.url.startsWith("http")' ensures it's a web page, not an internal Chrome page
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("http")) {
    if (matchesCourseraQuiz(tab.url)) {
      console.log(`Background: Coursera Quiz Page Detected: ${tab.url}`);
      try {
        // Check if the script is already injected to avoid multiple injections on refreshes
        // This 'function' property of executeScript runs code in the target page's context
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => window.courseraSolverInjected // Check for a global flag set by your loader script
        });

        // If the script is not already injected, then inject the loader script
        if (!results || !results[0] || !results[0].result) {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content_scripts/loader.js'], // <--- IMPORTANT CHANGE HERE: Inject loader.js
            injectImmediately: true // Try injecting immediately for faster setup
          });
          console.log("Background: loader.js injected successfully, which will load coursera_solver.js as a module.");
        } else {
          console.log("Background: coursera_solver.js (via loader) already injected on this page.");
        }
      } catch (error) {
        console.error("Background: Failed to inject loader.js:", error);
      }
    }
  }
});

/**
 * Listener for messages from other parts of the extension (popup, content scripts).
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Return true to indicate that sendResponse will be called asynchronously.
    (async () => {
        if (message.type === CONSTANTS.MESSAGES.SOLVE_QUESTION_REQUEST) {
            /**
             * Handles a request from a content script to solve a question using Gemini API.
             * @param {object} questionData - Contains question text, options, questionType ('single'/'multiple').
             * @returns {object} - Response object with status, answer(s), explanation (optional), or error.
             */
            console.log('Background: Received SOLVE_QUESTION_REQUEST', message.payload);
            const { questionData } = message.payload;
            try {
                const apiKey = await StorageManager.get(CONSTANTS.STORAGE_KEYS.GEMINI_API_KEY);
                if (!apiKey) {
                    sendResponse({
                        status: 'error',
                        message: 'Gemini API Key not found. Please set it in the extension popup.'
                    });
                    return;
                }

                // Get user settings for prompt and response parsing
                const settings = await StorageManager.get(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP) || {};
                const showExplanations = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.EXPLANATIONS] ?? false;
                const minConfidence = settings[CONSTANTS.STORAGE_KEYS.SETTINGS.MIN_CONFIDENCE] ?? 70;

                // 1. Build the prompt for Gemini
                const prompt = PromptBuilder.buildQuizPrompt(questionData, showExplanations);
                console.log('Background: Prompt built:', prompt);

                // 2. Make API call to Gemini
                const geminiResponse = await ApiClient.callGeminiApi(apiKey, prompt);
                console.log('Background: Gemini API Response:', geminiResponse);

                // 3. Parse Gemini's response
                const parsedResult = ResponseParser.parseGeminiQuizResponse(
                    geminiResponse,
                    questionData.options,
                    questionData.questionType
                );

                if (!parsedResult || !parsedResult.answers.length) {
                    sendResponse({
                        status: 'error',
                        message: 'Could not parse valid answers from Gemini response.'
                    });
                    return;
                }

                // Optional: Implement confidence check here if Gemini model provides it
                // For now, we assume parsing indicates confidence.
                sendResponse({
                    status: 'success',
                    answers: parsedResult.answers,
                    explanation: parsedResult.explanation || null,
                    confidence: parsedResult.confidence || 100 // Placeholder, implement actual confidence detection if API supports
                });

            } catch (error) {
                ErrorHandler.logError('Error solving question with Gemini API:', error, questionData);
                sendResponse({
                    status: 'error',
                    message: error.message || 'Failed to get answer from Gemini API. Check API key or network.',
                    details: error.details // Include more details if available (e.g., from API error)
                });
            }
        } else if (message.type === CONSTANTS.MESSAGES.FETCH_SETTINGS_REQUEST) {
            /**
             * Handles a request from a content script to fetch current settings.
             * @returns {object} - Object containing all relevant settings.
             */
            try {
                const settings = await StorageManager.get(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP) || {};
                sendResponse({
                    status: 'success',
                    payload: {
                        autoSolve: settings[CONSTANTS.STORAGE_KEYS.SETTINGS.AUTO_SOLVE] ?? true,
                        showExplanations: settings[CONSTANTS.STORAGE_KEYS.SETTINGS.EXPLANATIONS] ?? false,
                        minConfidence: settings[CONSTANTS.STORAGE_KEYS.SETTINGS.MIN_CONFIDENCE] ?? 70,
                        delayBeforeSolveMs: settings[CONSTANTS.STORAGE_KEYS.SETTINGS.DELAY_SOLVE_MS] ?? 500
                    }
                });
            } catch (error) {
                ErrorHandler.logError('Error fetching settings for content script:', error);
                sendResponse({ status: 'error', message: 'Failed to load settings.' });
            }
        }
        // Add more message handlers as the extension grows (e.g., for reporting incorrect answers)
    })();
    return true; // Indicates an asynchronous response
});

/**
 * Listener for extension installation/update.
 * Sets default settings on first install.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        console.log("Extension installed. Setting default preferences.");
        try {
            // Set default settings only if not already present
            const currentSettings = await StorageManager.get(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP) || {};
            const defaultSettings = {
                [CONSTANTS.STORAGE_KEYS.SETTINGS.AUTO_SOLVE]: true,
                [CONSTANTS.STORAGE_KEYS.SETTINGS.EXPLANATIONS]: false,
                [CONSTANTS.STORAGE_KEYS.SETTINGS.MIN_CONFIDENCE]: 70,
                [CONSTANTS.STORAGE_KEYS.SETTINGS.DELAY_SOLVE_MS]: 500
            };
            // Merge defaults, but don't overwrite existing user settings
            await StorageManager.set(CONSTANTS.STORAGE_KEYS.SETTINGS_GROUP, { ...defaultSettings, ...currentSettings });
        } catch (error) {
            ErrorHandler.logError('Failed to set default settings on install:', error);
        }
    }
});

// Implement heartbeat/keep-alive if necessary for specific long-running tasks
// For typical quiz solving, Service Worker should wake up on message.