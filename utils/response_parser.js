// utils/response_parser.js

/**
 * @module ResponseParser
 * @description Parses the raw JSON response from the Gemini API to extract
 * the identified correct answers and any requested explanations.
 * Designed to be flexible to various output formats.
 */

import { ErrorHandler } from './error_handler.js';

class ResponseParser {
    /**
     * Parses the Gemini API response to extract quiz answers and explanations.
     * @param {object} geminiResponse - The raw JSON response object from the Gemini API.
     * @param {Array<object>} options - The original array of option objects from DOMDetector.
     * @param {'single'|'multiple'} questionType - The type of question.
     * @returns {object} An object containing:
     * - `answers`: Array of strings, each being the text of a correct answer.
     * - `explanation`: string or null, if an explanation was provided.
     * - `confidence`: number (0-100), inferred or directly from model (placeholder).
     * @throws {Error} If no valid answer or response text can be extracted.
     */
    static parseGeminiQuizResponse(geminiResponse, options, questionType) {
        if (!geminiResponse || !geminiResponse.candidates || geminiResponse.candidates.length === 0) {
            ErrorHandler.logError('ResponseParser: Invalid or empty Gemini response received.', geminiResponse);
            throw new Error('Invalid or empty response from Gemini API.');
        }

        const candidate = geminiResponse.candidates[0];
        let responseText = '';

        // Safely extract text from parts
        if (candidate.content && Array.isArray(candidate.content.parts)) {
            responseText = candidate.content.parts
                .filter(part => part.text)
                .map(part => part.text)
                .join(' ').trim();
        }

        if (!responseText) {
            ErrorHandler.logError('ResponseParser: No text content found in Gemini response candidate.', geminiResponse);
            throw new Error('No answer text provided by Gemini.');
        }

        console.log('Gemini raw response text:', responseText);

        const parsedAnswers = [];
        let explanation = null;

        // Separate answer from explanation if both are present
        const explanationMatch = responseText.match(/(Explanation:|Explanation:)\s*(.*)/is);
        if (explanationMatch && explanationMatch[2]) {
            explanation = explanationMatch[2].trim();
            responseText = responseText.substring(0, explanationMatch.index).trim();
        }

        // --- Robust Answer Extraction ---
        // Strategy 1: Look for letter-based answers (A, B, C...)
        const letterAnswers = responseText.match(/[A-Z](?=[.,\s]|$)/g); // Find capital letters possibly followed by punctuation/space
        if (letterAnswers && letterAnswers.length > 0) {
            letterAnswers.forEach(letter => {
                const index = letter.charCodeAt(0) - 65; // A=0, B=1...
                if (options[index]) {
                    parsedAnswers.push(options[index].text);
                }
            });
        }

        // Strategy 2: If no letter answers, try to match whole option text (less reliable if options are long)
        if (parsedAnswers.length === 0) {
            options.forEach(option => {
                // Use a more robust matching strategy, e.g., includes()
                // Convert both to lower case for case-insensitive comparison
                const optionTextLower = option.text.toLowerCase();
                const responseTextLower = responseText.toLowerCase();

                // If Gemini's response directly contains an option text
                if (responseTextLower.includes(optionTextLower) && parsedAnswers.length < (questionType === 'single' ? 1 : options.length)) {
                    parsedAnswers.push(option.text);
                }
            });
        }

        // Fallback for single choice if multiple answers parsed somehow
        if (questionType === 'single' && parsedAnswers.length > 1) {
            // Take the first parsed answer or apply a more sophisticated heuristic
            console.warn('ResponseParser: Multiple answers parsed for single choice. Taking the first.', parsedAnswers);
            parsedAnswers.splice(1); // Keep only the first
        }
        
        if (parsedAnswers.length === 0) {
            throw new Error('ResponseParser: Failed to extract any valid answer from Gemini response text.');
        }

        return {
            answers: Array.from(new Set(parsedAnswers)), // Ensure unique answers
            explanation: explanation,
            confidence: 100 // Placeholder. Gemini API doesn't directly provide confidence score. Could infer from safety ratings if present.
        };
    }
}

export { ResponseParser };