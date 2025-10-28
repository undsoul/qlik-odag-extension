/**
 * ODAG Dynamic View Renderer
 * Renders dynamic embed view (auto-generate and embed generated app)
 *
 * @version 5.0.0-beta
 */

define([
    "qlik",
    "jquery",
    "../foundation/odag-api-service",
    "../foundation/odag-ui-builder",
    "../foundation/odag-error-handler",
    "../foundation/odag-state-manager",
    "./odag-toolbar-manager"
], function(qlik, $, ApiService, UIBuilder, ErrorHandler, StateManager, ToolbarManager) {
    'use strict';

    const DynamicView = {

        /**
         * Render dynamic view
         * @param {jQuery} $element - Container element
         * @param {Object} layout - Extension layout
         * @param {Object} eventManager - Event manager instance
         * @returns {Promise} Render promise
         */
        render: function($element, layout, eventManager) {
            const self = this;
            const extensionId = layout.qInfo.qId;
            const odagConfig = layout.odagConfig || {};
            const app = qlik.currApp();

            // Store references
            StateManager.set(extensionId, 'view', 'dynamic');
            StateManager.set(extensionId, 'app', app);

            // Create main container
            const $container = UIBuilder.createElement('div', {
                className: 'odag-dynamic-container',
                styles: {
                    width: '100%',
                    height: '100%',
                    position: 'relative'
                }
            });

            $element.append($container);

            // Show loading state
            const $loader = UIBuilder.createLoader('Checking for existing ODAG app...');
            $container.append($loader);

            // Check for existing generated app
            return this.checkForExistingApp(odagConfig)
                .then(function(existingApp) {
                    if (existingApp) {
                        // App exists, embed it
                        StateManager.set(extensionId, 'embeddedApp', existingApp);
                        $container.empty();
                        return self.embedApp($container, existingApp, extensionId, odagConfig, eventManager);
                    } else {
                        // No app exists, generate one
                        $container.empty();
                        const $generatingLoader = UIBuilder.createLoader('Generating ODAG app...');
                        $container.append($generatingLoader);

                        return self.generateApp(odagConfig, app)
                            .then(function(newApp) {
                                StateManager.set(extensionId, 'embeddedApp', newApp);
                                $container.empty();
                                return self.embedApp($container, newApp, extensionId, odagConfig, eventManager);
                            });
                    }
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'DynamicView.render', odagConfig.enableDebug);
                    $container.empty();

                    const $error = UIBuilder.createErrorBox(
                        'Failed to load or generate ODAG app. ' + (error.message || 'Unknown error'),
                        'Dynamic View Error'
                    );
                    $container.append($error);
                });
        },

        /**
         * Check for existing generated app matching current selections
         * @param {Object} odagConfig - ODAG configuration
         * @returns {Promise} Promise resolving to existing app or null
         */
        checkForExistingApp: function(odagConfig) {
            return ApiService.fetchRequests(odagConfig.odagLinkId, false)
                .then(function(apps) {
                    if (!apps || apps.length === 0) {
                        return null;
                    }

                    // Find first succeeded app
                    // In real implementation, would match based on current selections
                    const succeededApp = apps.find(function(app) {
                        const status = app.status || app.genAppStatus || '';
                        return status.toLowerCase() === 'succeeded' || status.toLowerCase() === 'success';
                    });

                    return succeededApp || null;
                });
        },

        /**
         * Generate new ODAG app
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} app - Qlik app instance
         * @returns {Promise} Promise resolving to generated app
         */
        generateApp: function(odagConfig, app) {
            const self = this;

            // Build payload (similar to FormView)
            const payload = this.buildPayload(app, odagConfig);

            return ApiService.createRequest(odagConfig.odagLinkId, payload)
                .then(function(response) {
                    // Poll for completion
                    return self.pollForCompletion(response.id || response.requestId, odagConfig);
                });
        },

        /**
         * Build ODAG request payload
         * @param {Object} app - Qlik app instance
         * @param {Object} odagConfig - ODAG configuration
         * @returns {Object} Request payload
         */
        buildPayload: function(app, odagConfig) {
            // Simplified payload - in real implementation would get actual selections
            return {
                selectionState: '',
                userSelections: []
            };
        },

        /**
         * Poll for app generation completion
         * @param {string} requestId - Request ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {number} maxAttempts - Maximum polling attempts
         * @returns {Promise} Promise resolving to completed app
         */
        pollForCompletion: function(requestId, odagConfig, maxAttempts) {
            maxAttempts = maxAttempts || 30; // 30 attempts = ~1 minute with 2s interval
            const self = this;
            let attempts = 0;

            return new Promise(function(resolve, reject) {
                const checkStatus = function() {
                    attempts++;

                    // In real implementation, would fetch request status
                    ApiService.fetchRequests(odagConfig.odagLinkId, false)
                        .then(function(apps) {
                            const app = apps.find(function(a) {
                                return (a.id || a.requestId) === requestId;
                            });

                            if (!app) {
                                if (attempts >= maxAttempts) {
                                    reject(new Error('App generation timed out'));
                                } else {
                                    setTimeout(checkStatus, 2000);
                                }
                                return;
                            }

                            const status = app.status || app.genAppStatus || '';
                            const statusLower = status.toLowerCase();

                            if (statusLower === 'succeeded' || statusLower === 'success') {
                                resolve(app);
                            } else if (statusLower === 'failed' || statusLower === 'error') {
                                reject(new Error('App generation failed'));
                            } else if (attempts >= maxAttempts) {
                                reject(new Error('App generation timed out'));
                            } else {
                                // Still pending, check again
                                setTimeout(checkStatus, 2000);
                            }
                        })
                        .catch(function(error) {
                            reject(error);
                        });
                };

                // Start polling
                checkStatus();
            });
        },

        /**
         * Embed generated app
         * @param {jQuery} $container - Container element
         * @param {Object} generatedApp - Generated app data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         * @returns {Promise} Embed promise
         */
        embedApp: function($container, generatedApp, extensionId, odagConfig, eventManager) {
            const self = this;
            const appId = generatedApp.genAppId || generatedApp.id || generatedApp.appId;

            if (!appId) {
                return qlik.Promise.reject(new Error('No app ID found for embedding'));
            }

            // Create toolbar
            const appName = generatedApp.genAppName || generatedApp.name || 'ODAG App';
            ToolbarManager.create($container, extensionId, {
                title: appName,
                autoHide: true,
                actions: [
                    {
                        id: 'refresh',
                        label: 'Refresh',
                        handler: function() {
                            self.refreshEmbed($container, generatedApp, extensionId, odagConfig, eventManager);
                        }
                    },
                    {
                        id: 'open',
                        label: 'Open in New Tab',
                        handler: function() {
                            self.openInNewTab(appId);
                        }
                    }
                ]
            }, eventManager);

            // Create embed container
            const $embedContainer = UIBuilder.createElement('div', {
                className: 'odag-embed-container',
                styles: {
                    position: 'absolute',
                    top: '50px',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    overflow: 'hidden'
                }
            });

            $container.append($embedContainer);

            // Determine embed mode
            const embedMode = odagConfig.embedMode || 'classic/app';

            if (embedMode === 'classic/app' || embedMode === 'analytics/app') {
                return this.embedFullApp($embedContainer, appId, embedMode, odagConfig);
            } else if (embedMode === 'classic/sheet' || embedMode === 'analytics/sheet') {
                return this.embedSheet($embedContainer, appId, odagConfig.templateSheetId, embedMode, odagConfig);
            } else {
                return qlik.Promise.reject(new Error('Unknown embed mode: ' + embedMode));
            }
        },

        /**
         * Embed full app
         * @param {jQuery} $container - Container element
         * @param {string} appId - App ID
         * @param {string} embedMode - Embed mode
         * @param {Object} odagConfig - ODAG configuration
         * @returns {Promise} Embed promise
         */
        embedFullApp: function($container, appId, embedMode, odagConfig) {
            const isCloud = window.qlikEnvironment === 'cloud';
            const baseUrl = window.location.origin;

            // Create iframe for app
            const $iframe = UIBuilder.createElement('iframe', {
                className: 'odag-embed-iframe',
                attrs: {
                    src: baseUrl + '/sense/app/' + appId,
                    frameborder: '0'
                },
                styles: {
                    width: '100%',
                    height: '100%',
                    border: 'none'
                }
            });

            $container.append($iframe);

            return qlik.Promise.resolve();
        },

        /**
         * Embed specific sheet
         * @param {jQuery} $container - Container element
         * @param {string} appId - App ID
         * @param {string} sheetId - Sheet ID
         * @param {string} embedMode - Embed mode
         * @param {Object} odagConfig - ODAG configuration
         * @returns {Promise} Embed promise
         */
        embedSheet: function($container, appId, sheetId, embedMode, odagConfig) {
            const self = this;

            if (!sheetId) {
                const $error = UIBuilder.createErrorBox(
                    'Sheet ID is required for sheet embed mode.',
                    'Configuration Error'
                );
                $container.append($error);
                return qlik.Promise.reject(new Error('Sheet ID required'));
            }

            // Use Qlik Capability APIs to embed sheet
            const config = {
                host: window.location.hostname,
                prefix: '/',
                port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
                isSecure: window.location.protocol === 'https:'
            };

            return qlik.Promise.resolve()
                .then(function() {
                    // Open remote app
                    return qlik.openApp(appId, config);
                })
                .then(function(app) {
                    // Get sheet object
                    return app.getObject($container[0], sheetId);
                })
                .catch(function(error) {
                    ErrorHandler.handle(error, 'embedSheet', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);

                    const $error = UIBuilder.createErrorBox(
                        'Failed to embed sheet. ' + (error.message || 'Unknown error'),
                        'Embed Error'
                    );
                    $container.append($error);
                });
        },

        /**
         * Refresh embed
         * @param {jQuery} $container - Container element
         * @param {Object} generatedApp - Generated app data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        refreshEmbed: function($container, generatedApp, extensionId, odagConfig, eventManager) {
            const self = this;

            // Clear container (except toolbar)
            $container.find('.odag-embed-container').remove();

            // Re-embed
            this.embedApp($container, generatedApp, extensionId, odagConfig, eventManager);
        },

        /**
         * Open app in new tab
         * @param {string} appId - App ID
         */
        openInNewTab: function(appId) {
            const baseUrl = window.location.origin;
            const appUrl = baseUrl + '/sense/app/' + appId;
            window.open(appUrl, '_blank');
        }
    };

    return DynamicView;
});
