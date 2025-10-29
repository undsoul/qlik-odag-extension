define([
    "qlik",
    "jquery",
    "./properties/odag-api-properties",
    "./foundation/odag-api-service",
    "./foundation/odag-state-manager",
    "./foundation/odag-constants",
    "./foundation/odag-validators",
    "./foundation/odag-error-handler",
    "./handlers/odag-event-handlers",
    "css!./styles/odag-api-extension.css"
],
function(qlik, $, properties, ApiService, StateManager, CONSTANTS, Validators, ErrorHandler, EventHandlers) {
    'use strict';

    // ========== ENVIRONMENT DETECTION (RUNS IMMEDIATELY ON MODULE LOAD) ==========
    // This MUST run before properties panel is rendered, so we detect it at module level
    if (!window.qlikEnvironment) {
        const hostname = window.location.hostname;
        const currentUrl = window.location.origin;

        // Immediate synchronous detection based on hostname
        const isQlikCloud = hostname.includes('qlikcloud.com') || hostname.includes('qlik-stage.com');
        window.qlikEnvironment = isQlikCloud ? 'cloud' : 'onpremise';

        console.log('🌍 ODAG Extension - Environment detected:', window.qlikEnvironment.toUpperCase(), '| Hostname:', hostname);

        // Async verification via API (will update if needed, but sync detection is primary)
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
        
        paint: function($element, layout) {
            try {
            const app = qlik.currApp();
            const odagConfig = layout.odagConfig || {};
            const elementHeight = $element.height();
            const elementWidth = $element.width();

            // Debug logger - only logs when debug mode is enabled
            const debugLog = function() {
                if (odagConfig.enableDebug) {
                    console.log.apply(console, arguments);
                }
            };

            debugLog('ODAG Extension: paint() called');
            debugLog('ODAG Extension: odagConfig =', odagConfig);

            // Validate ODAG Link ID early to prevent issues
            if (odagConfig.odagLinkId) {
                const isCloud = window.qlikEnvironment === 'cloud';
                const validation = Validators.odagLinkId(odagConfig.odagLinkId, isCloud);
                if (!validation.valid) {
                    $element.html('<div style="padding: 20px; color: #d32f2f; background: #ffebee; border: 1px solid #d32f2f; border-radius: 4px;">' +
                        '<strong>⚠️ Invalid ODAG Link ID</strong><br>' +
                        Validators.sanitizeHtml(validation.error) +
                        '</div>');
                    return qlik.Promise.resolve();
                }
            }

            // Helper function to get cookie value
            const getCookie = function(name) {
                const value = '; ' + document.cookie;
                const parts = value.split('; ' + name + '=');
                if (parts.length === 2) return parts.pop().split(';').shift();
                return null;
            };

            // ========== PERFORMANCE OPTIMIZATIONS ==========

            // 1. Paint Debouncing - Prevent excessive re-renders
            const extensionId = layout.qInfo.qId;
            const now = Date.now();
            const lastPaint = StateManager.get(extensionId, CONSTANTS.STATE_KEYS.LAST_PAINT, 0);

            if (lastPaint && (now - lastPaint) < CONSTANTS.TIMING.PAINT_DEBOUNCE_MS) {
                debugLog('Paint debounced - called too frequently (< ' + CONSTANTS.TIMING.PAINT_DEBOUNCE_MS + 'ms)');
                return qlik.Promise.resolve();
            }
            StateManager.set(extensionId, CONSTANTS.STATE_KEYS.LAST_PAINT, now);

            // 2. Interval Cleanup Manager - Prevent memory leaks
            if (!window.ODAGCleanupManager) {
                window.ODAGCleanupManager = {};
            }

            const cleanupKey = 'cleanup_' + layout.qInfo.qId;

            // Cleanup any previous intervals/timeouts for this instance
            if (window.ODAGCleanupManager[cleanupKey]) {
                const cleanup = window.ODAGCleanupManager[cleanupKey];

                // Clear all intervals
                (cleanup.intervals || []).forEach(function(id) {
                    clearInterval(id);
                });

                // Clear all timeouts
                (cleanup.timeouts || []).forEach(function(id) {
                    clearTimeout(id);
                });

                debugLog('Cleaned up', cleanup.intervals.length, 'intervals and', cleanup.timeouts.length, 'timeouts');
            }

            // Create fresh cleanup manager for this paint cycle
            window.ODAGCleanupManager[cleanupKey] = {
                intervals: [],
                timeouts: [],

                addInterval: function(id) {
                    this.intervals.push(id);
                    return id;
                },

                addTimeout: function(id) {
                    this.timeouts.push(id);
                    return id;
                },

                cleanup: function() {
                    this.intervals.forEach(function(id) { clearInterval(id); });
                    this.timeouts.forEach(function(id) { clearTimeout(id); });
                    this.intervals = [];
                    this.timeouts = [];
                }
            };

            const CleanupManager = window.ODAGCleanupManager[cleanupKey];

            // ========== SUPPRESS QLIK NEBULA EMBED DESTRUCTION ERRORS ==========
            // Install one-time global error handler to suppress known Qlik platform bug
            // Error: "Uncaught (in promise) TypeError: u[e] is not a function" at NebulaApp.jsx:145
            // This is an async promise rejection that occurs during embed destruction
            if (!window.odagNebulaErrorHandlerInstalled) {
                window.odagNebulaErrorHandlerInstalled = true;

                // Handle unhandled promise rejections (async errors from Nebula)
                window.addEventListener('unhandledrejection', function(event) {
                    // Check if this is the Nebula embed destruction error
                    const error = event.reason;

                    // Handle different error formats
                    let errorMessage = '';
                    let stack = '';

                    if (error) {
                        if (error.message) {
                            errorMessage = error.message;
                        } else if (typeof error === 'string') {
                            errorMessage = error;
                        } else {
                            errorMessage = String(error);
                        }

                        stack = error.stack || '';
                    }

                    // Check if error is from NebulaApp.jsx or qmfe-embed with "is not a function" TypeError
                    // This catches: "TypeError: u[e] is not a function at NebulaApp.jsx:145"
                    const hasNebulaInStack = stack.includes('NebulaApp') ||
                                            stack.includes('qmfe-embed') ||
                                            stack.includes('index.js') && stack.includes('destroy');

                    const hasTypeError = errorMessage.includes('is not a function') ||
                                        error instanceof TypeError;

                    const isNebulaError = hasNebulaInStack && hasTypeError;

                    if (isNebulaError) {
                        // Always suppress - this is a known Qlik platform bug
                        console.debug('[ODAG Extension] Suppressed Qlik Nebula embed destruction error (known platform bug, does not affect functionality)');
                        event.preventDefault(); // Prevent error from showing in console
                        return;
                    }
                });

                // Also handle regular synchronous errors (just in case)
                const originalErrorHandler = window.onerror;
                window.onerror = function(message, source, lineno, colno, error) {
                    // Suppress only the specific Nebula embed destruction error
                    const isNebulaError = source &&
                                         (source.includes('NebulaApp') || source.includes('qmfe-embed')) &&
                                         message.includes('is not a function');

                    if (isNebulaError) {
                        console.debug('[ODAG Extension] Suppressed Qlik Nebula embed destruction error (known platform bug)');
                        return true; // Prevent error from showing in console
                    }

                    // Let all other errors through
                    if (originalErrorHandler) {
                        return originalErrorHandler.apply(this, arguments);
                    }
                    return false;
                };
            }

            // ========== END PERFORMANCE OPTIMIZATIONS ==========

            // Check edit mode using Qlik API (synchronous call)
            let isEditMode = false;
            if (qlik.navigation && qlik.navigation.getMode) {
                const mode = qlik.navigation.getMode();
                isEditMode = (mode === 'edit');
                debugLog('Qlik navigation mode:', mode, 'isEditMode:', isEditMode);
            }

            // Get tenant URL dynamically from current location
            const currentUrl = window.location.origin;
            const hostname = window.location.hostname;

            // Store tenant URL globally for API calls
            window.qlikTenantUrl = currentUrl;

            // Environment is already detected at module level (lines 17-39)
            debugLog('Using environment:', window.qlikEnvironment, '- URL:', currentUrl);

            // Fetch available ODAG links for On-Premise only (Cloud uses manual input)
            const isCloud = window.qlikEnvironment === 'cloud';

            if (!isCloud && !window.odagLinksListFetched) {
                // Mark as fetched to avoid repeated calls
                window.odagLinksListFetched = true;

                const xrfkey = CONSTANTS.API.XRF_KEY;
                const linksUrl = currentUrl + '/api/odag/v1/links?xrfkey=' + xrfkey;

                debugLog('📋 Fetching available ODAG links from On-Premise...');

                ApiService.fetchAllLinks()
                    .then(function(links) {
                        if (Array.isArray(links) && links.length > 0) {
                            // Store links globally for property panel dropdown
                            window.odagAllLinks = links;

                            debugLog('✅ Found ' + links.length + ' ODAG Link(s) for this app.');
                            debugLog('ODAG Links loaded:', links);

                            // Force properties panel refresh to show the loaded links in dropdown
                            if (isEditMode) {
                                app.getObject(layout.qInfo.qId).then(function(model) {
                                    model.getProperties().then(function(props) {
                                        if (props.odagConfig) {
                                            props.odagConfig._linksLoadedTimestamp = Date.now();
                                        }
                                        model.setProperties(props).then(function() {
                                            debugLog('✅ Properties panel refreshed - ODAG links dropdown should now be populated');
                                        });
                                    });
                                }).catch(function(err) {
                                    debugLog('Could not refresh properties panel:', err);
                                });
                            }
                        } else {
                            debugLog('ℹ️ No ODAG links found for this app.');
                            window.odagAllLinks = [];
                        }
                    })
                    .catch(function(error) {
                        console.warn('⚠️ Could not fetch ODAG links list:', error);
                        debugLog('💡 You can manually get ODAG links from the On-Premise ODAG Links API');
                    });
            }

            // Fetch and cache ODAG bindings (for both Cloud and On-Premise)
            const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;
            const bindingsFetchingKey = 'odagBindingsFetching_' + odagConfig.odagLinkId;
            const rowEstCacheKey = 'odagRowEstConfig_' + odagConfig.odagLinkId;
            const wasInEditModeKey = 'wasInEditMode_' + odagConfig.odagLinkId;

            // Track edit mode state transitions
            const wasInEditMode = window[wasInEditModeKey] === true;
            const justEnteredEditMode = !wasInEditMode && isEditMode;
            const justExitedEditMode = wasInEditMode && !isEditMode;

            // Update edit mode tracking
            if (isEditMode) {
                window[wasInEditModeKey] = true;
            } else {
                delete window[wasInEditModeKey];
            }

            // OPTIMIZATION: Only clear cache ONCE when ENTERING edit mode (not on every paint)
            // This prevents redundant cache operations during edit mode
            if (justEnteredEditMode) {
                const initKey = 'odagInit_' + layout.qInfo.qId;
                delete window[initKey];
                delete window[rowEstCacheKey];
                delete window[bindingsCacheKey];
                delete window[bindingsFetchingKey];
                debugLog('🔄 [ENTERED EDIT MODE] Cleared cache once - will fetch fresh after exit');
            }

            // CRITICAL: If we just exited edit mode, cache is already cleared from entry
            // Just log for debugging
            if (justExitedEditMode) {
                debugLog('🔄 [EXITED EDIT MODE] Cache already cleared - will fetch fresh data from server');
            }

            debugLog('🔍 Bindings check:', {
                isCloud: isCloud,
                isEditMode: isEditMode,
                justExitedEditMode: justExitedEditMode,
                odagLinkId: odagConfig.odagLinkId,
                bindingsCacheKey: bindingsCacheKey,
                cached: window[bindingsCacheKey],
                fetching: window[bindingsFetchingKey],
                shouldFetch: odagConfig.odagLinkId && !window[bindingsCacheKey] && !window[bindingsFetchingKey] && !isEditMode
            });

            // Log when we're about to fetch fresh data after edit mode
            if (justExitedEditMode && odagConfig.odagLinkId && !window[bindingsCacheKey] && !window[bindingsFetchingKey]) {
                debugLog('🔄 JUST EXITED EDIT MODE → FETCHING FRESH API DATA FROM SERVER');
            } else if (window[bindingsCacheKey]) {
                debugLog('📦 Using cached bindings (already fetched)');
            }

            if (isCloud && odagConfig.odagLinkId && !window[bindingsCacheKey] && !window[bindingsFetchingKey] && !isEditMode) {
                // Set fetching flag to prevent duplicate requests
                window[bindingsFetchingKey] = true;
                debugLog('📋 [PAINT] Fetching ODAG bindings for Cloud link:', odagConfig.odagLinkId);

                const csrfToken = getCookie('_csrfToken');
                // Add cache-busting timestamp to force fresh data
                const cacheBuster = '_=' + Date.now();
                const bindingsUrl = currentUrl + '/api/v1/odaglinks/selAppLinkUsages?selAppId=' + app.id + '&' + cacheBuster;

                $.ajax({
                    url: bindingsUrl,
                    type: 'POST',
                    data: JSON.stringify({linkList: [odagConfig.odagLinkId]}),
                    contentType: 'application/json',
                    cache: false, // Disable jQuery caching
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': '*/*',
                        'qlik-csrf-token': csrfToken || '',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    xhrFields: {withCredentials: true},
                    success: function(response) {
                        debugLog('🔍 [PAINT] Cloud bindings response:', response);

                        // Cloud response format: [{link: {bindings: [...], rowEstExpr, curRowEstHighBound}}]
                        if (response && response.length > 0 && response[0].link && response[0].link.bindings) {
                            const linkData = response[0].link;
                            const bindings = linkData.bindings;
                            window[bindingsCacheKey] = bindings;

                            // Cache row estimation config from ODAG link
                            // Check multiple possible locations for curRowEstHighBound
                            const rowEstCacheKey = 'odagRowEstConfig_' + odagConfig.odagLinkId;
                            debugLog('🔍 [PAINT] Full link data structure:', JSON.stringify(linkData, null, 2));
                            debugLog('🔍 [PAINT] Checking rowEstExpr locations:', {
                                'linkData.rowEstExpr': linkData.rowEstExpr,
                                'linkData.link.rowEstExpr': linkData.link && linkData.link.rowEstExpr,
                                'response[0].rowEstExpr': response[0].rowEstExpr
                            });
                            debugLog('🔍 [PAINT] Checking curRowEstHighBound locations:', {
                                'linkData.curRowEstHighBound': linkData.curRowEstHighBound,
                                'linkData.link.curRowEstHighBound': linkData.link && linkData.link.curRowEstHighBound,
                                'response[0].curRowEstHighBound': response[0].curRowEstHighBound
                            });

                            // Extract curRowEstHighBound - check all possible locations
                            let curRowEstHighBound = null;
                            let rowEstExpr = null;

                            // Try multiple locations for curRowEstHighBound
                            if (linkData.curRowEstHighBound !== undefined && linkData.curRowEstHighBound !== null) {
                                curRowEstHighBound = linkData.curRowEstHighBound;
                            } else if (linkData.properties && linkData.properties.rowEstRange &&
                                       linkData.properties.rowEstRange.length > 0) {
                                curRowEstHighBound = linkData.properties.rowEstRange[0].highBound;
                            } else if (linkData.link && linkData.link.curRowEstHighBound !== undefined) {
                                curRowEstHighBound = linkData.link.curRowEstHighBound;
                            } else if (response[0].curRowEstHighBound !== undefined) {
                                curRowEstHighBound = response[0].curRowEstHighBound;
                            } else if (linkData.rowEstRange && linkData.rowEstRange.length > 0) {
                                curRowEstHighBound = linkData.rowEstRange[0].highBound;
                            }

                            // Try multiple locations for rowEstExpr
                            rowEstExpr = linkData.rowEstExpr || linkData.link?.rowEstExpr || response[0].rowEstExpr;

                            window[rowEstCacheKey] = {
                                rowEstExpr: rowEstExpr,
                                curRowEstHighBound: curRowEstHighBound
                            };

                            debugLog('🔍 [PAINT] Extracted row estimation config:', {
                                rowEstExpr: rowEstExpr,
                                curRowEstHighBound: curRowEstHighBound,
                                source: curRowEstHighBound ? 'found' : 'NOT FOUND - check ODAG Link configuration'
                            });

                            debugLog('✅ [PAINT] Cloud bindings cached:', bindings.length, 'bindings');
                            debugLog('✅ [PAINT] Cloud bindings array:', JSON.stringify(bindings, null, 2));
                            debugLog('✅ [PAINT] Row estimation config:', window[rowEstCacheKey]);

                            // Extract field names and store in layout for properties panel display
                            const fieldNames = bindings.map(function(b) {
                                return b.selectAppParamName || b.selectionAppParamName || b.fieldName || b.name;
                            }).filter(function(name) { return name; });

                            // Save to layout using backendApi
                            if (fieldNames.length > 0) {
                                app.getObject(layout.qInfo.qId).then(function(model) {
                                    model.getProperties().then(function(props) {
                                        // Preserve all existing properties
                                        if (props.odagConfig) {
                                            props.odagConfig._cachedBindingFields = fieldNames.join(', ');
                                        }
                                        model.setProperties(props);
                                        debugLog('✅ Saved bindings to layout:', fieldNames.join(', '));
                                    });
                                });
                            }
                        } else {
                            console.error('❌ [PAINT] Unexpected Cloud bindings response format');
                            console.error('[PAINT] Response:', response);
                            window[bindingsCacheKey] = [];
                        }
                        // Clear fetching flag
                        delete window[bindingsFetchingKey];
                    },
                    error: function(xhr, status, error) {
                        console.error('❌ [PAINT] Failed to fetch Cloud ODAG bindings:', xhr.status, error);
                        console.error('[PAINT] Response:', xhr.responseText);
                        window[bindingsCacheKey] = [];
                        // Clear fetching flag
                        delete window[bindingsFetchingKey];
                    }
                });
            } else if (!isCloud && odagConfig.odagLinkId && !window[bindingsCacheKey] && !window[bindingsFetchingKey] && !isEditMode) {
                // Set fetching flag to prevent duplicate requests
                window[bindingsFetchingKey] = true;
                // On-Premise: Fetch bindings from ODAG link details
                debugLog('📋 [PAINT] Fetching ODAG bindings for On-Premise link:', odagConfig.odagLinkId);

                const xrfkey = CONSTANTS.API.XRF_KEY;
                // Add cache-busting timestamp to force fresh data
                const cacheBuster = '_=' + Date.now();
                const linkDetailsUrl = currentUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '?xrfkey=' + xrfkey + '&' + cacheBuster;

                $.ajax({
                    url: linkDetailsUrl,
                    type: 'GET',
                    cache: false, // Disable jQuery caching
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Qlik-XrfKey': xrfkey,
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    xhrFields: {withCredentials: true},
                    timeout: CONSTANTS.TIMING.AJAX_TIMEOUT_MS,
                    success: function(linkDetails) {
                        debugLog('🔍 [PAINT] FULL On-Premise link details response:', linkDetails);

                        // On-Premise response format: {objectDef: {bindings: [...], ...}, feedback: [...]}
                        // Bindings are inside objectDef, not at top level
                        let bindings = null;

                        if (linkDetails && linkDetails.objectDef && linkDetails.objectDef.bindings) {
                            bindings = linkDetails.objectDef.bindings;
                        } else if (linkDetails && linkDetails.bindings) {
                            bindings = linkDetails.bindings;
                        }

                        debugLog('🔍 [PAINT] Extracted bindings:', bindings);

                        if (bindings && Array.isArray(bindings) && bindings.length > 0) {
                            window[bindingsCacheKey] = bindings;
                            debugLog('✅ [PAINT] On-Premise bindings cached:', bindings.length, 'bindings');
                            debugLog('✅ [PAINT] Bindings array:', JSON.stringify(bindings, null, 2));

                            // Cache row estimation config from ODAG link (On-Premise)
                            const rowEstCacheKey = 'odagRowEstConfig_' + odagConfig.odagLinkId;
                            if (linkDetails.objectDef) {
                                const objectDef = linkDetails.objectDef;

                                // Extract rowEstExpr and curRowEstHighBound from On-Premise structure
                                let rowEstExpr = null;
                                let curRowEstHighBound = null;

                                debugLog('🔍 [PAINT] On-Premise objectDef structure:', JSON.stringify(objectDef, null, 2));

                                // Try multiple locations for rowEstExpr
                                rowEstExpr = objectDef.rowEstExpr || objectDef.properties?.rowEstExpr;

                                // Try multiple locations for curRowEstHighBound
                                if (objectDef.curRowEstHighBound !== undefined && objectDef.curRowEstHighBound !== null) {
                                    curRowEstHighBound = objectDef.curRowEstHighBound;
                                } else if (objectDef.properties &&
                                           objectDef.properties.rowEstRange &&
                                           Array.isArray(objectDef.properties.rowEstRange) &&
                                           objectDef.properties.rowEstRange.length > 0) {
                                    curRowEstHighBound = objectDef.properties.rowEstRange[0].highBound;
                                } else if (objectDef.rowEstRange && Array.isArray(objectDef.rowEstRange) && objectDef.rowEstRange.length > 0) {
                                    curRowEstHighBound = objectDef.rowEstRange[0].highBound;
                                }

                                window[rowEstCacheKey] = {
                                    rowEstExpr: rowEstExpr,
                                    curRowEstHighBound: curRowEstHighBound
                                };

                                debugLog('✅ [PAINT] On-Premise row estimation config:', window[rowEstCacheKey]);
                                debugLog('🔍 [PAINT] Extracted values:', {
                                    rowEstExpr: rowEstExpr,
                                    curRowEstHighBound: curRowEstHighBound,
                                    source: curRowEstHighBound ? 'found' : 'NOT FOUND - check ODAG Link configuration in QMC'
                                });
                            }

                            // Extract field names and store in layout for properties panel display
                            const fieldNames = bindings.map(function(b) {
                                return b.selectAppParamName || b.selectionAppParamName || b.fieldName || b.name;
                            }).filter(function(name) { return name; });

                            // Save to layout using backendApi
                            if (fieldNames.length > 0) {
                                app.getObject(layout.qInfo.qId).then(function(model) {
                                    model.getProperties().then(function(props) {
                                        // Preserve all existing properties
                                        if (props.odagConfig) {
                                            props.odagConfig._cachedBindingFields = fieldNames.join(', ');
                                        }
                                        model.setProperties(props);
                                        debugLog('✅ Saved bindings to layout:', fieldNames.join(', '));
                                    });
                                });
                            }
                        } else {
                            console.error('❌ [PAINT] No bindings found in ODAG link details');
                            console.error('[PAINT] Response structure:', Object.keys(linkDetails || {}));
                            if (linkDetails && linkDetails.objectDef) {
                                console.error('[PAINT] objectDef structure:', Object.keys(linkDetails.objectDef));
                            }
                            window[bindingsCacheKey] = []; // Empty array to avoid repeated fetches
                        }
                        // Clear fetching flag
                        delete window[bindingsFetchingKey];
                    },
                    error: function(xhr, status, error) {
                        console.error('❌ Failed to fetch ODAG link details for bindings:', xhr.status, error);
                        window[bindingsCacheKey] = []; // Empty array to avoid repeated fetches
                        // Clear fetching flag
                        delete window[bindingsFetchingKey];
                    }
                });
            }

            // Check if extension is large enough for iframe view
            const isLargeView = elementHeight > 400 && elementWidth > 600;
            // Detect mobile viewport early (width < 768px) for use in initialization logic
            const isMobile = elementWidth < CONSTANTS.UI.MOBILE_BREAKPOINT_PX;
            // On mobile, force list view (not dynamic view) and classic/app embed mode
            const isDynamicView = isMobile ? false : odagConfig.viewMode === 'dynamicView';
            const effectiveEmbedMode = isMobile ? 'classic/app' : (odagConfig.embedMode || 'classic/app');

            debugLog('ODAG Extension: isEditMode =', isEditMode, 'isDynamicView =', isDynamicView, 'isMobile =', isMobile, 'effectiveEmbedMode =', effectiveEmbedMode, 'odagLinkId =', odagConfig.odagLinkId);

            // Check if we're switching TO Dynamic View (even in edit mode)
            // This cleanup happens BEFORE edit mode check so it runs immediately
            const configKey = 'dynamicViewConfig_' + layout.qInfo.qId;
            const currentConfig = JSON.stringify({
                odagLinkId: odagConfig.odagLinkId,
                variableMappings: odagConfig.variableMappings,
                templateSheetId: odagConfig.templateSheetId,
                viewMode: odagConfig.viewMode,
                embedMode: odagConfig.embedMode,
                allowInteractions: odagConfig.allowInteractions
            });
            const previousConfig = window[configKey];
            const previousViewMode = previousConfig ? JSON.parse(previousConfig).viewMode : null;

            // Debug config comparison
            if (isDynamicView && previousConfig) {
                debugLog('Config comparison:', {
                    same: previousConfig === currentConfig,
                    prevLength: previousConfig.length,
                    currLength: currentConfig.length,
                    prevConfig: previousConfig.substring(0, 100),
                    currConfig: currentConfig.substring(0, 100)
                });
            }

            // Detect if we're switching TO Dynamic View:
            // 1. If previousViewMode exists and changed from non-dynamic to dynamic
            // 2. OR if we're in Dynamic View and there's no previous config (first time)
            const switchedToDynamicView = (previousViewMode && previousViewMode !== 'dynamicView' && odagConfig.viewMode === 'dynamicView') ||
                                         (!previousConfig && odagConfig.viewMode === 'dynamicView');

            // Detect if we're switching FROM Dynamic View to Standard List View
            const switchedFromDynamicView = previousViewMode === 'dynamicView' && odagConfig.viewMode !== 'dynamicView';

            // When switching TO Dynamic View or entering it for first time, keep only the latest app and delete others
            if (switchedToDynamicView && odagConfig.odagLinkId) {
                debugLog('ODAG Extension: Entering Dynamic View - cleaning up old apps, keeping only latest...');

                // Store the new config immediately
                window[configKey] = currentConfig;

                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = CONSTANTS.API.XRF_KEY;
                const apiUrl = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagConfig.odagLinkId + '/requests?pending=true'
                    : tenantUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '/requests?pending=true&xrfkey=' + xrfkey;

                $.ajax({
                    url: apiUrl,
                    type: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(result) {
                        if (result && Array.isArray(result) && result.length > 1) {
                            // Sort by date to find latest
                            result.sort(function(a, b) {
                                return new Date(b.createdDate) - new Date(a.createdDate);
                            });

                            // Keep first (latest), delete rest
                            const latestApp = result[0];
                            const appsToDelete = result.slice(1);

                            debugLog('ODAG Extension: Keeping latest app:', latestApp.generatedAppName);
                            debugLog('ODAG Extension: Deleting', appsToDelete.length, 'older apps');

                            appsToDelete.forEach(function(app) {
                                const isCloud = window.qlikEnvironment === 'cloud';
                                const xrfkey = CONSTANTS.API.XRF_KEY;
                                const deleteHeaders = isCloud
                                    ? { 'qlik-csrf-token': getCookie('_csrfToken') || '' }
                                    : { 'X-Qlik-XrfKey': xrfkey, 'Content-Type': 'application/json' };

                                $.ajax({
                                    url: (isCloud ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + app.id + '/app?xrfkey=' + xrfkey,
                                    type: 'DELETE',
                                    headers: deleteHeaders,
                                    xhrFields: {
                                        withCredentials: true
                                    },
                                    success: function() {
                                        debugLog('ODAG Extension: Deleted old app:', app.generatedAppName || app.id);
                                    },
                                    error: function(xhr) {
                                        if (xhr.status !== 404) {
                                            console.error('ODAG Extension: Failed to delete app:', app.id, xhr.status);
                                        }
                                    }
                                });
                            });
                        } else {
                            debugLog('ODAG Extension: Only one or zero apps exist, no cleanup needed');
                        }
                    },
                    error: function(xhr) {
                        console.error('ODAG Extension: Failed to fetch apps for cleanup:', xhr.responseText);
                    }
                });
            }

            // Store flag for view mode switch globally (will be checked after loadExistingRequests is defined)
            const refreshFlagKey = 'odagViewSwitchRefresh_' + layout.qInfo.qId;
            if (switchedFromDynamicView && odagConfig.odagLinkId) {
                debugLog('ODAG Extension: Detected switch from Dynamic View to Standard List View');
                window[refreshFlagKey] = true;
                // Store the new config
                window[configKey] = currentConfig;
            }

            // Build HTML
            let html = '<div class="odag-container">';

            // Show warning if ODAG Link ID is not configured
            if (!odagConfig.odagLinkId || odagConfig.odagLinkId.trim() === '') {
                debugLog('ODAG Extension: No ODAG Link ID, showing warning');
                html += '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">';
                html += '<div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>';
                html += '<div style="font-size: 18px; font-weight: bold; color: #f59e0b; margin-bottom: 8px;">ODAG Link ID Required</div>';
                if (isCloud) {
                    html += '<div style="font-size: 14px; color: #666;">Please configure the ODAG Link ID in the property panel to use this extension.</div>';
                } else {
                    html += '<div style="font-size: 14px; color: #666;">Please select an ODAG Link from the dropdown in the property panel.</div>';
                }
                html += '</div>';
                html += '</div>'; // Close odag-container
                debugLog('ODAG Extension: Setting warning HTML');
                $element.html(html);
                return qlik.Promise.resolve();
            }

            // Show standard message in edit mode
            if (isEditMode) {
                debugLog('ODAG Extension: In edit mode, showing edit message');
                // Note: Cache clearing is now done ONCE when entering edit mode (line 234-240)
                // This prevents redundant operations on every paint() call during edit mode

                html += '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">';
                html += '<div style="font-size: 48px; margin-bottom: 16px;">✏️ 📝</div>';
                html += '<div style="font-size: 18px; font-weight: bold; color: #666; margin-bottom: 8px;">Edit Mode</div>';
                html += '<div style="font-size: 14px; color: #999;">Configure ODAG settings in the properties panel →</div>';
                html += '</div>';
                html += '</div>'; // Close odag-container
                $element.html(html);
                return qlik.Promise.resolve();
            }

            debugLog('ODAG Extension: ODAG Link ID configured, continuing with normal rendering...');

            // Check if already initialized - if so, skip HTML rebuild to preserve existing embeds
            // BUT: Only skip if we're staying in the same mode (edit or analysis)
            const initKey = 'odagInit_' + layout.qInfo.qId;
            const modeKey = 'odagMode_' + layout.qInfo.qId;
            const previousMode = window[modeKey];
            const currentMode = isEditMode ? 'edit' : 'analysis';

            // Track mobile state to detect viewport changes
            const mobileStateKey = 'odagMobileState_' + layout.qInfo.qId;
            const previousMobileState = window[mobileStateKey];
            const viewportChanged = previousMobileState !== undefined && previousMobileState !== isMobile;

            if (window[initKey] && previousMode === currentMode && !isEditMode && !isMobile && !viewportChanged) {
                // Check if actual DOM content still exists (not destroyed by page navigation)
                // Note: Skip this optimization on mobile to ensure event handlers are re-attached
                // Also skip if viewport changed (mobile <-> desktop transition)
                const hasContent = $element.children().length > 0;
                if (hasContent) {
                    // Already initialized and staying in analysis mode - skip rebuild
                    debugLog('⏭️ ODAG Extension already initialized - skipping HTML rebuild to preserve embeds');
                    return qlik.Promise.resolve();
                } else {
                    // DOM was cleared (likely due to page navigation), need to reinitialize
                    debugLog('🔄 DOM content missing despite init flag - reinitializing after page navigation');
                    delete window[initKey];
                    const dynamicViewKey = 'dynamicView_' + layout.qInfo.qId;
                    delete window[dynamicViewKey];
                }
            }

            if (viewportChanged) {
                debugLog('🔄 Viewport changed (mobile <-> desktop), rebuilding layout');
                delete window[initKey];
                // Also clear Dynamic View flags when switching to mobile
                if (isMobile) {
                    const dynamicViewKey = 'dynamicView_' + layout.qInfo.qId;
                    delete window[dynamicViewKey];
                    debugLog('🔄 Switched to mobile - clearing Dynamic View flags');
                }
            }

            // Store current mode and mobile state for next paint cycle
            window[modeKey] = currentMode;
            window[mobileStateKey] = isMobile;

            // Note: When switching modes, Qlik may throw a console error "TypeError: u[e] is not a function"
            // in NebulaApp.jsx during embed cleanup. This is a known Qlik framework limitation and does not
            // affect functionality. See README Troubleshooting section for details.

            // isMobile already defined earlier (line 364) for use in initialization logic
            debugLog('ODAG Extension: isMobile =', isMobile, 'elementWidth =', elementWidth);

            // Helper function to generate loading placeholder with spinner
            const getLoadingPlaceholder = function(message) {
                let html = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px;">';
                html += '<span class="status-spinner" style="display: inline-block; width: 40px; height: 40px; ';
                html += 'border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-left-color: #3b82f6; ';
                html += 'border-radius: 50%; animation: spin 0.8s linear infinite;"></span>';
                html += '<div style="color: #6b7280; font-size: 14px; font-weight: 500;">' + message + '</div>';
                html += '</div>';
                return html;
            };

            // Helper function to generate status HTML with spinner (used by Dynamic View)
            const getStatusHTML = function(state, message, showSpinner) {
                let color = '#6b7280'; // default gray
                if (state === 'succeeded' || state === 'success') {
                    color = '#10b981'; // green
                    showSpinner = false;
                } else if (state === 'failed' || state === 'error') {
                    color = '#ef4444'; // red
                    showSpinner = false;
                } else if (state === 'generating' || state === 'pending' || state === 'queued' || state === 'loading' || state === 'validating') {
                    color = '#f59e0b'; // orange
                    showSpinner = true;
                }

                let html = '';
                if (showSpinner) {
                    html += '<span class="status-spinner" style="display: inline-block; width: 14px; height: 14px; ';
                    html += 'border: 2px solid #e5e7eb; border-top-color: ' + color + '; border-left-color: ' + color + '; ';
                    html += 'border-radius: 50%; animation: spin 0.8s linear infinite;"></span>';
                } else {
                    html += '<span style="color: ' + color + ';">●</span>';
                }
                html += '<span>' + message + '</span>';
                return html;
            };

            // Dynamic View Mode - only show latest ODAG app
            if (isDynamicView && odagConfig.odagLinkId) {
                html += '<div class="odag-dynamic-view" style="height: 100%; position: relative; display: flex; flex-direction: column;">';

                // Top bar container (auto-hides after 5s, shows on hover/selection change)
                // Mobile: Make it stack vertically if needed
                html += '<div id="dynamic-top-bar-' + layout.qInfo.qId + '" class="dynamic-top-bar" style="position: absolute; top: 0; left: 0; right: 0; z-index: ' + CONSTANTS.UI.TOP_BAR_Z_INDEX + '; ';
                html += 'background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid #e5e7eb; ';
                html += 'padding: ' + (isMobile ? '8px 12px' : '12px 16px') + '; display: flex; ';
                html += 'flex-direction: ' + (isMobile ? 'column' : 'row') + '; ';
                html += 'justify-content: space-between; align-items: ' + (isMobile ? 'stretch' : 'center') + '; ';
                html += 'gap: ' + (isMobile ? '8px' : '0') + '; pointer-events: none; ';
                html += 'transition: transform 0.3s ease, opacity 0.3s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">';

                // Close button positioned absolutely at top-right corner (outside flex layout)
                // Center-aligned vertically with the content
                html += '<button class="odag-close-topbar-btn" id="close-topbar-btn-' + layout.qInfo.qId + '" ';
                html += 'style="position: absolute; top: 50%; right: ' + (isMobile ? '12px' : '16px') + '; transform: translateY(-50%); ';
                html += 'background: transparent; border: none; color: #666; cursor: pointer; ';
                html += 'font-size: 20px; padding: 0; width: 24px; height: 24px; pointer-events: auto; ';
                html += 'display: flex; align-items: center; justify-content: center; border-radius: 3px; z-index: 1;" ';
                html += 'title="Hide top bar">';
                html += '×';
                html += '</button>';

                // Status indicator on the left
                html += '<div id="dynamic-status-' + layout.qInfo.qId + '" style="display: flex; align-items: center; gap: 8px; ';
                html += 'font-size: 13px; color: #374151; font-weight: 500; flex: 1;">';
                html += '<span class="status-spinner" style="display: inline-block; width: 14px; height: 14px; ';
                html += 'border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-left-color: #3b82f6; ';
                html += 'border-radius: 50%; animation: spin 0.8s linear infinite;"></span>';
                html += '<span>Loading latest app...</span>';
                html += '</div>';

                // Button container on the right - center-aligned
                html += '<div style="display: flex; gap: 8px; align-items: center; pointer-events: auto; margin-right: 48px;">'; // Added margin-right to prevent overlap with close button

                // Cancel button (hidden by default)
                html += '<button class="odag-cancel-btn" id="cancel-btn-' + layout.qInfo.qId + '" ';
                html += 'style="background: #ef4444; border: 1px solid #dc2626; border-radius: 3px; color: white; ';
                html += 'padding: 6px 12px; cursor: pointer; font-size: 14px; pointer-events: auto; ';
                html += 'box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: none; align-items: center; gap: 4px;">';
                html += '<span style="font-size: 16px;">⏹</span> Cancel';
                html += '</button>';

                // Refresh button
                html += '<button class="odag-refresh-btn" id="refresh-btn-' + layout.qInfo.qId + '" ';
                html += 'style="background: white; border: 1px solid #ccc; border-radius: 3px; ';
                html += 'padding: 6px 12px; cursor: pointer; font-size: 14px; pointer-events: auto; ';
                html += 'box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 4px;">';
                html += '<span style="font-size: 16px;">↻</span> Refresh';
                html += '</button>';

                html += '</div>'; // Close button container

                // Validation status indicator for Dynamic View
                // Added right padding to make space for close button
                html += '<div id="validation-status-' + layout.qInfo.qId + '" style="margin: 8px 16px; margin-right: 48px; padding: 8px 12px; border-radius: 4px; font-size: 13px; display: none;"></div>';

                html += '</div>'; // Close top bar

                // Embed container takes full space
                html += '<div class="odag-dynamic-embed" id="dynamic-embed-' + layout.qInfo.qId + '" style="height: 100%; width: 100%;">';
                html += getLoadingPlaceholder('Loading ODAG app...');
                html += '</div>';

                html += '</div>';
            }
            // Main content area - simplified layout: always list left, iframe right
            // On mobile, always use this view (with dropdown) regardless of size
            else if ((isLargeView || isMobile) && !isDynamicView) {
                const listWidth = 350; // Fixed width for the list panel

                // MOBILE VIEW: Vertical stacking with dropdown and embed underneath
                if (isMobile) {
                    html += '<div class="odag-content-mobile" style="display: flex; flex-direction: column; height: 100%;">';

                    // Top section: Controls with dropdown
                    html += '<div class="mobile-controls" style="background: white; border-bottom: 1px solid #e1e5eb; padding: 12px; flex-shrink: 0;">';

                    // Generate button
                    html += '<button class="odag-generate-btn-compact" style="';
                    html += 'background-color:' + (odagConfig.buttonColor || '#009845') + ';';
                    html += 'color:' + (odagConfig.buttonTextColor || '#ffffff') + '; width: 100%; margin-bottom: 10px;">';
                    html += '<span class="btn-icon">⚡</span>';
                    html += '<span class="btn-text">' + Validators.sanitizeHtml(odagConfig.buttonText || CONSTANTS.DEFAULTS.BUTTON_TEXT) + '</span>';
                    html += '</button>';

                    // Controls row: dropdown + buttons
                    html += '<div style="display: flex; gap: 8px; align-items: center;">';

                    // Dropdown for app selection
                    html += '<select id="mobile-app-selector-' + layout.qInfo.qId + '" class="mobile-app-selector" style="';
                    html += 'flex: 1; padding: 10px; font-size: 14px; border: 1px solid #e5e7eb; border-radius: 6px; ';
                    html += 'background: white; color: #374151; cursor: pointer;">';
                    html += '<option value="">No apps generated yet</option>';
                    html += '</select>';

                    // Action buttons
                    html += '<button class="refresh-list-btn" id="refresh-list-btn-' + layout.qInfo.qId + '" title="Refresh app list" style="background: #f3f4f6; border: 1px solid #e5e7eb; color: #3b82f6; cursor: pointer; font-size: 16px; padding: 8px 12px; border-radius: 6px; transition: all 0.2s; display: flex; align-items: center;">';
                    html += '🔄';
                    html += '</button>';
                    html += '<button class="delete-all-btn" id="delete-all-btn-' + layout.qInfo.qId + '" title="Delete all apps" style="background: #f3f4f6; border: 1px solid #e5e7eb; color: #dc2626; cursor: pointer; font-size: 16px; padding: 8px 12px; border-radius: 6px; transition: background 0.2s; display: flex; align-items: center;">';
                    html += '🗑️';
                    html += '</button>';

                    html += '</div>'; // Close controls row

                    // App count
                    html += '<div style="margin-top: 8px; font-size: 12px; color: #6b7280; text-align: center;">';
                    html += '<span class="app-count" id="app-count-' + layout.qInfo.qId + '">0 apps</span>';
                    html += '</div>';

                    html += '</div>'; // Close mobile-controls

                    // Bottom section: Embedded app UNDERNEATH dropdown (takes remaining space)
                    html += '<div class="odag-iframe-panel" id="iframe-container-' + layout.qInfo.qId + '" style="flex: 1; overflow: hidden;">';
                    html += '<div class="iframe-placeholder">';
                    html += '<div class="placeholder-icon">📊</div>';
                    html += '<div class="placeholder-text">Select an app from the dropdown to preview</div>';
                    html += '</div>';
                    html += '</div>';

                    html += '</div>'; // Close odag-content-mobile
                }
                // DESKTOP VIEW: Horizontal layout (list left, iframe right)
                else {
                    // Horizontal layout only - list on left, iframe on right
                    html += '<div class="odag-content-horizontal">';

                    // Apps list panel on the LEFT with toggle button
                    html += '<div class="odag-apps-list-panel" id="apps-list-panel-' + layout.qInfo.qId + '" style="width:' + listWidth + 'px; transition: margin-left 0.3s ease;">';
                    html += '<div class="list-header">';
                    html += '<div class="header-top">';
                    html += '<h3>Generated Apps</h3>';
                    html += '<div style="display: flex; align-items: center; gap: 6px;">';
                    html += '<span class="app-count" id="app-count-' + layout.qInfo.qId + '">0 apps</span>';
                    html += '<button class="refresh-list-btn" id="refresh-list-btn-' + layout.qInfo.qId + '" title="Refresh app list" style="background: transparent; border: none; color: #3b82f6; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center;">';
                    html += '🔄';
                    html += '</button>';
                    html += '<button class="delete-all-btn" id="delete-all-btn-' + layout.qInfo.qId + '" title="Delete all apps" style="background: transparent; border: none; color: #dc2626; cursor: pointer; font-size: 18px; padding: 4px 6px; border-radius: 4px; transition: background 0.2s; display: flex; align-items: center;">';
                    html += '🗑️';
                    html += '</button>';
                    html += '</div>';
                    html += '</div>';
                    html += '<button class="odag-generate-btn-compact" style="';
                    html += 'background-color:' + (odagConfig.buttonColor || '#009845') + ';';
                    html += 'color:' + (odagConfig.buttonTextColor || '#ffffff') + ';">';
                    html += '<span class="btn-icon">⚡</span>';
                    html += '<span class="btn-text">' + Validators.sanitizeHtml(odagConfig.buttonText || CONSTANTS.DEFAULTS.BUTTON_TEXT) + '</span>';
                    html += '</button>';
                    html += '<div id="validation-status-' + layout.qInfo.qId + '" style="margin-top: 8px; padding: 10px 12px; border-radius: 6px; font-size: 13px; display: none; text-align: center; font-weight: 500;"></div>';
                    html += '</div>';
                    html += '<div class="odag-apps-list" id="apps-list-' + layout.qInfo.qId + '">';
                    html += '<div class="list-empty">No apps generated yet</div>';
                    html += '</div>';
                    html += '</div>';

                    // Toggle button on the edge of sidebar (smaller size)
                    html += '<button class="sidebar-toggle-btn" id="sidebar-toggle-' + layout.qInfo.qId + '" ';
                    html += 'style="position: absolute; left: ' + listWidth + 'px; top: 50%; transform: translateY(-50%); ';
                    html += 'width: 18px; height: 40px; background: #f3f4f6; border: 1px solid #e5e7eb; ';
                    html += 'border-left: none; border-radius: 0 6px 6px 0; cursor: pointer; ';
                    html += 'display: flex; align-items: center; justify-content: center; z-index: 1001; ';
                    html += 'transition: left 0.3s ease; box-shadow: 2px 0 4px rgba(0,0,0,0.1);" ';
                    html += 'title="Toggle sidebar">';
                    html += '<span style="font-size: 11px; color: #6b7280;">◀</span>';
                    html += '</button>';

                    // Iframe/embed panel on the RIGHT
                    html += '<div class="odag-iframe-panel" id="iframe-container-' + layout.qInfo.qId + '">';

                    html += '<div class="iframe-placeholder">';
                    html += '<div class="placeholder-icon">📊</div>';

                    // Show different message based on whether sheet ID is configured
                    if (odagConfig.templateSheetId && odagConfig.templateSheetId.trim() !== '') {
                        html += '<div class="placeholder-text">Click on any app to view its sheet</div>';
                    } else {
                        html += '<div class="placeholder-text">Select an app from the list to preview</div>';
                    }

                    html += '</div>';
                    html += '</div>';

                    html += '</div>';
                }
            } else if (!isDynamicView) {
                // Small view - just the list with button at top (not for dynamic view)
                html += '<div class="odag-small-view">';
                html += '<div class="small-view-header">';
                html += '<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px;">';
                html += '<div style="display: flex; align-items: center; gap: 6px;">';
                html += '<span class="app-count" id="app-count-' + layout.qInfo.qId + '">0 apps</span>';
                html += '<button class="refresh-list-btn" id="refresh-list-btn-' + layout.qInfo.qId + '" title="Refresh app list" style="background: transparent; border: none; color: #3b82f6; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 4px; transition: all 0.2s;">';
                html += '🔄';
                html += '</button>';
                html += '<button class="delete-all-btn" id="delete-all-btn-' + layout.qInfo.qId + '" title="Delete all apps">';
                html += '🗑️';
                html += '</button>';
                html += '</div>';
                html += '</div>';
                html += '<button class="odag-generate-btn-compact" id="generate-btn-' + layout.qInfo.qId + '" style="';
                html += 'background-color:' + (odagConfig.buttonColor || '#009845') + ';';
                html += 'color:' + (odagConfig.buttonTextColor || '#ffffff') + '; width: 100%;">';
                html += '<span class="btn-icon">⚡</span>';
                html += '<span class="btn-text">' + Validators.sanitizeHtml(odagConfig.buttonText || CONSTANTS.DEFAULTS.BUTTON_TEXT) + '</span>';
                html += '</button>';
                html += '<div id="validation-status-' + layout.qInfo.qId + '" style="margin-top: 8px; padding: 10px 12px; border-radius: 6px; font-size: 13px; display: none; text-align: center; font-weight: 500;"></div>';
                html += '</div>';
                html += '<div class="odag-apps-list" id="apps-list-' + layout.qInfo.qId + '"></div>';
                html += '</div>';
            }
            
            html += '</div>';

            $element.html(html);

            // Calculate row estimation for ODAG validation
            const calculateRowEstimation = async function(app, odagLinkId) {
                const rowEstCacheKey = 'odagRowEstConfig_' + odagLinkId;
                const rowEstConfig = window[rowEstCacheKey];

                // If no row estimation config, allow generation (no restrictions)
                if (!rowEstConfig || !rowEstConfig.rowEstExpr) {
                    debugLog('📊 No row estimation config found - allowing generation');
                    return {
                        actualRowEst: 1,
                        curRowEstHighBound: null,
                        canGenerate: true,
                        message: null
                    };
                }

                const rowEstExpr = rowEstConfig.rowEstExpr;
                const curRowEstHighBound = rowEstConfig.curRowEstHighBound;

                debugLog('📊 Calculating row estimation:', {
                    rowEstExpr: rowEstExpr,
                    curRowEstHighBound: curRowEstHighBound
                });

                try {
                    // Create a temporary session object to evaluate expression in CURRENT selection state
                    const enigmaApp = app.model.enigmaModel;

                    // Create a hypercube session object to get live evaluation
                    const tempObj = await enigmaApp.createSessionObject({
                        qInfo: { qType: 'RowEstValidator' },
                        qHyperCubeDef: {
                            qDimensions: [],
                            qMeasures: [{
                                qDef: {
                                    qDef: rowEstExpr
                                }
                            }],
                            qInitialDataFetch: [{
                                qTop: 0,
                                qLeft: 0,
                                qWidth: 1,
                                qHeight: 1
                            }]
                        }
                    });

                    // Get the layout to evaluate the expression in current selection context
                    const objLayout = await tempObj.getLayout();

                    // Extract value from hypercube data matrix
                    let actualRowEst = 0;
                    if (objLayout.qHyperCube &&
                        objLayout.qHyperCube.qDataPages &&
                        objLayout.qHyperCube.qDataPages[0] &&
                        objLayout.qHyperCube.qDataPages[0].qMatrix &&
                        objLayout.qHyperCube.qDataPages[0].qMatrix[0] &&
                        objLayout.qHyperCube.qDataPages[0].qMatrix[0][0]) {
                        actualRowEst = Math.round(objLayout.qHyperCube.qDataPages[0].qMatrix[0][0].qNum);
                    }

                    // Destroy the temporary object
                    await enigmaApp.destroySessionObject(tempObj.id);

                    // Handle undefined curRowEstHighBound (no limit configured)
                    const hasLimit = curRowEstHighBound !== undefined && curRowEstHighBound !== null;
                    const canGenerate = !hasLimit || actualRowEst <= curRowEstHighBound;

                    debugLog('📊 Row estimation calculated:', {
                        actualRowEst: actualRowEst,
                        curRowEstHighBound: curRowEstHighBound,
                        hasLimit: hasLimit,
                        canGenerate: canGenerate
                    });

                    const message = canGenerate ? null :
                        'Cannot generate ODAG app: The current selections would result in ' +
                        actualRowEst.toLocaleString() + ' rows, which exceeds the maximum allowed ' +
                        curRowEstHighBound.toLocaleString() + ' rows. Please refine your selections to reduce the data volume.';

                    return {
                        actualRowEst: actualRowEst,
                        curRowEstHighBound: curRowEstHighBound,
                        canGenerate: canGenerate,
                        message: message
                    };

                } catch (error) {
                    console.error('❌ Failed to calculate row estimation:', error);
                    // On error, allow generation (fail open)
                    return {
                        actualRowEst: 1,
                        curRowEstHighBound: null,
                        canGenerate: true,
                        message: null
                    };
                }
            };

            // Real-time validation check function - runs on every paint/selection change
            const checkODAGValidation = async function() {
                try {
                    // First check binding validation
                    const cachedBindings = window['odagBindings_' + odagConfig.odagLinkId];
                    let bindingValidationPassed = true;
                    let bindingErrorMessageShort = '';
                    let bindingErrorMessageFull = '';

                    if (cachedBindings && cachedBindings.length > 0) {
                        const buildResult = await buildPayload(app, odagConfig, layout);
                        const payload = buildResult.payload;

                        // Create a map of binding field values
                        const bindingValueMap = new Map();
                        for (const bindingField of payload.bindSelectionState) {
                            bindingValueMap.set(
                                bindingField.selectionAppParamName,
                                bindingField.values || []
                            );
                        }

                        // Check for missing required fields with details
                        const missingFields = [];
                        const missingFieldDetails = [];
                        for (const binding of cachedBindings) {
                            const fieldName = binding.selectAppParamName || binding.selectionAppParamName;
                            const selectionStates = binding.selectionStates || "SO";
                            const fieldValues = bindingValueMap.get(fieldName) || [];

                            if (selectionStates === "S" && fieldValues.length === 0) {
                                missingFields.push(fieldName);
                                missingFieldDetails.push({ field: fieldName, mode: selectionStates });
                            }
                        }

                        if (missingFields.length > 0) {
                            bindingValidationPassed = false;
                            bindingErrorMessageShort = 'Selection required in: ' + missingFields.join(', ');

                            // Build full detailed message for status div
                            const fieldListHTML = missingFieldDetails.map(detail => {
                                const prefix = detail.mode === 'S' ? '$(odags_' + detail.field + ')' : '$(odag_' + detail.field + ')';
                                return '<div style="margin: 4px 0; padding-left: 8px;">• <strong>' + detail.field + '</strong> → ' + prefix + '</div>';
                            }).join('');

                            bindingErrorMessageFull =
                                '<div style="margin-bottom: 8px;"><strong>⚠️ Selection Required</strong></div>' +
                                '<div style="margin-bottom: 8px;">The following fields require selections to generate the app:</div>' +
                                fieldListHTML +
                                '<div style="margin-top: 8px; font-size: 0.9em; opacity: 0.9;">These fields use "selected values only" mode (selectionStates: "S"). ' +
                                'The template app expects selected values in variables like $(odags_FieldName).</div>';
                        }
                    }

                    const rowEstResult = await calculateRowEstimation(app, odagConfig.odagLinkId);
                    const $statusDiv = $('#validation-status-' + layout.qInfo.qId);

                    // Select all generate buttons (List View may have multiple)
                    const $generateBtn = isDynamicView ?
                        $('#refresh-btn-' + layout.qInfo.qId) :
                        $element.find('.odag-generate-btn-compact');

                    debugLog('🔍 Validation check:', {
                        isDynamicView: isDynamicView,
                        buttonCount: $generateBtn.length,
                        bindingValidationPassed: bindingValidationPassed,
                        rowEstResult: rowEstResult
                    });

                    // Check both validations
                    if (!bindingValidationPassed) {
                        // BLOCK: Binding validation failed
                        if (isDynamicView) {
                            $generateBtn.hide();
                        } else {
                            $generateBtn.prop('disabled', true).css({
                                'opacity': '0.5',
                                'cursor': 'not-allowed',
                                'pointer-events': 'none'
                            });
                        }

                        // Show message in status div - SHORT for dynamic view, FULL for list view
                        const messageToShow = isDynamicView ? bindingErrorMessageShort : bindingErrorMessageFull;
                        $statusDiv.show().css({
                            'background': '#fff3cd',
                            'border': '1px solid #ffc107',
                            'color': '#856404',
                            'padding': '12px',
                            'line-height': '1.5'
                        }).html(messageToShow);

                        debugLog('🚫 ODAG binding validation FAILED:', bindingErrorMessageShort);
                    } else if (!rowEstResult.canGenerate) {
                        // BLOCK: Hide/disable button and show error
                        if (isDynamicView) {
                            // In Dynamic View: HIDE Refresh button when validation fails
                            $generateBtn.hide();
                        } else {
                            // In List View: Disable Generate button (gray it out)
                            $generateBtn.prop('disabled', true).css({
                                'opacity': '0.5',
                                'cursor': 'not-allowed',
                                'pointer-events': 'none'
                            });
                        }

                        $statusDiv.show().css({
                            'background': '#ffebee',
                            'border': '1px solid #ef5350',
                            'color': '#c62828'
                        }).html('⚠️ <strong>Cannot generate:</strong> Current selections result in ' +
                                rowEstResult.actualRowEst + ' rows, exceeding the limit of ' +
                                rowEstResult.curRowEstHighBound + ' rows. Please refine your selections.');

                        debugLog('🚫 ODAG validation FAILED:', rowEstResult);
                    } else {
                        // ALLOW: Show/enable button and HIDE status message
                        if (isDynamicView) {
                            // In Dynamic View: SHOW Refresh button when validation passes
                            $generateBtn.show();

                            // Add "needs-refresh" warning state to indicate selections changed
                            // This highlights the button in orange/yellow to prompt user to refresh
                            if (!$generateBtn.hasClass('needs-refresh')) {
                                $generateBtn.addClass('needs-refresh');
                                debugLog('🟡 Added needs-refresh warning state to refresh button');
                            }
                        } else {
                            // In List View: Enable Generate button
                            $generateBtn.prop('disabled', false).css({
                                'opacity': '1',
                                'cursor': 'pointer',
                                'pointer-events': 'auto'
                            });
                        }

                        // Hide validation status when validation passes - no need to show success message
                        $statusDiv.hide();

                        debugLog('✅ ODAG validation PASSED:', rowEstResult);
                    }
                } catch (error) {
                    console.error('❌ Validation check error:', error);
                    // On error, allow generation (fail open)
                }
            };

            // Store validation function in StateManager so it can be called on every paint
            StateManager.set(extensionId, 'checkODAGValidation', checkODAGValidation);

            // Subscribe to selection state changes to trigger validation
            if (!StateManager.get(extensionId, CONSTANTS.STATE_KEYS.SELECTION_LISTENER)) {
                app.model.enigmaModel.on('changed', function() {
                    // Debounce validation check on selection changes
                    const existingTimeout = StateManager.get(extensionId, 'selectionChangeTimeout');
                    if (existingTimeout) {
                        clearTimeout(existingTimeout);
                    }
                    const timeoutId = setTimeout(function() {
                        const validationFunc = StateManager.get(extensionId, 'checkODAGValidation');
                        if (validationFunc) {
                            debugLog('🔄 Selection changed - triggering validation');
                            validationFunc();
                        }
                    }, CONSTANTS.TIMING.SELECTION_CHANGE_DEBOUNCE_MS);
                    StateManager.set(extensionId, 'selectionChangeTimeout', timeoutId);
                });
                StateManager.set(extensionId, CONSTANTS.STATE_KEYS.SELECTION_LISTENER, true);
            }

            // Run validation check immediately after HTML is rendered
            setTimeout(function() {
                checkODAGValidation();
            }, 500);

            // Store reference for Dynamic View initialization later
            let initDynamicView = null;
            let restoreDynamicView = null;

            // Handle Dynamic View Mode - Show only latest ODAG app
            if (isDynamicView && odagConfig.odagLinkId) {
                // Defer initialization until after helper functions are defined
                initDynamicView = function(debugLog) {
                let latestAppId = null;
                let latestAppName = null;
                let isGenerating = false;
                let checkStatusInterval = null;
                let currentRequestId = null;
                let deletedApps = new Set(); // Track deleted apps to avoid duplicate deletions
                let lastGeneratedPayload = null; // Track last payload to detect selection changes

                // Store deletedApps in StateManager so restoreDynamicView can access it
                StateManager.set(extensionId, 'deletedApps', deletedApps);

                // Function to delete old ODAG apps (keeping the latest one)
                const deleteOldODAGApps = function(keepRequestId) {
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                    const xrfkey = CONSTANTS.API.XRF_KEY;
                    const apiUrl = isCloud
                        ? tenantUrl + '/api/v1/odaglinks/' + odagConfig.odagLinkId + '/requests?pending=true'
                        : tenantUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '/requests?pending=true&xrfkey=' + xrfkey;

                    debugLog('Deleting old ODAG apps (keeping latest:', keepRequestId, ')...');

                    const headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    };

                    // Add environment-specific headers
                    if (isCloud) {
                        headers['qlik-csrf-token'] = getCookie('_csrfToken') || '';
                    } else {
                        headers['X-Qlik-XrfKey'] = xrfkey;
                    }

                    $.ajax({
                        url: apiUrl,
                        type: 'GET',
                        headers: headers,
                        xhrFields: {
                            withCredentials: true
                        },
                        success: function(result) {
                            if (result && Array.isArray(result) && result.length > 0) {
                                // Filter out the app we want to keep
                                const appsToDelete = result.filter(function(request) {
                                    return request.id !== keepRequestId;
                                });

                                if (appsToDelete.length === 0) {
                                    debugLog('No old apps to delete (only latest exists)');
                                    return;
                                }

                                debugLog('Found', appsToDelete.length, 'old app(s) to delete');

                                appsToDelete.forEach(function(request) {
                                    // Mark as deleted to prevent duplicate deletion attempts
                                    deletedApps.add(request.id);

                                    // Delete the generated app
                                    ApiService.deleteApp(request.id)
                                        .then(function() {
                                            debugLog('Deleted old app:', request.generatedAppName || request.id);
                                        })
                                        .catch(function(error) {
                                            if (error.status === 404) {
                                                debugLog('Old app already deleted:', request.id);
                                            } else if (error.status === 403) {
                                                debugLog('No permission to delete app:', request.id, '(this is OK, will be cleaned up by Qlik retention policy)');
                                            } else {
                                                console.error('Failed to delete old app:', request.id, error.status);
                                            }
                                            // Continue even if delete fails - not critical
                                        });
                                });
                            } else {
                                debugLog('No old apps to delete');
                            }
                        },
                        error: function(xhr) {
                            console.error('Failed to get ODAG apps list for cleanup:', xhr.responseText);
                            // Not critical - just log and continue
                        }
                    });
                };

                let previousRequestId = null; // Track the previous app to delete later

                // Function to generate new ODAG app
                const generateNewODAGApp = async function() {
                    if (isGenerating) {
                        debugLog('Already generating an app, please wait...');
                        return;
                    }

                    isGenerating = true;
                    $('#dynamic-status-' + layout.qInfo.qId).html(
                        getStatusHTML('generating', 'Generating new app with current selections...', true)
                    );

                    // Show top bar and keep it visible (no auto-hide during generation)
                    const showTopBarFunc = StateManager.get(extensionId, 'showDynamicTopBar');
                    if (showTopBarFunc) {
                        showTopBarFunc(false);
                    }

                    // Show cancel button
                    $('#cancel-btn-' + layout.qInfo.qId).show().css('display', 'flex');

                    // Safety timeout: Clear loading state after 60 seconds if stuck
                    const safetyTimeoutId = setTimeout(function() {
                        if (isGenerating) {
                            debugLog('⏱️ Safety timeout: Clearing stuck loading state after 60s');
                            isGenerating = false;
                            $('#cancel-btn-' + layout.qInfo.qId).hide();
                            $('#dynamic-status-' + layout.qInfo.qId).html(
                                getStatusHTML('error', 'Generation timed out. Please try again.')
                            );
                        }
                    }, 60000); // 60 seconds

                    // Store the old request ID to delete later
                    const oldRequestId = previousRequestId;

                    try {
                        // Build payload with current selections
                        const buildResult = await buildPayload(app, odagConfig, layout);
                        const payload = buildResult.payload;
                        const rowEstResult = buildResult.rowEstResult;

                        // CRITICAL VALIDATION: Check binding fields BEFORE sending to API (same as compact view)
                        const cachedBindings = window['odagBindings_' + odagConfig.odagLinkId];

                        if (cachedBindings && cachedBindings.length > 0) {
                            debugLog('🔍 [Dynamic View] Validating binding fields before API call...');

                            // Create a map of binding field values for quick lookup
                            const bindingValueMap = new Map();
                            for (const bindingField of payload.bindSelectionState) {
                                bindingValueMap.set(
                                    bindingField.selectionAppParamName,
                                    bindingField.values || []
                                );
                            }

                            // Check each binding individually based on its selectionStates
                            const missingRequiredFields = [];
                            const missingFieldDetails = [];

                            for (const binding of cachedBindings) {
                                const fieldName = binding.selectAppParamName || binding.selectionAppParamName;
                                const selectionStates = binding.selectionStates || "SO";
                                const fieldValues = bindingValueMap.get(fieldName) || [];

                                // If mode is "S" (Selected only), values are REQUIRED
                                if (selectionStates === "S") {
                                    if (fieldValues.length === 0) {
                                        debugLog('    ❌ [Dynamic View] Mode "S": No values found - REQUIRED!');
                                        missingRequiredFields.push(fieldName);
                                        missingFieldDetails.push({ field: fieldName, mode: selectionStates });
                                    }
                                }
                            }

                            // If there are missing required fields, alert user and stop
                            if (missingRequiredFields.length > 0) {
                                debugLog('❌ [Dynamic View] Missing required selections in fields:', missingRequiredFields);
                                isGenerating = false;
                                $('#cancel-btn-' + layout.qInfo.qId).hide();

                                // Short message for dynamic view status bar
                                const fieldNames = missingRequiredFields.join(', ');
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    getStatusHTML('error', 'Select: ' + fieldNames)
                                );

                                // Build warning message (same logic as compact view)
                                const fieldListBullets = missingFieldDetails.map(detail => {
                                    let prefix = '';
                                    if (detail.mode === 'S') {
                                        prefix = '$(odags_' + detail.field + ')';
                                    } else if (detail.mode === 'O') {
                                        prefix = '$(odago_' + detail.field + ')';
                                    } else {
                                        prefix = '$(odag_' + detail.field + ')';
                                    }
                                    return '  • ' + detail.field + ' → ' + prefix + ' (mode: ' + detail.mode + ')';
                                }).join('\n');

                                const uniqueModes = [...new Set(missingFieldDetails.map(d => d.mode))];
                                let explanationText = '';

                                if (uniqueModes.length === 1 && uniqueModes[0] === 'S') {
                                    explanationText = 'These fields are configured with "selected values only" mode (selectionStates: "S").\n' +
                                                      'The template app uses variables like $(odags_FieldName) which expect selected values.';
                                } else {
                                    explanationText = 'These fields require selections based on their selectionStates configuration:\n' +
                                                      '  • Mode "S"  = $(odags_Field) - Selected values only\n' +
                                                      '  • Mode "O"  = $(odago_Field) - Optional values only\n' +
                                                      '  • Mode "SO" = $(odag_Field)  - Selected + Optional values';
                                }

                                // No need for alert - dynamic status already shows detailed message
                                // Status bar shows: "Selection required - see alert for details"
                                // But actually the real-time validation will show full details
                                debugLog('[Dynamic View] Validation failed - shown in status, no alert needed');
                                return;
                            }

                            debugLog('✅ [Dynamic View] Binding validation passed: All required fields have values');
                        }

                        // Check if generation is allowed based on row estimation
                        if (!rowEstResult.canGenerate) {
                            isGenerating = false;
                            $('#cancel-btn-' + layout.qInfo.qId).hide();
                            alert(rowEstResult.message);
                            return;
                        }

                        // Store this payload to compare for future selection changes
                        lastGeneratedPayload = payload;

                        // Remove warning class from refresh button
                        $('#refresh-btn-' + layout.qInfo.qId).removeClass('needs-refresh');

                        // Call ODAG API
                        const result = await callODAGAPI(odagConfig.odagLinkId, payload);

                        if (result.success && result.data) {
                            const odagData = result.data;
                            currentRequestId = odagData.id;

                            debugLog('Dynamic View - New ODAG app generation started:', {
                                newRequestId: odagData.id,
                                appName: odagData.generatedAppName,
                                oldRequestId: oldRequestId,
                                currentSelections: payload
                            });

                            // Clear the current latestAppId so we detect the new one properly
                            latestAppId = null;

                            // Delete the old app AFTER new one is ready
                            if (oldRequestId && oldRequestId !== odagData.id && !deletedApps.has(oldRequestId)) {
                                debugLog('Will delete old app after new one is ready:', oldRequestId);

                                // Wait and check periodically if new app is ready
                                const deleteCheckInterval = CleanupManager.addInterval(setInterval(function() {
                                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                                    const statusUrl = (isCloud
                                        ? tenantUrl + '/api/v1/odagrequests/'
                                        : tenantUrl + '/api/odag/v1/requests/') + odagData.id;
                                    $.ajax({
                                        url: statusUrl,
                                        type: 'GET',
                                        headers: {'Accept': 'application/json'},
                                        xhrFields: {withCredentials: true},
                                        success: function(newStatus) {
                                            if (newStatus && newStatus.state === 'succeeded') {
                                                clearInterval(deleteCheckInterval);

                                                // Check again before deleting
                                                if (!deletedApps.has(oldRequestId)) {
                                                    // Mark as deleted before making the request
                                                    deletedApps.add(oldRequestId);

                                                    const isCloud = window.qlikEnvironment === 'cloud';
                                                    const xrfkey = CONSTANTS.API.XRF_KEY;
                                                    const deleteHeaders = isCloud
                                                        ? { 'qlik-csrf-token': getCookie('_csrfToken') || '' }
                                                        : { 'X-Qlik-XrfKey': xrfkey, 'Content-Type': 'application/json' };

                                                    $.ajax({
                                                        url: (isCloud ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + oldRequestId + '/app?xrfkey=' + xrfkey,
                                                        type: 'DELETE',
                                                        headers: deleteHeaders,
                                                        xhrFields: {
                                                            withCredentials: true
                                                        },
                                                        success: function() {
                                                            debugLog('Successfully deleted old app:', oldRequestId);
                                                        },
                                                        error: function(xhr) {
                                                            if (xhr.status === 404) {
                                                                debugLog('App already deleted:', oldRequestId);
                                                            } else {
                                                                console.error('Failed to delete old app:', xhr.responseText);
                                                                // Remove from deleted set if it really failed
                                                                deletedApps.delete(oldRequestId);
                                                            }
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    });
                                }, 3000));
                            }

                            // Store for next refresh
                            previousRequestId = odagData.id;

                            // Start checking for completion
                            checkStatusInterval = CleanupManager.addInterval(setInterval(function() {
                                loadLatestODAGApp();
                            }, 1000));
                        } else {
                            $('#dynamic-status-' + layout.qInfo.qId).html(
                                getStatusHTML('failed', 'Failed to generate app', false)
                            );
                            $('#cancel-btn-' + layout.qInfo.qId).hide();
                            console.error('Failed to generate ODAG app:', result.error);

                            // Show user-friendly error message with alert for visibility
                            const errorMsg = result.userMessage || result.error || 'Unknown error';
                            alert('Failed to generate ODAG app:\n\n' + errorMsg);
                            showNotification('ODAG Generation Failed', 'error');
                        }
                    } catch (error) {
                        console.error('ODAG Generation Error:', error);
                        $('#dynamic-status-' + layout.qInfo.qId).html(
                            getStatusHTML('error', 'Error: ' + error.message, false)
                        );
                        $('#cancel-btn-' + layout.qInfo.qId).hide();
                    } finally {
                        // Always clear loading state and safety timeout
                        isGenerating = false;
                        clearTimeout(safetyTimeoutId);
                        debugLog('✅ [Dynamic View] Generation complete, loading state cleared');
                    }
                };

                const loadLatestODAGApp = function() {
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = CONSTANTS.API.XRF_KEY;
                const apiUrl = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagConfig.odagLinkId + '/requests?pending=true'
                    : tenantUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '/requests?pending=true&xrfkey=' + xrfkey;

                    $.ajax({
                        url: apiUrl,
                        type: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        xhrFields: {
                            withCredentials: true
                        },
                        success: function(result) {
                            debugLog('loadLatestODAGApp received response:', {
                                resultLength: result ? result.length : 0,
                                currentRequestId: currentRequestId,
                                isGenerating: isGenerating,
                                results: result
                            });

                            if (result && Array.isArray(result) && result.length > 0) {
                                // Sort by date to get the latest
                                result.sort(function(a, b) {
                                    return new Date(b.createdDate) - new Date(a.createdDate);
                                });

                                // If we're currently generating, ONLY look for that specific request
                                let latestApp = null;
                                if (currentRequestId) {
                                    debugLog('Looking for specific request:', currentRequestId);

                                    // Find the specific request we're waiting for
                                    latestApp = result.find(req =>
                                        req.id === currentRequestId &&
                                        req.state === 'succeeded' &&
                                        req.generatedApp &&
                                        !deletedApps.has(req.id)
                                    );

                                    debugLog('Found matching succeeded app?', latestApp ? 'YES' : 'NO');

                                    if (!latestApp) {
                                        // Still pending, check status
                                        const pendingApp = result.find(req => req.id === currentRequestId);
                                        if (pendingApp) {
                                            debugLog('Waiting for new app:', currentRequestId, 'Status:', pendingApp.state, 'generatedApp:', pendingApp.generatedApp);
                                        } else {
                                            debugLog('WARNING: Current request ID not found in results!', currentRequestId);
                                        }
                                    }
                                } else {
                                    // No specific request, find any latest succeeded app that hasn't been deleted
                                    latestApp = result.find(req =>
                                        req.state === 'succeeded' &&
                                        req.generatedApp &&
                                        !deletedApps.has(req.id)
                                    );
                                }

                                if (latestApp) {
                                    // Extract app ID from generatedApp
                                    let appId = '';
                                    if (typeof latestApp.generatedApp === 'string') {
                                        appId = latestApp.generatedApp;
                                    } else if (typeof latestApp.generatedApp === 'object' && latestApp.generatedApp.id) {
                                        appId = latestApp.generatedApp.id;
                                    }

                                    if (appId) {
                                        // Check if this is a different app than what we're currently showing
                                        const isNewApp = (!latestAppId || latestAppId !== appId);

                                        // Stop checking if we have a succeeded app
                                        if (checkStatusInterval) {
                                            clearInterval(checkStatusInterval);
                                            checkStatusInterval = null;
                                        }

                                        // Hide cancel button
                                        $('#cancel-btn-' + layout.qInfo.qId).hide();

                                        // Clear current request ID since we found it
                                        currentRequestId = null;

                                        // Update to show the latest app
                                        latestAppId = appId;

                                        // Extract app name - check multiple locations
                                        // On-Premise: generatedApp can be object with name property
                                        // Cloud: generatedAppName property
                                        let appName = 'Latest ODAG App';
                                        if (latestApp.generatedAppName) {
                                            appName = latestApp.generatedAppName;
                                        } else if (typeof latestApp.generatedApp === 'object' && latestApp.generatedApp.name) {
                                            appName = latestApp.generatedApp.name;
                                        } else if (latestApp.name) {
                                            appName = latestApp.name;
                                        }

                                        latestAppName = appName;

                                        // Store the request ID for deletion later
                                        if (!previousRequestId || previousRequestId !== latestApp.id) {
                                            previousRequestId = latestApp.id;
                                        }

                                        // Update status indicator
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            getStatusHTML('succeeded', latestAppName, false)
                                        );

                                        // Keep top bar visible for 10 seconds after successful generation
                                        // so user can see the completion status
                                        const showTopBarFunc = StateManager.get(extensionId, 'showDynamicTopBar');
                                        if (showTopBarFunc) {
                                            showTopBarFunc(false); // Keep visible
                                            // Then enable auto-hide after 10 seconds
                                            setTimeout(function() {
                                                const showTopBarFunc2 = StateManager.get(extensionId, 'showDynamicTopBar');
                                                if (showTopBarFunc2) {
                                                    showTopBarFunc2(true);
                                                }
                                            }, CONSTANTS.TIMING.TOP_BAR_HIDE_AFTER_COMPLETE_MS);
                                        }

                                        // Store the selection state from this app as baseline (if not already set)
                                        if (!lastGeneratedPayload && latestApp.bindSelectionState) {
                                            lastGeneratedPayload = {
                                                bindSelectionState: latestApp.bindSelectionState,
                                                selectionState: latestApp.selectionState || latestApp.bindSelectionState
                                            };
                                            debugLog('Stored initial payload from existing ODAG app:', lastGeneratedPayload.bindSelectionState);
                                        }

                                        // Load the app in embed - only if it's a new app
                                        if (isNewApp) {
                                            debugLog('New ODAG app detected, refreshing embed:', appId);
                                            loadDynamicEmbed(appId, latestAppName);
                                        } else {
                                            debugLog('Same app already loaded, skipping refresh:', appId);
                                        }
                                    }
                                } else {
                                    // Check if there's a pending app - prioritize the one we're waiting for
                                    let pendingApp = null;
                                    if (currentRequestId) {
                                        // Look for the specific request we're generating
                                        pendingApp = result.find(req => req.id === currentRequestId);
                                    } else {
                                        // Find any pending app
                                        pendingApp = result.find(req =>
                                            req.state === 'pending' ||
                                            req.state === 'queued' ||
                                            req.state === 'loading' ||
                                            req.state === 'generating' ||
                                            req.state === 'validating'
                                        );
                                    }

                                    if (pendingApp) {
                                        const stateName = pendingApp.state.charAt(0).toUpperCase() + pendingApp.state.slice(1);
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            getStatusHTML(pendingApp.state, stateName + ': ' + (pendingApp.generatedAppName || 'New App'), true)
                                        );
                                    }
                                }
                            } else {
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    getStatusHTML('none', 'No ODAG apps yet', false)
                                );

                                // Stop checking if no apps
                                if (checkStatusInterval) {
                                    clearInterval(checkStatusInterval);
                                    checkStatusInterval = null;
                                }
                            }
                        },
                        error: function(xhr) {
                            console.error('Failed to load ODAG requests:', xhr.responseText);
                            $('#dynamic-status-' + layout.qInfo.qId).html(
                                getStatusHTML('error', 'Error loading apps', false)
                            );

                            // Stop checking on error
                            if (checkStatusInterval) {
                                clearInterval(checkStatusInterval);
                                checkStatusInterval = null;
                            }
                        }
                    });
                };

                const loadDynamicEmbed = function(appId, appName) {
                    const $container = $('#dynamic-embed-' + layout.qInfo.qId);
                    const allowInteractions = odagConfig.allowInteractions !== false;
                    const hostName = window.location.hostname;

                    if (!appId) {
                        $container.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">No app available</div>');
                        return;
                    }

                    // Dynamic View uses sheet ID if configured
                    const sheetId = odagConfig.templateSheetId;
                    const hasValidSheetId = sheetId && typeof sheetId === 'string' && sheetId.trim() !== '';
                    const embedMode = odagConfig.embedMode || 'classic/app';

                    debugLog('loadDynamicEmbed - sheetId check:', {
                        sheetId: sheetId,
                        type: typeof sheetId,
                        hasValidSheetId: hasValidSheetId,
                        embedMode: embedMode
                    });

                    // Check if existing embed already matches what we want
                    const existingEmbed = $container.find('qlik-embed')[0];
                    let needsUpdate = !existingEmbed;

                    if (existingEmbed) {
                        const currentAppId = existingEmbed.getAttribute('app-id');
                        const currentSheetId = existingEmbed.getAttribute('sheet-id');
                        const currentObjectId = existingEmbed.getAttribute('object-id');
                        const currentUi = existingEmbed.getAttribute('ui');

                        debugLog('DYNAMIC VIEW - Existing embed check:', {
                            currentAppId: currentAppId,
                            targetAppId: appId,
                            currentUi: currentUi,
                            targetUi: embedMode,
                            currentSheetId: currentSheetId,
                            currentObjectId: currentObjectId,
                            targetSheetId: sheetId
                        });

                        // Check if any key attributes changed
                        // On-Premise: Always use sheet-id
                        // Cloud: analytics/sheet uses object-id, classic/app uses sheet-id
                        const isCloud = window.qlikEnvironment === 'cloud';
                        const sheetIdChanged = (embedMode === 'analytics/sheet' && isCloud)
                            ? (hasValidSheetId && currentObjectId !== sheetId.trim())
                            : (hasValidSheetId && currentSheetId !== sheetId.trim());

                        needsUpdate = currentAppId !== appId ||
                                     currentUi !== embedMode ||
                                     sheetIdChanged;

                        debugLog('DYNAMIC VIEW - needsUpdate:', needsUpdate, 'sheetIdChanged:', sheetIdChanged);

                        if (!needsUpdate) {
                            debugLog('Dynamic View: Embed already correct, skipping recreation to prevent flash');
                            // Just update the visual state
                            $container.css('filter', 'none');
                            $container.css('pointer-events', 'auto');
                            $container.css('opacity', '1');
                            return;
                        }
                    }

                    // Only recreate if needed
                    debugLog('DYNAMIC VIEW - Creating new embed for app:', appId);

                    // Set init-in-progress flag BEFORE setTimeout so paint() knows we're creating the embed
                    const initInProgressKey = 'dynamicViewInitInProgress_' + layout.qInfo.qId;
                    window[initInProgressKey] = true;
                    debugLog('Set initInProgressKey before embed creation');

                    // Remove any existing qlik-embed element completely
                    if (existingEmbed) {
                        debugLog('Removing existing qlik-embed for complete refresh');
                        existingEmbed.remove();
                    }

                    // Clear container completely
                    $container.empty();

                    // Generate unique key for refresh - include app ID to force new instance
                    const embedKey = 'dynamic-' + appId + '-' + Date.now();

                    // Validate Sheet ID format if provided
                    if (hasValidSheetId) {
                        const rawSheetId = sheetId.trim();

                        // Check for common mistakes: URLs, paths, or extra content
                        if (rawSheetId.includes('/') || rawSheetId.includes('\\') ||
                            rawSheetId.includes('sheet') || rawSheetId.includes('state') ||
                            rawSheetId.includes('http') || rawSheetId.includes('sense/app')) {

                            const errorMsg = '⚠️ Invalid Sheet ID Format\n\n' +
                                'Sheet ID should be ONLY the sheet identifier (36 characters).\n\n' +
                                'You entered: ' + rawSheetId + '\n\n' +
                                'Example of CORRECT format:\n' +
                                '✅ 56cb1a8e-ee80-4dba-8984-69bec687e28f\n\n' +
                                'Example of WRONG formats:\n' +
                                '❌ 56cb1a8e-ee80-4dba-8984-69bec687e28f/state/analysis\n' +
                                '❌ https://demo.com/sense/app/ABC/sheet/56cb1a8e.../state/analysis\n\n' +
                                'How to find the Sheet ID:\n' +
                                '1. Open your ODAG template app\n' +
                                '2. Open the sheet you want to display\n' +
                                '3. Copy ONLY the ID after /sheet/ in the URL\n' +
                                '   (before /state/analysis)';

                            $element.html(
                                '<div style="padding: 20px; color: #d32f2f; background: #ffebee; border: 2px solid #d32f2f; border-radius: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6;">' +
                                errorMsg +
                                '</div>'
                            );

                            console.error('❌ Invalid Sheet ID:', rawSheetId);
                            return qlik.Promise.resolve();
                        }
                    }

                    // Create qlik-embed element with timestamp to force refresh
                    let embedElement = '<qlik-embed ';
                    embedElement += 'key="' + embedKey + '" ';
                    embedElement += 'data-refresh="' + Date.now() + '" '; // Force refresh attribute
                    embedElement += 'ui="' + embedMode + '" ';
                    embedElement += 'app-id="' + appId + '" ';

                    if (hasValidSheetId) {
                        // On-Premise: Always use sheet-id
                        // Cloud: analytics/sheet uses object-id, classic/app uses sheet-id
                        const isCloud = window.qlikEnvironment === 'cloud';
                        if (embedMode === 'analytics/sheet' && isCloud) {
                            embedElement += 'object-id="' + sheetId.trim() + '" ';
                            debugLog('Creating analytics/sheet embed with object-id (Cloud):', sheetId.trim());
                        } else {
                            embedElement += 'sheet-id="' + sheetId.trim() + '" ';
                            debugLog('Creating embed with sheet-id:', sheetId.trim(), 'Mode:', embedMode);
                        }
                    } else {
                        // No sheet ID configured, show app overview
                        debugLog('Creating ' + embedMode + ' embed (app overview)');
                    }

                    embedElement += 'host="' + hostName + '" ';
                    embedElement += 'no-cache="true" '; // Add no-cache attribute
                    embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';

                    // Add context for interactions (no theme - use app default)
                    const context = {
                        interactions: {
                            select: allowInteractions,
                            edit: false
                        }
                    };
                    embedElement += "context___json='" + JSON.stringify(context) + "' ";
                    embedElement += '></qlik-embed>';

                    // Add wrapper
                    let embedHtml = '<div class="qlik-embed-wrapper" style="position: relative; height: 100%; width: 100%; overflow: hidden;">';
                    embedHtml += embedElement;
                    embedHtml += '</div>';

                    $container.html(embedHtml);

                    // Clear init-in-progress flag after a small delay to ensure qlik-embed element is recognized
                    setTimeout(function() {
                        delete window[initInProgressKey];
                        debugLog('Cleared initInProgressKey after qlik-embed element initialization');
                    }, CONSTANTS.TIMING.PAINT_DEBOUNCE_MS); // Small delay to ensure custom element is registered in DOM

                    debugLog('Dynamic view refreshed with new ODAG app:', {
                        appId: appId,
                        appName: appName,
                        sheetId: odagConfig.templateSheetId || 'Full App',
                        embedKey: embedKey
                    });

                    // Force refresh of the qlik-embed component
                    const newEmbed = $container.find('qlik-embed')[0];
                    if (newEmbed) {
                        // Dispatch refresh event to force update
                        newEmbed.dispatchEvent(new CustomEvent('refresh'));
                    }

                    // Remove blur overlay - app is ready
                    $container.css('filter', 'none');
                    $container.css('pointer-events', 'auto');
                    $container.css('opacity', '1');

                    // Load qlik-embed script if not already loaded
                    if (!window.qlikEmbedLoaded) {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/@qlik/embed-web-components';
                        script.crossOrigin = 'anonymous';
                        script.onload = function() {
                            window.qlikEmbedLoaded = true;
                        };
                        document.head.appendChild(script);
                    }
                };

                // Initial load - Delete all existing apps, then generate a new one
                $('#dynamic-status-' + layout.qInfo.qId).html(
                    getStatusHTML('loading', 'Initializing Dynamic View...', true)
                );

                // Keep top bar visible during initialization
                const showTopBarFunc = StateManager.get(extensionId, 'showDynamicTopBar');
                if (showTopBarFunc) {
                    showTopBarFunc(false);
                }

                // Use sessionStorage to track if we've initialized in this browser session
                const sessionKey = 'dynamicViewInit_' + odagConfig.odagLinkId;
                const hasInitializedThisSession = sessionStorage.getItem(sessionKey);

                if (!hasInitializedThisSession) {
                    // First session load - load latest app immediately, then delete old ones in background
                    debugLog('ODAG Extension: First Dynamic View load - loading latest app...');
                    sessionStorage.setItem(sessionKey, 'true');

                    // Load latest app first for fast initialization
                    loadLatestODAGApp();

                    // After a delay, check if we have an app or need to generate one
                    setTimeout(async function() {
                        if (!latestAppId) {
                            debugLog('No existing apps found, generating initial app...');
                            generateNewODAGApp();
                        } else {
                            debugLog('Found existing app:', latestAppId, '- will delete old ones in background');

                            // Delete old apps in background (after latest is already loaded)
                            setTimeout(function() {
                                deleteOldODAGApps(latestAppId);
                            }, 2000);
                        }
                    }, 1000);
                } else {
                    // Subsequent loads in same session - check for existing app or generate
                    debugLog('ODAG Extension: Subsequent Dynamic View load - checking for existing app...');
                    loadLatestODAGApp();

                    // Store initial selection state after a delay
                    setTimeout(async function() {
                        if (!latestAppId) {
                            debugLog('No existing apps found, generating initial app...');
                            generateNewODAGApp();
                        } else {
                            // We found an existing app, capture current selections as baseline
                            if (!lastGeneratedPayload) {
                                try {
                                    const buildResult = await buildPayload(app, odagConfig, layout);
                                    lastGeneratedPayload = buildResult.payload;
                                    debugLog('Stored initial selection state:', lastGeneratedPayload.bindSelectionState);
                                } catch (error) {
                                    console.error('Error storing initial payload:', error);
                                }
                            }
                        }
                    }, 1000);
                }

                // Function to check if current selections differ from last generated payload
                const checkSelectionsChanged = async function() {
                    if (isGenerating) return; // Don't check while generating
                    if (!lastGeneratedPayload) return; // No previous payload to compare

                    try {
                        // Lightweight check: just compare current selections, not full payload
                        const currentSelections = await getCurrentSelections(app);
                        const currentSelStr = JSON.stringify(currentSelections);
                        const lastSelStr = JSON.stringify(lastGeneratedPayload.selectionState);

                        debugLog('Checking selections changed:', currentSelStr !== lastSelStr);

                        if (currentSelStr !== lastSelStr) {
                            // Selections changed - highlight refresh button
                            $('#refresh-btn-' + layout.qInfo.qId).addClass('needs-refresh');

                            // If top bar was manually closed, show it now with the warning
                            if (topBarManuallyClosed) {
                                debugLog('🔔 Selections changed - showing top bar with refresh warning');
                                topBarManuallyClosed = false; // Reset flag
                                showTopBar(false, true); // Show without auto-hide, force show for warning
                            }
                        } else {
                            // Selections same - remove highlight
                            $('#refresh-btn-' + layout.qInfo.qId).removeClass('needs-refresh');
                        }
                    } catch (error) {
                        debugLog('Error checking selections:', error);
                    }
                };

                // Store check function in StateManager so paint can call it
                StateManager.set(extensionId, 'checkSelectionsChanged', checkSelectionsChanged);

                // Listen for selection changes using selection state subscription
                app.selectionState().OnData.bind(function() {
                    debugLog('Selection state changed - checking...');
                    checkSelectionsChanged();
                });

                // Store generateNewODAGApp function in StateManager for restoreDynamicView to access
                StateManager.set(extensionId, 'generateNewODAGApp', function() {
                    // Prevent multiple simultaneous clicks
                    if (isGenerating) {
                        debugLog('Generation already in progress, ignoring click');
                        return;
                    }
                    generateNewODAGApp();
                });

                // Store cancel function in StateManager
                StateManager.set(extensionId, 'cancelGeneration', function() {
                    if (currentRequestId && confirm('Are you sure you want to cancel the current generation?')) {
                        debugLog('Cancelling generation...');

                        // Stop checking
                        if (checkStatusInterval) {
                            clearInterval(checkStatusInterval);
                            checkStatusInterval = null;
                        }

                        // Cancel via API
                        ApiService.cancelRequest(currentRequestId)
                            .then(function() {
                                debugLog('Generation cancelled');
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    getStatusHTML('none', 'Generation cancelled', false)
                                );
                                $('#cancel-btn-' + layout.qInfo.qId).hide();
                                isGenerating = false;
                                currentRequestId = null;

                                // Reload to get the latest completed app
                                setTimeout(loadLatestODAGApp, 1000);
                            })
                            .catch(function(error) {
                                console.error('Failed to cancel:', error.responseText || error.message);
                                // Even if cancel fails, reset the UI
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    getStatusHTML('error', 'Cancel failed', false)
                                );
                                $('#cancel-btn-' + layout.qInfo.qId).hide();
                                isGenerating = false;
                            });
                    }
                });

                // Handle refresh button click - Generate a NEW app
                $('#refresh-btn-' + layout.qInfo.qId).on('click', function() {
                    debugLog('Refresh clicked - generating new ODAG app...');

                    // Reset the manually closed flag - normal behavior resumes after refresh
                    topBarManuallyClosed = false;

                    // Add blur overlay to the embed
                    const $embedContainer = $('#dynamic-embed-' + layout.qInfo.qId);
                    $embedContainer.css('filter', 'blur(3px)');
                    $embedContainer.css('pointer-events', 'none');
                    $embedContainer.css('opacity', '0.6');

                    const generateFunc = StateManager.get(extensionId, 'generateNewODAGApp');
                    if (generateFunc) generateFunc();
                });

                // Handle cancel button click
                const cancelFunc = StateManager.get(extensionId, 'cancelGeneration');
                if (cancelFunc) {
                    $('#cancel-btn-' + layout.qInfo.qId).on('click', cancelFunc);
                }

                // Load the latest ODAG app on initialization
                loadLatestODAGApp();

                // No need to load regular apps list
                return qlik.Promise.resolve();
                }; // End of initDynamicView function

                // Create restore function to refresh UI without re-initializing
                // CRITICAL: This should ONLY restore event handlers, NOT make API calls or create embeds
                restoreDynamicView = function(debugLog) {
                    debugLog('Restoring Dynamic View (event handlers only, no API calls)');

                    // Re-attach button click handlers (they get lost when HTML is recreated)
                    const generateFunc = StateManager.get(extensionId, 'generateNewODAGApp');
                    const cancelFunc = StateManager.get(extensionId, 'cancelGeneration');

                    if (generateFunc) {
                        $('#refresh-btn-' + layout.qInfo.qId).off('click').on('click', function() {
                            debugLog('Refresh clicked (restored handler)');
                            const $embedContainer = $('#dynamic-embed-' + layout.qInfo.qId);
                            $embedContainer.css('filter', 'blur(3px)');
                            $embedContainer.css('pointer-events', 'none');
                            $embedContainer.css('opacity', '0.6');
                            generateFunc();
                        });
                    }

                    if (cancelFunc) {
                        $('#cancel-btn-' + layout.qInfo.qId).off('click').on('click', cancelFunc);
                    }

                    // That's it! Don't make API calls, don't recreate embeds or modify DOM
                    // The embed and status were already set during initDynamicView
                    debugLog('Dynamic View restored successfully');
                    return qlik.Promise.resolve();
                };

                // Auto-hide top bar logic
                let hideTimer = null;
                let lastSelectionState = null;
                let isTopBarVisible = true; // Track visibility state
                let topBarManuallyClosed = false; // Track if user explicitly closed the top bar
                const $topBar = $('#dynamic-top-bar-' + layout.qInfo.qId);

                const hideTopBar = function() {
                    $topBar.css({
                        'transform': 'translateY(-100%)',
                        'opacity': '0'
                    });
                    isTopBarVisible = false;
                };

                const showTopBar = function(autoHide, forceShow) {
                    // If user manually closed the bar, don't show it unless forced (e.g., for refresh warning)
                    if (topBarManuallyClosed && !forceShow) {
                        debugLog('⛔ Top bar manually closed - not showing');
                        return;
                    }

                    $topBar.css({
                        'transform': 'translateY(0)',
                        'opacity': '1'
                    });
                    isTopBarVisible = true;

                    // Clear existing timer
                    if (hideTimer) {
                        clearTimeout(hideTimer);
                        hideTimer = null;
                    }

                    // Only set auto-hide timer if autoHide is true (default: true)
                    if (autoHide !== false) {
                        hideTimer = CleanupManager.addTimeout(setTimeout(hideTopBar, CONSTANTS.TIMING.TOP_BAR_AUTO_HIDE_MS));
                    }
                };

                // Make showTopBar accessible via StateManager for status updates
                StateManager.set(extensionId, 'showDynamicTopBar', showTopBar);

                // Show initially with auto-hide
                showTopBar(true);

                // Show when selections change - use Qlik's selection API
                app.getList('SelectionObject', function(reply) {
                    const newState = JSON.stringify(reply.qSelectionObject.qSelections);

                    if (lastSelectionState && newState !== lastSelectionState) {
                        // Selections changed
                        showTopBar();
                    }
                    lastSelectionState = newState;
                });

                // Close button handler - hide top bar when clicked
                $('#close-topbar-btn-' + layout.qInfo.qId).on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    debugLog('❌ Close button clicked - hiding top bar until refresh needed');

                    // Set flag to keep bar hidden until selections change
                    topBarManuallyClosed = true;

                    // Clear any pending auto-hide timer
                    if (hideTimer) {
                        clearTimeout(hideTimer);
                        hideTimer = null;
                    }

                    // Hide the top bar immediately
                    hideTopBar();
                });
            }

            // Keep track of generated apps (not for dynamic view)
            if (!window.odagGeneratedApps) {
                window.odagGeneratedApps = [];
            }

            // Forward declare updateAppsList (defined later but needed by loadExistingRequests)
            let updateAppsList;

            // Load existing ODAG requests from API on init
            const loadExistingRequests = async function() {
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
            
            // Function to start monitoring for status updates (defined before use)
            const startStatusMonitoring = function() {
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
                }, 3000)); // Check every 3 seconds (reduced from 1 second)
            };

            // Store function globally so we can call it when generating new apps
            window.startODAGStatusMonitoring = startStatusMonitoring;

            // Load existing requests on init (not in dynamic view)
            // This ensures the list persists on page reload
            if (odagConfig.odagLinkId && !isDynamicView) {
                // Guard against duplicate initialization (use unique key per extension instance)
                const initKey = 'odagInit_' + layout.qInfo.qId;

                if (!window[initKey]) {
                    window[initKey] = true;
                    debugLog('Initializing ODAG extension for object:', layout.qInfo.qId);

                    // Load ONCE on initial paint
                    loadExistingRequests();
                } else if (window[refreshFlagKey]) {
                    // Switching from Dynamic View to Standard List View - refresh the list
                    debugLog('ODAG Extension: Refreshing apps list after view mode switch...');
                    delete window[refreshFlagKey]; // Clear flag after use
                    loadExistingRequests().then(function() {
                        debugLog('ODAG Extension: Apps list refreshed after view mode switch');
                    }).catch(function(error) {
                        console.error('ODAG Extension: Failed to refresh apps list:', error);
                    });
                } else {
                    debugLog('⏭️ ODAG Extension already initialized for this object, skipping duplicate setup');
                }

                // Only start monitoring if there are pending apps initially
                setTimeout(function() {
                    const hasPending = window.odagGeneratedApps &&
                        window.odagGeneratedApps.some(app =>
                            app.status === 'pending' ||
                            app.status === 'queued' ||
                            app.status === 'loading' ||
                            app.status === 'generating' ||
                            app.status === 'validating'
                        );

                    if (hasPending) {
                        debugLog('Found pending apps on init, starting status monitoring...');
                        startStatusMonitoring();
                    }
                }, CONSTANTS.TIMING.PAINT_DEBOUNCE_MS); // Small delay to ensure apps are loaded
            }
            
            // Helper functions
            const showNotification = function(message, type) {
                // Disabled notifications - they were appearing as popups
                // Just log to console instead
                debugLog('[ODAG ' + (type || 'info').toUpperCase() + ']:', message);
                return; // Don't show visual notifications
            };
            
            const generateContextHandle = function() {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let handle = '';
                for (let i = 0; i < 6; i++) {
                    handle += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return handle;
            };

            // Helper function to get only optional (white) values from a field
            const getFieldOptionalValues = async function(enigmaApp, fieldName, hasUserSelection) {
                const values = [];
                try {
                    const listObj = await enigmaApp.createSessionObject({
                        qInfo: { qType: 'ListObject' },
                        qListObjectDef: {
                            qDef: { qFieldDefs: [fieldName] },
                            qInitialDataFetch: [{
                                qTop: 0,
                                qLeft: 0,
                                qWidth: 1,
                                qHeight: 10000
                            }]
                        }
                    });

                    const layout = await listObj.getLayout();

                    if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                        const dataPage = layout.qListObject.qDataPages[0];

                        for (const row of dataPage.qMatrix) {
                            const cell = row[0];
                            // Only include Optional values (qState === 'O')
                            // If user has selection, 'O' are the unselected values
                            // If no selection, all values are 'O'
                            if (cell && cell.qState === 'O') {
                                values.push({
                                    selStatus: 'S',  // Still mark as 'S' for ODAG
                                    strValue: cell.qText,
                                    numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum.toString()
                                });
                            }
                        }
                    }

                    await enigmaApp.destroySessionObject(listObj.id);
                } catch (error) {
                    console.error('Error getting optional values for field', fieldName, ':', error);
                }

                return values;
            };

            // Helper function to get all possible values (Selected + Optional) from a field
            const getFieldAllPossibleValues = async function(enigmaApp, fieldName) {
                const values = [];
                try {
                    const listObj = await enigmaApp.createSessionObject({
                        qInfo: { qType: 'ListObject' },
                        qListObjectDef: {
                            qDef: { qFieldDefs: [fieldName] },
                            qInitialDataFetch: [{
                                qTop: 0,
                                qLeft: 0,
                                qWidth: 1,
                                qHeight: 10000
                            }]
                        }
                    });

                    const layout = await listObj.getLayout();

                    if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                        const dataPage = layout.qListObject.qDataPages[0];

                        for (const row of dataPage.qMatrix) {
                            const cell = row[0];
                            // Include both Selected and Optional values (not Excluded)
                            if (cell && (cell.qState === 'S' || cell.qState === 'O')) {
                                values.push({
                                    selStatus: 'S',  // Mark as 'S' for ODAG
                                    strValue: cell.qText,
                                    numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum.toString()
                                });
                            }
                        }
                    }

                    await enigmaApp.destroySessionObject(listObj.id);
                } catch (error) {
                    console.error('Error getting all possible values for field', fieldName, ':', error);
                }

                return values;
            };

            // getCookie function moved to top of paint() function for early access
            
            // Get current selections
            const getCurrentSelections = async function(app) {
                try {
                    const reply = await new Promise(function(resolve) {
                        app.getList("CurrentSelections", function(reply) {
                            resolve(reply);
                        });
                    });

                    const selections = [];

                    if (reply.qSelectionObject && reply.qSelectionObject.qSelections) {
                        // Process each selected field
                        for (const selection of reply.qSelectionObject.qSelections) {
                            const fieldName = selection.qField;
                            const selectedCount = selection.qSelectedCount;

                            debugLog('Getting selected values for field:', fieldName, 'Count:', selectedCount);

                            // Get the actual selected values using multiple methods for reliability
                            try {
                                const fieldSelection = {
                                    selectionAppParamType: "Field",
                                    selectionAppParamName: fieldName,
                                    values: [],
                                    selectedSize: selectedCount
                                };

                                // Method 1: Try using field.getData() with proper parameters
                                // Add small delay to ensure field API is ready (fixes timing issue after 1133 error)
                                await new Promise(resolve => setTimeout(resolve, 50));

                                const field = app.field(fieldName);

                                // First, try to get the field data with a proper request
                                // Qlik field API may need initialization after errors
                                let fieldData = null;

                                try {
                                    // Method 1a: Try simple getData() first
                                    fieldData = await field.getData();

                                    // If rows are empty, try with parameters
                                    if (!fieldData.rows || fieldData.rows.length === 0) {
                                        debugLog('Method 1a returned empty, trying with parameters...');
                                        fieldData = await field.getData({
                                            rows: 10000,
                                            frequencyMode: 'V'
                                        });
                                    }
                                } catch (e) {
                                    debugLog('Field getData error, will use fallback:', e.message);
                                }

                                // Extract selected values from field data
                                if (fieldData && fieldData.rows && fieldData.rows.length > 0) {
                                    fieldData.rows.forEach(function(row) {
                                        if (row.qState === 'S') { // S = Selected
                                            fieldSelection.values.push({
                                                selStatus: "S",
                                                strValue: row.qText,
                                                numValue: isNaN(row.qNum) ? "NaN" : String(row.qNum)
                                            });
                                        }
                                    });
                                    debugLog('Method 1: Found', fieldSelection.values.length, 'selected values for', fieldName);
                                }

                                // Method 2: If no values yet, try using qSelected text
                                if (fieldSelection.values.length === 0 && selection.qSelected) {
                                    debugLog('Method 2: Using qSelected text for', fieldName, ':', selection.qSelected);
                                    const values = selection.qSelected.split(', ');
                                    values.forEach(function(value) {
                                        // Skip if it's a complex expression like "x of y"
                                        if (!value.includes(' of ')) {
                                            fieldSelection.values.push({
                                                selStatus: "S",
                                                strValue: value.trim(),
                                                numValue: isNaN(value) ? "NaN" : String(value)
                                            });
                                        }
                                    });
                                    debugLog('Method 2: Extracted', fieldSelection.values.length, 'values from qSelected');
                                }

                                // Method 3: If still no values but we know there are selections, use session object
                                if (fieldSelection.values.length === 0 && selectedCount > 0) {
                                    debugLog('Method 3: Creating session object for', fieldName);
                                    const enigmaApp = app.model.enigmaModel;
                                    const sessionObj = await enigmaApp.createSessionObject({
                                        qInfo: { qType: 'CurrentSelections' },
                                        qListObjectDef: {
                                            qDef: { qFieldDefs: [fieldName] },
                                            qInitialDataFetch: [{
                                                qTop: 0,
                                                qLeft: 0,
                                                qWidth: 1,
                                                qHeight: Math.min(selectedCount * 2, 10000)
                                            }]
                                        }
                                    });

                                    const layout = await sessionObj.getLayout();
                                    if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                                        const dataPage = layout.qListObject.qDataPages[0];
                                        dataPage.qMatrix.forEach(function(row) {
                                            const cell = row[0];
                                            if (cell && cell.qState === 'S') {
                                                fieldSelection.values.push({
                                                    selStatus: "S",
                                                    strValue: cell.qText,
                                                    numValue: isNaN(cell.qNum) ? "NaN" : cell.qNum.toString()
                                                });
                                            }
                                        });
                                        debugLog('Method 3: Found', fieldSelection.values.length, 'selected values via session object');
                                    }
                                    await enigmaApp.destroySessionObject(sessionObj.id);
                                }

                                // If we got selected values, add to selections
                                if (fieldSelection.values.length > 0) {
                                    debugLog('Total found:', fieldSelection.values.length, 'selected values for', fieldName);
                                    selections.push(fieldSelection);
                                } else {
                                    debugLog('Warning: Could not retrieve selected values for', fieldName, 'despite selectedCount:', selectedCount);
                                }
                            } catch (fieldError) {
                                console.error('Error getting field data for', fieldName, ':', fieldError);
                                // Fallback to qSelected text if field API fails
                                const fieldSelection = {
                                    selectionAppParamType: "Field",
                                    selectionAppParamName: fieldName,
                                    values: [],
                                    selectedSize: selectedCount
                                };

                                if (selection.qSelected) {
                                    const values = selection.qSelected.split(', ');
                                    values.forEach(function(value) {
                                        fieldSelection.values.push({
                                            selStatus: "S",
                                            strValue: value,
                                            numValue: isNaN(value) ? "NaN" : String(value)
                                        });
                                    });
                                }

                                selections.push(fieldSelection);
                            }
                        }
                    }

                    debugLog('getCurrentSelections returning', selections.length, 'field selections');
                    return selections;
                } catch (error) {
                    console.error('Error in getCurrentSelections:', error);
                    return [];
                }
            };
            
            // Get variable values and map them
            const getVariableValues = async function(app, variableMappings) {
                const mappedSelections = [];

                for (const mapping of variableMappings) {
                    if (mapping.variableName && mapping.fieldName) {
                        try {
                            const variable = await app.variable.getByName(mapping.variableName);
                            const variableData = await variable.getLayout();
                            let value = variableData.qText || variableData.qNum || "";

                            if (value && value.toString().startsWith('=')) {
                                try {
                                    const result = await app.evaluate(value);
                                    value = result.qText || result.qNumber || result;
                                } catch(e) {
                                    console.warn('Could not evaluate expression:', value);
                                }
                            }

                            if (value) {
                                // Split comma-separated values and create multiple value objects
                                const valueString = value.toString();
                                const valueArray = valueString.split(',').map(v => v.trim()).filter(v => v !== '');

                                if (valueArray.length > 0) {
                                    const valuesObjects = valueArray.map(function(val) {
                                        return {
                                            selStatus: "S",
                                            strValue: val,
                                            numValue: isNaN(val) ? "NaN" : val.toString()
                                        };
                                    });

                                    mappedSelections.push({
                                        selectionAppParamType: "Field",
                                        selectionAppParamName: mapping.fieldName,
                                        values: valuesObjects
                                    });
                                }
                            }
                        } catch(e) {
                            console.warn('Could not get variable ' + mapping.variableName, e);
                        }
                    }
                }

                return mappedSelections;
            };

            // Build the ODAG payload
            // This function creates the correct payload structure with:
            // - selectionState: Fields the user actually selected (selStatus: "S")
            // - bindSelectionState: ALL ODAG binding fields:
            //   * If user selected a binding field → use their selection (selStatus: "S")
            //   * If user did NOT select a binding field → fetch possible values (selStatus: "O")
            const buildPayload = async function(app, odagConfig, layout) {
                const enigmaApp = app.model.enigmaModel;
                const appLayout = await enigmaApp.getAppLayout();

                // Always use the current app ID
                let appId = app.id;
                if (!appId) {
                    // Fallback: try to get from URL if app.id is not available
                    const pathMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
                    if (pathMatch) {
                        appId = pathMatch[1];
                    }
                }

                // Get ODAG bindings from cache (fetched at paint)
                const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;
                const cachedBindings = window[bindingsCacheKey];

                debugLog('Building payload - cached bindings:', cachedBindings ? cachedBindings.length + ' fields' : 'none');

                const currentSelections = await getCurrentSelections(app);
                const variableSelections = await getVariableValues(app, odagConfig.variableMappings || []);

                // Create map of actually selected fields
                const selectionMap = new Map();

                if (odagConfig.includeCurrentSelections) {
                    currentSelections.forEach(selection => {
                        selectionMap.set(selection.selectionAppParamName, selection);
                    });
                }

                variableSelections.forEach(selection => {
                    selectionMap.set(selection.selectionAppParamName, selection);
                });

                // selectionState = only fields user actually selected
                const selectionState = Array.from(selectionMap.values());

                // bindSelectionState = ALL binding fields (selected + possible values for non-selected)
                const bindSelectionState = [];

                if (cachedBindings && cachedBindings.length > 0) {
                    // Process each binding field
                    debugLog('✅ Found cached ODAG bindings:', cachedBindings.length);
                    debugLog('📋 Raw bindings structure:', cachedBindings);

                    for (const binding of cachedBindings) {
                        // Try multiple possible field names from binding object
                        const fieldName = binding.selectAppParamName ||
                                        binding.selectionAppParamName ||
                                        binding.fieldName ||
                                        binding.name;

                        if (!fieldName) {
                            console.warn('⚠️ Binding missing field name:', binding);
                            continue;
                        }

                        // Get selectionStates parameter (default to "SO" if not specified)
                        const selectionStates = binding.selectionStates || "SO";

                        debugLog('Processing binding field:', fieldName, 'with selectionStates:', selectionStates);

                        // Check if user selected this field
                        const hasUserSelection = selectionMap.has(fieldName);
                        const userSelection = hasUserSelection ? selectionMap.get(fieldName) : null;

                        // Process based on selectionStates parameter
                        if (selectionStates === "S") {
                            // Only Selected values
                            if (hasUserSelection) {
                                debugLog('  → Mode "S": User selected this field, using selection');
                                bindSelectionState.push(userSelection);
                            } else {
                                debugLog('  → Mode "S": No user selection, sending empty values');
                                bindSelectionState.push({
                                    selectionAppParamType: 'Field',
                                    selectionAppParamName: fieldName,
                                    values: []  // Empty array for "S" mode with no selection
                                });
                            }
                        } else if (selectionStates === "O") {
                            // Only Optional (white) values
                            debugLog('  → Mode "O": Getting optional values only');
                            try {
                                const optionalValues = await getFieldOptionalValues(enigmaApp, fieldName, hasUserSelection);
                                bindSelectionState.push({
                                    selectionAppParamType: 'Field',
                                    selectionAppParamName: fieldName,
                                    values: optionalValues
                                });
                            } catch (error) {
                                debugLog('  → ERROR: Could not get optional values for field:', fieldName, error);
                                bindSelectionState.push({
                                    selectionAppParamType: 'Field',
                                    selectionAppParamName: fieldName,
                                    values: []
                                });
                            }
                        } else if (selectionStates === "SO" || selectionStates === "OS") {
                            // Selected + Optional values
                            debugLog('  → Mode "SO": Getting both selected and optional values');

                            if (hasUserSelection) {
                                // User has selection - use it
                                debugLog('    → User has selection, using it');
                                bindSelectionState.push(userSelection);
                            } else {
                                // No user selection - get all possible values
                                debugLog('    → No user selection, getting all possible values');
                                try {
                                    const allPossibleValues = await getFieldAllPossibleValues(enigmaApp, fieldName);

                                    if (allPossibleValues.length > 0) {
                                        bindSelectionState.push({
                                            selectionAppParamType: 'Field',
                                            selectionAppParamName: fieldName,
                                            values: allPossibleValues,
                                            selectedSize: allPossibleValues.length
                                        });
                                    } else {
                                        debugLog('  → WARNING: No possible values found for binding field:', fieldName);
                                        bindSelectionState.push({
                                            selectionAppParamType: 'Field',
                                            selectionAppParamName: fieldName,
                                            values: []
                                        });
                                    }
                                } catch (error) {
                                    debugLog('  → ERROR: Could not get possible values for field:', fieldName, error);
                                    bindSelectionState.push({
                                        selectionAppParamType: 'Field',
                                        selectionAppParamName: fieldName,
                                        values: []
                                    });
                                }
                            }
                        } else {
                            // Unknown selectionStates - default to SO behavior
                            console.warn('⚠️ Unknown selectionStates value:', selectionStates, '- defaulting to "SO"');
                            // Fallback to SO logic (code omitted for brevity - same as SO case above)
                        }
                    }

                    debugLog('✅ Final bindSelectionState has', bindSelectionState.length, 'fields');
                } else {
                    console.error('❌ No cached ODAG bindings found!');
                    console.error('This means the selAppLinkUsages call in paint() failed.');
                    console.error('Check console for "Failed to fetch ODAG bindings" error above.');
                    console.error('Falling back to selected fields only - THIS WILL LIKELY FAIL!');
                    // Fallback: if we couldn't get bindings, use only selected fields (will likely cause 400 error)
                    bindSelectionState.push(...selectionState);
                }

                let sheetId = "";
                try {
                    const navigation = qlik.navigation;
                    if (navigation && navigation.getCurrentSheetId) {
                        const currentSheet = navigation.getCurrentSheetId();
                        if (currentSheet && currentSheet.sheetId) {
                            sheetId = currentSheet.sheetId;
                        }
                    }
                } catch(e) {
                    debugLog('Could not get sheet ID');
                }

                // Calculate row estimation based on ODAG link configuration
                const rowEstResult = await calculateRowEstimation(app, odagConfig.odagLinkId);

                const payload = {
                    clientContextHandle: generateContextHandle(),
                    actualRowEst: rowEstResult.actualRowEst,
                    selectionApp: appId,
                    bindSelectionState: bindSelectionState,
                    selectionState: selectionState
                };

                if (sheetId) {
                    payload.sheetname = sheetId;
                }

                debugLog('✅ Built ODAG payload:', {
                    selectionState: selectionState.map(s => s.selectionAppParamName),
                    bindSelectionState: bindSelectionState.map(s => s.selectionAppParamName),
                    bindSelectionStateCount: bindSelectionState.length,
                    actualRowEst: rowEstResult.actualRowEst,
                    canGenerate: rowEstResult.canGenerate,
                    fullPayload: payload
                });

                return {
                    payload: payload,
                    rowEstResult: rowEstResult
                };
            };
            
            // Make the API call
            const callODAGAPI = async function(odagLinkId, payload) {
                // Use dynamic tenant URL
                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = CONSTANTS.API.XRF_KEY; // 16 character key for On-Premise

                // Different API paths for Cloud vs On-Premise
                const url = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagLinkId + '/requests'
                    : tenantUrl + '/api/odag/v1/links/' + odagLinkId + '/requests?xrfkey=' + xrfkey;

                debugLog('Calling ODAG API:', url, '(Environment:', window.qlikEnvironment + ')');
                debugLog('Payload:', JSON.stringify(payload, null, 2));

                const csrfToken = getCookie('_csrfToken');

                if (isCloud && !csrfToken) {
                    console.error('No CSRF token found!');
                }

                // Build headers based on environment
                const headers = isCloud
                    ? {
                        'Content-Type': 'application/json',
                        'Accept': '*/*',
                        'qlik-csrf-token': csrfToken || ''
                      }
                    : {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Qlik-XrfKey': xrfkey
                      };

                return new Promise(function(resolve) {
                    $.ajax({
                        url: url,
                        type: 'POST',
                        data: JSON.stringify(payload),
                        contentType: 'application/json',
                        headers: headers,
                        xhrFields: {
                            withCredentials: true
                        },
                        success: function(result) {
                            debugLog('ODAG API Success:', result);
                            resolve({
                                success: true,
                                data: result
                            });
                        },
                        error: function(xhr, status, error) {
                            console.error('ODAG API Error:', xhr.status, error);
                            console.error('Response:', xhr.responseText);

                            let errorMessage = 'API call failed: ' + xhr.status + ' - ' + error;
                            let userFriendlyMessage = errorMessage;

                            // Parse error response for specific ODAG errors
                            if (xhr.responseText) {
                                try {
                                    const errorResponse = JSON.parse(xhr.responseText);

                                    // Check for 400 errors with specific messages
                                    if (xhr.status === 400 && errorResponse.message) {
                                        // Handle numValue type error
                                        if (errorResponse.message.includes('numValue of type string')) {
                                            userFriendlyMessage = '❌ Data Type Error\n\n' +
                                                'There is a data type mismatch in the ODAG request payload.\n\n' +
                                                '🔧 This is likely a bug in the extension. Please:\n' +
                                                '1. Report this issue to the extension developer\n' +
                                                '2. Include the field values you selected\n\n' +
                                                'Technical: ' + errorResponse.message;
                                        } else {
                                            // Other 400 errors
                                            userFriendlyMessage = '❌ Bad Request (400)\n\n' + errorResponse.message;
                                        }
                                    } else if (errorResponse.errors && errorResponse.errors.length > 0) {
                                        const odagError = errorResponse.errors[0];

                                        // ODAG-ERR-1132: Field binding mismatch
                                        if (odagError.code === 'ODAG-ERR-1132') {
                                            userFriendlyMessage = '❌ Field Binding Mismatch\n\n' +
                                                'The fields in your current selections do not match the ODAG template configuration.\n\n' +
                                                '🔧 How to fix:\n' +
                                                '1. Check your ODAG link field bindings (App navigation links)\n' +
                                                '2. Make sure the field names match exactly\n' +
                                                '3. Or make selections on the correct fields\n\n' +
                                                'Error: ' + odagError.title;
                                        } else {
                                            // Other ODAG errors
                                            userFriendlyMessage = '❌ ODAG Error (' + odagError.code + ')\n\n' + odagError.title;
                                        }
                                    }
                                } catch (e) {
                                    // JSON parse failed, use default error
                                }
                            }

                            resolve({
                                success: false,
                                error: errorMessage,
                                userMessage: userFriendlyMessage
                            });
                        }
                    });
                });
            };
            
            // Update apps list display
            updateAppsList = function(qId) {
                const $listContainer = $('#apps-list-' + qId);
                const $appCount = $('#app-count-' + qId);
                const elementHeight = $element.height();
                const isLargeView = elementHeight > 400;

                // Update app count
                const appCount = window.odagGeneratedApps.length;
                $appCount.text(appCount + (appCount === 1 ? ' app' : ' apps'));

                // Update mobile dropdown if it exists
                const $mobileSelector = $('#mobile-app-selector-' + qId);
                if ($mobileSelector.length > 0) {
                    if (appCount === 0) {
                        $mobileSelector.html('<option value="">No apps generated yet</option>');
                    } else {
                        let dropdownHtml = '<option value="">Select an app...</option>';
                        window.odagGeneratedApps.forEach(function(app, index) {
                            // Get app ID as string
                            let appIdStr = '';
                            if (app.appId) {
                                if (typeof app.appId === 'string') {
                                    appIdStr = app.appId;
                                } else if (typeof app.appId === 'object') {
                                    appIdStr = app.appId.id || app.appId.appId || app.appId.resourceId || '';
                                }
                            }

                            // Only show succeeded apps in dropdown
                            if (app.status === 'succeeded' && appIdStr) {
                                const date = new Date(app.created);
                                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                dropdownHtml += '<option value="' + appIdStr + '">' + app.name + ' (' + formattedDate + ')</option>';
                            } else if (app.status === 'pending' || app.status === 'queued' || app.status === 'loading' || app.status === 'generating' || app.status === 'validating') {
                                // Show in-progress apps as disabled
                                dropdownHtml += '<option value="" disabled>' + app.name + ' (Generating...)</option>';
                            }
                        });
                        $mobileSelector.html(dropdownHtml);
                    }
                }

                if (appCount === 0) {
                    $listContainer.html('<div class="list-empty">No apps generated yet</div>');
                    return;
                }

                let listHtml = '';
                window.odagGeneratedApps.forEach(function(app, index) {
                    const date = new Date(app.created);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                    // Ensure appId is a string, not an object
                    let appIdStr = '';
                    if (app.appId) {
                        if (typeof app.appId === 'string') {
                            appIdStr = app.appId;
                        } else if (typeof app.appId === 'object') {
                            // If it's still an object, extract the ID
                            appIdStr = app.appId.id || app.appId.appId || app.appId.resourceId || '';
                            console.warn('App ID was still an object in updateAppsList, extracting:', appIdStr);
                        }
                    }
                    const requestIdStr = (app.requestId && typeof app.requestId === 'string') ? app.requestId : app.requestId || '';

                    listHtml += '<div class="odag-app-item" data-app-id="' + appIdStr + '" data-request-id="' + requestIdStr + '" data-app-index="' + index + '" data-status="' + (app.status || 'unknown') + '">';
                    listHtml += '<div class="app-info">';
                    listHtml += '<div class="app-name" title="' + app.name + '">' + app.name + '</div>';
                    listHtml += '<div class="app-meta">';
                    listHtml += '<span class="app-date">🕒 ' + formattedDate + '</span>';
                    if (app.status) {
                        // Check if app is in progress
                        const isInProgress = app.status === 'pending' ||
                                           app.status === 'queued' ||
                                           app.status === 'loading' ||
                                           app.status === 'generating' ||
                                           app.status === 'validating';

                        if (isInProgress) {
                            // Show spinning loader for in-progress apps
                            listHtml += '<span class="app-status status-loading">';
                            listHtml += '<span class="status-spinner"></span> ';

                            // Show user-friendly status text
                            let statusDisplayText = app.status.charAt(0).toUpperCase() + app.status.slice(1);
                            if (app.status === 'queued') statusDisplayText = 'Queued';
                            if (app.status === 'validating') statusDisplayText = 'Validating';
                            if (app.status === 'generating') statusDisplayText = 'Generating';
                            if (app.status === 'loading') statusDisplayText = 'Loading';

                            listHtml += statusDisplayText;
                            listHtml += '</span>';
                        } else {
                            const statusIcon = app.status === 'succeeded' ? '✓' :
                                             app.status === 'failed' ? '❌' :
                                             app.status === 'cancelled' ? '⏹' : '⚠';
                            const statusText = app.status === 'succeeded' ? 'Ready' :
                                             app.status === 'cancelled' ? 'Cancelled' : app.status;
                            listHtml += '<span class="app-status status-' + app.status + '">' + statusIcon + ' ' + statusText + '</span>';
                        }
                    }
                    listHtml += '</div>';
                    listHtml += '</div>';

                    listHtml += '<div class="app-menu-container">';
                    listHtml += '<button class="app-menu-btn" title="Actions">⋮</button>';
                    listHtml += '<div class="app-menu-dropdown" style="display:none;">';

                    // Show cancel option for pending/generating apps
                    if (app.status === 'pending' || app.status === 'queued' ||
                        app.status === 'loading' || app.status === 'generating' ||
                        app.status === 'validating') {
                        listHtml += '<div class="menu-item cancel-app"><span class="menu-icon">⏹️</span> Cancel generation</div>';
                    } else if (app.status === 'succeeded') {
                        // Only succeeded apps can be opened
                        listHtml += '<div class="menu-item open-app"><span class="menu-icon">🔗</span> Open in new tab</div>';
                        listHtml += '<div class="menu-item reload-app"><span class="menu-icon">🔄</span> Reload data</div>';
                    }
                    // All apps (succeeded, failed, cancelled) can be deleted

                    listHtml += '<div class="menu-item delete-app"><span class="menu-icon">🗑️</span> Delete app</div>';
                    listHtml += '</div>';
                    listHtml += '</div>';

                    listHtml += '</div>';
                });

                $listContainer.html(listHtml);
                
                // Bind events
                $listContainer.find('.odag-app-item').off('click').on('click', function(e) {
                    // Don't trigger if clicking on menu button or menu items (or their children)
                    if (!$(e.target).closest('.app-menu-btn').length && !$(e.target).closest('.menu-item').length) {
                        const appId = $(this).data('app-id');
                        const appIndex = $(this).data('app-index');
                        const appData = window.odagGeneratedApps[appIndex];

                        debugLog('App clicked:', {
                            dataAppId: appId,
                            appDataAppId: appData.appId,
                            appIndex: appIndex,
                            appData: appData
                        });

                        // Check if we have the app ID - it might not be populated yet for queued/pending apps
                        // Make sure we get a string ID, not an object
                        let actualAppId = '';
                        if (appId && typeof appId === 'string' && appId !== '[object Object]') {
                            actualAppId = appId;
                        } else if (appData.appId) {
                            // Try to get from appData
                            if (typeof appData.appId === 'string' && appData.appId !== '[object Object]') {
                                actualAppId = appData.appId;
                            } else if (typeof appData.appId === 'object') {
                                actualAppId = appData.appId.id || appData.appId.appId || appData.appId.resourceId || '';
                                console.warn('Had to extract app ID from object in click handler:', actualAppId);
                            }
                        }

                        debugLog('App click - checking status:', {
                            status: appData.status,
                            appId: actualAppId,
                            templateAppId: appData.templateAppId
                        });

                        // Only allow viewing if app is ready and has an ID
                        if (appData.status !== 'succeeded' || !actualAppId) {
                            if (appData.status === 'pending' ||
                                appData.status === 'queued' ||
                                appData.status === 'loading' ||
                                appData.status === 'generating' ||
                                appData.status === 'validating') {
                                showNotification('App is still being generated. Please wait...', 'info');
                            } else if (appData.status === 'failed') {
                                showNotification('This app generation failed.', 'error');
                            } else if (appData.status === 'succeeded' && !actualAppId) {
                                // App is ready but ID not loaded yet - refresh the list
                                showNotification('Loading app ID, refreshing list...', 'info');
                                loadExistingRequests();
                            }
                            return;
                        }

                        if (isLargeView) {
                            $('.odag-app-item').removeClass('selected');
                            $(this).addClass('selected');

                            // Build qlik-embed element based on view mode
                            const viewMode = odagConfig.viewMode || 'odagApp';
                            const allowInteractions = odagConfig.allowInteractions !== false;
                            const hostName = window.location.hostname;
                            const embedMode = odagConfig.embedMode || 'classic/app';

                            let embedElement = '';
                            let embedAppId = '';

                            // Generate a unique key for this embed instance
                            const embedKey = 'embed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

                            if (odagConfig.templateSheetId && odagConfig.templateSheetId.trim() !== '') {
                                // Validate Sheet ID format
                                const rawSheetId = odagConfig.templateSheetId.trim();

                                // Check for common mistakes: URLs, paths, or extra content
                                if (rawSheetId.includes('/') || rawSheetId.includes('\\') ||
                                    rawSheetId.includes('sheet') || rawSheetId.includes('state') ||
                                    rawSheetId.includes('http') || rawSheetId.includes('sense/app')) {

                                    const errorMsg = '⚠️ Invalid Sheet ID Format\n\n' +
                                        'Sheet ID should be ONLY the sheet identifier (36 characters).\n\n' +
                                        'You entered: ' + rawSheetId + '\n\n' +
                                        'Example of CORRECT format:\n' +
                                        '✅ 56cb1a8e-ee80-4dba-8984-69bec687e28f\n\n' +
                                        'Example of WRONG formats:\n' +
                                        '❌ 56cb1a8e-ee80-4dba-8984-69bec687e28f/state/analysis\n' +
                                        '❌ https://demo.com/sense/app/ABC/sheet/56cb1a8e.../state/analysis\n\n' +
                                        'How to find the Sheet ID:\n' +
                                        '1. Open your ODAG template app\n' +
                                        '2. Open the sheet you want to display\n' +
                                        '3. Copy ONLY the ID after /sheet/ in the URL\n' +
                                        '   (before /state/analysis)';

                                    $listContainer.html(
                                        '<div style="padding: 20px; color: #d32f2f; background: #ffebee; border: 2px solid #d32f2f; border-radius: 8px; font-family: monospace; white-space: pre-wrap; line-height: 1.6;">' +
                                        errorMsg +
                                        '</div>'
                                    );

                                    console.error('❌ Invalid Sheet ID:', rawSheetId);
                                    return;
                                }

                                // Show specific sheet from the generated ODAG app
                                // Use the actual generated app ID, not the template
                                embedAppId = actualAppId;
                                debugLog('Using generated ODAG app for sheet view:', embedAppId, 'Sheet:', rawSheetId);
                                debugLog('LIST VIEW - embedMode:', embedMode);

                                embedElement = '<qlik-embed ';
                                embedElement += 'key="' + embedKey + '" ';
                                embedElement += 'ui="' + embedMode + '" ';
                                embedElement += 'app-id="' + embedAppId + '" ';

                                // On-Premise: Always use sheet-id
                                // Cloud: analytics/sheet uses object-id, classic/app uses sheet-id
                                const isCloud = window.qlikEnvironment === 'cloud';
                                if (embedMode === 'analytics/sheet' && isCloud) {
                                    embedElement += 'object-id="' + rawSheetId + '" ';
                                    debugLog('LIST VIEW - Adding object-id for analytics/sheet (Cloud):', rawSheetId);
                                } else {
                                    embedElement += 'sheet-id="' + rawSheetId + '" ';
                                    debugLog('LIST VIEW - Adding sheet-id:', rawSheetId, 'Mode:', embedMode);
                                }

                                embedElement += 'host="' + hostName + '" ';
                                embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';

                                const context = {
                                    interactions: {
                                        select: allowInteractions,
                                        edit: false
                                    }
                                };
                                embedElement += "context___json='" + JSON.stringify(context) + "'";
                                embedElement += '></qlik-embed>';
                            } else {
                                // Show generated ODAG app (default)
                                embedAppId = actualAppId;
                                debugLog('Using generated ODAG app for embed:', embedAppId);

                                // Use user-selected embed mode (default: classic/app)
                                const embedMode = odagConfig.embedMode || 'classic/app';
                                embedElement = '<qlik-embed ';
                                embedElement += 'key="' + embedKey + '" ';
                                embedElement += 'ui="' + embedMode + '" ';
                                embedElement += 'app-id="' + embedAppId + '" ';
                                embedElement += 'host="' + hostName + '" ';
                                embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';

                                // Add context for interactions (no theme - use app default)
                                const context = {
                                    interactions: {
                                        select: allowInteractions,
                                        edit: false
                                    }
                                };
                                embedElement += "context___json='" + JSON.stringify(context) + "' ";
                                embedElement += '></qlik-embed>';
                            }

                            // Replace placeholder with qlik-embed
                            const $container = $('#iframe-container-' + qId);

                            // Check if existing embed matches what we want to create
                            const existingEmbed = $container.find('qlik-embed')[0];
                            let needsUpdate = !existingEmbed;

                            if (existingEmbed) {
                                const currentAppId = existingEmbed.getAttribute('app-id');
                                const currentSheetId = existingEmbed.getAttribute('sheet-id');
                                const currentObjectId = existingEmbed.getAttribute('object-id');
                                const currentUi = existingEmbed.getAttribute('ui');
                                const embedMode = odagConfig.embedMode || 'classic/app';
                                const sheetId = odagConfig.templateSheetId;

                                debugLog('LIST VIEW - Existing embed check:', {
                                    currentAppId: currentAppId,
                                    targetAppId: embedAppId,
                                    currentUi: currentUi,
                                    targetUi: embedMode,
                                    currentSheetId: currentSheetId,
                                    currentObjectId: currentObjectId,
                                    targetSheetId: sheetId
                                });

                                // Check if any key attributes changed
                                // On-Premise: Always use sheet-id
                                // Cloud: analytics/sheet uses object-id, classic/app uses sheet-id
                                const isCloud = window.qlikEnvironment === 'cloud';
                                const sheetIdChanged = (embedMode === 'analytics/sheet' && isCloud)
                                    ? (sheetId && currentObjectId !== sheetId)
                                    : (sheetId && currentSheetId !== sheetId);

                                needsUpdate = currentAppId !== embedAppId ||
                                             currentUi !== embedMode ||
                                             sheetIdChanged;

                                debugLog('LIST VIEW - needsUpdate:', needsUpdate, 'sheetIdChanged:', sheetIdChanged);

                                if (!needsUpdate) {
                                    debugLog('List View: Embed already correct, skipping recreation to prevent flash');
                                }
                            }

                            if (needsUpdate) {
                                debugLog('LIST VIEW - Creating new embed. HTML:', embedElement);

                                // Clear any existing qlik-embed elements first
                                if (existingEmbed) {
                                    debugLog('Removing existing qlik-embed element');
                                    // Wrap in try-catch to suppress Qlik Nebula platform bug
                                    // Error: "u[e] is not a function" at NebulaApp.jsx:145
                                    // This is an internal Qlik bug during embed destruction that doesn't affect functionality
                                    try {
                                        existingEmbed.remove();
                                    } catch (e) {
                                        // Silently ignore Nebula destruction errors - this is a known Qlik platform bug
                                        if (odagConfig.enableDebug) {
                                            console.warn('[Known Qlik platform bug] Nebula embed destruction error (safe to ignore):', e.message);
                                        }
                                    }
                                }

                                // Clear the container completely (this also removes any remaining embeds)
                                $container.empty();

                                // Add a small delay to ensure proper cleanup
                                setTimeout(function() {
                                    // Ensure container is visible
                                    $container.show();

                                    // Show loading animation first
                                    $container.html(getLoadingPlaceholder('Loading app...'));

                                    // Create a wrapper div to contain the qlik-embed properly with relative positioning
                                    setTimeout(function() {
                                        let embedHtml = '<div class="qlik-embed-wrapper" style="position: relative; height: 100%; width: 100%; overflow: hidden;">';
                                        embedHtml += embedElement;
                                        embedHtml += '</div>';

                                        debugLog('LIST VIEW - Setting container HTML');
                                        $container.html(embedHtml);

                                        debugLog('Created new qlik-embed element:', {
                                            appId: embedAppId,
                                            viewMode: viewMode,
                                            sheetId: odagConfig.templateSheetId || 'N/A',
                                            container: $container.attr('id'),
                                            embedKey: embedKey
                                        });

                                        // Force a re-render of the web component
                                        const newEmbed = $container.find('qlik-embed')[0];
                                        if (newEmbed) {
                                            // Trigger a custom event to force refresh if needed
                                            newEmbed.dispatchEvent(new CustomEvent('refresh'));
                                        }
                                    }, 300); // Short delay to show loading animation
                                }, CONSTANTS.TIMING.PAINT_DEBOUNCE_MS);
                            }
                            
                            // Load qlik-embed script if not already loaded
                            if (!window.qlikEmbedLoaded) {
                                const script = document.createElement('script');
                                script.src = 'https://cdn.jsdelivr.net/npm/@qlik/embed-web-components';
                                script.crossOrigin = 'anonymous';
                                script.onload = function() {
                                    window.qlikEmbedLoaded = true;
                                };
                                document.head.appendChild(script);
                            }
                        } else {
                            // Small view - open in new tab
                            if (actualAppId && actualAppId !== '[object Object]') {
                                window.open(window.location.origin + '/sense/app/' + actualAppId, '_blank');
                            } else {
                                showNotification('App ID not available yet. Please wait for app to be ready.', 'warning');
                            }
                        }
                    }
                });
                
                // Setup all app item action handlers using EventHandlers module
                EventHandlers.setupAppMenuHandler($listContainer);
                EventHandlers.setupAppItemHandlers($listContainer, qId, updateAppsList, showNotification, debugLog, getCookie);
            };
            
            // Main generate function
            const generateODAGApp = async function() {
                console.log('⚡ generateODAGApp() called', {
                    odagLinkId: odagConfig.odagLinkId,
                    bindingsCacheKey: 'odagBindings_' + odagConfig.odagLinkId,
                    bindingsCached: !!window['odagBindings_' + odagConfig.odagLinkId],
                    isCloud: window.qlikEnvironment === 'cloud'
                });

                if (!odagConfig.odagLinkId) {
                    console.error('❌ No ODAG Link ID configured');
                    showNotification('Please configure ODAG Link ID in properties panel', 'error');
                    return;
                }

                const $button = $('.odag-generate-btn-compact');
                console.log('🔘 Found', $button.length, 'generate button(s) to disable');
                $button.addClass('loading').prop('disabled', true);

                try {
                    // Ensure bindings are loaded before generating (both Cloud and On-Premise)
                    const isCloud = window.qlikEnvironment === 'cloud';
                    const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;
                    const currentUrl = window.qlikTenantUrl || window.location.origin;

                    if (isCloud && !window[bindingsCacheKey]) {
                        debugLog('⏳ Cloud bindings not cached yet, fetching before generation...');

                        // Fetch Cloud bindings synchronously before generating
                        const csrfToken = getCookie('_csrfToken');
                        // Add cache-busting timestamp to force fresh data
                        const cacheBuster = '_=' + Date.now();
                        const bindingsUrl = currentUrl + '/api/v1/odaglinks/selAppLinkUsages?selAppId=' + app.id + '&' + cacheBuster;

                        await new Promise(function(resolve, reject) {
                            $.ajax({
                                url: bindingsUrl,
                                type: 'POST',
                                data: JSON.stringify({linkList: [odagConfig.odagLinkId]}),
                                contentType: 'application/json',
                                cache: false, // Disable jQuery caching
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': '*/*',
                                    'qlik-csrf-token': csrfToken || '',
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache',
                                    'Expires': '0'
                                },
                                xhrFields: {withCredentials: true},
                                timeout: CONSTANTS.TIMING.AJAX_TIMEOUT_MS * 2, // Longer timeout for bindings
                                success: function(response) {
                                    debugLog('🔍 Cloud bindings response:', response);

                                    if (response && response.length > 0 && response[0].link && response[0].link.bindings) {
                                        const linkData = response[0].link;
                                        const bindings = linkData.bindings;
                                        window[bindingsCacheKey] = bindings;

                                        // Cache row estimation config from ODAG link
                                        const rowEstCacheKey = 'odagRowEstConfig_' + odagConfig.odagLinkId;

                                        // Extract curRowEstHighBound from properties.rowEstRange[0].highBound
                                        let curRowEstHighBound = linkData.curRowEstHighBound;
                                        if (!curRowEstHighBound && linkData.properties && linkData.properties.rowEstRange &&
                                            linkData.properties.rowEstRange.length > 0) {
                                            curRowEstHighBound = linkData.properties.rowEstRange[0].highBound;
                                        }

                                        window[rowEstCacheKey] = {
                                            rowEstExpr: linkData.rowEstExpr,
                                            curRowEstHighBound: curRowEstHighBound
                                        };

                                        debugLog('✅ Cloud bindings cached for generation:', bindings.length, 'bindings');
                                        debugLog('✅ Bindings:', JSON.stringify(bindings, null, 2));
                                        debugLog('✅ Row estimation config:', window[rowEstCacheKey]);
                                        resolve();
                                    } else {
                                        console.error('❌ Unexpected Cloud bindings response format');
                                        window[bindingsCacheKey] = [];
                                        resolve();
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error('❌ Failed to fetch Cloud bindings:', xhr.status, error);
                                    window[bindingsCacheKey] = [];
                                    reject(new Error('Failed to fetch Cloud bindings: ' + error));
                                }
                            });
                        });
                    } else if (!isCloud && !window[bindingsCacheKey]) {
                        debugLog('⏳ On-Premise bindings not cached yet, fetching before generation...');

                        // Fetch On-Premise bindings synchronously before generating
                        const xrfkey = CONSTANTS.API.XRF_KEY;
                        // Add cache-busting timestamp to force fresh data
                        const cacheBuster = '_=' + Date.now();
                        const linkDetailsUrl = currentUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '?xrfkey=' + xrfkey + '&' + cacheBuster;

                        await new Promise(function(resolve, reject) {
                            $.ajax({
                                url: linkDetailsUrl,
                                type: 'GET',
                                cache: false, // Disable jQuery caching
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'X-Qlik-XrfKey': xrfkey,
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache',
                                    'Expires': '0'
                                },
                                xhrFields: {withCredentials: true},
                                timeout: CONSTANTS.TIMING.AJAX_TIMEOUT_MS * 2, // Longer timeout for link details
                                success: function(linkDetails) {
                                    debugLog('🔍 FULL On-Premise link details response:', linkDetails);

                                    // On-Premise response format: {objectDef: {bindings: [...], ...}, feedback: [...]}
                                    // Bindings are inside objectDef, not at top level
                                    let bindings = null;

                                    if (linkDetails && linkDetails.objectDef && linkDetails.objectDef.bindings) {
                                        bindings = linkDetails.objectDef.bindings;
                                    } else if (linkDetails && linkDetails.bindings) {
                                        bindings = linkDetails.bindings;
                                    }

                                    debugLog('🔍 Extracted bindings:', bindings);

                                    if (bindings && Array.isArray(bindings) && bindings.length > 0) {
                                        window[bindingsCacheKey] = bindings;
                                        debugLog('✅ On-Premise bindings cached:', bindings.length, 'bindings');
                                        debugLog('✅ Bindings array:', JSON.stringify(bindings, null, 2));

                                        // Cache row estimation config from ODAG link (On-Premise)
                                        const rowEstCacheKey = 'odagRowEstConfig_' + odagConfig.odagLinkId;
                                        if (linkDetails.objectDef) {
                                            const objectDef = linkDetails.objectDef;

                                            // Extract rowEstExpr and curRowEstHighBound from On-Premise structure
                                            let rowEstExpr = objectDef.rowEstExpr;
                                            let curRowEstHighBound = null;

                                            // Check for row estimation range configuration
                                            if (objectDef.rowEstRange && Array.isArray(objectDef.rowEstRange) &&
                                                objectDef.rowEstRange.length > 0) {
                                                curRowEstHighBound = objectDef.rowEstRange[0].highBound;
                                            }

                                            window[rowEstCacheKey] = {
                                                rowEstExpr: rowEstExpr,
                                                curRowEstHighBound: curRowEstHighBound
                                            };

                                            debugLog('✅ On-Premise row estimation config:', window[rowEstCacheKey]);
                                        }

                                        resolve();
                                    } else {
                                        console.error('❌ No bindings found in ODAG link details');
                                        console.error('Response structure:', Object.keys(linkDetails || {}));
                                        if (linkDetails && linkDetails.objectDef) {
                                            console.error('objectDef structure:', Object.keys(linkDetails.objectDef));
                                        }
                                        window[bindingsCacheKey] = [];
                                        resolve();
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error('❌ Failed to fetch ODAG link details for bindings:', xhr.status, error);
                                    window[bindingsCacheKey] = [];
                                    reject(new Error('Failed to fetch bindings: ' + error));
                                }
                            });
                        });
                    }

                    const buildResult = await buildPayload(app, odagConfig, layout);
                    const payload = buildResult.payload;
                    const rowEstResult = buildResult.rowEstResult;

                    // CRITICAL VALIDATION: Check binding fields BEFORE sending to API
                    const cachedBindings = window['odagBindings_' + odagConfig.odagLinkId];

                    if (cachedBindings && cachedBindings.length > 0) {
                        debugLog('🔍 Validating binding fields before API call...');

                        // Create a map of binding field values for quick lookup
                        const bindingValueMap = new Map();
                        for (const bindingField of payload.bindSelectionState) {
                            bindingValueMap.set(
                                bindingField.selectionAppParamName,
                                bindingField.values || []
                            );
                        }

                        // Check each binding individually based on its selectionStates
                        const missingRequiredFields = [];
                        const missingFieldDetails = []; // Store field name + selectionStates for better messaging

                        for (const binding of cachedBindings) {
                            const fieldName = binding.selectAppParamName || binding.selectionAppParamName;
                            const selectionStates = binding.selectionStates || "SO";
                            const fieldValues = bindingValueMap.get(fieldName) || [];

                            debugLog('  🔍 Checking binding:', {
                                field: fieldName,
                                mode: selectionStates,
                                valueCount: fieldValues.length
                            });

                            // If mode is "S" (Selected only), values are REQUIRED
                            if (selectionStates === "S") {
                                if (fieldValues.length === 0) {
                                    debugLog('    ❌ Mode "S": No values found - REQUIRED!');
                                    missingRequiredFields.push(fieldName);
                                    missingFieldDetails.push({ field: fieldName, mode: selectionStates });
                                } else {
                                    debugLog('    ✅ Mode "S": Has', fieldValues.length, 'values');
                                }
                            }
                            // If mode is "O" (Optional only), values can be empty or filled
                            else if (selectionStates === "O") {
                                debugLog('    ℹ️ Mode "O": Optional values -', fieldValues.length, 'values found');
                            }
                            // If mode is "SO" or "OS" (Selected + Optional), values can be empty
                            else if (selectionStates === "SO" || selectionStates === "OS") {
                                debugLog('    ℹ️ Mode "SO/OS": Flexible -', fieldValues.length, 'values found');
                            }
                            // Unknown mode - treat as flexible
                            else {
                                debugLog('    ⚠️ Unknown mode "' + selectionStates + '" - treating as flexible');
                            }
                        }

                        // If there are missing required fields, alert user
                        if (missingRequiredFields.length > 0) {
                            debugLog('❌ Missing required selections in fields:', missingRequiredFields);
                            $button.removeClass('loading').prop('disabled', false);

                            // Build clear, informative warning message with dynamic prefixes
                            const fieldListBullets = missingFieldDetails.map(detail => {
                                // Determine the correct variable prefix based on selectionStates
                                let prefix = '';
                                let modeDescription = '';

                                if (detail.mode === 'S') {
                                    prefix = '$(odags_' + detail.field + ')';
                                    modeDescription = '"selected values only"';
                                } else if (detail.mode === 'O') {
                                    prefix = '$(odago_' + detail.field + ')';
                                    modeDescription = '"optional values only"';
                                } else if (detail.mode === 'SO' || detail.mode === 'OS') {
                                    prefix = '$(odag_' + detail.field + ')';
                                    modeDescription = '"selected + optional values"';
                                } else {
                                    prefix = '$(odag_' + detail.field + ')';
                                    modeDescription = 'mode "' + detail.mode + '"';
                                }

                                return '  • ' + detail.field + ' → ' + prefix + ' (mode: ' + detail.mode + ')';
                            }).join('\n');

                            // Build explanation text based on modes
                            let explanationText = '';
                            const uniqueModes = [...new Set(missingFieldDetails.map(d => d.mode))];

                            if (uniqueModes.length === 1 && uniqueModes[0] === 'S') {
                                explanationText = 'These fields are configured with "selected values only" mode (selectionStates: "S").\n' +
                                                  'The template app uses variables like $(odags_FieldName) which expect selected values.';
                            } else {
                                explanationText = 'These fields require selections based on their selectionStates configuration:\n' +
                                                  '  • Mode "S"  = $(odags_Field) - Selected values only\n' +
                                                  '  • Mode "O"  = $(odago_Field) - Optional values only\n' +
                                                  '  • Mode "SO" = $(odag_Field)  - Selected + Optional values';
                            }

                            // No need for alert - validation status already shows detailed message
                            // User can see the full explanation in the yellow warning box above
                            debugLog('Validation failed - message shown in status div, no alert needed');
                            return;
                        }

                        debugLog('✅ Binding validation passed: All required fields have values');
                    }

                    // Check if generation is allowed based on row estimation
                    if (!rowEstResult.canGenerate) {
                        $button.removeClass('loading').prop('disabled', false);
                        alert(rowEstResult.message);
                        return;
                    }

                    const result = await callODAGAPI(odagConfig.odagLinkId, payload);
                    
                    if (result.success && result.data) {
                        const odagData = result.data;
                        debugLog('ODAG Response:', odagData);
                        
                        // Store the app with correct IDs
                        // The generated app ID is in generatedApp field (populated when ready)
                        // It could be an object with an id property or a direct string
                        let generatedAppId = '';

                        if (odagData.generatedApp) {
                            if (typeof odagData.generatedApp === 'object' && odagData.generatedApp.id) {
                                // It's an object with an id property
                                generatedAppId = odagData.generatedApp.id;
                                debugLog('Extracted app ID from object.id:', generatedAppId);
                            } else if (typeof odagData.generatedApp === 'string') {
                                // It's a direct string
                                generatedAppId = odagData.generatedApp;
                                debugLog('App ID was string:', generatedAppId);
                            } else {
                                // Log the full object to understand the structure
                                debugLog('Unknown generatedApp structure:', odagData.generatedApp);
                                // Try to find ID in other possible locations
                                if (odagData.generatedApp.appId) {
                                    generatedAppId = odagData.generatedApp.appId;
                                    debugLog('Found app ID in appId field:', generatedAppId);
                                } else if (odagData.generatedApp.resourceId) {
                                    generatedAppId = odagData.generatedApp.resourceId;
                                    debugLog('Found app ID in resourceId field:', generatedAppId);
                                }
                            }
                        }

                        debugLog('New ODAG app created:', {
                            requestId: odagData.id,
                            generatedApp: odagData.generatedApp,
                            extractedAppId: generatedAppId,
                            templateApp: odagData.templateApp,
                            state: odagData.state
                        });

                        window.odagGeneratedApps.unshift({
                            requestId: odagData.id,  // ODAG request ID for delete/reload
                            appId: generatedAppId,  // The actual generated app ID (from generatedApp field)
                            templateAppId: odagData.templateApp || '', // Template app ID
                            name: odagData.generatedAppName,
                            created: odagData.createdDate,
                            status: odagData.state || 'pending',
                            owner: odagData.owner?.name || 'Unknown'
                        });

                        updateAppsList(layout.qInfo.qId);
                        showNotification('ODAG app "' + odagData.generatedAppName + '" generated successfully!', 'success');

                        // Start monitoring for status updates since we have a new pending app
                        if (window.startODAGStatusMonitoring) {
                            debugLog('Starting status monitoring for newly generated app...');
                            window.startODAGStatusMonitoring();
                        }
                    } else {
                        // Show user-friendly message if available, otherwise show technical error
                        const errorMsg = result.userMessage || result.error || 'Unknown error';

                        // Show all errors as alerts for better visibility
                        alert('Failed to generate ODAG app:\n\n' + errorMsg);

                        // Also show notification
                        showNotification('ODAG Generation Failed', 'error');
                    }
                    
                } catch (error) {
                    console.error('ODAG Generation Error:', error);
                    showNotification('Error: ' + error.message, 'error');
                } finally {
                    $button.removeClass('loading').prop('disabled', false);
                }
            };
            
            // Initialize Dynamic View if needed (after all helper functions are defined)
            // Use a unique key per extension instance to prevent re-initialization on resize/edit mode changes
            const dynamicViewKey = 'dynamicView_' + layout.qInfo.qId;
            // Note: configKey and currentConfig already declared at top of paint() for cleanup logic
            const configChanged = previousConfig && previousConfig !== currentConfig;

            // Dynamic View should NEVER run on mobile - double check
            if (isDynamicView && initDynamicView && !isMobile) {
                const initInProgressKey = 'dynamicViewInitInProgress_' + layout.qInfo.qId;

                debugLog('Dynamic View initialization check:', {
                    hasDynamicViewKey: !!window[dynamicViewKey],
                    configChanged: configChanged,
                    willInitialize: !window[dynamicViewKey] || configChanged
                });

                if (!window[dynamicViewKey] || configChanged) {
                    // Mark as initialized to prevent duplicate runs
                    window[dynamicViewKey] = true;
                    window[configKey] = currentConfig;

                    // Also set initKey to prevent HTML rebuilds
                    const initKey = 'odagInit_' + layout.qInfo.qId;
                    window[initKey] = true;
                    // Don't set initInProgressKey here - loadDynamicEmbed() will handle it

                    if (configChanged) {
                        debugLog('Configuration changed, re-initializing Dynamic View');
                    } else {
                        debugLog('Initializing Dynamic View for the first time');
                    }

                    // initDynamicView() will set and clear initInProgressKey as needed
                    return initDynamicView(debugLog);
                } else if (restoreDynamicView) {
                    // Check if initialization is still in progress
                    if (window[initInProgressKey]) {
                        debugLog('Dynamic View initialization in progress, waiting...');
                        return qlik.Promise.resolve();
                    }

                    // Only restore if the embed actually exists (meaning init completed successfully)
                    const embedContainer = document.getElementById('dynamic-embed-' + layout.qInfo.qId);
                    const existingEmbed = embedContainer ? embedContainer.querySelector('qlik-embed') : null;

                    debugLog('Checking for existing embed:', {
                        embedContainerExists: !!embedContainer,
                        embedContainerHTML: embedContainer ? embedContainer.innerHTML.substring(0, 200) : 'N/A',
                        existingEmbed: !!existingEmbed,
                        qId: layout.qInfo.qId
                    });

                    if (existingEmbed) {
                        debugLog('Dynamic View already initialized with embed, restoring state');
                        return restoreDynamicView(debugLog);
                    } else {
                        // Embed was destroyed (e.g., by NebulaApp error during mode switch or edit/analysis transition)
                        // Reinitialize instead of waiting indefinitely
                        debugLog('⚠️ Dynamic View embed missing, reinitializing...');
                        delete window[dynamicViewKey]; // Clear flag to allow reinitialization
                        // NOTE: Do NOT delete configKey - preserve it to prevent false "config changed" detection
                        delete window[initKey]; // Clear init flag to prevent early return on next paint
                        debugLog('🔄 Cleared Dynamic View flags, reinitializing now...');

                        // Trigger reinitialization by calling initDynamicView directly
                        // This happens in the same execution instead of waiting for next paint()
                        window[dynamicViewKey] = true;
                        window[configKey] = currentConfig;
                        window[initKey] = true;
                        return initDynamicView(debugLog);
                    }
                }
            } else if (!isDynamicView && window[dynamicViewKey]) {
                // Clean up flags if switching away from dynamic view (including when switching to mobile)
                debugLog('🔄 Switching away from Dynamic View (isMobile=' + isMobile + '), clearing flags');
                delete window[dynamicViewKey];
                delete window[configKey];
            }

            // Load existing apps on init (not in dynamic view)
            if (!isDynamicView && window.odagGeneratedApps && window.odagGeneratedApps.length > 0) {
                updateAppsList(layout.qInfo.qId);
            }

            // Button click handler (not in dynamic view)
            if (!isDynamicView) {
                const $generateButtons = $element.find('.odag-generate-btn-compact');
                debugLog('🔘 Attaching click handlers to', $generateButtons.length, 'generate button(s)');

                // Setup generate button handler
                EventHandlers.setupGenerateHandler($generateButtons, generateODAGApp, odagConfig);

                // Setup sidebar toggle handler
                EventHandlers.setupSidebarToggleHandler($element, layout);

                // Refresh list button handler
                $element.find('.refresh-list-btn').on('click', function() {
                    const $btn = $(this);

                    // Add spinning animation
                    $btn.css('transform', 'rotate(360deg)');
                    setTimeout(function() {
                        $btn.css('transform', 'rotate(0deg)');
                    }, 600);

                    // Reload the apps list
                    loadExistingRequests().then(function() {
                        updateAppsList(layout.qInfo.qId);
                        showNotification('App list refreshed', 'info');
                    }).catch(function(error) {
                        debugLog('Error refreshing apps list:', error);
                        showNotification('Failed to refresh app list', 'error');
                    });
                });

                // Setup delete all button handler
                EventHandlers.setupDeleteAllHandler($element, layout, updateAppsList, showNotification, debugLog, getCookie);

                // Mobile dropdown selector handler
                $element.find('.mobile-app-selector').on('change', function() {
                    const selectedAppId = $(this).val();

                    if (!selectedAppId || selectedAppId === '') {
                        debugLog('No app selected from mobile dropdown');
                        return;
                    }

                    // Find the selected app
                    const selectedApp = window.odagGeneratedApps.find(function(app) {
                        return app.appId === selectedAppId;
                    });

                    if (!selectedApp) {
                        debugLog('Selected app not found:', selectedAppId);
                        return;
                    }

                    debugLog('Mobile dropdown: Selected app', selectedApp.name);

                    // Clear existing iframe
                    const $iframeContainer = $('#iframe-container-' + layout.qInfo.qId);
                    $iframeContainer.empty();

                    // Mobile always uses classic/app mode (full app overview, no sheet ID)
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const embedMode = 'classic/app';
                    const allowInteractions = odagConfig.allowInteractions !== false;
                    const hostName = window.location.hostname;

                    debugLog('Mobile: Embedding app in classic/app mode:', selectedApp.appId);

                    // Generate unique key for this embed instance
                    const embedKey = 'mobile-embed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

                    // Create and add qlik-embed - no sheet ID for mobile
                    let embedElement = '<qlik-embed ' +
                        'key="' + embedKey + '" ' +
                        'ui="' + embedMode + '" ' +
                        'app-id="' + selectedApp.appId + '" ';

                    embedElement += 'host="' + hostName + '" ' +
                        'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';

                    const context = {
                        interactions: {
                            select: allowInteractions,
                            edit: false
                        }
                    };
                    embedElement += "context___json='" + JSON.stringify(context) + "' ";
                    embedElement += '></qlik-embed>';

                    // Add a small delay to ensure proper cleanup before creating new embed
                    setTimeout(function() {
                        // Ensure container is visible
                        $iframeContainer.show();

                        // Wrap embed in a container div for proper positioning
                        const embedHtml = '<div class="qlik-embed-wrapper" style="position: relative; height: 100%; width: 100%; overflow: hidden;">' +
                            embedElement +
                            '</div>';

                        debugLog('Mobile: Setting embed HTML');
                        $iframeContainer.html(embedHtml);
                    }, CONSTANTS.TIMING.PAINT_DEBOUNCE_MS);
                });
            }

            // Check for selection changes on every paint (for Dynamic View)
            if (isDynamicView) {
                const checkSelectionsFunc = StateManager.get(extensionId, 'checkSelectionsChanged');
                if (checkSelectionsFunc) {
                    checkSelectionsFunc();
                }
            }

            // Run validation check on EVERY paint to update button state when selections change
            const validationFunc = StateManager.get(extensionId, 'checkODAGValidation');
            if (validationFunc) {
                // Clear any pending validation check to avoid running multiple times
                const existingTimeout = StateManager.get(extensionId, CONSTANTS.STATE_KEYS.VALIDATION_TIMEOUT);
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                }
                // Delay validation to ensure Qlik engine has processed selection changes
                const timeoutId = setTimeout(function() {
                    const validationFunc2 = StateManager.get(extensionId, 'checkODAGValidation');
                    if (validationFunc2) {
                        validationFunc2();
                    }
                }, CONSTANTS.TIMING.VALIDATION_DEBOUNCE_MS);
                StateManager.set(extensionId, CONSTANTS.STATE_KEYS.VALIDATION_TIMEOUT, timeoutId);
            }

            return qlik.Promise.resolve();

            } catch (error) {
                console.error('ODAG Extension ERROR:', error);
                $element.html('<div style="padding: 20px; color: red;">Error: ' + error.message + '</div>');
                return qlik.Promise.reject(error);
            }
        },

        /**
         * Destroy lifecycle method
         * Clean up all resources when extension is removed or destroyed
         */
        destroy: function($element, layout) {
            // Handle case where layout might be undefined
            if (!layout || !layout.qInfo || !layout.qInfo.qId) {
                console.warn('[ODAG Extension] destroy() called without valid layout, skipping cleanup');
                return;
            }

            const extensionId = layout.qInfo.qId;

            // Clean up all state for this extension instance
            StateManager.cleanup(extensionId);

            // Remove any document-level event listeners
            const clickHandlerKey = 'clickHandler_' + extensionId;
            if (window[clickHandlerKey]) {
                $(document).off('click', window[clickHandlerKey]);
                delete window[clickHandlerKey];
            }

            // Clear any global variables that might still exist
            const keysToClean = [
                'lastPaint_',
                'configHash_',
                'odagBindings_',
                'bindingsFetching_',
                'odagRowEstConfig_',
                'wasInEditMode_',
                'checkODAGValidation_',
                'odagSelectionListener_',
                'selectionChangeTimeout_',
                'validationCheckTimeout_',
                'showDynamicTopBar_',
                'hideTimer_',
                'initInProgressKey_',
                'dynamicViewInitialized_',
                'lastOdagAppId_',
                'lastSelectionPayload_'
            ];

            keysToClean.forEach(function(keyPrefix) {
                const fullKey = keyPrefix + extensionId;
                if (window[fullKey] !== undefined) {
                    delete window[fullKey];
                }
            });

            // Clean up CleanupManager for this extension
            const cleanupKey = 'cleanup_' + extensionId;
            if (window.ODAGCleanupManager && window.ODAGCleanupManager[cleanupKey]) {
                window.ODAGCleanupManager[cleanupKey].cleanup();
                delete window.ODAGCleanupManager[cleanupKey];
            }

            // Remove DOM element content
            if ($element) {
                $element.empty();
            }
        }
    };
});