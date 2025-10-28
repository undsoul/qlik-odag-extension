/**
 * ODAG State Manager
 * Manages extension state without polluting global window namespace
 *
 * @version 3.4.0
 */

define([], function() {
    'use strict';

    /**
     * State Manager
     * Replaces window[dynamicKey] pattern with proper state management
     */
    const ODAGStateManager = {

        /**
         * Internal state storage
         * Map<extensionId, Map<key, value>>
         */
        _states: new Map(),

        /**
         * Get state value for extension instance
         * @param {string} extensionId - Extension instance ID (layout.qInfo.qId)
         * @param {string} key - State key
         * @param {any} defaultValue - Default value if not found
         * @returns {any} State value
         */
        get: function(extensionId, key, defaultValue) {
            if (!this._states.has(extensionId)) {
                return defaultValue;
            }

            const instanceState = this._states.get(extensionId);
            return instanceState.has(key) ? instanceState.get(key) : defaultValue;
        },

        /**
         * Set state value for extension instance
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key
         * @param {any} value - State value
         */
        set: function(extensionId, key, value) {
            if (!this._states.has(extensionId)) {
                this._states.set(extensionId, new Map());
            }

            this._states.get(extensionId).set(key, value);
        },

        /**
         * Check if state key exists
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key
         * @returns {boolean} True if key exists
         */
        has: function(extensionId, key) {
            if (!this._states.has(extensionId)) {
                return false;
            }

            return this._states.get(extensionId).has(key);
        },

        /**
         * Delete specific state key
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key
         * @returns {boolean} True if deleted
         */
        delete: function(extensionId, key) {
            if (!this._states.has(extensionId)) {
                return false;
            }

            return this._states.get(extensionId).delete(key);
        },

        /**
         * Get all state keys for extension instance
         * @param {string} extensionId - Extension instance ID
         * @returns {Array<string>} Array of keys
         */
        keys: function(extensionId) {
            if (!this._states.has(extensionId)) {
                return [];
            }

            return Array.from(this._states.get(extensionId).keys());
        },

        /**
         * Clear all state for extension instance
         * @param {string} extensionId - Extension instance ID
         */
        clear: function(extensionId) {
            if (this._states.has(extensionId)) {
                this._states.get(extensionId).clear();
            }
        },

        /**
         * Cleanup - remove all state for extension instance
         * Call this in destroy() lifecycle method
         * @param {string} extensionId - Extension instance ID
         */
        cleanup: function(extensionId) {
            if (this._states.has(extensionId)) {
                this._states.delete(extensionId);
            }
        },

        /**
         * Get all extension IDs with state
         * @returns {Array<string>} Array of extension IDs
         */
        getAllExtensions: function() {
            return Array.from(this._states.keys());
        },

        /**
         * Get memory usage statistics
         * @returns {Object} Stats object
         */
        getStats: function() {
            let totalKeys = 0;
            const instances = this._states.size;

            this._states.forEach(function(instanceState) {
                totalKeys += instanceState.size;
            });

            return {
                instances: instances,
                totalKeys: totalKeys,
                averageKeysPerInstance: instances > 0 ? totalKeys / instances : 0
            };
        }
    };

    return ODAGStateManager;
});
