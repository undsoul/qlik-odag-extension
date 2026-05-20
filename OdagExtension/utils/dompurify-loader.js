/**
 * DOMPurify Loader
 * Loads DOMPurify from the bundled local copy (air-gapped friendly).
 *
 * @version 9.2.14
 * @description Loads DOMPurify via RequireJS from utils/dompurify.min.js
 *              and exposes it on window.DOMPurify. No CDN dependency.
 */

define([], function() {
    'use strict';

    const DOMPurifyLoader = {

        _loadPromise: null,

        load: function() {
            if (this._loadPromise) {
                return this._loadPromise;
            }

            if (window.DOMPurify) {
                this._loadPromise = Promise.resolve(window.DOMPurify);
                return this._loadPromise;
            }

            this._loadPromise = new Promise((resolve, reject) => {
                require(['./dompurify.min'], function(DOMPurify) {
                    const instance = window.DOMPurify || DOMPurify;
                    if (!instance) {
                        const err = new Error('DOMPurify loaded but no instance found');
                        console.error('[DOMPurify]', err.message);
                        reject(err);
                        return;
                    }
                    if (!window.DOMPurify) {
                        window.DOMPurify = instance;
                    }
                    console.log('[DOMPurify] Loaded from bundled copy');
                    resolve(instance);
                }, function(err) {
                    console.error('[DOMPurify] Failed to load bundled copy:', err);
                    reject(err);
                });
            }).catch((error) => {
                this._loadPromise = null;
                throw error;
            });

            return this._loadPromise;
        },

        isLoaded: function() {
            return window.DOMPurify !== undefined;
        },

        get: function() {
            return window.DOMPurify || null;
        },

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
