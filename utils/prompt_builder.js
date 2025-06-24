// utils/prompt_builder.js

/**
 * @module PromptBuilder
 * @description Generates optimized prompts for the Google Gemini API based on quiz question data.
 * Aims to maximize accuracy and ensure relevant output format.
 */

// ADD THIS LINE:
import { ErrorHandler } from './error_handler.js';

class PromptBuilder {
    /**
     * Builds a comprehensive prompt for the Gemini API to solve a quiz question.
     * @param {object} questionData - Object containing question text, options, and type.
     * - `questionText`: The main question string.
     * - `options`: Array of option objects `{ text: string, index: number }`.
     * - `questionType`: 'single' or 'multiple'.
     * @param {boolean} includeExplanation - If true, requests an explanation for the answer.
     * @returns {Array<object>} An array of message parts (text, role) for the Gemini API.
     */
    static buildQuizPrompt(questionData, includeExplanation) {
        if (!questionData || !questionData.questionText || !questionData.options || questionData.options.length === 0) {
            ErrorHandler.logError('PromptBuilder: Invalid question data provided for prompt construction.'); // This line will now work
            throw new Error('Invalid question data for prompt construction.');
        }

        const { questionText, options, questionType } = questionData;

        let optionsString = '';
        const optionMap = new Map(); // To map option text to identifiers (e.g., A, B, C)
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C...
            optionsString += `${letter}. ${option.text}\n`;
            optionMap.set(option.text.toLowerCase(), letter); // Store for parsing if needed
        });

        // Determine instructions based on question type
        const answerFormatInstruction = questionType === 'multiple'
            ? `Select ALL correct options. Provide your answer as a comma-separated list of the option letters (e.g., "A, C" if A and C are correct).`
            : `Select the ONE correct option. Provide your answer as a single option letter (e.g., "B").`;

        // Determine explanation request
        const explanationInstruction = includeExplanation
            ? `Additionally, provide a concise explanation for why your chosen answer(s) are correct.`
            : `Do NOT provide any explanation unless explicitly requested.`;

        const systemInstruction = `You are an expert academic assistant specializing in online course content. Your task is to accurately answer multiple-choice and single-choice quiz questions.
        Strictly follow the output format.
        `;

        const userPrompt = `Given the following quiz question and options:

Question: ${questionText}

Options:
${optionsString}

${answerFormatInstruction}
${explanationInstruction}`;

        return [
            {
                role: "user",
                parts: [
                    { text: systemInstruction },
                    { text: userPrompt }
                ]
            }
        ];
    }

    // You could add other prompt building methods here for different tasks
    /**
     * Builds a prompt specifically for generating an explanation for an already selected answer.
     * @param {string} questionText - The original question text.
     * @param {string[]} options - The original options.
     * @param {string[]} selectedAnswers - The text of the answers that were selected.
     * @returns {Array<object>} A Gemini API prompt.
     */
    static buildExplanationPrompt(questionText, options, selectedAnswers) {
        if (!questionText || !options || options.length === 0 || !selectedAnswers || selectedAnswers.length === 0) {
            ErrorHandler.logError('PromptBuilder: Invalid data for explanation prompt construction.'); // This line will now work
            throw new Error('Invalid data for explanation prompt construction.');
        }

        let optionsString = '';
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index);
            optionsString += `${letter}. ${option.text}\n`;
        });

        const selectedAnswersString = selectedAnswers.join(' and '); // "Option A and Option B"

        return [
            {
                role: "user",
                parts: [
                    { text: `Explain why the following answer(s) are correct for the given quiz question. Be concise and focus only on the explanation.\n\nQuestion: ${questionText}\n\nOptions:\n${optionsString}\n\nSelected Answer(s): ${selectedAnswersString}\n\nExplanation:` }
                ]
            }
        ];
    }
}

export { PromptBuilder };