// content_scripts/modules/answer_renderer.js

/**
 * @module AnswerRenderer
 * @description Renders the solved answers on the Coursera page by selecting
 * radio buttons, checking checkboxes, or highlighting options.
 */

class AnswerRenderer {
    /**
     * Renders the provided answers by either auto-selecting or highlighting.
     * @param {object} questionData - The question object obtained from DOMDetector.
     * @param {string[]} answers - An array of strings representing the correct answer texts.
     * @param {boolean} autoSelect - If true, auto-selects; otherwise, only highlights.
     */
    static renderAnswer(questionData, answers, autoSelect) {
        if (!questionData || !questionData.options || !answers || answers.length === 0) {
            console.error('AnswerRenderer: Invalid input for rendering answers.', { questionData, answers });
            return;
        }

        // --- START DEBUGGING LOGS ---
        console.log('AnswerRenderer: questionData.options:', questionData.options);
        console.log('AnswerRenderer: answers from Gemini:', answers);
        // --- END DEBUGGING LOGS ---

        const selectedElements = new Set(); // To prevent duplicate highlighting/selection

        questionData.options.forEach(option => {
            const optionTextLower = option.text.toLowerCase();
            const isCorrectAnswer = answers.some(ans => optionTextLower.includes(ans.toLowerCase())); // Case-insensitive, partial match

            // Remove any previous highlight/selection classes
            if (option.element.closest) { // Check if closest exists (for non-input elements if any)
                 option.element.classList.remove('gs-selected-answer', 'gs-highlighted-answer');
                 const labelParent = option.element.closest('.rc-RadioChoice__label, .rc-CheckboxChoice__label');
                 if (labelParent) {
                     labelParent.classList.remove('gs-selected-answer', 'gs-highlighted-answer');
                 }
            }


            if (isCorrectAnswer) {
                // To avoid selecting/highlighting the same element multiple times if logic is complex
                if (selectedElements.has(option.element)) {
                    return;
                }

                if (autoSelect) {
                    if (option.element.type === 'radio' || option.element.type === 'checkbox') {
                        option.element.checked = true;
                        // Trigger change event to ensure Coursera's JS registers the selection
                        option.element.dispatchEvent(new Event('change', { bubbles: true }));
                        option.element.dispatchEvent(new Event('click', { bubbles: true })); // Some frameworks listen to click
                    }
                    if (option.element.closest) {
                        const labelParent = option.element.closest('.rc-RadioChoice__label, .rc-CheckboxChoice__label');
                        if (labelParent) {
                            labelParent.classList.add('gs-selected-answer');
                        }
                    }
                } else {
                    if (option.element.closest) {
                        const labelParent = option.element.closest('.rc-RadioChoice__label, .rc-CheckboxChoice__label');
                        if (labelParent) {
                            labelParent.classList.add('gs-highlighted-answer');
                        } else {
                            // Fallback if not a standard Coursera label structure
                            option.element.classList.add('gs-highlighted-answer');
                        }
                    }
                }
                selectedElements.add(option.element);
            }
        });
    }
}

export { AnswerRenderer };