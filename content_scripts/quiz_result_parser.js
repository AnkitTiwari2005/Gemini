// content_scripts/quiz_result_parser.js

import { SmartBlocker } from '../utils/smart_blocker.js';
import { ErrorHandler } from '../utils/error_handler.js';
import { CONSTANTS } from '../utils/constants.js';
import * as UrlParser from '../utils/url_parser.js'; // Import the UrlParser module

// --- UPDATED SELECTORS ---
// These selectors have been updated based on the provided Coursera quiz result page HTML structure.

// Selector for a container that holds a single question's result (e.g., "Question 1: Correct", "Question 2: Incorrect")
// Identified by a div with a specific data-testid attribute and class.
// UPDATED: Broadened the selector to match any data-testid containing "Submission"
const QUIZ_QUESTION_CONTAINER_SELECTOR = 'div[data-testid*="Submission"]';

// Selector within a QUIZ_QUESTION_CONTAINER_SELECTOR that indicates the question was incorrect.
// Uses the specific data-testid for the incorrect icon.
const INCORRECT_QUESTION_INDICATOR_SELECTOR = '[data-testid="icon-incorrect"]';

// Selector for the actual question text within its container.
// Targets the rc-CML class within the relevant question text div.
const QUESTION_TEXT_SELECTOR = 'div.css-ybrhvy .rc-CML';

// Selector for an individual answer option's text.
// Targets the span containing the actual option text.
const OPTION_TEXT_SELECTOR = 'span._bc4egv';

// Selector for the user's selected answer option (if it's incorrect).
// Targets the specific label class and the rc-Option container to find the checked radio input.
const SELECTED_INCORRECT_ANSWER_SELECTOR = '.rc-Option label.cui-isChecked';

// --- END UPDATED SELECTORS ---

/**
 * Parses the quiz results page to identify incorrect answers and stores them.
 */
async function parseQuizResults() {
    console.log('QuizResultParser: Starting result page analysis.');

    const currentUrl = window.location.href;

    // IMPORTANT: Calling the extractCourseAndQuizIdsFromResultUrl from the UrlParser module
    const ids = UrlParser.extractCourseAndQuizIdsFromResultUrl(currentUrl);

    if (!ids) {
        ErrorHandler.logError("QuizResultParser: Could not extract courseId or quizId from URL", currentUrl);
        console.log('QuizResultParser: Not on a recognized quiz result page or missing IDs.');
        return;
    }

    // Give some time for the page to fully render its results content and for dynamic elements to load
    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay for robustness

    const questionContainers = document.querySelectorAll(QUIZ_QUESTION_CONTAINER_SELECTOR);

    if (questionContainers.length === 0) {
        console.log('QuizResultParser: No question containers found on the page using selector. Check selectors.');
        return;
    }

    for (const container of questionContainers) {
        // Check if the overall question container or an element within it signifies an incorrect answer
        const isIncorrectQuestion = container.querySelector(INCORRECT_QUESTION_INDICATOR_SELECTOR);

        if (isIncorrectQuestion) {
            try {
                const questionElement = container.querySelector(QUESTION_TEXT_SELECTOR);
                const questionText = questionElement ? questionElement.innerText.trim() : '';
                const questionSignature = SmartBlocker.generateSignature(questionText);

                if (!questionSignature) {
                    console.warn('QuizResultParser: Could not generate signature for question. Skipping.', container);
                    continue;
                }

                const incorrectSelectedOptions = container.querySelectorAll(SELECTED_INCORRECT_ANSWER_SELECTOR);

                if (incorrectSelectedOptions.length === 0) {
                    // Fallback logic for complex DOM structures or if explicit 'selected' + 'incorrect' isn't on the option itself
                    console.warn('QuizResultParser: No specific selected-incorrect options found. Attempting fallback for question:', questionText);
                    const selectedOptionElements = container.querySelectorAll('.rc-Option--selected, [data-test="selected-option"]');
                    // This fallback assumes that if the question is marked incorrect, and *any* option was selected, that selected option was the incorrect choice.
                    // This is less precise but might be necessary if Coursera's DOM doesn't explicitly mark the selected incorrect choice.
                    for (const optionElement of selectedOptionElements) {
                        const optionTextElement = optionElement.querySelector(OPTION_TEXT_SELECTOR);
                        if (optionTextElement) {
                            const optionText = optionTextElement.innerText.trim();
                            const optionSignature = SmartBlocker.generateSignature(optionText);
                            if (optionSignature) {
                                await chrome.runtime.sendMessage({
                                    type: CONSTANTS.MESSAGES.REPORT_INCORRECT_ANSWER,
                                    payload: {
                                        courseId: ids.courseId,
                                        quizId: ids.quizId,
                                        questionSignature: questionSignature,
                                        wrongAnswerSignature: optionSignature
                                    }
                                });
                                console.log(`QuizResultParser: Fallback added wrong answer for ${questionSignature}: ${optionSignature}`);
                            }
                        }
                    }
                } else {
                    // Primary logic: Found specific elements marked as selected AND incorrect
                    for (const optionElement of incorrectSelectedOptions) {
                        const optionTextElement = optionElement.querySelector(OPTION_TEXT_SELECTOR);
                        if (optionTextElement) {
                            const optionText = optionTextElement.innerText.trim();
                            const optionSignature = SmartBlocker.generateSignature(optionText);
                            if (optionSignature) {
                                await chrome.runtime.sendMessage({
                                    type: CONSTANTS.MESSAGES.REPORT_INCORRECT_ANSWER,
                                    payload: {
                                        courseId: ids.courseId,
                                        quizId: ids.quizId,
                                        questionSignature: questionSignature,
                                        wrongAnswerSignature: optionSignature
                                    }
                                });
                                console.log(`QuizResultParser: Added wrong answer for ${questionSignature}: ${optionSignature}`);
                            }
                        }
                    }
                }
            } catch (error) {
                ErrorHandler.logError('QuizResultParser: Error processing question container', { container, error });
            }
        }
    }
    console.log('QuizResultParser: Analysis complete.');
}

// Run the parser when the content script is loaded
parseQuizResults();