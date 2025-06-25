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
     * @param {Array<object>} options - The original array of option objects from DOMDetector (includes {text, value, element}).
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

        console.log('ResponseParser: Gemini raw response text:', responseText);

        let extractedExplanation = null;
        let answerPart = responseText;

        // Attempt to separate answer from explanation based on "Explanation:" keyword
        const explanationDelimiter = /Explanation:\s*/i; // Case-insensitive
        const explanationMatch = responseText.match(explanationDelimiter);

        if (explanationMatch) {
            extractedExplanation = responseText.substring(explanationMatch.index + explanationMatch[0].length).trim();
            answerPart = responseText.substring(0, explanationMatch.index).trim();
        }

        // --- Robust Answer Extraction from `answerPart` ---
        let parsedAnswerLetters = [];
        // Ensure maxOptionLetter is correctly calculated, handling cases with many options
        const maxOptionLetter = options.length > 0 ? String.fromCharCode(64 + options.length) : 'A'; 


        if (questionType === 'single') {
            // Strategy 1: Look for a single letter (A, B, C, D) as the entire answer part
            if (new RegExp(`^[A-${maxOptionLetter}]$`).test(answerPart)) {
                parsedAnswerLetters.push(answerPart);
            } else {
                // Strategy 2: Look for 'A.', 'B.', 'Option A', 'Answer is B'
                const singleLetterMatch = answerPart.match(new RegExp(`(?:^|[^A-Z0-9])([A-${maxOptionLetter}])(?:\\.|\\s|$)`, 'i'));
                if (singleLetterMatch && singleLetterMatch[1]) {
                    parsedAnswerLetters.push(singleLetterMatch[1].toUpperCase());
                }
            }
        } else { // 'multiple' choice
            // Strategy 1: Look for comma-separated letters (e.g., "A, C", "B, D, A")
            // This regex now correctly captures multiple letters by finding all matches globally
            const commaSeparatedMatches = answerPart.match(new RegExp(`[A-${maxOptionLetter}]`, 'g'));
            if (commaSeparatedMatches) {
                parsedAnswerLetters = commaSeparatedMatches.map(s => s.trim().toUpperCase());
            } else {
                // Strategy 2: Look for multiple individual letters (e.g., "A and C", "B. C. D")
                // This is already covered by the global regex above.
                // Re-added for clarity in case future modifications separate concerns.
                const individualLetters = answerPart.match(new RegExp(`[A-${maxOptionLetter}]`, 'g'));
                if (individualLetters) {
                    parsedAnswerLetters = individualLetters.map(s => s.toUpperCase());
                }
            }
        }

        // Filter and map to actual option texts
        let finalParsedAnswers = []; // Changed to `let` for re-assignment in fallback
        const seenLetters = new Set(); // To ensure unique answers

        // Validate extracted letters against available options
        for (const letter of parsedAnswerLetters) {
            const index = letter.charCodeAt(0) - 65;
            if (options[index] && !seenLetters.has(letter)) {
                finalParsedAnswers.push(options[index].text);
                seenLetters.add(letter);
            } else if (options[index] && seenLetters.has(letter)) {
                console.warn(`ResponseParser: Duplicate answer letter '${letter}' detected and ignored.`);
            } else {
                console.warn(`ResponseParser: Extracted letter '${letter}' does not correspond to a valid option.`);
            }
        }
        
        // --- Fallback if no letter-based answers are found, but options are present in response text ---
        // This is a lower confidence fallback and should ideally not be hit if prompt is followed.
        if (finalParsedAnswers.length === 0 && options.length > 0) {
            console.warn("ResponseParser: No letter-based answers found. Attempting to match full option text as fallback.");
            const responseTextLower = responseText.toLowerCase();

            options.forEach(option => {
                const optionTextLower = option.text.toLowerCase();
                // Check if the exact option text (or a very close match) is present in the response
                // This is a simple `includes` - a more sophisticated approach might use fuzzy matching
                if (responseTextLower.includes(optionTextLower) && !finalParsedAnswers.includes(option.text)) {
                    // For single choice, if multiple answers were picked up by text matching, just take the first
                    // IMPORTANT: This condition only applies to 'single' choice questions.
                    if (questionType === 'single' && finalParsedAnswers.length > 0) {
                        return; // Already found a single answer for a single-choice question
                    }
                    finalParsedAnswers.push(option.text);
                }
            });

            // For single choice, if multiple answers were picked up by text matching, just take the first
            // This is a redundant check if the above `return` handles it for 'single', but good for robustness.
            if (questionType === 'single' && finalParsedAnswers.length > 1) {
                console.warn('ResponseParser: Multiple answers parsed by text match for single choice. Taking the first.');
                finalParsedAnswers = [finalParsedAnswers[0]];
            }
        }

        if (finalParsedAnswers.length === 0) {
            ErrorHandler.logError('ResponseParser: Failed to extract any valid answer from Gemini response text.', responseText);
            throw new Error('ResponseParser: Failed to extract any valid answer from Gemini response text.');
        }

        return {
            answers: finalParsedAnswers,
            explanation: extractedExplanation,
            confidence: 100 // Placeholder. Gemini API doesn't directly provide confidence score.
        };
    }
}

export { ResponseParser };