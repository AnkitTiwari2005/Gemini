// content_scripts/modules/dom_detector.js

/**
 * @module DOMDetector
 * @description Provides utilities to detect and extract quiz questions and their options
 * from the Coursera page's DOM.
 */

class DOMDetector {
    constructor() {
        this.questions = [];
    }

    /**
     * Initializes the detection process by finding all potential quiz question containers.
     */
    detect() {
        console.log("DOMDetector: Starting detection...");
        this.questions = [];

        // UPDATED: More robust selectors for different types of question containers
        // This includes general quiz questions, assignment submissions, and self-review pages.
        const questionContainerSelectors = [
            '[data-testid*="part-Submission_MultipleChoiceQuestion"]', // Covers general MCQs and "Reflect" types
            '.rc-FormPartsQuestion', // Common standard quiz question container
            'div[role="group"][aria-labelledby*="-legend"]', // Broader selector for question groups, seen in 8.txt
            '.rc-QuizQuestion' // Another general Coursera quiz question class
        ];

        let potentialQuestionContainers = [];
        questionContainerSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(container => {
                // Ensure unique containers are added to avoid duplicates if multiple selectors match the same element
                if (!potentialQuestionContainers.includes(container)) {
                    potentialQuestionContainers.push(container);
                }
            });
        });

        if (potentialQuestionContainers.length === 0) {
            console.log("DOMDetector: No potential quiz question containers found.");
            return;
        }

        console.log(`DOMDetector: Found ${potentialQuestionContainers.length} potential quiz question containers.`);

        potentialQuestionContainers.forEach((container, index) => {
            try {
                const question = this.extractQuestion(container, index);
                if (question) {
                    this.questions.push(question);
                }
            } catch (error) {
                console.error(`DOMDetector: Error extracting question from container ${index}:`, error);
            }
        });

        console.log(`DOMDetector: Extracted ${this.questions.length} questions.`);
    }

    /**
     * Extracts a single question and its options from a given container element.
     * @param {Element} container - The DOM element containing the question.
     * @param {number} index - The index of the question (for logging/debugging).
     * @returns {Object|null} The extracted question object, or null if extraction fails.
     */
    extractQuestion(container, index) {
        let questionText = null;
        let options = [];
        let codeSnippet = null; // To store extracted code

        // --- Question Text and Code Extraction ---
        // Prioritize specific elements for question text
        const questionTextSelectors = [
            '[data-testid="legend"] .rc-CML p',
            '[data-testid="legend"] p',
            '.rc-FormPartsQuestion__contentCell .rc-CML p',
            'div[data-test-id="question-text"] p' // Common for older quizzes
        ];

        for (const selector of questionTextSelectors) {
            const element = container.querySelector(selector);
            if (element && element.textContent.trim()) {
                questionText = element.textContent.trim();
                break;
            }
        }

        // UPDATED: Look for code blocks within the question container
        const codeBlockSelectors = [
            'pre code', // Standard code block
            '.rc-CodeBlock code', // Coursera-specific code block class
            '[data-testid="cml-viewer"] pre code', // Code inside CML viewer
            '[data-testid="cml-code"] pre code', // Specific data-testid for code
            '[data-testid="cml-code"]', // Sometimes code is directly within this div
            '.c-content-code pre' // Older code blocks
        ];

        for (const selector of codeBlockSelectors) {
            const codeElement = container.querySelector(selector);
            if (codeElement && codeElement.textContent.trim()) {
                codeSnippet = codeElement.textContent.trim();
                break;
            }
        }

        // Combine question text and code snippet
        if (questionText && codeSnippet) {
            questionText = `${questionText}\n\n\`\`\`javascript\n${codeSnippet}\n\`\`\``;
        } else if (!questionText && codeSnippet) {
            // If only code is found, make the code the question text
            questionText = `\`\`\`javascript\n${codeSnippet}\n\`\`\``;
        }
        
        // Final fallback for question text if not found through specific selectors, but found in a 'legend' like area
        if (!questionText) {
            const legendElement = container.querySelector('[data-testid="legend"]');
            if (legendElement && legendElement.textContent.trim()) {
                // Attempt to clean up numerical prefixes (e.g., "1. Question Text")
                questionText = legendElement.textContent.trim().replace(/^\d+\.\s*/, '');
            }
        }

        if (!questionText) {
            console.warn(`DOMDetector: Could not find any valid question text for container ${index}.`);
            return null; // Return null if no question text at all
        }

        // --- Options Extraction ---
        // UPDATED: More robust selectors for individual answer option containers
        const optionContainerSelectors = [
            '[data-testid="Submission_MultipleChoiceQuestion__option"]',
            '.rc-Option', // Most consistent option wrapper
            '.rc-FormPartsQuestion__choices > div', // General choices wrapper
            'div[role="radio"]', // If options are directly role="radio"
            'div[role="checkbox"]', // If options are directly role="checkbox"
            '.c-choice-group__item' // Found in some older structures
        ];
        
        let rawOptions = [];
        optionContainerSelectors.forEach(selector => {
            container.querySelectorAll(selector).forEach(optionElement => {
                // Add unique option elements
                if (!rawOptions.includes(optionElement)) {
                    rawOptions.push(optionElement);
                }
            });
        });

        // Fallback for options if primary selectors don't work, look for inputs directly
        if (rawOptions.length === 0) {
             container.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                const parentElement = input.closest('label') || input.closest('div');
                if (parentElement && !rawOptions.includes(parentElement)) {
                    rawOptions.push(parentElement);
                }
            });
        }

        rawOptions.forEach(optionElement => {
            let optionText = null;
            let optionValue = null;
            let inputElement = null; // To store the actual input element

            // UPDATED: Try to find the option text within the option element
            const textElement = optionElement.querySelector('.rc-Option .rc-CML p') ||
                                optionElement.querySelector('.rc-Option__text') ||
                                optionElement.querySelector('span:not([data-testid="visually-hidden"])') || // Exclude hidden spans
                                optionElement.querySelector('.cml-viewer p') || // General CML within an option
                                optionElement.querySelector('p'); // General paragraph within an option
            
            if (textElement && textElement.textContent.trim()) {
                optionText = textElement.textContent.trim();
            } else {
                // Fallback to direct text content of the option element, cleaning up any leading numbers/letters
                optionText = optionElement.textContent.trim().replace(/^[a-zA-Z]\.\s*|^[0-9]\.\s*/, '');
            }

            // Get the value and the input element itself from within the option element
            inputElement = optionElement.querySelector('input[type="radio"], input[type="checkbox"]');
            if (inputElement) {
                optionValue = inputElement.value;
            }

            if (optionText) {
                options.push({ text: optionText, value: optionValue, element: inputElement }); // Store the input element for interaction
            }
        });

        if (options.length === 0) {
            console.warn(`DOMDetector: No options extracted for question "${questionText.substring(0, 50)}..." after all attempts.`);
            // This might be a fill-in-the-blank or free text question, or an undetected option structure.
        }

        // Return the structured question object including the container DOM element
        return {
            question: questionText,
            options: options,
            container: container // Include the main question container element
        };
    }

    /**
     * Returns the detected questions.
     * @returns {Array<Object>} An array of question objects.
     */
    getQuestions() {
        return this.questions;
    }
}

// Export the DOMDetector class so it can be imported by other modules (like coursera_solver.js)
export { DOMDetector };