// content_scripts/coursera_solver.js
/**
 * @module CourseraSolver
 * @description Main content script for Coursera.
 * Detects quiz questions,
 * communicates with the background script to solve them using Gemini,
 * and renders the answers on the page.
 */
import { DOMDetector } from './modules/dom_detector.js';
import { MutationObserverManager } from './modules/mutation_observer.js';
import { UIFeedback } from './modules/ui_feedback.js';
import { AnswerRenderer } from './modules/answer_renderer.js';
import { CONSTANTS } from '../utils/constants.js';
import { ErrorHandler } from '../utils/error_handler.js';
import { CacheManager } from '../utils/cache_manager.js';

let currentSettings = {};
let isSolverActive = false; // Prevents re-triggering while solving

// Fallback for ErrorHandler in case of module loading issues
const SafeErrorHandler = typeof ErrorHandler !== 'undefined' ?
    ErrorHandler : {
        logError: (message, error, ...context) => {
            console.error(`[Coursera Gemini Solver Error - Fallback] ${message}`, error, ...context);
        },
        handleError: (userMessage, error, uiFeedbackFunc = null) => {
            console.error(`[Coursera Gemini Solver Error - Fallback] ${userMessage}`, error);
            if (uiFeedbackFunc && typeof uiFeedbackFunc === 'function') {
                uiFeedbackFunc(userMessage, 'error');
            }
        }
    };

async function initializeSolver() {
    console.log('Coursera Gemini Solver: Initializing...');
    try {
        currentSettings = await fetchSettingsFromBackground();
        console.log('Solver settings loaded:', currentSettings);
        detectAndSolveQuizzes();
        MutationObserverManager.observeBody(handleDOMChanges);
        chrome.runtime.onMessage.addListener(handleRuntimeMessages);
        UIFeedback.showToast('Coursera Gemini Solver Ready!', 'info', 3000);
    } catch (error) {
        SafeErrorHandler.logError('Failed to initialize Coursera Solver', error);
        UIFeedback.showToast('Solver initialization failed. Check console.', 'error', 5000);
    }
}

async function fetchSettingsFromBackground() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: CONSTANTS.MESSAGES.FETCH_SETTINGS_REQUEST
        });
        if (response && response.status === 'success') {
            return response.payload;
        } else {
            throw new Error(response?.message || 'Failed to fetch settings from background.');
        }
    } catch (error) {
        SafeErrorHandler.logError('Failed to fetch settings from background:', error);
        // Return default settings as a fallback
        return {
            autoSolve: true,
            showExplanations: false,
            minConfidence: 70,
            delayBeforeSolveMs: 500
        };
    }
}

function handleRuntimeMessages(message, sender, sendResponse) {
    if (message.type === CONSTANTS.MESSAGES.TRIGGER_SOLVER) {
        console.log('Content Script: Manual solver trigger received.');
        if (!isSolverActive) {
            // Call the async function and ensure sendResponse is called after its completion
            detectAndSolveQuizzes(true).then(() => {
                // This will be called after detectAndSolveQuizzes completes all its promises
                sendResponse({ status: 'success', message: 'Solver finished running.' });
            }).catch(error => {
                SafeErrorHandler.logError('Error during manual solver trigger:', error);
                sendResponse({ status: 'error', message: 'Solver encountered an error during manual trigger.' });
            });
            return true; // Indicate that sendResponse will be called asynchronously
        } else {
            sendResponse({ status: 'info', message: 'Solver already active.' });
            return true; // Still need to return true as sendResponse is called within this path
        }
    }
    // For other messages, if not handled, ensure sendResponse is called to prevent channel closure
    // (though background script usually expects responses only for specific request types)
    // If not a recognized message type, just return false, let Chrome handle it.
    return false; // For messages not handled asynchronously
}

async function detectAndSolveQuizzes(forceSolve = false) {
    if (isSolverActive && !forceSolve) {
        console.log('Solver already active, skipping.');
        return;
    }
    if (!currentSettings.autoSolve && !forceSolve) {
        console.log('Auto-solve is off. Waiting for manual trigger.');
        return;
    }
    isSolverActive = true;
    UIFeedback.showToast('Scanning for quizzes...', 'info');
    let solvedCount = 0;

    try {
        const detector = new DOMDetector();
        detector.detect();
        const quizQuestions = detector.getQuestions();

        if (quizQuestions.length === 0) {
            UIFeedback.showToast('No new quiz questions found.', 'info', 3000);
            isSolverActive = false;
            return;
        }

        for (const questionData of quizQuestions) {
            // Validate questionData more thoroughly before proceeding
            if (!questionData || !questionData.container || !questionData.question || typeof questionData.question !== 'string' || !Array.isArray(questionData.options) || questionData.options.length === 0) {
                SafeErrorHandler.logError('Skipping malformed or incomplete questionData in detectAndSolveQuizzes loop:', questionData);
                // Use a general error toast if container is invalid, as we can't attach tooltip to it
                if (questionData && questionData.container) {
                    UIFeedback.showTooltip(questionData.container, 'Error: Incomplete question data detected.', 'error');
                    UIFeedback.markQuestionAsSolved(questionData.container, 'error');
                } else {
                    UIFeedback.showToast('Error: Detected incomplete question data for an element.', 'error', 5000);
                }
                continue;
            }

            // CORRECTED: Pass question text and options to generate hash
            const questionHash = CacheManager.generateQuestionHash(questionData.question, questionData.options);
            let cachedAnswer = await CacheManager.get(questionHash);

            if (cachedAnswer) {
                console.log('Found cached answer for question:', questionData.question);
                UIFeedback.showTooltip(questionData.container, 'Using cached answer!', 'info');
                AnswerRenderer.renderAnswer(questionData, cachedAnswer.answers, currentSettings.autoSolve);
                if (currentSettings.showExplanations && cachedAnswer.explanation) {
                    UIFeedback.showExplanation(questionData.container, cachedAnswer.explanation);
                }
                solvedCount++;
                continue;
            }

            UIFeedback.markQuestionAsProcessing(questionData.container);
            UIFeedback.showTooltip(questionData.container, 'Solving with Gemini...', 'info');

            if (currentSettings.delayBeforeSolveMs > 0) {
                await new Promise(resolve => setTimeout(resolve, currentSettings.delayBeforeSolveMs));
            }

            // Create a serializable payload by omitting the DOM element 'container'
            // and ensuring options are also simple, serializable objects.
            const serializableQuestionData = {
                question: questionData.question,
                options: questionData.options.map(opt => ({ text: opt.text, value: opt.value })),
                questionType: questionData.questionType
            };

            // Send message and await response
            const response = await chrome.runtime.sendMessage({
                type: CONSTANTS.MESSAGES.SOLVE_QUESTION_REQUEST,
                payload: { questionData: serializableQuestionData } // Send the clean, serializable data
            });

            if (response && response.status === 'success') {
                const { answers, explanation, confidence } = response;

                if (confidence < currentSettings.minConfidence && !forceSolve) {
                    UIFeedback.showTooltip(questionData.container, `Confidence too low (${confidence}%). Not auto-solving.`, 'warning');
                    UIFeedback.markQuestionAsSolved(questionData.container, 'warning');
                } else {
                    UIFeedback.showTooltip(questionData.container, 'Answer found!', 'success');
                    AnswerRenderer.renderAnswer(questionData, answers, currentSettings.autoSolve);
                    if (currentSettings.showExplanations && explanation) {
                        UIFeedback.showExplanation(questionData.container, explanation);
                    }
                    solvedCount++;
                    await CacheManager.set(questionHash, { answers, explanation, confidence });
                    UIFeedback.markQuestionAsSolved(questionData.container, 'success');
                }
            } else {
                const errorMsg = response?.message || 'Failed to get answer.';
                SafeErrorHandler.logError('Error solving question:', errorMsg, questionData, response?.details);
                UIFeedback.showTooltip(questionData.container, `Error: ${errorMsg}`, 'error');
                UIFeedback.markQuestionAsSolved(questionData.container, 'error');
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between questions
        }
    } catch (error) {
        SafeErrorHandler.logError('General error in detectAndSolveQuizzes:', error);
        UIFeedback.showToast('An error occurred during solving.', 'error', 5000);
    } finally {
        isSolverActive = false;
        UIFeedback.hideToast();
        UIFeedback.showToast(`Solver finished. Solved ${solvedCount} questions.`, 'success', 3000);
        chrome.runtime.sendMessage({
            type: CONSTANTS.MESSAGES.SOLVER_STATUS_UPDATE,
            payload: {
                message: `Solved ${solvedCount} questions.`,
                type: 'success'
            }
        });
    }
}

function handleDOMChanges(mutations) {
    let quizContentChanged = false;
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const relevantNodes = Array.from(mutation.addedNodes).some(node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node.matches('.rc-FormParts') || node.matches('.rc-QuizQuestion') ||
                 node.matches('[data-testid*="part-Submission_MultipleChoiceQuestion"]') ||
                 node.matches('.rc-FormPartsQuestion') ||
                 node.matches('[data-testid*="part-Submission_MultipleChoiceReflectQuestion"]') ||
                 node.matches('div[role="group"][aria-labelledby*="-legend"]') || // Added the new selector for self-review pages
                 node.matches('.c-quiz-question') // Older quiz question class
                )
            );
            if (relevantNodes) {
                quizContentChanged = true;
                break;
            }
        }
    }
    if (quizContentChanged) {
        console.log('DOM change detected, re-scanning for quizzes.');
        clearTimeout(window._quizScanDebounce);
        window._quizScanDebounce = setTimeout(() => {
            if (!isSolverActive) {
                detectAndSolveQuizzes();
            }
        }, 1000); // Debounce to avoid multiple rapid scans
    }
}

// Start the solver
initializeSolver();