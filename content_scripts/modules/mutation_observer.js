// content_scripts/modules/mutation_observer.js

/**
 * @module MutationObserverManager
 * @description Manages the MutationObserver to detect changes in the DOM,
 * specifically for dynamically loaded content on Coursera quiz pages.
 */

class MutationObserverManager {
    static observer = null;

    /**
     * Initializes and starts observing changes to the document body.
     * @param {function(MutationRecord[]): void} callback - The callback function to execute
     * when mutations are observed. This function typically re-scans for quizzes.
     */
    static observeBody(callback) {
        if (MutationObserverManager.observer) {
            console.warn('MutationObserverManager: Observer already active. Stopping previous observer.');
            MutationObserverManager.disconnect();
        }

        const config = { childList: true, subtree: true, attributes: false };
        MutationObserverManager.observer = new MutationObserver(callback);

        try {
            MutationObserverManager.observer.observe(document.body, config);
            console.log('MutationObserverManager: Observing document.body for changes.');
        } catch (error) {
            ErrorHandler.logError('MutationObserverManager: Failed to observe body:', error);
        }
    }

    /**
     * Stops observing changes and disconnects the observer.
     */
    static disconnect() {
        if (MutationObserverManager.observer) {
            MutationObserverManager.observer.disconnect();
            MutationObserverManager.observer = null;
            console.log('MutationObserverManager: Observer disconnected.');
        }
    }
}

export { MutationObserverManager };