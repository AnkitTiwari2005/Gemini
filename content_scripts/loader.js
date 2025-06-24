// content_scripts/loader.js

/**
 * @module ContentScriptLoader
 * @description This script acts as a loader for coursera_solver.js,
 * ensuring it's loaded as an ES Module within the page context.
 */

// Set a global flag so the background script can check if the solver is already injected.
// This helps prevent multiple injections on page refreshes or DOM changes.
window.courseraSolverInjected = true;

// Dynamically import the main content script.
// This is the key step that forces the browser to treat coursera_solver.js and its
// own imports (like DOMDetector, UIFeedback, etc.) as ES Modules.
import('./coursera_solver.js')
  .then(() => {
    console.log('Loader: coursera_solver.js module loaded successfully.');
    // You might want to call an initialization function here if coursera_solver.js
    // exports one, instead of calling initializeSolver directly within it.
    // For now, since initializeSolver() is called at the end of coursera_solver.js,
    // this dynamic import is sufficient to trigger its execution.
  })
  .catch(error => {
    console.error('Loader: Failed to load coursera_solver.js module:', error);
    // Potentially show a user-facing error or log it via the background script
    // if the ErrorHandler is accessible here.
    // For now, just a console error is fine.
  });