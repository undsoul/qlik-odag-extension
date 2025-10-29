/**
 * ODAG API Service
 * Unified API layer for all ODAG operations (Cloud and On-Premise)
 *
 * @version 3.4.0
 */

define(["jquery"], function($) {
    'use strict';

    /**
     * ODAG API Service
     * Handles all API calls for both Cloud and On-Premise environments
     */
    const ODAGApiService = {

        /**
         * Configuration
         */
        config: {
            xrfKey: 'abcdefghijklmnop',
            timeout: 5000,
            retries: 2
        },

        /**
         * Determine if running in Cloud environment
         * @returns {boolean} true if Cloud, false if On-Premise
         */
        isCloud: function() {
            const currentUrl = window.location.origin;
            return currentUrl.indexOf('.qlikcloud.com') > -1 ||
                   currentUrl.indexOf('qlik.com') > -1;
        },

        /**
         * Generic AJAX call wrapper with error handling
         * @param {string} method - HTTP method (GET, POST, DELETE, etc.)
         * @param {string} url - Full URL
         * @param {Object} data - Request payload
         * @param {Object} options - Additional options
         * @returns {Promise} Promise resolving to response data
         */
        _call: function(method, url, data, options) {
            options = options || {};
            const isCloud = this.isCloud();

            // Build base headers
            const baseHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Only add XRF key header for On-Premise
            if (!isCloud) {
                baseHeaders['X-Qlik-XrfKey'] = this.config.xrfKey;
            }

            // Merge with any custom headers from options
            const headers = Object.assign(baseHeaders, options.headers || {});

            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    type: method,
                    data: data ? JSON.stringify(data) : undefined,
                    contentType: 'application/json',
                    headers: headers,
                    xhrFields: { withCredentials: true },
                    timeout: options.timeout || this.config.timeout
                })
                .done(function(response) {
                    resolve(response);
                })
                .fail(function(jqXHR, textStatus, errorThrown) {
                    const error = {
                        status: jqXHR.status,
                        statusText: textStatus,
                        message: errorThrown || textStatus,
                        response: jqXHR.responseJSON || jqXHR.responseText,
                        url: url,
                        method: method
                    };
                    reject(error);
                });
            });
        },

        /**
         * Build URL for ODAG operations
         * @param {string} endpoint - API endpoint path
         * @param {string} params - Query parameters
         * @returns {string} Full URL
         */
        _buildUrl: function(endpoint, params) {
            const baseUrl = window.location.origin;
            const isCloud = this.isCloud();

            // Only add XRF key for On-Premise, NOT for Cloud
            if (isCloud) {
                // Cloud: No XRF key needed
                if (params) {
                    const separator = endpoint.indexOf('?') > -1 ? '&' : '?';
                    return baseUrl + endpoint + separator + params;
                }
                return baseUrl + endpoint;
            } else {
                // On-Premise: Add XRF key
                const xrfParam = 'xrfkey=' + this.config.xrfKey;
                const separator = endpoint.indexOf('?') > -1 ? '&' : '?';
                return baseUrl + endpoint + separator + xrfParam + (params ? '&' + params : '');
            }
        },

        /**
         * Fetch ODAG link details
         * @param {string} odagLinkId - ODAG link identifier
         * @returns {Promise} Link details including bindings
         */
        fetchLinkDetails: function(odagLinkId) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odaglinks/' + odagLinkId
                : '/api/odag/v1/links/' + odagLinkId;

            return this._call('GET', this._buildUrl(endpoint));
        },

        /**
         * Fetch all ODAG links for current app (On-Premise only)
         * @returns {Promise} Array of ODAG links
         */
        fetchAllLinks: function() {
            const endpoint = '/api/odag/v1/links';
            return this._call('GET', this._buildUrl(endpoint, 'pending=true'));
        },

        /**
         * Fetch ODAG bindings (field mappings) for a link
         * @param {string} odagLinkId - ODAG link identifier
         * @param {string} appId - Current app ID (optional, will try to get from qlik.currApp())
         * @returns {Promise} Array of bindings
         */
        fetchBindings: function(odagLinkId, appId) {
            const self = this;
            const isCloud = this.isCloud();

            // Get app ID if not provided
            if (!appId) {
                try {
                    const app = require('qlik').currApp();
                    appId = app.id;
                } catch (e) {
                    console.warn('Could not get app ID for bindings fetch');
                }
            }

            if (isCloud) {
                // Cloud: POST to /api/v1/odaglinks/selAppLinkUsages with linkList
                const endpoint = '/api/v1/odaglinks/selAppLinkUsages?selAppId=' + (appId || '');
                const payload = { linkList: [odagLinkId] };

                return this._call('POST', this._buildUrl(endpoint), payload)
                    .then(function(response) {
                        // Cloud response: [{link: {bindings: [...], rowEstExpr, curRowEstHighBound}}]
                        if (response && response.length > 0 && response[0].link && response[0].link.bindings) {
                            return response[0].link.bindings;
                        }
                        return [];
                    })
                    .catch(function(error) {
                        console.error('Failed to fetch ODAG bindings (Cloud):', error);
                        return [];
                    });
            } else {
                // On-Premise: GET to /api/odag/v1/links/{id}
                const endpoint = '/api/odag/v1/links/' + odagLinkId;

                return this._call('GET', this._buildUrl(endpoint))
                    .then(function(response) {
                        // On-Premise response has bindings at root level
                        return response.bindings || [];
                    })
                    .catch(function(error) {
                        console.error('Failed to fetch ODAG bindings (On-Premise):', error);
                        return [];
                    });
            }
        },

        /**
         * Fetch ODAG requests/apps for a link
         * @param {string} odagLinkId - ODAG link identifier
         * @param {boolean} pendingOnly - Only fetch pending requests
         * @returns {Promise} Array of requests
         */
        fetchRequests: function(odagLinkId, pendingOnly) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odaglinks/' + odagLinkId + '/requests'
                : '/api/odag/v1/links/' + odagLinkId + '/requests';

            const params = pendingOnly ? 'pending=true' : '';
            return this._call('GET', this._buildUrl(endpoint, params));
        },

        /**
         * Create new ODAG request (generate app)
         * @param {string} odagLinkId - ODAG link identifier
         * @param {Object} payload - Request payload with selections
         * @returns {Promise} Created request details
         */
        createRequest: function(odagLinkId, payload) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odaglinks/' + odagLinkId + '/requests'
                : '/api/odag/v1/links/' + odagLinkId + '/requests';

            return this._call('POST', this._buildUrl(endpoint), payload);
        },

        /**
         * Cancel pending ODAG request
         * @param {string} requestId - Request identifier
         * @returns {Promise} Cancellation result
         */
        cancelRequest: function(requestId) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odagrequests/' + requestId
                : '/api/odag/v1/requests/' + requestId;

            return this._call('DELETE', this._buildUrl(endpoint));
        },

        /**
         * Delete generated ODAG app
         * @param {string} requestId - Request identifier
         * @returns {Promise} Deletion result
         */
        deleteApp: function(requestId) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odagrequests/' + requestId + '/app'
                : '/api/odag/v1/requests/' + requestId + '/app';

            return this._call('DELETE', this._buildUrl(endpoint));
        },

        /**
         * Reload ODAG app data
         * @param {string} requestId - Request identifier
         * @returns {Promise} Reload result
         */
        reloadApp: function(requestId) {
            const isCloud = this.isCloud();
            const endpoint = isCloud
                ? '/api/v1/odagrequests/' + requestId + '/reloadApp'
                : '/api/odag/v1/requests/' + requestId + '/reload';

            return this._call('POST', this._buildUrl(endpoint));
        },

        /**
         * Fetch Qlik Cloud tenant information
         * @returns {Promise} Tenant info
         */
        fetchTenantInfo: function() {
            return this._call('GET', this._buildUrl('/api/v1/users/me'));
        },

        /**
         * Fetch On-Premise system information
         * @returns {Promise} System info
         */
        fetchSystemInfo: function() {
            return this._call('GET', this._buildUrl('/qrs/about'));
        }
    };

    return ODAGApiService;
});
