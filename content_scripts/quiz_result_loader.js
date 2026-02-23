// content_scripts/quiz_result_loader.js

/**
 * @module QuizResultLoader
 * @description This script acts as a loader for quiz_result_parser.js,
 * ensuring it's loaded as an ES Module within the page context.
 */

// Set a global flag so the background script can check if the parser is already injected.
window.courseraResultParserInjectedViaLoader = true;

// Dynamically import the main quiz result parser script.
import('./quiz_result_parser.js')
  .then(() => {
    console.log('Quiz Result Loader: quiz_result_parser.js module loaded successfully.');
  })
  .catch(error => {
    console.error('Quiz Result Loader: Failed to load quiz_result_parser.js module:', error);
  });