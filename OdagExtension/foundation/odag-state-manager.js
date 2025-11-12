/**
 * ODAG State Manager
 * Manages extension state without polluting global window namespace
 *
 * @version 6.0.0
 */

define([], function() {
    'use strict';

    /**
     * State Manager
     * Replaces window[dynamicKey] pattern with proper state management
     * v6: Enhanced with timers, observers, and better cleanup
     */
    const ODAGStateManager = {

        /**
         * Internal state storage
         * Map<extensionId, Map<key, value>>
         */
        _states: new Map(),

        /**
         * Timer storage for cleanup
         * Map<extensionId, Array<timerId>>
         */
        _timers: new Map(),

        /**
         * Interval storage for cleanup
         * Map<extensionId, Array<intervalId>>
         */
        _intervals: new Map(),

        /**
         * State change observers
         * Map<extensionId, Map<key, Array<callback>>>
         */
        _observers: new Map(),

        /**
         * Get state value for extension instance
         * @param {string} extensionId - Extension instance ID (layout.qInfo.qId)
         * @param {string} key - State key
         * @param {any} defaultValue - Default value if not found
         * @param {string} customStorageKey - Optional custom storage key for sessionStorage (for persistent keys)
         * @returns {any} State value
         */
        get: function(extensionId, key, defaultValue, customStorageKey) {
            if (!this._states.has(extensionId)) {
                this._states.set(extensionId, new Map());
            }

            const instanceState = this._states.get(extensionId);

            // If key exists in memory, return it
            if (instanceState.has(key)) {
                return instanceState.get(key);
            }

            // If this is a persistent key, try loading from sessionStorage
            if (this._persistentKeys.indexOf(key) > -1) {
                try {
                    // Use custom storage key if provided, otherwise use extensionId
                    const storageKey = customStorageKey || ('odagState_' + extensionId + '_' + key);
                    const storedValue = sessionStorage.getItem(storageKey);
                    if (storedValue !== null) {
                        const parsed = JSON.parse(storedValue);
                        // Store in memory for future access
                        instanceState.set(key, parsed);
                        console.log('[ODAG StateManager] Loaded ' + key + ' from sessionStorage with key:', storageKey);
                        return parsed;
                    }
                } catch (e) {
                    console.warn('[ODAG StateManager] Failed to load state from sessionStorage:', e);
                }
            }

            return defaultValue;
        },

        /**
         * Keys that should persist across browser refreshes
         */
        _persistentKeys: ['lastGeneratedPayload'],

        /**
         * Set state value for extension instance
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key
         * @param {any} value - State value
         * @param {boolean} silent - Don't notify observers if true
         * @param {string} customStorageKey - Optional custom storage key for sessionStorage (for persistent keys)
         */
        set: function(extensionId, key, value, silent, customStorageKey) {
            if (!this._states.has(extensionId)) {
                this._states.set(extensionId, new Map());
            }

            const oldValue = this._states.get(extensionId).get(key);
            this._states.get(extensionId).set(key, value);

            // Persist to sessionStorage if this is a persistent key
            if (this._persistentKeys.indexOf(key) > -1) {
                try {
                    // Use custom storage key if provided, otherwise use extensionId
                    const storageKey = customStorageKey || ('odagState_' + extensionId + '_' + key);
                    sessionStorage.setItem(storageKey, JSON.stringify(value));
                    console.log('[ODAG StateManager] Persisted ' + key + ' to sessionStorage with key:', storageKey);
                } catch (e) {
                    console.warn('[ODAG StateManager] Failed to persist state to sessionStorage:', e);
                }
            }

            // Notify observers if not silent
            if (!silent) {
                this._notifyObservers(extensionId, key, value, oldValue);
            }
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
            // Remove from sessionStorage if persistent key
            if (this._persistentKeys.indexOf(key) > -1) {
                try {
                    const storageKey = 'odagState_' + extensionId + '_' + key;
                    sessionStorage.removeItem(storageKey);
                } catch (e) {
                    console.warn('[ODAG StateManager] Failed to remove state from sessionStorage:', e);
                }
            }

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
            // Clear all timers
            this.clearTimers(extensionId);

            // Clear all intervals
            this.clearIntervals(extensionId);

            // Remove observers
            if (this._observers.has(extensionId)) {
                this._observers.delete(extensionId);
            }

            // Remove persistent keys from sessionStorage
            const self = this;
            this._persistentKeys.forEach(function(key) {
                try {
                    const storageKey = 'odagState_' + extensionId + '_' + key;
                    sessionStorage.removeItem(storageKey);
                } catch (e) {
                    console.warn('[ODAG StateManager] Failed to cleanup sessionStorage:', e);
                }
            });

            // Remove state
            if (this._states.has(extensionId)) {
                this._states.delete(extensionId);
            }
        },

        /**
         * Track a timer for cleanup
         * @param {string} extensionId - Extension instance ID
         * @param {number} timerId - Timer ID from setTimeout
         */
        trackTimer: function(extensionId, timerId) {
            if (!this._timers.has(extensionId)) {
                this._timers.set(extensionId, []);
            }
            this._timers.get(extensionId).push(timerId);
        },

        /**
         * Track an interval for cleanup
         * @param {string} extensionId - Extension instance ID
         * @param {number} intervalId - Interval ID from setInterval
         */
        trackInterval: function(extensionId, intervalId) {
            if (!this._intervals.has(extensionId)) {
                this._intervals.set(extensionId, []);
            }
            this._intervals.get(extensionId).push(intervalId);
        },

        /**
         * Clear all timers for extension instance
         * @param {string} extensionId - Extension instance ID
         */
        clearTimers: function(extensionId) {
            if (this._timers.has(extensionId)) {
                this._timers.get(extensionId).forEach(function(timerId) {
                    clearTimeout(timerId);
                });
                this._timers.delete(extensionId);
            }
        },

        /**
         * Clear all intervals for extension instance
         * @param {string} extensionId - Extension instance ID
         */
        clearIntervals: function(extensionId) {
            if (this._intervals.has(extensionId)) {
                this._intervals.get(extensionId).forEach(function(intervalId) {
                    clearInterval(intervalId);
                });
                this._intervals.delete(extensionId);
            }
        },

        /**
         * Observe state changes for a specific key
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key to observe
         * @param {Function} callback - Callback(newValue, oldValue)
         */
        observe: function(extensionId, key, callback) {
            if (!this._observers.has(extensionId)) {
                this._observers.set(extensionId, new Map());
            }

            const instanceObservers = this._observers.get(extensionId);
            if (!instanceObservers.has(key)) {
                instanceObservers.set(key, []);
            }

            instanceObservers.get(key).push(callback);
        },

        /**
         * Remove observer for a specific key
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key
         * @param {Function} callback - Callback to remove
         */
        unobserve: function(extensionId, key, callback) {
            if (!this._observers.has(extensionId)) {
                return;
            }

            const instanceObservers = this._observers.get(extensionId);
            if (!instanceObservers.has(key)) {
                return;
            }

            const callbacks = instanceObservers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        },

        /**
         * Notify observers of state change
         * @param {string} extensionId - Extension instance ID
         * @param {string} key - State key that changed
         * @param {any} newValue - New value
         * @param {any} oldValue - Old value
         * @private
         */
        _notifyObservers: function(extensionId, key, newValue, oldValue) {
            if (!this._observers.has(extensionId)) {
                return;
            }

            const instanceObservers = this._observers.get(extensionId);
            if (!instanceObservers.has(key)) {
                return;
            }

            const callbacks = instanceObservers.get(key);
            callbacks.forEach(function(callback) {
                try {
                    callback(newValue, oldValue);
                } catch (e) {
                    console.error('[ODAG StateManager] Observer error:', e);
                }
            });
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
