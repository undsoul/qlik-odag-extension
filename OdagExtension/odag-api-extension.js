define(["qlik", "jquery", "./odag-api-properties", "css!./odag-api-extension.css"],
function(qlik, $, properties) {
    'use strict';

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
                embedTheme: "horizon",
                allowInteractions: true
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

            // Helper function to get cookie value
            const getCookie = function(name) {
                const value = '; ' + document.cookie;
                const parts = value.split('; ' + name + '=');
                if (parts.length === 2) return parts.pop().split(';').shift();
                return null;
            };

            // ========== PERFORMANCE OPTIMIZATIONS ==========

            // 1. Paint Debouncing - Prevent excessive re-renders
            const paintKey = 'lastPaint_' + layout.qInfo.qId;
            const now = Date.now();

            if (window[paintKey] && (now - window[paintKey]) < 100) {
                debugLog('Paint debounced - called too frequently (< 100ms)');
                return qlik.Promise.resolve();
            }
            window[paintKey] = now;

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

            // Detect environment if not already detected
            if (!window.qlikEnvironment) {
                // Try to detect via /qrs/about endpoint (On-Premise only)
                $.ajax({
                    url: currentUrl + '/qrs/about?xrfkey=abcdefghijklmnop',
                    type: 'GET',
                    headers: {
                        'X-Qlik-XrfKey': 'abcdefghijklmnop'
                    },
                    timeout: 2000,
                    success: function(response) {
                        // If /qrs/about responds, it's On-Premise
                        if (response && response.buildVersion) {
                            window.qlikEnvironment = 'onpremise';
                            console.log('🌍 ODAG Extension - Environment: ONPREMISE (detected via /qrs/about) | Build:', response.buildVersion);
                        }
                    },
                    error: function() {
                        // If /qrs/about fails, it's Cloud
                        window.qlikEnvironment = 'cloud';
                        console.log('🌍 ODAG Extension - Environment: CLOUD (no /qrs/about endpoint) | Hostname:', hostname);
                    }
                });

                // Fallback: Use hostname-based detection while waiting for async call
                const isQlikCloud = hostname.includes('qlikcloud.com') || hostname.includes('qlik-stage.com');
                window.qlikEnvironment = isQlikCloud ? 'cloud' : 'onpremise';
            }

            debugLog('Using environment:', window.qlikEnvironment, '- URL:', currentUrl);

            // Fetch available ODAG links for On-Premise (for debugging/helper)
            const isCloud = window.qlikEnvironment === 'cloud';
            if (!isCloud && !window.odagLinksListFetched) {
                // Mark as fetched to avoid repeated calls
                window.odagLinksListFetched = true;

                const xrfkey = 'abcdefghijklmnop';
                // Get all ODAG links
                const linksUrl = currentUrl + '/api/odag/v1/links?xrfkey=' + xrfkey;

                debugLog('📋 Fetching available ODAG links from On-Premise...');

                $.ajax({
                    url: linksUrl,
                    type: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Qlik-XrfKey': xrfkey
                    },
                    xhrFields: {withCredentials: true},
                    timeout: 5000,
                    success: function(links) {
                        if (Array.isArray(links) && links.length > 0) {
                            // Store links for this app
                            window['odagAppLinks_' + app.id] = links;

                            console.log('✅ Found ' + links.length + ' ODAG Link(s) for this app:');
                            console.table(links.map(function(link) {
                                return {
                                    'Link ID': link.id,
                                    'Name': link.name || '(no name)',
                                    'Template App': link.templateApp ? link.templateApp.name : 'N/A',
                                    'Status': link.status || 'unknown'
                                };
                            }));
                            console.log('💡 Copy the "Link ID" from the table above and paste it into the ODAG Link ID property field.');
                        } else {
                            console.log('ℹ️ No ODAG links found for this app.');
                        }
                    },
                    error: function(xhr, status, error) {
                        console.warn('⚠️ Could not fetch ODAG links list:', xhr.status, error);
                        console.log('💡 You can manually get ODAG links by visiting:', linksUrl);
                    }
                });
            }

            // Fetch and cache ODAG bindings (Cloud only)
            const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;

            if (isCloud && odagConfig.odagLinkId && !window[bindingsCacheKey]) {
                debugLog('Fetching ODAG bindings for Cloud link:', odagConfig.odagLinkId);

                const csrfToken = getCookie('_csrfToken');
                const bindingsUrl = currentUrl + '/api/v1/odaglinks/selAppLinkUsages?selAppId=' + app.id;

                $.ajax({
                    url: bindingsUrl,
                    type: 'POST',
                    data: JSON.stringify({linkList: [odagConfig.odagLinkId]}),
                    contentType: 'application/json',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': '*/*',
                        'qlik-csrf-token': csrfToken || ''
                    },
                    xhrFields: {withCredentials: true},
                    success: function(response) {
                        // Cloud response format: [{link: {bindings: [...]}}]
                        if (response && response.length > 0 && response[0].link && response[0].link.bindings) {
                            const bindings = response[0].link.bindings;
                            window[bindingsCacheKey] = bindings;
                            debugLog('✅ Cloud bindings cached:', bindings.length, 'bindings');
                        } else {
                            console.error('❌ Unexpected bindings response format');
                        }
                    },
                    error: function(error) {
                        console.error('❌ Failed to fetch ODAG bindings:', error.status, error.statusText);
                    }
                });
            } else if (!isCloud) {
                // On-Premise: Skip bindings fetch, rely on ODAG template configuration
                debugLog('✅ On-Premise: Using ODAG template configuration (no bindings fetch needed)');
                window[bindingsCacheKey] = []; // Set empty to avoid repeated checks
            }

            // Check if extension is large enough for iframe view
            const isLargeView = elementHeight > 400 && elementWidth > 600;
            const isDynamicView = odagConfig.viewMode === 'dynamicView';

            debugLog('ODAG Extension: isEditMode =', isEditMode, 'isDynamicView =', isDynamicView, 'odagLinkId =', odagConfig.odagLinkId);

            // Check if we're switching TO Dynamic View (even in edit mode)
            // This cleanup happens BEFORE edit mode check so it runs immediately
            const configKey = 'dynamicViewConfig_' + layout.qInfo.qId;
            const currentConfig = JSON.stringify({
                odagLinkId: odagConfig.odagLinkId,
                variableMappings: odagConfig.variableMappings,
                templateSheetId: odagConfig.templateSheetId,
                viewMode: odagConfig.viewMode
            });
            const previousConfig = window[configKey];
            const previousViewMode = previousConfig ? JSON.parse(previousConfig).viewMode : null;

            // Detect if we're switching TO Dynamic View:
            // 1. If previousViewMode exists and changed from non-dynamic to dynamic
            // 2. OR if we're in Dynamic View and there's no previous config (first time)
            const switchedToDynamicView = (previousViewMode && previousViewMode !== 'dynamicView' && odagConfig.viewMode === 'dynamicView') ||
                                         (!previousConfig && odagConfig.viewMode === 'dynamicView');

            // When switching TO Dynamic View or entering it for first time, keep only the latest app and delete others
            if (switchedToDynamicView && odagConfig.odagLinkId) {
                debugLog('ODAG Extension: Entering Dynamic View - cleaning up old apps, keeping only latest...');

                // Store the new config immediately
                window[configKey] = currentConfig;

                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = 'abcdefghijklmnop';
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
                                $.ajax({
                                    url: (window.qlikEnvironment === 'cloud' ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + app.id + '/app?xrfkey=abcdefghijklmnop',
                                    type: 'DELETE',
                                    headers: {
                                        'qlik-csrf-token': getCookie('_csrfToken') || ''
                                    },
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

            // Build HTML
            let html = '<div class="odag-container">';

            // Show warning if ODAG Link ID is not configured
            if (!odagConfig.odagLinkId || odagConfig.odagLinkId.trim() === '') {
                debugLog('ODAG Extension: No ODAG Link ID, showing warning');

                // For On-Premise, fetch and show available links
                if (!isCloud) {
                    html += '<div id="odag-links-container" style="padding: 20px;">';
                    html += '<div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">⚙️ ODAG Link Configuration</div>';
                    html += '<div style="color: #666; margin-bottom: 16px;">No ODAG Link ID configured. Fetching available links...</div>';
                    html += '<div id="odag-links-list" style="max-height: 400px; overflow-y: auto;"></div>';
                    html += '</div>';
                    html += '</div>'; // Close odag-container
                    $element.html(html);

                    // Fetch available ODAG links
                    const xrfkey = 'abcdefghijklmnop';
                    const linksUrl = currentUrl + '/api/odag/v1/links?xrfkey=' + xrfkey;

                    $.ajax({
                        url: linksUrl,
                        type: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-Qlik-XrfKey': xrfkey
                        },
                        xhrFields: {withCredentials: true},
                        success: function(links) {
                            let linksHtml = '';
                            if (Array.isArray(links) && links.length > 0) {
                                linksHtml += '<div style="color: #16a34a; margin-bottom: 16px;">✅ Found ' + links.length + ' ODAG link(s) for this app:</div>';
                                linksHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
                                linksHtml += '<thead><tr style="background: #f3f4f6; text-align: left;">';
                                linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Name</th>';
                                linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Template App</th>';
                                linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Link ID</th>';
                                linksHtml += '</tr></thead><tbody>';

                                links.forEach(function(link) {
                                    linksHtml += '<tr style="border-bottom: 1px solid #ddd;">';
                                    linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">' + (link.name || '(no name)') + '</td>';
                                    linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; color: #666; font-size: 12px;">' + (link.templateApp ? link.templateApp.name : 'N/A') + '</td>';
                                    linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 11px; background: #f9fafb; cursor: pointer;" onclick="navigator.clipboard.writeText(\'' + link.id + '\'); this.style.background=\'#dcfce7\'; setTimeout(() => this.style.background=\'#f9fafb\', 1000);" title="Click to copy">' + link.id + '</td>';
                                    linksHtml += '</tr>';
                                });

                                linksHtml += '</tbody></table>';
                                linksHtml += '<div style="margin-top: 16px; padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; font-size: 12px;">';
                                linksHtml += '💡 <strong>Tip:</strong> Click any Link ID to copy it, then paste it in the ODAG Link ID property field.';
                                linksHtml += '</div>';
                            } else {
                                linksHtml += '<div style="color: #dc2626;">❌ No ODAG links found for this app.</div>';
                                linksHtml += '<div style="margin-top: 8px; font-size: 12px; color: #666;">Please create an ODAG link for this selection app in the QMC.</div>';
                            }

                            $('#odag-links-list').html(linksHtml);
                        },
                        error: function(xhr, status, error) {
                            $('#odag-links-list').html('<div style="color: #dc2626;">❌ Failed to fetch ODAG links: ' + xhr.status + ' ' + error + '</div>');
                        }
                    });

                    return qlik.Promise.resolve();
                } else {
                    // Cloud: Show standard warning
                    html += '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">';
                    html += '<div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>';
                    html += '<div style="font-size: 18px; font-weight: bold; color: #f59e0b; margin-bottom: 8px;">ODAG Link ID Required</div>';
                    html += '<div style="font-size: 14px; color: #666;">Please configure the ODAG Link ID in the property panel to use this extension.</div>';
                    html += '</div>';
                    html += '</div>'; // Close odag-container
                    $element.html(html);
                    return qlik.Promise.resolve();
                }
            }

            // Show link selector in edit mode
            if (isEditMode) {
                debugLog('ODAG Extension: In edit mode, showing link selector');

                // Show link selector for On-Premise
                if (!isCloud) {
                    html += '<div id="odag-link-selector" style="padding: 20px;">';
                    html += '<div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">🔗 ODAG Link Selector</div>';
                    html += '<div style="color: #666; margin-bottom: 16px;">Select an ODAG link from the list below. The link ID will be saved automatically.</div>';
                    html += '<div style="margin-bottom: 16px;">';
                    html += '<input type="text" id="odag-link-search" placeholder="🔍 Search links by name or template app..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">';
                    html += '</div>';
                    html += '<div id="odag-links-list" style="max-height: 500px; overflow-y: auto;">Loading links...</div>';
                    html += '</div>';
                    html += '</div>'; // Close odag-container
                    $element.html(html);

                    // Fetch all ODAG links
                    const xrfkey = 'abcdefghijklmnop';
                    const linksUrl = currentUrl + '/api/odag/v1/links?xrfkey=' + xrfkey;

                    $.ajax({
                        url: linksUrl,
                        type: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-Qlik-XrfKey': xrfkey
                        },
                        xhrFields: {withCredentials: true},
                        success: function(links) {
                            window.odagAllLinks = links || [];
                            renderLinksList(links);

                            // Add search functionality
                            $('#odag-link-search').on('input', function() {
                                const searchTerm = $(this).val().toLowerCase();
                                const filtered = window.odagAllLinks.filter(function(link) {
                                    const name = (link.name || '').toLowerCase();
                                    const templateName = (link.templateApp && link.templateApp.name || '').toLowerCase();
                                    return name.includes(searchTerm) || templateName.includes(searchTerm);
                                });
                                renderLinksList(filtered);
                            });
                        },
                        error: function(xhr, status, error) {
                            $('#odag-links-list').html('<div style="color: #dc2626;">❌ Failed to fetch ODAG links: ' + xhr.status + ' ' + error + '</div>');
                        }
                    });

                    // Function to render links list
                    function renderLinksList(links) {
                        let linksHtml = '';
                        if (Array.isArray(links) && links.length > 0) {
                            linksHtml += '<div style="color: #16a34a; margin-bottom: 16px;">✅ Found ' + links.length + ' ODAG link(s)</div>';
                            linksHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
                            linksHtml += '<thead><tr style="background: #f3f4f6; text-align: left;">';
                            linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Name</th>';
                            linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Template App</th>';
                            linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Link ID</th>';
                            linksHtml += '<th style="padding: 8px; border: 1px solid #ddd;">Action</th>';
                            linksHtml += '</tr></thead><tbody>';

                            links.forEach(function(link) {
                                const isSelected = link.id === odagConfig.odagLinkId;
                                const rowStyle = isSelected ? 'background: #dcfce7;' : '';
                                linksHtml += '<tr style="border-bottom: 1px solid #ddd; ' + rowStyle + '">';
                                linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">' + (link.name || '(no name)') + '</td>';
                                linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; color: #666; font-size: 12px;">' + (link.templateApp ? link.templateApp.name : 'N/A') + '</td>';
                                linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 10px;">' + link.id + '</td>';
                                linksHtml += '<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">';
                                if (isSelected) {
                                    linksHtml += '<span style="color: #16a34a; font-weight: bold;">✓ Selected</span>';
                                } else {
                                    linksHtml += '<button class="odag-select-link" data-link-id="' + link.id + '" data-link-name="' + (link.name || '(no name)') + '" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Select</button>';
                                }
                                linksHtml += '</td>';
                                linksHtml += '</tr>';
                            });

                            linksHtml += '</tbody></table>';
                        } else {
                            linksHtml += '<div style="color: #dc2626;">❌ No ODAG links found.</div>';
                        }

                        $('#odag-links-list').html(linksHtml);

                        // Add click handlers for select buttons
                        $('.odag-select-link').on('click', function() {
                            const linkId = $(this).data('link-id');
                            const linkName = $(this).data('link-name');

                            // Update the property
                            app.model.engineApp.getProperties().then(function(props) {
                                props.odagConfig = props.odagConfig || {};
                                props.odagConfig.odagLinkId = linkId;
                                props.odagConfig.odagLinkName = linkName;
                                return app.model.engineApp.setProperties(props);
                            }).then(function() {
                                console.log('✅ ODAG Link selected:', linkName, '(' + linkId + ')');
                                // Re-render to show selection
                                renderLinksList(window.odagAllLinks);
                            });
                        });
                    }

                    return qlik.Promise.resolve();
                } else {
                    // Cloud: Show standard edit mode message
                    html += '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; text-align: center;">';
                    html += '<div style="font-size: 48px; margin-bottom: 16px;">✏️ 📝</div>';
                    html += '<div style="font-size: 18px; font-weight: bold; color: #666; margin-bottom: 8px;">Edit Mode</div>';
                    html += '<div style="font-size: 14px; color: #999;">Extension is paused while in edit mode. Exit edit mode to activate.</div>';
                    html += '</div>';
                    html += '</div>'; // Close odag-container
                    $element.html(html);
                    return qlik.Promise.resolve();
                }
            }

            debugLog('ODAG Extension: ODAG Link ID configured, continuing with normal rendering...');

            // Dynamic View Mode - only show latest ODAG app
            if (isDynamicView && odagConfig.odagLinkId) {
                html += '<div class="odag-dynamic-view" style="height: 100%; position: relative;">';

                // Status indicator for latest app (only show in debug mode)
                const debugDisplay = odagConfig.enableDebug ? 'block' : 'none';
                html += '<div id="dynamic-status-' + layout.qInfo.qId + '" style="position: absolute; top: 10px; left: 10px; z-index: 100; ';
                html += 'background: white; border: 1px solid #ccc; border-radius: 4px; padding: 6px 12px; ';
                html += 'font-size: 12px; color: #666; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: ' + debugDisplay + ';">';
                html += 'Loading latest app...';
                html += '</div>';

                // Button container for refresh and cancel
                html += '<div style="position: absolute; top: 10px; right: 10px; z-index: 100; display: flex; gap: 8px;">';

                // Cancel button (hidden by default)
                html += '<button class="odag-cancel-btn" id="cancel-btn-' + layout.qInfo.qId + '" ';
                html += 'style="background: #ef4444; border: 1px solid #dc2626; border-radius: 4px; color: white; ';
                html += 'padding: 6px 12px; cursor: pointer; font-size: 14px; ';
                html += 'box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: none; align-items: center; gap: 4px;">';
                html += '<span style="font-size: 16px;">⏹</span> Cancel';
                html += '</button>';

                // Refresh button
                html += '<button class="odag-refresh-btn" id="refresh-btn-' + layout.qInfo.qId + '" ';
                html += 'style="background: white; border: 1px solid #ccc; border-radius: 4px; ';
                html += 'padding: 6px 12px; cursor: pointer; font-size: 14px; ';
                html += 'box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 4px;">';
                html += '<span style="font-size: 16px;">↻</span> Refresh';
                html += '</button>';

                html += '</div>';

                // Embed container takes full space
                html += '<div class="odag-dynamic-embed" id="dynamic-embed-' + layout.qInfo.qId + '" style="height: 100%; width: 100%;">';
                html += '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">';
                html += 'Waiting for ODAG app...';
                html += '</div>';
                html += '</div>';

                html += '</div>';
            }
            // Main content area - simplified layout: always list left, iframe right
            else if (isLargeView && !isDynamicView) {
                const listWidth = 350; // Fixed width for the list panel

                // Horizontal layout only - list on left, iframe on right
                html += '<div class="odag-content-horizontal">';

                // Apps list panel on the LEFT
                html += '<div class="odag-apps-list-panel" style="width:' + listWidth + 'px;">';
                html += '<div class="list-header">';
                html += '<div class="header-top">';
                html += '<h3>Generated Apps</h3>';
                html += '<div style="display: flex; align-items: center; gap: 8px;">';
                html += '<span class="app-count" id="app-count-' + layout.qInfo.qId + '">0 apps</span>';
                html += '<button class="delete-all-btn" id="delete-all-btn-' + layout.qInfo.qId + '" title="Delete all apps" style="background: transparent; border: none; color: #dc2626; cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;">';
                html += '🗑️';
                html += '</button>';
                html += '</div>';
                html += '</div>';
                html += '<button class="odag-generate-btn-compact" style="';
                html += 'background-color:' + (odagConfig.buttonColor || '#009845') + ';';
                html += 'color:' + (odagConfig.buttonTextColor || '#ffffff') + ';">';
                html += '<span class="btn-icon">⚡</span>';
                html += '<span class="btn-text">' + (odagConfig.buttonText || 'Generate ODAG App') + '</span>';
                html += '</button>';
                html += '</div>';
                html += '<div class="odag-apps-list" id="apps-list-' + layout.qInfo.qId + '">';
                html += '<div class="list-empty">No apps generated yet</div>';
                html += '</div>';
                html += '</div>';

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
            } else if (!isDynamicView) {
                // Small view - just the list with button at top (not for dynamic view)
                html += '<div class="odag-small-view">';
                html += '<div class="small-view-header">';
                html += '<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px;">';
                html += '<div style="display: flex; align-items: center; gap: 8px;">';
                html += '<span class="app-count" id="app-count-' + layout.qInfo.qId + '">0 apps</span>';
                html += '<button class="delete-all-btn" id="delete-all-btn-' + layout.qInfo.qId + '" title="Delete all apps">';
                html += '🗑️';
                html += '</button>';
                html += '</div>';
                html += '</div>';
                html += '<button class="odag-generate-btn-compact" style="';
                html += 'background-color:' + (odagConfig.buttonColor || '#009845') + ';';
                html += 'color:' + (odagConfig.buttonTextColor || '#ffffff') + '; width: 100%;">';
                html += '<span class="btn-icon">⚡</span>';
                html += '<span class="btn-text">' + (odagConfig.buttonText || 'Generate ODAG App') + '</span>';
                html += '</button>';
                html += '</div>';
                html += '<div class="odag-apps-list" id="apps-list-' + layout.qInfo.qId + '"></div>';
                html += '</div>';
            }
            
            html += '</div>';
            
            $element.html(html);

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

                // Store deletedApps globally so restoreDynamicView can access it
                window['deletedApps_' + layout.qInfo.qId] = deletedApps;

                // Function to delete all existing ODAG apps
                const deleteAllODAGApps = function(callback) {
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = 'abcdefghijklmnop';
                const apiUrl = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagConfig.odagLinkId + '/requests?pending=true'
                    : tenantUrl + '/api/odag/v1/links/' + odagConfig.odagLinkId + '/requests?pending=true&xrfkey=' + xrfkey;

                    debugLog('Deleting all existing ODAG apps for Dynamic View...');

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
                            if (result && Array.isArray(result) && result.length > 0) {
                                let deleteCount = result.length;
                                let deletedCount = 0;

                                result.forEach(function(request) {
                                    // Mark as deleted to prevent duplicate deletion attempts
                                    deletedApps.add(request.id);

                                    // Delete the generated app itself, not the request
                                    // Use the /app endpoint to delete the actual app
                                    $.ajax({
                                        url: (window.qlikEnvironment === 'cloud' ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + request.id + '/app?xrfkey=abcdefghijklmnop',
                                        type: 'DELETE',
                                        headers: {
                                            'qlik-csrf-token': getCookie('_csrfToken') || ''
                                        },
                                        xhrFields: {
                                            withCredentials: true
                                        },
                                        success: function() {
                                            deletedCount++;
                                            debugLog('Deleted app:', request.generatedAppName || request.id);
                                            if (deletedCount === deleteCount && callback) {
                                                callback();
                                            }
                                        },
                                        error: function(xhr) {
                                            deletedCount++;
                                            if (xhr.status === 404) {
                                                debugLog('App already deleted:', request.id);
                                            } else {
                                                console.error('Failed to delete app:', request.id, xhr.status, xhr.responseText);
                                            }
                                            // Continue even if delete fails
                                            if (deletedCount === deleteCount && callback) {
                                                callback();
                                            }
                                        }
                                    });
                                });
                            } else {
                                // No apps to delete
                                debugLog('No existing apps to delete');
                                if (callback) callback();
                            }
                        },
                        error: function(xhr) {
                            console.error('Failed to get existing apps:', xhr.responseText);
                            if (callback) callback();
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
                        '<span style="color: #f59e0b;">●</span> Generating new app with current selections...'
                    );

                    // Show cancel button
                    $('#cancel-btn-' + layout.qInfo.qId).show().css('display', 'flex');

                    // Store the old request ID to delete later
                    const oldRequestId = previousRequestId;

                    try {
                        // Build payload with current selections
                        const payload = await buildPayload(app, odagConfig, layout);

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
                                    $.ajax({
                                        url: tenantUrl + '/api/v1/odagrequests/' + odagData.id,
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

                                                    $.ajax({
                                                        url: (window.qlikEnvironment === 'cloud' ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + oldRequestId + '/app?xrfkey=abcdefghijklmnop',
                                                        type: 'DELETE',
                                                        headers: {
                                                            'qlik-csrf-token': getCookie('_csrfToken') || ''
                                                        },
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
                                '<span style="color: #ef4444;">●</span> Failed to generate app'
                            );
                            $('#cancel-btn-' + layout.qInfo.qId).hide();
                            console.error('Failed to generate ODAG app:', result.error);

                            // Show user-friendly error message
                            const errorMsg = result.userMessage || result.error || 'Unknown error';
                            if (result.userMessage && result.userMessage.indexOf('Field Binding Mismatch') !== -1) {
                                alert(errorMsg);
                            }
                        }
                    } catch (error) {
                        console.error('ODAG Generation Error:', error);
                        $('#dynamic-status-' + layout.qInfo.qId).html(
                            '<span style="color: #ef4444;">●</span> Error: ' + error.message
                        );
                        $('#cancel-btn-' + layout.qInfo.qId).hide();
                    } finally {
                        isGenerating = false;
                    }
                };

                const loadLatestODAGApp = function() {
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = 'abcdefghijklmnop';
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
                                        latestAppName = latestApp.generatedAppName || 'Latest ODAG App';

                                        // Store the request ID for deletion later
                                        if (!previousRequestId || previousRequestId !== latestApp.id) {
                                            previousRequestId = latestApp.id;
                                        }

                                        // Update status indicator
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            '<span style="color: #10b981;">●</span> ' + latestAppName
                                        );

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
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            '<span style="color: #f59e0b;">●</span> ' +
                                            (pendingApp.state.charAt(0).toUpperCase() + pendingApp.state.slice(1)) +
                                            ': ' + (pendingApp.generatedAppName || 'New App')
                                        );
                                    }
                                }
                            } else {
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    '<span style="color: #999;">●</span> No ODAG apps yet'
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
                                '<span style="color: #ef4444;">●</span> Error loading apps'
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
                    const theme = odagConfig.embedTheme || 'sense';
                    const allowInteractions = odagConfig.allowInteractions !== false;
                    const hostName = window.location.hostname;

                    // Remove any existing qlik-embed element completely
                    const existingEmbed = $container.find('qlik-embed')[0];
                    if (existingEmbed) {
                        debugLog('Removing existing qlik-embed for complete refresh');
                        existingEmbed.remove();
                    }

                    // Clear container completely
                    $container.empty();

                    // Add small delay to ensure DOM cleanup
                    setTimeout(function() {
                        if (!appId) {
                            $container.html('<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">No app available</div>');
                            return;
                        }

                        // Generate unique key for refresh - include app ID to force new instance
                        const embedKey = 'dynamic-' + appId + '-' + Date.now();

                        // Create qlik-embed element with timestamp to force refresh
                        let embedElement = '<qlik-embed ';
                        embedElement += 'key="' + embedKey + '" ';
                        embedElement += 'data-refresh="' + Date.now() + '" '; // Force refresh attribute

                        // Dynamic View uses sheet ID if configured
                        const sheetId = odagConfig.templateSheetId;
                        const hasValidSheetId = sheetId && typeof sheetId === 'string' && sheetId.trim() !== '';

                        debugLog('loadDynamicEmbed - sheetId check:', {
                            sheetId: sheetId,
                            type: typeof sheetId,
                            hasValidSheetId: hasValidSheetId
                        });

                        if (hasValidSheetId) {
                            embedElement += 'ui="analytics/sheet" ';
                            embedElement += 'app-id="' + appId + '" ';
                            embedElement += 'sheet-id="' + sheetId.trim() + '" ';
                            debugLog('Creating sheet embed with sheetId:', sheetId.trim());
                        } else {
                            // No sheet ID configured, show full app
                            embedElement += 'ui="classic/app" ';
                            embedElement += 'app-id="' + appId + '" ';
                            debugLog('Creating full app embed');
                        }

                        embedElement += 'theme="' + theme + '" ';
                        embedElement += 'host="' + hostName + '" ';
                        embedElement += 'no-cache="true" '; // Add no-cache attribute
                        embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';
                        embedElement += '></qlik-embed>';

                        // Add wrapper
                        let embedHtml = '<div class="qlik-embed-wrapper" style="position: relative; height: 100%; width: 100%; overflow: hidden;">';
                        embedHtml += embedElement;
                        embedHtml += '</div>';

                        $container.html(embedHtml);

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
                    }, 200); // Increased delay to ensure proper cleanup
                };

                // Initial load - Delete all existing apps, then generate a new one
                $('#dynamic-status-' + layout.qInfo.qId).html(
                    '<span style="color: #f59e0b;">●</span> Initializing Dynamic View...'
                );

                // Use sessionStorage to track if we've initialized in this browser session
                const sessionKey = 'dynamicViewInit_' + odagConfig.odagLinkId;
                const hasInitializedThisSession = sessionStorage.getItem(sessionKey);

                if (!hasInitializedThisSession) {
                    // First session load - delete all existing apps and generate fresh
                    debugLog('ODAG Extension: First Dynamic View load - deleting all existing apps...');
                    sessionStorage.setItem(sessionKey, 'true');

                    deleteAllODAGApps(function() {
                        debugLog('ODAG Extension: All existing apps deleted, generating new app...');
                        // After deletion completes, generate a new app
                        setTimeout(async function() {
                            generateNewODAGApp();
                        }, 500);
                    });
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
                                    lastGeneratedPayload = await buildPayload(app, odagConfig, layout);
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
                        } else {
                            // Selections same - remove highlight
                            $('#refresh-btn-' + layout.qInfo.qId).removeClass('needs-refresh');
                        }
                    } catch (error) {
                        debugLog('Error checking selections:', error);
                    }
                };

                // Store check function globally so paint can call it
                window['checkSelectionsChanged_' + layout.qInfo.qId] = checkSelectionsChanged;

                // Listen for selection changes using selection state subscription
                app.selectionState().OnData.bind(function() {
                    debugLog('Selection state changed - checking...');
                    checkSelectionsChanged();
                });

                // Store generateNewODAGApp function globally for restoreDynamicView to access
                window['generateNewODAGApp_' + layout.qInfo.qId] = function() {
                    // Prevent multiple simultaneous clicks
                    if (isGenerating) {
                        debugLog('Generation already in progress, ignoring click');
                        return;
                    }
                    generateNewODAGApp();
                };

                // Store cancel function globally
                window['cancelGeneration_' + layout.qInfo.qId] = function() {
                    if (currentRequestId && confirm('Are you sure you want to cancel the current generation?')) {
                        debugLog('Cancelling generation...');

                        // Stop checking
                        if (checkStatusInterval) {
                            clearInterval(checkStatusInterval);
                            checkStatusInterval = null;
                        }

                        // Cancel via API - Use PUT to update state to 'cancelled'
                        const tenantUrl = window.qlikTenantUrl || window.location.origin;
                        $.ajax({
                            url: tenantUrl + '/api/v1/odagrequests/' + currentRequestId,
                            type: 'PUT',
                            headers: {
                                'qlik-csrf-token': getCookie('_csrfToken') || '',
                                'Content-Type': 'application/json'
                            },
                            data: JSON.stringify({
                                state: 'cancelled'
                            }),
                            xhrFields: {
                                withCredentials: true
                            },
                            success: function() {
                                debugLog('Generation cancelled');
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    '<span style="color: #999;">●</span> Generation cancelled'
                                );
                                $('#cancel-btn-' + layout.qInfo.qId).hide();
                                isGenerating = false;
                                currentRequestId = null;

                                // Reload to get the latest completed app
                                setTimeout(loadLatestODAGApp, 1000);
                            },
                            error: function(xhr) {
                                console.error('Failed to cancel:', xhr.responseText);
                                // Even if cancel fails, reset the UI
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    '<span style="color: #999;">●</span> Cancel failed'
                                );
                                $('#cancel-btn-' + layout.qInfo.qId).hide();
                                isGenerating = false;
                            }
                        });
                    }
                };

                // Handle refresh button click - Generate a NEW app
                $('#refresh-btn-' + layout.qInfo.qId).on('click', function() {
                    debugLog('Refresh clicked - generating new ODAG app...');

                    // Add blur overlay to the embed
                    const $embedContainer = $('#dynamic-embed-' + layout.qInfo.qId);
                    $embedContainer.css('filter', 'blur(3px)');
                    $embedContainer.css('pointer-events', 'none');
                    $embedContainer.css('opacity', '0.6');

                    window['generateNewODAGApp_' + layout.qInfo.qId]();
                });

                // Handle cancel button click
                $('#cancel-btn-' + layout.qInfo.qId).on('click', window['cancelGeneration_' + layout.qInfo.qId]);

                // Load the latest ODAG app on initialization
                loadLatestODAGApp();

                // No need to load regular apps list
                return qlik.Promise.resolve();
                }; // End of initDynamicView function

                // Create restore function to refresh UI without re-initializing
                restoreDynamicView = function(debugLog) {
                    debugLog('Restoring Dynamic View state after resize/edit');

                    // Re-attach button click handlers (they get lost when HTML is recreated)
                    // Access the stored functions from window scope
                    const generateFunc = window['generateNewODAGApp_' + layout.qInfo.qId];
                    const cancelFunc = window['cancelGeneration_' + layout.qInfo.qId];

                    if (generateFunc) {
                        // Refresh button click handler
                        $('#refresh-btn-' + layout.qInfo.qId).off('click').on('click', function() {
                            debugLog('Refresh clicked (restored handler)');

                            // Add blur overlay
                            const $embedContainer = $('#dynamic-embed-' + layout.qInfo.qId);
                            $embedContainer.css('filter', 'blur(3px)');
                            $embedContainer.css('pointer-events', 'none');
                            $embedContainer.css('opacity', '0.6');

                            generateFunc();
                        });
                    }

                    if (cancelFunc) {
                        // Cancel button click handler
                        $('#cancel-btn-' + layout.qInfo.qId).off('click').on('click', cancelFunc);
                    }

                    // Simply call loadLatestODAGApp to refresh the current state
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = 'abcdefghijklmnop';
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
                            if (result && Array.isArray(result) && result.length > 0) {
                                result.sort(function(a, b) {
                                    return new Date(b.createdDate) - new Date(a.createdDate);
                                });

                                // Get deletedApps Set from window scope (if it exists)
                                const deletedAppsSet = window['deletedApps_' + layout.qInfo.qId] || new Set();

                                // Find latest succeeded app that hasn't been deleted
                                const latestApp = result.find(req =>
                                    req.state === 'succeeded' &&
                                    req.generatedApp &&
                                    !deletedAppsSet.has(req.id)
                                );

                                if (latestApp) {
                                    let appId = '';
                                    if (typeof latestApp.generatedApp === 'string') {
                                        appId = latestApp.generatedApp;
                                    } else if (typeof latestApp.generatedApp === 'object' && latestApp.generatedApp.id) {
                                        appId = latestApp.generatedApp.id;
                                    }

                                    // Validate appId before using it
                                    if (appId && appId.trim() !== '') {
                                        const appName = latestApp.generatedAppName || 'Latest ODAG App';
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            '<span style="color: #10b981;">●</span> ' + appName
                                        );

                                        // Reload embed - Dynamic View uses sheet ID if configured
                                        const embedContainer = document.getElementById('dynamic-embed-' + layout.qInfo.qId);
                                        if (embedContainer) {
                                            let embedUrl = '';
                                            const sheetId = odagConfig.templateSheetId;
                                            const hasValidSheetId = sheetId && typeof sheetId === 'string' && sheetId.trim() !== '';

                                            debugLog('restoreDynamicView - sheetId check:', {
                                                sheetId: sheetId,
                                                type: typeof sheetId,
                                                hasValidSheetId: hasValidSheetId
                                            });

                                            if (hasValidSheetId) {
                                                // Show specific sheet
                                                embedUrl = '<qlik-embed ui="analytics/sheet" app-id="' + appId + '" sheet-id="' + sheetId.trim() + '" theme="' + (odagConfig.embedTheme || 'horizon') + '" ' +
                                                          (odagConfig.allowInteractions ? 'select="true" navigate="true"' : '') + ' />';
                                                debugLog('Restoring sheet embed:', sheetId.trim());
                                            } else {
                                                // Show full app
                                                embedUrl = '<qlik-embed ui="classic/app" app-id="' + appId + '" theme="' + (odagConfig.embedTheme || 'horizon') + '" ' +
                                                          (odagConfig.allowInteractions ? 'select="true" navigate="true"' : '') + ' />';
                                                debugLog('Restoring full app embed');
                                            }
                                            debugLog('Restoring embed with appId:', appId);
                                            embedContainer.innerHTML = embedUrl;
                                        }
                                    } else {
                                        // Invalid appId
                                        debugLog('Invalid appId in restore:', appId);
                                        $('#dynamic-status-' + layout.qInfo.qId).html(
                                            '<span style="color: #ef4444;">●</span> Invalid app ID'
                                        );
                                    }
                                } else {
                                    // No app found - show waiting message
                                    debugLog('No existing app found in restore');
                                    $('#dynamic-status-' + layout.qInfo.qId).html(
                                        '<span style="color: #999;">●</span> No ODAG app yet'
                                    );
                                }
                            } else {
                                // No apps exist at all
                                debugLog('No apps in restore');
                                $('#dynamic-status-' + layout.qInfo.qId).html(
                                    '<span style="color: #999;">●</span> No ODAG app yet'
                                );
                            }
                        },
                        error: function(xhr) {
                            debugLog('Failed to restore Dynamic View:', xhr.responseText);
                        }
                    });

                    return qlik.Promise.resolve();
                };
            }

            // Keep track of generated apps (not for dynamic view)
            if (!window.odagGeneratedApps) {
                window.odagGeneratedApps = [];
            }
            
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
                const xrfkey = 'abcdefghijklmnop';

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

                                if (request.generatedApp) {
                                    if (typeof request.generatedApp === 'object' && request.generatedApp.id) {
                                        // It's an object with an id property
                                        generatedAppId = request.generatedApp.id;
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
                                    name: request.generatedAppName
                                });

                                const currentStatus = request.state || 'pending';
                                const previousStatus = previousStatuses[request.id];

                                // Detect if app just succeeded
                                if (currentStatus === 'succeeded' && previousStatus && previousStatus !== 'succeeded') {
                                    newlySucceededApp = {
                                        requestId: request.id,
                                        appId: generatedAppId,
                                        name: request.generatedAppName
                                    };
                                    debugLog('App just succeeded:', newlySucceededApp);
                                }

                                window.odagGeneratedApps.push({
                                    requestId: request.id,
                                    appId: generatedAppId,  // This is the actual generated app ID (extracted from object)
                                    templateAppId: request.templateApp || '', // Template app ID
                                    name: request.generatedAppName || 'Generated App',
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
                                }, 300);
                            }
                        }
                    },
                    error: function(xhr) {
                        console.error('Failed to load existing ODAG requests:', xhr.responseText);
                    }
                });
            };
            
            // Load existing requests on init (not in dynamic view)
            // This ensures the list persists on page reload
            if (odagConfig.odagLinkId && !isDynamicView) {
                // Load ONCE on initial paint
                loadExistingRequests();

                // Function to start monitoring for status updates
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
                            const hasPending = window.odagGeneratedApps &&
                                window.odagGeneratedApps.some(app => {
                                    const isPending = app.status === 'pending' ||
                                        app.status === 'queued' ||
                                        app.status === 'loading' ||
                                        app.status === 'generating' ||
                                        app.status === 'validating' ||
                                        !app.status ||
                                        (app.status !== 'succeeded' && app.status !== 'failed');
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
                    }, 1000)); // Check every 1 second
                };

                // Store function globally so we can call it when generating new apps
                window.startODAGStatusMonitoring = startStatusMonitoring;

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
                }, 100); // Small delay to ensure apps are loaded
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

            // getCookie function moved to top of paint() function for early access
            
            // Get current selections
            const getCurrentSelections = async function(app) {
                return new Promise(function(resolve) {
                    app.getList("CurrentSelections", function(reply) {
                        const selections = [];
                        
                        if (reply.qSelectionObject && reply.qSelectionObject.qSelections) {
                            reply.qSelectionObject.qSelections.forEach(function(selection) {
                                const fieldSelection = {
                                    selectionAppParamType: "Field",
                                    selectionAppParamName: selection.qField,
                                    values: [],
                                    selectedSize: selection.qSelectedCount
                                };
                                
                                if (selection.qSelected) {
                                    const values = selection.qSelected.split(', ');
                                    values.forEach(function(value) {
                                        fieldSelection.values.push({
                                            selStatus: "S",
                                            strValue: value,
                                            numValue: isNaN(value) ? "NaN" : value
                                        });
                                    });
                                }
                                
                                selections.push(fieldSelection);
                            });
                        }
                        
                        resolve(selections);
                    });
                });
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

                    for (const binding of cachedBindings) {
                        const fieldName = binding.selectAppParamName || binding.selectionAppParamName;

                        if (!fieldName) continue;

                        debugLog('Processing binding field:', fieldName);

                        // Check if user selected this field
                        if (selectionMap.has(fieldName)) {
                            // User selected this field - use their selection with selStatus: "S"
                            debugLog('  → User selected this field, using selection');
                            bindSelectionState.push(selectionMap.get(fieldName));
                        } else {
                            // User did NOT select this field - get possible values with selStatus: "O"
                            debugLog('  → User did NOT select this field, getting possible values');
                            try {
                                // Create a temporary list object to get field values
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
                                const possibleValues = [];

                                // Get possible (not excluded) values from list object
                                if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                                    const dataPage = layout.qListObject.qDataPages[0];
                                    debugLog('  → Found', dataPage.qMatrix.length, 'rows for field:', fieldName);

                                    for (const row of dataPage.qMatrix) {
                                        const cell = row[0]; // First column
                                        // Only include possible values (not excluded)
                                        // qState: 'O' = Optional/Possible, 'S' = Selected, 'X' = Excluded
                                        if (cell && (cell.qState === 'O' || cell.qState === 'S')) {
                                            possibleValues.push({
                                                selStatus: 'O',
                                                strValue: cell.qText,
                                                numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum
                                            });
                                        }
                                    }

                                    debugLog('  → Added', possibleValues.length, 'possible values');
                                }

                                // Destroy temporary object
                                await enigmaApp.destroySessionObject(listObj.id);

                                if (possibleValues.length > 0) {
                                    bindSelectionState.push({
                                        selectionAppParamType: 'Field',
                                        selectionAppParamName: fieldName,
                                        values: possibleValues,
                                        selectedSize: 0
                                    });
                                } else {
                                    debugLog('  → WARNING: No possible values found for binding field:', fieldName);
                                }
                            } catch (error) {
                                debugLog('  → ERROR: Could not get possible values for field:', fieldName, error);
                            }
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

                const payload = {
                    clientContextHandle: generateContextHandle(),
                    actualRowEst: 1,
                    selectionApp: appId,
                    bindSelectionState: bindSelectionState,
                    selectionState: selectionState
                };

                if (sheetId) {
                    payload.sheetname = sheetId;
                }

                debugLog('Built payload with binding fields:', {
                    selectionState: selectionState.map(s => s.selectionAppParamName),
                    bindSelectionState: bindSelectionState.map(s => s.selectionAppParamName)
                });

                return payload;
            };
            
            // Make the API call
            const callODAGAPI = async function(odagLinkId, payload) {
                // Use dynamic tenant URL
                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = 'abcdefghijklmnop'; // 16 character key for On-Premise

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
                                    if (errorResponse.errors && errorResponse.errors.length > 0) {
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
            const updateAppsList = function(qId) {
                const $listContainer = $('#apps-list-' + qId);
                const $appCount = $('#app-count-' + qId);
                const elementHeight = $element.height();
                const isLargeView = elementHeight > 400;

                // Update app count
                const appCount = window.odagGeneratedApps.length;
                $appCount.text(appCount + (appCount === 1 ? ' app' : ' apps'));

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
                                             app.status === 'failed' ? '❌' : '⚠';
                            const statusText = app.status === 'succeeded' ? 'Ready' : app.status;
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
                    } else {
                        listHtml += '<div class="menu-item open-app"><span class="menu-icon">🔗</span> Open in new tab</div>';
                        listHtml += '<div class="menu-item reload-app"><span class="menu-icon">🔄</span> Reload data</div>';
                    }

                    listHtml += '<div class="menu-item delete-app"><span class="menu-icon">🗑️</span> Delete app</div>';
                    listHtml += '</div>';
                    listHtml += '</div>';

                    listHtml += '</div>';
                });

                $listContainer.html(listHtml);
                
                // Bind events
                $listContainer.find('.odag-app-item').off('click').on('click', function(e) {
                    if (!$(e.target).hasClass('app-menu-btn') && !$(e.target).hasClass('menu-item')) {
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
                            const theme = odagConfig.embedTheme || 'sense';
                            const allowInteractions = odagConfig.allowInteractions !== false;
                            const hostName = window.location.hostname;

                            let embedElement = '';
                            let embedAppId = '';

                            // Generate a unique key for this embed instance
                            const embedKey = 'embed-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

                            if (odagConfig.templateSheetId && odagConfig.templateSheetId.trim() !== '') {
                                // Show specific sheet from the generated ODAG app
                                // Use the actual generated app ID, not the template
                                embedAppId = actualAppId;
                                debugLog('Using generated ODAG app for sheet view:', embedAppId, 'Sheet:', odagConfig.templateSheetId);

                                embedElement = '<qlik-embed ';
                                embedElement += 'key="' + embedKey + '" ';
                                embedElement += 'ui="analytics/sheet" ';
                                embedElement += 'app-id="' + embedAppId + '" ';
                                embedElement += 'object-id="' + odagConfig.templateSheetId + '" ';
                                embedElement += 'theme="' + theme + '" ';
                                embedElement += 'host="' + hostName + '" ';
                                embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';

                                const context = {
                                    theme: theme,
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

                                embedElement = '<qlik-embed ';
                                embedElement += 'key="' + embedKey + '" ';
                                embedElement += 'ui="classic/app" ';
                                embedElement += 'app-id="' + embedAppId + '" ';
                                embedElement += 'theme="' + theme + '" ';
                                embedElement += 'host="' + hostName + '" ';
                                embedElement += 'style="height: 100%; width: 100%; position: absolute; top: 0; left: 0;" ';
                                embedElement += '></qlik-embed>';
                            }

                            // Replace placeholder with qlik-embed
                            const $container = $('#iframe-container-' + qId);

                            // Clear any existing qlik-embed elements first
                            const existingEmbed = $container.find('qlik-embed')[0];
                            if (existingEmbed) {
                                debugLog('Removing existing qlik-embed element');
                                // Properly dispose of the existing embed
                                existingEmbed.remove();
                            }

                            // Clear the container completely
                            $container.empty();

                            // Add a small delay to ensure proper cleanup
                            setTimeout(function() {
                                // Ensure container is visible
                                $container.show();

                                // Create a wrapper div to contain the qlik-embed properly with relative positioning
                                let embedHtml = '<div class="qlik-embed-wrapper" style="position: relative; height: 100%; width: 100%; overflow: hidden;">';
                                embedHtml += embedElement;
                                embedHtml += '</div>';

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
                            }, 100);
                            
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
                
                $listContainer.find('.app-menu-btn').off('click').on('click', function(e) {
                    e.stopPropagation();
                    const $dropdown = $(this).next('.app-menu-dropdown');
                    $('.app-menu-dropdown').not($dropdown).hide();
                    $dropdown.toggle();
                });
                
                $listContainer.find('.open-app').off('click').on('click', function(e) {
                    e.stopPropagation();
                    const $item = $(this).closest('.odag-app-item');
                    const appIndex = $item.data('app-index');
                    const appData = window.odagGeneratedApps[appIndex];

                    // Extract app ID properly if it's an object
                    let appId = '';
                    if (appData.appId) {
                        if (typeof appData.appId === 'string' && appData.appId !== '[object Object]') {
                            appId = appData.appId;
                        } else if (typeof appData.appId === 'object') {
                            appId = appData.appId.id || appData.appId.appId || appData.appId.resourceId || '';
                            console.warn('Had to extract app ID from object in open-app handler:', appId);
                        }
                    }

                    debugLog('Opening app:', {
                        appId: appId,
                        appData: appData
                    });

                    if (!appId || appId === '[object Object]') {
                        showNotification('App ID not available yet. Please wait for app to be ready.', 'warning');
                        return;
                    }

                    window.open(window.location.origin + '/sense/app/' + appId, '_blank');
                    $(this).closest('.app-menu-dropdown').hide();
                });
                
                $listContainer.find('.cancel-app').off('click').on('click', function(e) {
                    e.stopPropagation();
                    const requestId = $(this).closest('.odag-app-item').data('request-id');
                    const appIndex = $(this).closest('.odag-app-item').data('app-index');
                    const appName = window.odagGeneratedApps[appIndex].name;

                    if (confirm('Are you sure you want to cancel generation of "' + appName + '"?')) {
                        // Cancel ODAG app generation via DELETE
                        const tenantUrl = window.qlikTenantUrl || window.location.origin;
                        $.ajax({
                            url: tenantUrl + '/api/v1/odagrequests/' + requestId,
                            type: 'DELETE',
                            headers: {
                                'qlik-csrf-token': getCookie('_csrfToken') || ''
                            },
                            xhrFields: {
                                withCredentials: true
                            },
                            success: function(result) {
                                debugLog('Generation cancelled successfully');
                                // Remove from list
                                window.odagGeneratedApps.splice(appIndex, 1);
                                updateAppsList(qId);
                            },
                            error: function(xhr) {
                                console.error('Failed to cancel generation:', xhr.responseText);
                                showNotification('Failed to cancel generation', 'error');
                            }
                        });
                    }

                    $(this).closest('.app-menu-dropdown').hide();
                });

                $listContainer.find('.reload-app').off('click').on('click', function(e) {
                    e.stopPropagation();
                    const requestId = $(this).closest('.odag-app-item').data('request-id');
                    const $item = $(this).closest('.odag-app-item');
                    
                    // Reload ODAG app
                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    $.ajax({
                        url: tenantUrl + '/api/v1/odagrequests/' + requestId + '/reloadApp',
                        type: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'qlik-csrf-token': getCookie('_csrfToken') || ''
                        },
                        xhrFields: {
                            withCredentials: true
                        },
                        success: function(result) {
                            showNotification('App reload started successfully!', 'success');
                            $item.addClass('reloading');
                            setTimeout(function() {
                                $item.removeClass('reloading');
                            }, 5000);
                        },
                        error: function(xhr) {
                            showNotification('Failed to reload app', 'error');
                        }
                    });
                    
                    $(this).closest('.app-menu-dropdown').hide();
                });
                
                $listContainer.find('.delete-app').off('click').on('click', function(e) {
                    e.stopPropagation();
                    const requestId = $(this).closest('.odag-app-item').data('request-id');
                    const appIndex = $(this).closest('.odag-app-item').data('app-index');
                    const appName = window.odagGeneratedApps[appIndex].name;
                    
                    if (confirm('Are you sure you want to delete "' + appName + '"?')) {
                        // Delete ODAG app via API
                        const tenantUrl = window.qlikTenantUrl || window.location.origin;
                        $.ajax({
                            url: (window.qlikEnvironment === 'cloud' ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + requestId + '/app?xrfkey=abcdefghijklmnop',
                            type: 'DELETE',
                            headers: {
                                'qlik-csrf-token': getCookie('_csrfToken') || ''
                            },
                            xhrFields: {
                                withCredentials: true
                            },
                            success: function(result) {
                                window.odagGeneratedApps.splice(appIndex, 1);
                                updateAppsList(qId);
                                showNotification('App deleted successfully!', 'success');
                                
                                // Hide iframe if this app was being viewed
                                $('#iframe-container-' + qId).hide();
                            },
                            error: function(xhr) {
                                showNotification('Failed to delete app', 'error');
                            }
                        });
                    }
                });
            };
            
            // Main generate function
            const generateODAGApp = async function() {
                if (!odagConfig.odagLinkId) {
                    showNotification('Please configure ODAG Link ID in properties panel', 'error');
                    return;
                }
                
                const $button = $('.odag-generate-btn-compact');
                $button.addClass('loading').prop('disabled', true);
                
                try {
                    const payload = await buildPayload(app, odagConfig, layout);
                    
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

                        // For field binding errors, show alert instead of notification for more visibility
                        if (result.userMessage && result.userMessage.indexOf('Field Binding Mismatch') !== -1) {
                            alert(errorMsg);
                        } else {
                            showNotification('Failed to generate ODAG app: ' + errorMsg, 'error');
                        }
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

            if (isDynamicView && initDynamicView) {
                if (!window[dynamicViewKey] || configChanged) {
                    // Mark as initialized to prevent duplicate runs
                    window[dynamicViewKey] = true;
                    window[configKey] = currentConfig;

                    if (configChanged) {
                        debugLog('Configuration changed, re-initializing Dynamic View');
                    } else {
                        debugLog('Initializing Dynamic View for the first time');
                    }
                    return initDynamicView(debugLog);
                } else if (restoreDynamicView) {
                    debugLog('Dynamic View already initialized, restoring state');
                    return restoreDynamicView(debugLog);
                }
            } else if (!isDynamicView && window[dynamicViewKey]) {
                // Clean up flags if switching away from dynamic view
                delete window[dynamicViewKey];
                delete window[configKey];
            }

            // Load existing apps on init (not in dynamic view)
            if (!isDynamicView && window.odagGeneratedApps && window.odagGeneratedApps.length > 0) {
                updateAppsList(layout.qInfo.qId);
            }

            // Button click handler (not in dynamic view)
            if (!isDynamicView) {
                $element.find('.odag-generate-btn-compact').on('click', function() {
                    generateODAGApp();
                });

                // Delete all button handler
                $element.find('.delete-all-btn').on('click', function() {
                    const appCount = window.odagGeneratedApps ? window.odagGeneratedApps.length : 0;

                    if (appCount === 0) {
                        showNotification('No apps to delete', 'info');
                        return;
                    }

                    const confirmMessage = 'Are you sure you want to delete all ' + appCount + ' ODAG app' + (appCount > 1 ? 's' : '') + '? This action cannot be undone.';

                    if (confirm(confirmMessage)) {
                        debugLog('Deleting all ODAG apps...');

                        // Show loading state
                        const $btn = $(this);
                        $btn.prop('disabled', true);
                        $btn.html('⏳');

                        const tenantUrl = window.qlikTenantUrl || window.location.origin;
                        let deleteCount = 0;
                        let errorCount = 0;

                        // Delete all apps
                        const deletePromises = window.odagGeneratedApps.map(function(app) {
                            return new Promise(function(resolve) {
                                if (app.requestId) {
                                    $.ajax({
                                        url: tenantUrl + '/api/v1/odagrequests/' + app.requestId + '/app',
                                        type: 'DELETE',
                                        headers: {
                                            'qlik-csrf-token': getCookie('_csrfToken') || ''
                                        },
                                        xhrFields: {
                                            withCredentials: true
                                        },
                                        success: function() {
                                            deleteCount++;
                                            debugLog('Deleted app:', app.name);
                                            resolve();
                                        },
                                        error: function(xhr) {
                                            errorCount++;
                                            console.error('Failed to delete app:', app.name, xhr.responseText);
                                            resolve(); // Still resolve to continue with other deletions
                                        }
                                    });
                                } else {
                                    resolve();
                                }
                            });
                        });

                        // Wait for all deletions to complete
                        Promise.all(deletePromises).then(function() {
                            // Clear the apps array
                            window.odagGeneratedApps = [];

                            // Update the UI
                            updateAppsList(layout.qInfo.qId);

                            // Reset button
                            $btn.prop('disabled', false);
                            $btn.html('🗑️');

                            // Show result
                            if (errorCount > 0) {
                                showNotification('Deleted ' + deleteCount + ' apps. ' + errorCount + ' failed.', 'warning');
                            } else {
                                showNotification('Successfully deleted all ' + deleteCount + ' apps!', 'success');
                            }

                            // Hide iframe since no app is selected
                            $('#iframe-container-' + layout.qInfo.qId).hide();
                        });
                    }
                });
            }

            // Check for selection changes on every paint (for Dynamic View)
            if (isDynamicView && window['checkSelectionsChanged_' + layout.qInfo.qId]) {
                window['checkSelectionsChanged_' + layout.qInfo.qId]();
            }

            return qlik.Promise.resolve();

            } catch (error) {
                console.error('ODAG Extension ERROR:', error);
                $element.html('<div style="padding: 20px; color: red;">Error: ' + error.message + '</div>');
                return qlik.Promise.reject(error);
            }
        }
    };
});