// content_scripts/modules/ui_feedback.js

/**
 * @module UIFeedback
 * @description Manages visual feedback elements on the Coursera page,
 * such as toasts, tooltips, highlights, and question status indicators.
 */

class UIFeedback {
    static toastElement = null;
    static toastTimeout = null;

    /**
     * Displays a temporary toast message on the screen.
     * @param {string} message - The message to display.
     * @param {'info'|'success'|'error'|'warning'} type - The type of message for styling.
     * @param {number} [duration=3000] - Duration in milliseconds to show the toast.
     */
    static showToast(message, type = 'info', duration = 3000) {
        if (!UIFeedback.toastElement) {
            UIFeedback.toastElement = document.createElement('div');
            UIFeedback.toastElement.id = 'gemini-solver-toast';
            document.body.appendChild(UIFeedback.toastElement);
        }

        UIFeedback.toastElement.textContent = message;
        UIFeedback.toastElement.className = `gs-toast gs-toast--${type} gs-toast--show`;

        clearTimeout(UIFeedback.toastTimeout);
        UIFeedback.toastTimeout = setTimeout(() => {
            UIFeedback.hideToast();
        }, duration);
    }

    /**
     * Hides the currently displayed toast message.
     */
    static hideToast() {
        if (UIFeedback.toastElement) {
            UIFeedback.toastElement.classList.remove('gs-toast--show');
            // Remove from DOM after transition if desired, or keep hidden
        }
    }

    /**
     * Displays a tooltip next to a specific question element.
     * @param {HTMLElement} questionElement - The main DOM element of the question.
     * @param {string} message - The message to display in the tooltip.
     * @param {'info'|'success'|'error'|'warning'} type - The type of message for styling.
     * @param {number} [duration=3000] - Duration in milliseconds to show the tooltip.
     */
    static showTooltip(questionElement, message, type = 'info', duration = 3000) {
        let tooltip = questionElement.querySelector('.gs-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'gs-tooltip';
            questionElement.style.position = 'relative'; // Ensure positioning context for tooltip
            questionElement.appendChild(tooltip);
        }

        tooltip.textContent = message;
        tooltip.className = `gs-tooltip gs-tooltip--${type} gs-tooltip--show`;

        // Store timeout for this specific tooltip
        if (questionElement.dataset.tooltipTimeout) {
            clearTimeout(parseInt(questionElement.dataset.tooltipTimeout));
        }
        questionElement.dataset.tooltipTimeout = setTimeout(() => {
            tooltip.classList.remove('gs-tooltip--show');
            // Optional: remove tooltip element after it fades
            // tooltip.remove();
        }, duration);
    }

    /**
     * Highlights or marks a question element to indicate it's being processed.
     * @param {HTMLElement} questionElement - The main DOM element of the question.
     */
    static markQuestionAsProcessing(questionElement) {
        questionElement.classList.add('gs-processing');
        questionElement.classList.remove('gs-solved', 'gs-error', 'gs-warning'); // Clear previous states
        // Add a spinner or icon if desired
        let spinner = questionElement.querySelector('.gs-spinner');
        if (!spinner) {
            spinner = document.createElement('img');
            spinner.src = chrome.runtime.getURL('assets/images/loading_spinner.gif');
            spinner.className = 'gs-spinner';
            questionElement.appendChild(spinner); // Append somewhere visible, e.g., near question text
        }
        spinner.style.display = 'block';
    }

    /**
     * Marks a question element to indicate its final status (solved, error, warning).
     * @param {HTMLElement} questionElement - The main DOM element of the question.
     * @param {'success'|'error'|'warning'} type - The final status type.
     */
    static markQuestionAsSolved(questionElement, type) {
        questionElement.classList.remove('gs-processing');
        questionElement.classList.add(`gs-${type}`);
        const spinner = questionElement.querySelector('.gs-spinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        // Add a checkmark or error icon
        let statusIcon = questionElement.querySelector('.gs-status-icon');
        if (!statusIcon) {
            statusIcon = document.createElement('span');
            statusIcon.className = 'gs-status-icon';
            questionElement.appendChild(statusIcon);
        }
        statusIcon.textContent = type === 'success' ? '✔' : (type === 'error' ? '✖' : '⚠');
        statusIcon.style.color = type === 'success' ? 'green' : (type === 'error' ? 'red' : 'orange');
        statusIcon.style.display = 'inline-block';
    }

    /**
     * Displays an explanation for a solved question.
     * @param {HTMLElement} questionElement - The main DOM element of the question.
     * @param {string} explanationText - The explanation provided by Gemini.
     */
    static showExplanation(questionElement, explanationText) {
        let explanationDiv = questionElement.querySelector('.gs-explanation');
        if (!explanationDiv) {
            explanationDiv = document.createElement('div');
            explanationDiv.className = 'gs-explanation';
            questionElement.appendChild(explanationDiv);
        }
        explanationDiv.innerHTML = `<strong>Explanation:</strong> ${explanationText}`;
        explanationDiv.style.display = 'block';
    }
}

export { UIFeedback };