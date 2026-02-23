// utils/smart_blocker.js

import { StorageManager } from './storage_manager.js';
import { ErrorHandler } from './error_handler.js';
import { CONSTANTS } from './constants.js';

class SmartBlocker {
    /**
     * Generates a simple, consistent signature (hash) for a given text string.
     * This is used to identify questions and answer options across attempts,
     * making them resistant to minor UI changes but sensitive to content changes.
     * @param {string} text - The text to generate a signature for.
     * @returns {string} The generated signature.
     */
    static generateSignature(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        // Normalize: lowercase, remove leading/trailing whitespace, collapse multiple spaces
        // Also remove common punctuation that doesn't alter meaning for robust matching
        const normalizedText = text
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '') // Remove common punctuation
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        
        // Simple string hash function (djb2 variant)
        let hash = 0;
        for (let i = 0; i < normalizedText.length; i++) {
            const char = normalizedText.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return String(hash);
    }

    /**
     * Stores an incorrectly selected answer signature for a specific question within a quiz.
     * The data is structured to be keyed by a combination of course and quiz IDs,
     * and then by question signature, holding an array of wrong answer signatures.
     * Data structure in storage:
     * {
     * "courseId_quizId": {
     * "questionSignature1": ["wrongAnswerSignatureA", "wrongAnswerSignatureB"],
     * "questionSignature2": ["wrongAnswerSignatureX"]
     * },
     * "anotherCourseId_anotherQuizId": { ... }
     * }
     * @param {string} courseId - The ID of the Coursera course (from URL).
     * @param {string} quizId - The ID of the quiz (from URL).
     * @param {string} questionSignature - The generated signature of the question.
     * @param {string} wrongAnswerSignature - The generated signature of the answer option that was wrong.
     */
    static async addWrongAnswer(courseId, quizId, questionSignature, wrongAnswerSignature) {
        if (!courseId || !quizId || !questionSignature || !wrongAnswerSignature) {
            ErrorHandler.logError('SmartBlocker: Missing parameters for addWrongAnswer.', {courseId, quizId, questionSignature, wrongAnswerSignature});
            return;
        }

        const storageKey = CONSTANTS.STORAGE_KEYS.SMART_BLOCKER_DATA_KEY;
        const quizSpecificKey = `${courseId}_${quizId}`; // Unique key for this specific quiz instance

        try {
            const storedData = await StorageManager.get(storageKey) || {};
            const quizData = storedData[quizSpecificKey] || {};
            const questionWrongAnswers = quizData[questionSignature] || [];

            if (!questionWrongAnswers.includes(wrongAnswerSignature)) {
                questionWrongAnswers.push(wrongAnswerSignature);
                quizData[questionSignature] = questionWrongAnswers;
                storedData[quizSpecificKey] = quizData;
                await StorageManager.set(storageKey, storedData);
                console.log(`SmartBlocker: Added wrong answer for quiz ${quizSpecificKey}, question ${questionSignature}: ${wrongAnswerSignature}`);
            } else {
                console.log(`SmartBlocker: Wrong answer ${wrongAnswerSignature} already recorded for question ${questionSignature}.`);
            }
        } catch (error) {
            ErrorHandler.logError('SmartBlocker: Failed to add wrong answer to storage', error);
        }
    }

    /**
     * Retrieves the list of previously marked wrong answer signatures for a given question in a quiz.
     * @param {string} courseId - The ID of the Coursera course.
     * @param {string} quizId - The ID of the quiz.
     * @param {string} questionSignature - The signature of the question to retrieve wrong answers for.
     * @returns {Promise<string[]>} A promise that resolves to an array of wrong answer signatures.
     * Returns an empty array if no data is found or an error occurs.
     */
    static async getWrongAnswers(courseId, quizId, questionSignature) {
        if (!courseId || !quizId || !questionSignature) {
            ErrorHandler.logError('SmartBlocker: Missing parameters for getWrongAnswers.', {courseId, quizId, questionSignature});
            return [];
        }

        const storageKey = CONSTANTS.STORAGE_KEYS.SMART_BLOCKER_DATA_KEY;
        const quizSpecificKey = `${courseId}_${quizId}`;

        try {
            const storedData = await StorageManager.get(storageKey) || {};
            const quizData = storedData[quizSpecificKey] || {};
            return quizData[questionSignature] || [];
        } catch (error) {
            ErrorHandler.logError('SmartBlocker: Failed to retrieve wrong answers from storage', error);
            return [];
        }
    }

    /**
     * Clears smart blocker data. Can clear for a specific quiz, or all data.
     * @param {string} [courseId] - Optional. The ID of the Coursera course.
     * @param {string} [quizId] - Optional. The ID of the quiz.
     */
    static async clearWrongAnswers(courseId, quizId) {
        const storageKey = CONSTANTS.STORAGE_KEYS.SMART_BLOCKER_DATA_KEY;
        try {
            if (courseId && quizId) {
                const quizSpecificKey = `${courseId}_${quizId}`;
                const storedData = await StorageManager.get(storageKey) || {};
                if (storedData[quizSpecificKey]) {
                    delete storedData[quizSpecificKey];
                    await StorageManager.set(storageKey, storedData);
                    console.log(`SmartBlocker: Cleared wrong answers for quiz ${quizSpecificKey}`);
                } else {
                    console.log(`SmartBlocker: No data found for quiz ${quizSpecificKey} to clear.`);
                }
            } else {
                await StorageManager.remove(storageKey); // Clear all if no specific quiz
                console.log('SmartBlocker: Cleared all smart blocker data.');
            }
        } catch (error) {
            ErrorHandler.logError('SmartBlocker: Failed to clear wrong answers data', error);
        }
    }
}

export { SmartBlocker };