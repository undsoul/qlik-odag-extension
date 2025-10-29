/**
 * ODAG API Extension - V5 Modular Architecture
 * Main entry point - delegates to RenderCoordinator and specialized renderers
 *
 * @version 5.0.0-beta
 * @author Önder Altınbilek
 * @description On-Demand App Generation extension for Qlik Sense
 */

define([
    "qlik",
    "jquery",
    "./properties/odag-api-properties",
    "./foundation/odag-api-service",
    "./foundation/odag-state-manager",
    "./foundation/odag-constants",
    "./foundation/odag-validators",
    "./foundation/odag-error-handler",
    "./foundation/odag-event-manager",
    "./foundation/odag-payload-builder",
    "./rendering/odag-render-coordinator",
    "./rendering/odag-app-list-view",
    "./rendering/odag-form-view",
    "./rendering/odag-dynamic-view",
    "css!./styles/odag-api-extension.css"
],
function(
    qlik,
    $,
    properties,
    ApiService,
    StateManager,
    CONSTANTS,
    Validators,
    ErrorHandler,
    EventManager,
    PayloadBuilder,
    RenderCoordinator,
    AppListView,
    FormView,
    DynamicView
) {
    'use strict';

    // ========== ENVIRONMENT DETECTION (RUNS IMMEDIATELY ON MODULE LOAD) ==========
    if (!window.qlikEnvironment) {
        const hostname = window.location.hostname;
        const isQlikCloud = hostname.includes('qlikcloud.com') || hostname.includes('qlik-stage.com');
        window.qlikEnvironment = isQlikCloud ? 'cloud' : 'onpremise';

        console.log('🌍 ODAG Extension V5 - Environment:', window.qlikEnvironment.toUpperCase(), '| Host:', hostname);

        // Async verification via API
        ApiService.fetchSystemInfo()
            .then(function(response) {
                if (response && response.buildVersion) {
                    window.qlikEnvironment = 'onpremise';
                    console.log('✅ Environment verified: ONPREMISE via /qrs/about | Build:', response.buildVersion);
                }
            })
            .catch(function() {
                window.qlikEnvironment = 'cloud';
                console.log('✅ Environment verified: CLOUD (no /qrs/about endpoint)');
            });
    }

    // Store tenant URL globally for API calls
    if (!window.qlikTenantUrl) {
        window.qlikTenantUrl = window.location.origin;
    }

    // Initialize global state objects
    if (!window.odagGeneratedApps) {
        window.odagGeneratedApps = [];
    }

    if (!window.odagDeletingRequests) {
        window.odagDeletingRequests = new Set();
    }

    return {
        definition: properties,

        initialProperties: {
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: 10,
                    qHeight: 50
                }]
            },
            odagConfig: {
                odagLinkId: "",
                variableMappings: [],
                buttonText: "Generate ODAG App",
                buttonColor: "#009845",
                buttonTextColor: "#ffffff",
                includeCurrentSelections: true,
                viewMode: "odagApp",
                templateSheetId: "",
                embedMode: "classic/app",
                allowInteractions: true,
                showAppsList: true,
                enableDebug: true
            }
        },

        /**
         * Paint function - delegates to RenderCoordinator
         * @param {jQuery} $element - Extension container element
         * @param {Object} layout - Extension layout object
         * @returns {Promise} Render promise
         */
        paint: function($element, layout) {
            const extensionId = layout.qInfo.qId;
            const odagConfig = layout.odagConfig || {};
            const app = qlik.currApp();

            // Debug logger
            const debugLog = function() {
                if (odagConfig.enableDebug) {
                    console.log.apply(console, ['[ODAG V5]'].concat(Array.prototype.slice.call(arguments)));
                }
            };

            debugLog('🎨 paint() called', {
                extensionId: extensionId,
                viewMode: odagConfig.viewMode,
                odagLinkId: odagConfig.odagLinkId
            });

            try {
                // Create or retrieve event manager for this instance
                let eventManager = StateManager.get(extensionId, 'eventManager');

                if (!eventManager) {
                    eventManager = EventManager.create(extensionId);
                    StateManager.set(extensionId, 'eventManager', eventManager);
                    debugLog('✅ Created new EventManager for:', extensionId);
                }

                // Fetch ODAG bindings and cache them globally
                if (odagConfig.odagLinkId) {
                    const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;

                    // Only fetch if not already cached
                    if (!window[bindingsCacheKey]) {
                        debugLog('📡 Fetching ODAG bindings for:', odagConfig.odagLinkId);

                        ApiService.fetchBindings(odagConfig.odagLinkId)
                            .then(function(bindings) {
                                window[bindingsCacheKey] = bindings;
                                debugLog('✅ Cached ODAG bindings:', bindings.length, 'fields');
                            })
                            .catch(function(error) {
                                console.error('❌ Failed to fetch ODAG bindings:', error);
                            });
                    } else {
                        debugLog('✅ Using cached ODAG bindings:', window[bindingsCacheKey].length, 'fields');
                    }
                }

                // Create renderers map
                const renderers = {
                    appListView: AppListView,
                    formView: FormView,
                    dynamicView: DynamicView
                };

                // Delegate to RenderCoordinator
                return RenderCoordinator.paint($element, layout, renderers, eventManager);

            } catch (error) {
                console.error('❌ ODAG Extension paint() error:', error);
                ErrorHandler.handle(error, 'paint', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);

                $element.empty().append(
                    $('<div>').css({
                        padding: '20px',
                        color: '#d32f2f',
                        background: '#ffebee',
                        border: '1px solid #ef5350',
                        borderRadius: '4px'
                    }).html(
                        '<strong>Error:</strong> ' + (error.message || 'Unknown error occurred')
                    )
                );

                return qlik.Promise.resolve();
            }
        },

        /**
         * Destroy lifecycle method
         * Cleans up event listeners, timers, and state
         * @param {jQuery} $element - Extension container element
         * @param {Object} layout - Extension layout object
         */
        destroy: function($element, layout) {
            const extensionId = layout.qInfo.qId;
            const odagConfig = layout.odagConfig || {};

            const debugLog = function() {
                if (odagConfig.enableDebug) {
                    console.log.apply(console, ['[ODAG V5 Destroy]'].concat(Array.prototype.slice.call(arguments)));
                }
            };

            debugLog('🧹 destroy() called for:', extensionId);

            try {
                // Get event manager
                const eventManager = StateManager.get(extensionId, 'eventManager');

                if (eventManager && eventManager.cleanup) {
                    debugLog('Cleaning up event listeners...');
                    eventManager.cleanup();
                }

                // Clean up state manager data for this instance
                if (StateManager.clear) {
                    debugLog('Clearing state manager data...');
                    StateManager.clear(extensionId);
                }

                // Clean up any polling timers
                const pollingTimerId = window['odagPollingTimer_' + extensionId];
                if (pollingTimerId) {
                    clearInterval(pollingTimerId);
                    delete window['odagPollingTimer_' + extensionId];
                    debugLog('Cleared polling timer');
                }

                debugLog('✅ Cleanup complete');

            } catch (error) {
                console.error('Error during destroy:', error);
            }
        },

        /**
         * Resize handler (optional)
         * @param {jQuery} $element - Extension container element
         * @param {Object} layout - Extension layout object
         */
        resize: function($element, layout) {
            // V5 renderers handle their own responsive behavior
            // No additional resize logic needed at this level
        }
    };
});
