// utils/url_parser.js

/**
 * @module UrlParser
 * @description Utility functions for parsing Coursera URLs and extracting relevant identifiers.
 */

/**
 * Extracts courseId and quizId from a Coursera quiz page URL.
 * Assumes a URL format like:
 * https://www.coursera.org/learn/{course-slug}/lecture/{lecture-id}/quiz/{quiz-id}/attempt
 * https://www.coursera.org/learn/{course-slug}/home/week/{week-number}/quiz/{quiz-id}/attempt
 *
 * @param {string} url - The URL of the Coursera quiz page.
 * @returns {object|null} An object containing courseId and quizId, or null if not found.
 */
function extractCourseraIdentifiers(url) {
    // Added $ to anchor to the end of the string for precision
    const quizPagePattern = /coursera\.org\/learn\/([^/]+)(?:\/[^/]+){2,4}\/quiz\/([^/]+)(?:\/attempt)?$/;
    // Added $ to anchor to the end of the string for precision
    const assignmentPagePattern = /coursera\.org\/learn\/([^/]+)\/assignment-submission\/([^/]+)(?:\/(?:practice-quiz|quiz))?\/([^/]+)(?:\/attempt)?$/;

    let match = url.match(quizPagePattern);
    if (match) {
        return { courseId: match[1], quizId: match[2] };
    }

    match = url.match(assignmentPagePattern);
    if (match) {
        return { courseId: match[1], quizId: match[3] }; // quizId should be the third group
    }

    console.warn(`UrlParser: Could not extract identifiers from URL: ${url}`);
    // Optional: add to debug display if this function is used elsewhere
    // if (window.updateGeminiSolverDebugInfo) { // REMOVED/KEPT COMMENTED AS IT REFERENCES 'window'
    //     window.updateGeminiSolverDebugInfo(`UrlParser: Could not extract identifiers from URL: ${url}`, true);
    // }
    return null;
}

/**
 * Extracts courseId, quizId, and optionally 'result' or 'view-feedback' state from a Coursera quiz result page URL.
 * Assumes URL formats like:
 * https://www.coursera.org/learn/{course-slug}/quiz/{quiz-id}/result
 * https://www.coursera.org/learn/{course-slug}/assignment-submission/{assignment-id}/view-feedback
 * https://www.coursera.org/learn/{course-slug}/assignment-submission/{assignment-id}/practice-quiz/{quiz-id}/view-feedback
 *
 * @param {string} url - The URL of the Coursera quiz result page.
 * @returns {object|null} An object containing courseId, quizId, and type, or null if not found.
 */
function extractCourseAndQuizIdsFromResultUrl(url) {
    // --- DEBUGGING ADDITION: Removed 'window' references ---
    // if (window.updateGeminiSolverDebugInfo) {
    //     window.updateGeminiSolverDebugInfo(`URL received by extractCourseAndQuizIdsFromResultUrl: ${url}`);
    //     window.updateGeminiSolverDebugInfo(`URL char codes: [${Array.from(url).map(c => c.charCodeAt(0)).join(', ')}]`, true);
    // }
    // --- END DEBUGGING ADDITION ---


    // Pattern for direct quiz results: /learn/{course-slug}/quiz/{quiz-id}/result
    const directQuizResultPattern = /coursera\.org\/learn\/([^/]+)\/quiz\/([^/]+)\/result(?:[?#].*)?$/;

    // Pattern for quizzes within assignment submissions like:
    // /learn/{course-slug}/assignment-submission/{assignment-id}/{quiz-slug}/view-feedback
    // Using (.*?) for maximal permissiveness for the quiz-slug to cover any unexpected characters.
    const assignmentQuizFeedbackPattern = /coursera\.org\/learn\/([^/]+)\/assignment-submission\/([^/]+)\/(.*?)\/view-feedback(?:[?#].*)?$/;

    // Pattern for general assignment submission feedback: /learn/{course-slug}/assignment-submission/{assignment-id}/view-feedback
    const assignmentFeedbackPattern = /coursera\.org\/learn\/([^/]+)\/assignment-submission\/([^/]+)\/view-feedback(?:[?#].*)?$/;


    let match;

    // Prioritize the most specific pattern
    match = url.match(assignmentQuizFeedbackPattern);
    if (match) {
        // For quizzes within assignments: group 1 = courseId, group 3 = quizId
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("MATCHED: assignmentQuizFeedbackPattern", true);
        //     window.updateGeminiSolverDebugInfo(`Extracted: CourseID='${match[1]}', QuizID='${match[3]}'`, true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.log("DEBUG: Matched assignmentQuizFeedbackPattern"); // Keep for console as well
        return { courseId: match[1], quizId: match[3], type: 'assignmentQuizResult' };
    } else {
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("FAILED: assignmentQuizFeedbackPattern", true);
        //     window.updateGeminiSolverDebugInfo(`Match Result (RAW): ${JSON.stringify(url.match(assignmentQuizFeedbackPattern))}`, true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.error("DEBUG: assignmentQuizFeedbackPattern failed to match. URL:", url); // Keep for console as well
        console.error("DEBUG: Result of url.match(assignmentQuizFeedbackPattern):", url.match(assignmentQuizFeedbackPattern)); // Keep for console as well
    }


    // Next, try general assignment feedback pattern
    match = url.match(assignmentFeedbackPattern);
    if (match) {
        // For general assignment feedback: group 1 = courseId, group 2 = assignmentId (used as quizId here)
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("MATCHED: assignmentFeedbackPattern", true);
        //     window.updateGeminiSolverDebugInfo(`Extracted: CourseID='${match[1]}', AssignmentID='${match[2]}'`, true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.log("DEBUG: Matched assignmentFeedbackPattern"); // Keep for console as well
        return { courseId: match[1], quizId: match[2], type: 'assignmentFeedback' };
    } else {
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("FAILED: assignmentFeedbackPattern", true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.error("DEBUG: assignmentFeedbackPattern failed to match. URL:", url); // Keep for console as well
    }

    // Finally, try direct quiz results pattern
    match = url.match(directQuizResultPattern);
    if (match) {
        // For direct quiz results: group 1 = courseId, group 2 = quizId
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("MATCHED: directQuizResultPattern", true);
        //     window.updateGeminiSolverDebugInfo(`Extracted: CourseID='${match[1]}', QuizID='${match[2]}'`, true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.log("DEBUG: Matched directQuizResultPattern"); // Keep for console as well
        return { courseId: match[1], quizId: match[2], type: 'quizResult' };
    } else {
        // --- DEBUGGING ADDITION: Removed 'window' references ---
        // if (window.updateGeminiSolverDebugInfo) {
        //     window.updateGeminiSolverDebugInfo("FAILED: directQuizResultPattern", true);
        // }
        // --- END DEBUGGING ADDITION ---
        console.error("DEBUG: directQuizResultPattern failed to match. URL:", url); // Keep for console as well
    }

    // --- DEBUGGING ADDITION: Removed 'window' references ---
    // if (window.updateGeminiSolverDebugInfo) {
    //     window.updateGeminiSolverDebugInfo(`FINAL FAILED: Could not extract CourseId or QuizId from URL.`, true);
    // }
    // --- END DEBUGGING ADDITION ---
    console.warn(`UrlParser: Could not extract courseId or quizId from URL: ${url}`); // Keep for console as well
    return null;
}

export { extractCourseraIdentifiers, extractCourseAndQuizIdsFromResultUrl };