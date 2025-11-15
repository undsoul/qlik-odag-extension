/**
 * HTTP Helper Utility (Fetch API)
 * Replaces jQuery.ajax with modern Fetch API
 *
 * @version 8.0.0
 * @description Modern HTTP client using native Fetch API
 */

define([], function() {
    'use strict';

    /**
     * HTTP Helper - Fetch API wrapper
     * Replaces $.ajax() with modern, promise-based HTTP client
     */
    const HTTPHelper = {

        /**
         * Default request options
         */
        defaults: {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        },

        /**
         * Make HTTP request
         * Replaces: $.ajax()
         *
         * @param {Object} options - Request options
         * @param {string} options.url - Request URL
         * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
         * @param {Object} options.headers - Request headers
         * @param {Object|string} options.data - Request body
         * @param {number} options.timeout - Request timeout in ms
         * @returns {Promise<Object>} Response data
         */
        request: async function(options) {
            const {
                url,
                method = 'GET',
                headers = {},
                data = null,
                timeout = 30000
            } = options;

            // Merge headers with defaults
            const finalHeaders = {
                ...this.defaults.headers,
                ...headers
            };

            // Build fetch options
            const fetchOptions = {
                method: method.toUpperCase(),
                headers: finalHeaders,
                credentials: this.defaults.credentials
            };

            // Add body for POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
                fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
            }

            try {
                // Create abort controller for timeout
                const controller = new AbortController();
                fetchOptions.signal = controller.signal;

                // Set timeout
                const timeoutId = setTimeout(function() {
                    controller.abort();
                }, timeout);

                // Make request
                const response = await fetch(url, fetchOptions);

                // Clear timeout
                clearTimeout(timeoutId);

                // Check if response is ok
                if (!response.ok) {
                    const error = new Error('HTTP Error: ' + response.status);
                    error.status = response.status;
                    error.statusText = response.statusText;
                    error.response = response;
                    throw error;
                }

                // Parse response based on content type
                const contentType = response.headers.get('content-type');
                let responseData;

                if (contentType && contentType.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                return responseData;

            } catch (error) {
                // Handle timeout
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout after ' + timeout + 'ms');
                }

                // Re-throw other errors
                throw error;
            }
        },

        /**
         * Make GET request
         * Replaces: $.ajax({ method: 'GET' })
         *
         * @param {string} url - Request URL
         * @param {Object} options - Additional options
         * @returns {Promise<Object>} Response data
         */
        get: async function(url, options) {
            return this.request({
                url: url,
                method: 'GET',
                ...options
            });
        },

        /**
         * Make POST request
         * Replaces: $.ajax({ method: 'POST' })
         *
         * @param {string} url - Request URL
         * @param {Object} data - Request body
         * @param {Object} options - Additional options
         * @returns {Promise<Object>} Response data
         */
        post: async function(url, data, options) {
            return this.request({
                url: url,
                method: 'POST',
                data: data,
                ...options
            });
        },

        /**
         * Make PUT request
         * Replaces: $.ajax({ method: 'PUT' })
         *
         * @param {string} url - Request URL
         * @param {Object} data - Request body
         * @param {Object} options - Additional options
         * @returns {Promise<Object>} Response data
         */
        put: async function(url, data, options) {
            return this.request({
                url: url,
                method: 'PUT',
                data: data,
                ...options
            });
        },

        /**
         * Make DELETE request
         * Replaces: $.ajax({ method: 'DELETE' })
         *
         * @param {string} url - Request URL
         * @param {Object} options - Additional options
         * @returns {Promise<Object>} Response data
         */
        delete: async function(url, options) {
            return this.request({
                url: url,
                method: 'DELETE',
                ...options
            });
        },

        /**
         * Build URL with query parameters
         *
         * @param {string} baseUrl - Base URL
         * @param {Object} params - Query parameters
         * @returns {string} URL with query string
         */
        buildUrl: function(baseUrl, params) {
            if (!params || Object.keys(params).length === 0) {
                return baseUrl;
            }

            const queryString = Object.keys(params)
                .map(function(key) {
                    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                })
                .join('&');

            return baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryString;
        },

        /**
         * Check if response is successful
         *
         * @param {Response} response - Fetch response object
         * @returns {boolean} True if successful
         */
        isSuccess: function(response) {
            return response && response.ok;
        },

        /**
         * Parse error response
         *
         * @param {Error} error - Error object
         * @returns {Object} Parsed error information
         */
        parseError: async function(error) {
            const errorInfo = {
                message: error.message,
                status: error.status,
                statusText: error.statusText
            };

            // Try to parse error response body
            if (error.response) {
                try {
                    const contentType = error.response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        errorInfo.data = await error.response.json();
                    } else {
                        errorInfo.data = await error.response.text();
                    }
                } catch (parseError) {
                    console.warn('[HTTPHelper] Could not parse error response:', parseError);
                }
            }

            return errorInfo;
        },

        /**
         * Retry request with exponential backoff
         *
         * @param {Function} requestFn - Request function to retry
         * @param {number} maxRetries - Maximum number of retries
         * @param {number} delay - Initial delay in ms
         * @returns {Promise<Object>} Response data
         */
        retry: async function(requestFn, maxRetries, delay) {
            maxRetries = maxRetries || 3;
            delay = delay || 1000;

            for (let i = 0; i <= maxRetries; i++) {
                try {
                    return await requestFn();
                } catch (error) {
                    // Don't retry on last attempt
                    if (i === maxRetries) {
                        throw error;
                    }

                    // Don't retry on client errors (4xx)
                    if (error.status && error.status >= 400 && error.status < 500) {
                        throw error;
                    }

                    // Wait before retry (exponential backoff)
                    const waitTime = delay * Math.pow(2, i);
                    console.warn('[HTTPHelper] Request failed, retrying in ' + waitTime + 'ms... (attempt ' + (i + 1) + '/' + maxRetries + ')');
                    await new Promise(function(resolve) {
                        setTimeout(resolve, waitTime);
                    });
                }
            }
        },

        /**
         * Make multiple parallel requests
         *
         * @param {Array<Object>} requests - Array of request options
         * @returns {Promise<Array>} Array of responses
         */
        all: async function(requests) {
            const promises = requests.map(function(req) {
                return this.request(req);
            }.bind(this));

            return Promise.all(promises);
        },

        /**
         * Cancel ongoing request (requires AbortController)
         *
         * @param {AbortController} controller - Abort controller
         */
        cancel: function(controller) {
            if (controller && controller.abort) {
                controller.abort();
            }
        }
    };

    return HTTPHelper;
});
