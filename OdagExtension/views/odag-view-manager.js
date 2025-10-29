/**
 * ODAG View Manager
 * Manages app list views, status monitoring, and UI updates
 *
 * @version 5.0.0
 */

define(['jquery', '../foundation/odag-constants'], function($, CONSTANTS) {
    'use strict';

    /**
     * ODAG View Manager Module
     * Handles all view-related functionality for app lists and status monitoring
     */
    const ODAGViewManager = {

        /**
         * Create loadExistingRequests function with context
         * @param {Object} context - Context object with odagConfig, debugLog, $element, layout, updateAppsList
         * @returns {Function} loadExistingRequests function
         */
        createLoadExistingRequests: function(context) {
            const { odagConfig, debugLog, $element, layout, updateAppsList } = context;

            return async function() {
                if (!odagConfig.odagLinkId) {
                    debugLog('No ODAG Link ID configured');
                    return;
                }

                // Validate ODAG Link ID format
                const odagLinkId = String(odagConfig.odagLinkId).trim();
                const isCloud = window.qlikEnvironment === 'cloud';

                // Cloud IDs are 24-char hex (MongoDB ObjectId), On-Premise are 36-char GUIDs
                const isValidCloudId = /^[a-f0-9]{24}$/i.test(odagLinkId);
                const isValidOnPremiseId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(odagLinkId);

                debugLog('ODAG Link ID validation:', {
                    id: odagLinkId,
                    length: odagLinkId.length,
                    environment: window.qlikEnvironment,
                    isValidCloudId: isValidCloudId,
                    isValidOnPremiseId: isValidOnPremiseId
                });

                if (isCloud && !isValidCloudId && odagLinkId.length !== 24) {
                    debugLog('WARNING: Cloud ODAG Link ID format incorrect:', odagLinkId);
                    $element.html('<div style="padding: 20px; color: red;">❌ Invalid Cloud ODAG Link ID<br>Expected: 24-character hex (e.g., 602c0332db186b0001f7dc38)<br>Current: ' + odagLinkId + ' (length: ' + odagLinkId.length + ')<br><br>Please check the ODAG Link ID in properties.</div>');
                    return;
                }

                if (!isCloud && !isValidOnPremiseId) {
                    debugLog('WARNING: On-Premise ODAG Link ID format incorrect:', odagLinkId);
                    $element.html('<div style="padding: 20px; color: red;">❌ Invalid On-Premise ODAG Link ID<br>Expected: GUID format (e.g., 52792d6c-72d7-462b-bed3-c4bda0481726)<br>Current: ' + odagLinkId + ' (length: ' + odagLinkId.length + ')<br><br>Please check the ODAG Link ID in properties.</div>');
                    return;
                }

                // Use the dynamic tenant URL
                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const xrfkey = CONSTANTS.API.XRF_KEY;

                const apiUrl = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagLinkId + '/requests?pending=true'
                    : tenantUrl + '/api/odag/v1/links/' + odagLinkId + '/requests?pending=true&xrfkey=' + xrfkey;

                debugLog('Loading existing ODAG requests from:', apiUrl);
                debugLog('  - Tenant URL:', tenantUrl);
                debugLog('  - Environment:', window.qlikEnvironment);
                debugLog('  - ODAG Link ID:', odagLinkId);
                debugLog('  - ODAG Link ID length:', odagLinkId.length);

                const headers = isCloud
                    ? {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                      }
                    : {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Qlik-XrfKey': xrfkey
                      };

                $.ajax({
                    url: apiUrl,
                    type: 'GET',
                    headers: headers,
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(result) {
                        if (result && Array.isArray(result)) {
                            // Store previous statuses before clearing
                            const previousStatuses = {};
                            if (window.odagGeneratedApps) {
                                window.odagGeneratedApps.forEach(function(app) {
                                    previousStatuses[app.requestId] = app.status;
                                });
                            }

                            // Clear existing list
                            window.odagGeneratedApps = [];

                            let newlySucceededApp = null;

                            // Add loaded requests to list (sorted by date)
                            result.sort(function(a, b) {
                                return new Date(b.createdDate) - new Date(a.createdDate);
                            }).forEach(function(request) {
                                // The generated app ID is in the generatedApp field
                                // It could be an object with an id property or a direct string
                                let generatedAppId = '';

                                // Extract app name (Cloud uses generatedAppName, On-Premise uses name or generatedApp.name)
                                let appName = request.generatedAppName || request.name || 'Generated App';

                                if (request.generatedApp) {
                                    if (typeof request.generatedApp === 'object' && request.generatedApp.id) {
                                        // It's an object with an id property
                                        generatedAppId = request.generatedApp.id;
                                        // On-Premise may store name in generatedApp.name
                                        if (request.generatedApp.name) {
                                            appName = request.generatedApp.name;
                                        }
                                        debugLog('Extracted app ID from object:', generatedAppId);
                                    } else if (typeof request.generatedApp === 'string') {
                                        // It's a direct string
                                        generatedAppId = request.generatedApp;
                                        debugLog('App ID was string:', generatedAppId);
                                    } else {
                                        // Log the full object to understand the structure
                                        debugLog('Unknown generatedApp structure:', request.generatedApp);
                                        // Try to find ID in other possible locations
                                        if (request.generatedApp.appId) {
                                            generatedAppId = request.generatedApp.appId;
                                        } else if (request.generatedApp.resourceId) {
                                            generatedAppId = request.generatedApp.resourceId;
                                        }
                                    }
                                }

                                debugLog('ODAG Request loaded:', {
                                    id: request.id,
                                    generatedApp: request.generatedApp,
                                    generatedAppId: generatedAppId,
                                    templateApp: request.templateApp,
                                    state: request.state,
                                    name: appName
                                });

                                // Debug: Log full request object to understand Cloud response structure
                                if (odagConfig.enableDebug) {
                                    debugLog('📋 Full request object from API:', JSON.stringify(request, null, 2));
                                }

                                // Normalize API status (API returns "canceled" but we use "cancelled" internally)
                                const rawStatus = request.state || 'pending';
                                const currentStatus = rawStatus === 'canceled' ? 'cancelled' : rawStatus;
                                const previousStatus = previousStatuses[request.id];

                                // Detect if app just succeeded
                                if (currentStatus === 'succeeded' && previousStatus && previousStatus !== 'succeeded') {
                                    newlySucceededApp = {
                                        requestId: request.id,
                                        appId: generatedAppId,
                                        name: appName
                                    };
                                    debugLog('App just succeeded:', newlySucceededApp);
                                }

                                window.odagGeneratedApps.push({
                                    requestId: request.id,
                                    appId: generatedAppId,  // This is the actual generated app ID (extracted from object)
                                    templateAppId: request.templateApp || '', // Template app ID
                                    name: appName,
                                    created: request.createdDate,
                                    status: currentStatus,
                                    owner: request.owner?.name || 'Unknown'
                                });
                            });

                            updateAppsList(layout.qInfo.qId);

                            // Auto-click the newly succeeded app to show it
                            if (newlySucceededApp && newlySucceededApp.appId) {
                                debugLog('Auto-clicking newly succeeded app:', newlySucceededApp.name);
                                setTimeout(function() {
                                    // Find and click the app item
                                    const $appItem = $('.odag-app-item[data-app-id="' + newlySucceededApp.appId + '"]');
                                    if ($appItem.length > 0) {
                                        $appItem.trigger('click');
                                        debugLog('Auto-clicked app successfully');
                                    } else {
                                        debugLog('Could not find app item to auto-click');
                                    }
                                }, CONSTANTS.TIMING.VALIDATION_DEBOUNCE_MS);
                            }
                        }
                    },
                    error: function(xhr) {
                        console.error('Failed to load existing ODAG requests:', xhr.responseText);
                    }
                });
            };
        },

        /**
         * Create startStatusMonitoring function with context
         * @param {Object} context - Context object with odagConfig, debugLog, isDynamicView, CleanupManager, loadExistingRequests
         * @returns {Function} startStatusMonitoring function
         */
        createStartStatusMonitoring: function(context) {
            const { odagConfig, debugLog, isDynamicView, CleanupManager, loadExistingRequests } = context;

            return function() {
                // Clear any existing interval first
                if (window.odagRefreshInterval) {
                    clearInterval(window.odagRefreshInterval);
                    window.odagRefreshInterval = null;
                }

                // Set up periodic refresh ONLY when there are pending apps
                window.odagRefreshInterval = CleanupManager.addInterval(setInterval(function() {
                    if (odagConfig.odagLinkId && !isDynamicView) {
                        // Check if there are any non-final status apps
                        // Final statuses: succeeded, failed, cancelled
                        const hasPending = window.odagGeneratedApps &&
                            window.odagGeneratedApps.some(app => {
                                const finalStatuses = ['succeeded', 'failed', 'cancelled'];
                                const isPending = !app.status || !finalStatuses.includes(app.status);
                                return isPending;
                            });

                        if (hasPending) {
                            debugLog('Checking status of pending apps...');
                            loadExistingRequests();
                        } else {
                            // All apps are in final state - stop checking
                            debugLog('All apps are in final state. Stopping status monitoring.');
                            clearInterval(window.odagRefreshInterval);
                            window.odagRefreshInterval = null;
                        }
                    }
                }, 3000)); // Check every 3 seconds
            };
        }
    };

    return ODAGViewManager;
});
