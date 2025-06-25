// utils/prompt_builder.js

/**
 * @module PromptBuilder
 * @description Generates optimized prompts for the Google Gemini API based on quiz question data.
 * Aims to maximize accuracy and ensure relevant output format.
 */

import { ErrorHandler } from './error_handler.js';

class PromptBuilder {
    /**
     * Builds a comprehensive prompt for the Gemini API to solve a quiz question.
     * @param {object} questionData - Object containing question text, options, and type.
     * - `question`: The main question string.
     * - `options`: Array of option objects `{ text: string, value: string, element: Element }`.
     * - `questionType`: 'single' or 'multiple'.
     * @param {boolean} includeExplanation - If true, requests an explanation for the answer.
     * @returns {Array<object>} An array of message parts (text, role) for the Gemini API.
     */
    static buildQuizPrompt(questionData, includeExplanation) {
        if (!questionData || !questionData.question || !questionData.options || questionData.options.length === 0) {
            ErrorHandler.logError('PromptBuilder: Invalid question data provided for prompt construction.');
            throw new Error('Invalid question data for prompt construction.');
        }

        const { question, options, questionType } = questionData;

        let optionsString = '';
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C...
            optionsString += `${letter}. ${option.text}\n`;
        });

        // Determine instructions based on question type - MADE MORE STRICT
        const answerFormatInstruction = questionType === 'multiple'
            ? `Your ENTIRE response MUST be ONLY a comma-separated list of the correct option letters (e.g., "A, C" if A and C are correct). ABSOLUTELY NO other text, explanation, or punctuation should be included unless you are also providing an explanation.`
            : `Your ENTIRE response MUST be ONLY the single, correct option letter (e.g., "B"). ABSOLUTELY NO other text, explanation, or punctuation should be included unless you are also providing an explanation.`;

        // Determine explanation request - MADE MORE STRICT
        const explanationInstruction = includeExplanation
            ? `Immediately after your answer(s), provide a clear, concise explanation for why your chosen answer(s) are correct, prefixed with "Explanation: ".`
            : `Do NOT provide any explanation or extra text. Only provide the answer in the specified format.`;

        // Refined system instruction for better adherence to format
        const systemInstruction = `You are an expert academic assistant specializing in online course content. Your primary goal is to provide accurate answers to quiz questions.
        Strictly follow the output format instructions given in the user prompt. Your response should be as direct and concise as possible according to the format.`;

        const userPrompt = `Given the following quiz question and options:

Question: ${question}

Options:
${optionsString}

${answerFormatInstruction}
${explanationInstruction}`;

        return [
            {
                role: "user",
                parts: [
                    { text: systemInstruction }, // System instruction should ideally be a separate part or role for some APIs, but as a text part it's fine for simple models.
                    { text: userPrompt }
                ]
            }
        ];
    }

    /**
     * Builds a prompt specifically for generating an explanation for an already selected answer.
     * @param {string} question - The original question text.
     * @param {Array<object>} options - The original options array from DOMDetector.
     * @param {string[]} selectedAnswerTexts - The text of the answers that were selected (e.g., ["Option A text", "Option B text"]).
     * @returns {Array<object>} A Gemini API prompt.
     */
    static buildExplanationPrompt(question, options, selectedAnswerTexts) {
        if (!question || !options || options.length === 0 || !selectedAnswerTexts || selectedAnswerTexts.length === 0) {
            ErrorHandler.logError('PromptBuilder: Invalid data for explanation prompt construction.');
            throw new Error('Invalid data for explanation prompt construction.');
        }

        let optionsString = '';
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index);
            optionsString += `${letter}. ${option.text}\n`;
        });

        const selectedAnswersDisplay = selectedAnswerTexts.map(text => `"${text}"`).join(' and ');

        return [
            {
                role: "user",
                parts: [
                    { text: `For the following quiz question, provide a detailed but concise explanation for why the selected answer(s) are correct. Focus on the core reasoning and avoid conversational filler.\n\nQuestion: ${question}\n\nOptions:\n${optionsString}\n\nSelected Answer(s): ${selectedAnswersDisplay}\n\nExplanation:` }
                ]
            }
        ];
    }
}

export { PromptBuilder };