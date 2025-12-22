/**
 * DOMPurify Loader
 * Loads DOMPurify from CDN for XSS protection
 *
 * @version 8.0.0
 * @description Loads DOMPurify library dynamically and makes it globally available
 */

define([], function() {
    'use strict';

    /**
     * DOMPurify Loader
     * Loads DOMPurify from CDN and caches it globally
     */
    const DOMPurifyLoader = {

        /**
         * CDN URL for DOMPurify
         */
        CDN_URL: 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',

        /**
         * Loading state
         */
        _loading: false,
        _loaded: false,
        _loadPromise: null,

        /**
         * Load DOMPurify from CDN
         *
         * @returns {Promise<Object>} DOMPurify instance
         */
        load: function() {
            // Return cached promise if already loading
            if (this._loadPromise) {
                return this._loadPromise;
            }

            // Return DOMPurify immediately if already loaded
            if (this._loaded && window.DOMPurify) {
                return Promise.resolve(window.DOMPurify);
            }

            // Start loading
            this._loading = true;

            this._loadPromise = new Promise((resolve, reject) => {
                // Create script element
                const script = document.createElement('script');
                script.src = this.CDN_URL;
                script.async = true;

                // Handle load success
                script.onload = () => {
                    this._loaded = true;
                    this._loading = false;

                    if (window.DOMPurify) {
                        console.log('[DOMPurify] Loaded successfully from CDN');
                        resolve(window.DOMPurify);
                    } else {
                        const error = new Error('DOMPurify loaded but not found in window');
                        console.error('[DOMPurify] Load error:', error);
                        reject(error);
                    }
                };

                // Handle load error
                script.onerror = () => {
                    this._loading = false;
                    const error = new Error('Failed to load DOMPurify from CDN');
                    console.error('[DOMPurify] Load error:', error);
                    reject(error);
                };

                // Append to document
                document.head.appendChild(script);

            }).catch((error) => {
                // Reset on error so it can be retried
                this._loadPromise = null;
                throw error;
            });

            return this._loadPromise;
        },

        /**
         * Check if DOMPurify is loaded
         *
         * @returns {boolean} True if loaded
         */
        isLoaded: function() {
            return this._loaded && window.DOMPurify !== undefined;
        },

        /**
         * Get DOMPurify instance (sync)
         *
         * @returns {Object|null} DOMPurify instance or null
         */
        get: function() {
            return window.DOMPurify || null;
        },

        /**
         * Sanitize HTML using DOMPurify
         * Falls back to returning empty string if not loaded
         *
         * @param {string} html - HTML to sanitize
         * @param {Object} config - DOMPurify config (optional)
         * @returns {string} Sanitized HTML
         */
        sanitize: function(html, config) {
            if (this.isLoaded()) {
                return window.DOMPurify.sanitize(html, config);
            }

            console.warn('[DOMPurify] Not loaded - cannot sanitize HTML safely. Returning empty string.');
            return '';
        }
    };

    return DOMPurifyLoader;
});
