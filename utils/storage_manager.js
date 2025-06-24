// utils/storage_manager.js

/**
 * @module StorageManager
 * @description Centralized utility for managing persistent data storage using Chrome's storage API.
 * Uses `chrome.storage.sync` for API keys and settings to allow synchronization across devices.
 * Provides a wrapper for robust error handling.
 */

import { ErrorHandler } from './error_handler.js';
import { CONSTANTS } from './constants.js';

class StorageManager {
    /**
     * Sets a value in Chrome's synchronized storage.
     * @param {string} key - The key under which to store the data.
     * @param {*} value - The data to store. Can be any JSON-serializable value.
     * @returns {Promise<void>} A promise that resolves when the data is set.
     * @throws {Error} If the storage operation fails (e.g., quota exceeded).
     */
    static async set(key, value) {
        try {
            // Chrome storage has limits (e.g., MAX_ITEMS, QUOTA_BYTES_PER_ITEM, QUOTA_BYTES)
            // It's good practice to check if the data might exceed limits, though for API keys/settings it's rare.
            // For larger caches, consider `chrome.storage.local` or IndexedDB.
            await chrome.storage.sync.set({ [key]: value });
            console.log(`StorageManager: Data set for key '${key}'`);
        } catch (error) {
            ErrorHandler.logError(`StorageManager: Failed to set data for key '${key}'`, error);
            if (error.message && error.message.includes('QUOTA_BYTES')) {
                throw new Error(`Storage quota exceeded for key '${key}'. Please clear some data.`);
            }
            throw new Error(`Failed to store data: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Retrieves a value from Chrome's synchronized storage.
     * @param {string} key - The key of the data to retrieve.
     * @returns {Promise<*>} A promise that resolves with the retrieved data, or undefined if not found.
     * @throws {Error} If the storage operation fails.
     */
    static async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            // console.log(`StorageManager: Data retrieved for key '${key}'`, result[key]);
            return result[key];
        } catch (error) {
            ErrorHandler.logError(`StorageManager: Failed to get data for key '${key}'`, error);
            throw new Error(`Failed to retrieve data: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Removes a value from Chrome's synchronized storage.
     * @param {string} key - The key of the data to remove.
     * @returns {Promise<void>} A promise that resolves when the data is removed.
     * @throws {Error} If the storage operation fails.
     */
    static async remove(key) {
        try {
            await chrome.storage.sync.remove(key);
            console.log(`StorageManager: Data removed for key '${key}'`);
        } catch (error) {
            ErrorHandler.logError(`StorageManager: Failed to remove data for key '${key}'`, error);
            throw new Error(`Failed to remove data: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Clears all data from Chrome's synchronized storage.
     * Use with caution.
     * @returns {Promise<void>} A promise that resolves when all data is cleared.
     * @throws {Error} If the storage operation fails.
     */
    static async clear() {
        try {
            await chrome.storage.sync.clear();
            console.log('StorageManager: All data cleared from sync storage.');
        } catch (error) {
            ErrorHandler.logError('StorageManager: Failed to clear all data from sync storage', error);
            throw new Error(`Failed to clear storage: ${error.message || 'Unknown error'}`);
        }
    }
}

export { StorageManager };