/**
 * ODAG Event Handlers
 * Manages all user interaction handlers (buttons, clicks, etc.)
 *
 * @version 8.0.0
 */

define([
    '../utils/dom-helper',
    '../utils/http-helper',
    '../foundation/odag-constants'
], function(DOM, HTTP, CONSTANTS) {
    'use strict';

    console.log('🔄 ODAG Event Handlers v8.0.0 LOADED - Vanilla JS migration');

    /**
     * Event Handlers Module
     * Extracted from monolithic main file for better maintainability
     */
    const ODAGEventHandlers = {

        /**
         * Setup app item handlers (open, cancel, reload, delete)
         * @param {Element|string} listContainer - Container element or selector
         * @param {string} qId - Extension instance ID
         * @param {Function} updateAppsList - Callback to update apps list
         * @param {Function} showNotification - Notification function
         * @param {Function} debugLog - Debug logging function
         * @param {Function} getCookie - Cookie getter function
         * @param {Function} checkODAGValidation - Validation check callback (optional)
         */
        setupAppItemHandlers: function(listContainer, qId, updateAppsList, showNotification, debugLog, getCookie, checkODAGValidation) {
            const self = this;
            const container = typeof listContainer === 'string' ? DOM.get(listContainer) : listContainer;
            if (!container) return;

            // Open app handler
            const openButtons = DOM.getAll('.open-app', container);
            openButtons.forEach(function(button) {
                DOM.off(button, 'click');
                DOM.on(button, 'click', function(e) {
                    e.stopPropagation();
                    const item = button.closest('.odag-app-item');
                    const appIndex = parseInt(item.getAttribute('data-app-index'), 10);
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
                    const menu = button.closest('.app-menu-dropdown');
                    if (menu) DOM.hide(menu);
                });
            });

            // Cancel app handler
            const cancelButtons = DOM.getAll('.cancel-app', container);
            cancelButtons.forEach(function(button) {
                DOM.off(button, 'click');
                DOM.on(button, 'click', function(e) {
                    e.stopPropagation();
                    const item = button.closest('.odag-app-item');
                    const requestId = item.getAttribute('data-request-id');
                    const appIndex = parseInt(item.getAttribute('data-app-index'), 10);
                    const appName = window.odagGeneratedApps[appIndex].name;

                    if (confirm('Are you sure you want to cancel generation of "' + appName + '"?')) {
                        self._cancelApp(requestId, appIndex, qId, updateAppsList, showNotification, debugLog, getCookie);
                    }

                    const menu = button.closest('.app-menu-dropdown');
                    if (menu) DOM.hide(menu);
                });
            });

            // Reload app handler
            const reloadButtons = DOM.getAll('.reload-app', container);
            reloadButtons.forEach(function(button) {
                DOM.off(button, 'click');
                DOM.on(button, 'click', function(e) {
                    e.stopPropagation();
                    const item = button.closest('.odag-app-item');
                    const requestId = item.getAttribute('data-request-id');
                    const appIndex = parseInt(item.getAttribute('data-app-index'), 10);

                    self._reloadApp(requestId, appIndex, qId, item, updateAppsList, showNotification, debugLog, getCookie);

                    const menu = button.closest('.app-menu-dropdown');
                    if (menu) DOM.hide(menu);
                });
            });

            // Delete app handler
            const deleteButtons = DOM.getAll('.delete-app', container);
            deleteButtons.forEach(function(button) {
                DOM.off(button, 'click');
                DOM.on(button, 'click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    debugLog('Delete button clicked');

                    const item = button.closest('.odag-app-item');
                    const requestId = item.getAttribute('data-request-id');
                    const appIndex = parseInt(item.getAttribute('data-app-index'), 10);
                    const appName = window.odagGeneratedApps[appIndex].name;

                    debugLog('Delete app:', {requestId: requestId, appIndex: appIndex, appName: appName});

                    // Initialize global deletion tracking set if not exists
                    if (!window.odagDeletingRequests) {
                        window.odagDeletingRequests = new Set();
                    }

                    // Check if this request is already being deleted
                    if (window.odagDeletingRequests.has(requestId)) {
                        showNotification('This app is already being deleted', 'warning');
                        return;
                    }

                    debugLog('Showing delete confirmation dialog for:', appName);
                    const confirmed = confirm('Are you sure you want to delete "' + appName + '"?');
                    debugLog('User confirmation result:', confirmed);

                    if (confirmed) {
                        self._deleteApp(requestId, appIndex, qId, updateAppsList, showNotification, debugLog, getCookie, checkODAGValidation);
                    } else {
                        debugLog('Delete cancelled by user');
                    }

                    // Close the menu dropdown regardless of confirmation
                    const menu = button.closest('.app-menu-dropdown');
                    if (menu) DOM.hide(menu);
                });
            });
        },

        /**
         * Setup generate button handler
         * @param {Element|NodeList|string} generateButtons - Generate button element(s) or selector
         * @param {Function} generateODAGApp - Generate app callback
         * @param {Object} odagConfig - ODAG configuration
         */
        setupGenerateHandler: function(generateButtons, generateODAGApp, odagConfig) {
            let buttons = generateButtons;

            // Convert to array if needed
            if (typeof generateButtons === 'string') {
                buttons = DOM.getAll(generateButtons);
            } else if (generateButtons instanceof Element) {
                buttons = [generateButtons];
            } else if (generateButtons instanceof NodeList) {
                buttons = Array.from(generateButtons);
            }

            buttons.forEach(function(button) {
                DOM.on(button, 'click', function(e) {
                    console.log('🔘 Generate button clicked!', {
                        odagLinkId: odagConfig.odagLinkId,
                        bindingsCached: !!window['odagBindings_' + odagConfig.odagLinkId],
                        buttonElement: button
                    });
                    e.preventDefault();
                    e.stopPropagation();
                    generateODAGApp();
                });
            });
        },

        /**
         * Setup delete all button handler
         * @param {Element|string} element - Extension element or selector
         * @param {Object} layout - Extension layout
         * @param {Function} updateAppsList - Callback to update apps list
         * @param {Function} showNotification - Notification function
         * @param {Function} debugLog - Debug logging function
         * @param {Function} getCookie - Cookie getter function
         * @param {Function} checkODAGValidation - Validation check callback (optional)
         */
        setupDeleteAllHandler: function(element, layout, updateAppsList, showNotification, debugLog, getCookie, checkODAGValidation) {
            const self = this;
            const el = typeof element === 'string' ? DOM.get(element) : element;
            if (!el) return;

            const deleteAllBtn = DOM.get('.delete-all-btn', el);
            if (!deleteAllBtn) return;

            DOM.on(deleteAllBtn, 'click', function() {
                const appCount = window.odagGeneratedApps ? window.odagGeneratedApps.length : 0;

                if (appCount === 0) {
                    showNotification('No apps to delete', 'info');
                    return;
                }

                const confirmMessage = 'Are you sure you want to delete all ' + appCount + ' ODAG app' + (appCount > 1 ? 's' : '') + '? This action cannot be undone.';

                if (confirm(confirmMessage)) {
                    debugLog('Deleting all ODAG apps...');

                    // Initialize global deletion tracking set if not exists
                    if (!window.odagDeletingRequests) {
                        window.odagDeletingRequests = new Set();
                    }

                    // Show loading state
                    deleteAllBtn.disabled = true;
                    DOM.setHTML(deleteAllBtn, '⏳');

                    const tenantUrl = window.qlikTenantUrl || window.location.origin;
                    const isCloud = window.qlikEnvironment === 'cloud';
                    const xrfkey = CONSTANTS.API.XRF_KEY;
                    let deleteCount = 0;
                    let errorCount = 0;
                    let skippedCount = 0;

                    // Delete all apps
                    const deletePromises = window.odagGeneratedApps.map(function(app) {
                        return new Promise(function(resolve) {
                            if (app.requestId) {
                                // Skip if already being deleted
                                if (window.odagDeletingRequests.has(app.requestId)) {
                                    skippedCount++;
                                    debugLog('Skipping already-deleting app:', app.name);
                                    resolve();
                                    return;
                                }

                                // Mark as being deleted
                                window.odagDeletingRequests.add(app.requestId);

                                // Check app status to determine delete method
                                const isCancelled = app.status === 'cancelled';
                                const isFailed = app.status === 'failed';

                                // Build proper URL, method and headers based on status and environment
                                let deleteUrl, deleteMethod;

                                if (isCancelled) {
                                    // Cancelled apps need ackcancel action
                                    if (isCloud) {
                                        deleteUrl = tenantUrl + '/api/v1/odagrequests/' + app.requestId +
                                            '?requestId=' + app.requestId +
                                            '&action=ackcancel' +
                                            '&ignoreSucceeded=true' +
                                            '&delGenApp=true' +
                                            '&autoAck=true';
                                    } else {
                                        deleteUrl = tenantUrl + '/api/odag/v1/requests/' + app.requestId +
                                            '?requestId=' + app.requestId +
                                            '&action=ackcancel' +
                                            '&ignoreSucceeded=true' +
                                            '&delGenApp=true' +
                                            '&autoAck=true' +
                                            '&xrfkey=' + xrfkey;
                                    }
                                    deleteMethod = 'PUT';
                                } else if (isFailed) {
                                    // Failed apps need ackfailure action
                                    if (isCloud) {
                                        deleteUrl = tenantUrl + '/api/v1/odagrequests/' + app.requestId +
                                            '?requestId=' + app.requestId +
                                            '&action=ackfailure' +
                                            '&ignoreSucceeded=true' +
                                            '&delGenApp=true' +
                                            '&autoAck=true';
                                    } else {
                                        deleteUrl = tenantUrl + '/api/odag/v1/requests/' + app.requestId +
                                            '?requestId=' + app.requestId +
                                            '&action=ackfailure' +
                                            '&ignoreSucceeded=true' +
                                            '&delGenApp=true' +
                                            '&autoAck=true' +
                                            '&xrfkey=' + xrfkey;
                                    }
                                    deleteMethod = 'PUT';
                                } else {
                                    // Normal delete for succeeded apps
                                    deleteUrl = (isCloud
                                        ? tenantUrl + '/api/v1/odagrequests/'
                                        : tenantUrl + '/api/odag/v1/requests/') + app.requestId + '/app?xrfkey=' + xrfkey;
                                    deleteMethod = 'DELETE';
                                }

                                const deleteHeaders = isCloud
                                    ? { 'qlik-csrf-token': getCookie('_csrfToken') || '' }
                                    : {
                                        'X-Qlik-XrfKey': xrfkey,
                                        'Content-Type': 'application/json'
                                      };

                                HTTP.request({
                                    url: deleteUrl,
                                    method: deleteMethod,
                                    headers: deleteHeaders
                                }).then(function() {
                                    deleteCount++;
                                    debugLog('Deleted app:', app.name);
                                    resolve();
                                }).catch(function(error) {
                                    // Remove from deleting set on non-404 errors
                                    if (error.status !== 404) {
                                        window.odagDeletingRequests.delete(app.requestId);
                                    }

                                    if (error.status === 404) {
                                        // Already deleted, count as success
                                        deleteCount++;
                                        debugLog('App already deleted:', app.name);
                                    } else {
                                        errorCount++;
                                        console.error('Failed to delete app:', app.name, error.status, error.message);
                                    }
                                    resolve(); // Still resolve to continue with other deletions
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

                        // Re-run validation to check if generate button should be re-enabled
                        if (checkODAGValidation) {
                            debugLog('Re-running validation after deleting all apps');
                            checkODAGValidation();
                        }

                        // Reset button
                        deleteAllBtn.disabled = false;
                        DOM.setHTML(deleteAllBtn, '🗑️');

                        // Show result
                        if (errorCount > 0) {
                            showNotification('Deleted ' + deleteCount + ' apps. ' + errorCount + ' failed.', 'warning');
                        } else {
                            showNotification('Successfully deleted all ' + deleteCount + ' apps!', 'success');
                        }

                        // Hide iframe since no app is selected
                        const iframeContainer = DOM.get('#iframe-container-' + layout.qInfo.qId);
                        if (iframeContainer) DOM.hide(iframeContainer);
                    });
                }
            });
        },

        /**
         * Setup refresh list button handler
         * @param {Element|string} element - Extension element or selector
         * @param {Function} pollODAGStatus - Polling function
         */
        setupRefreshHandler: function(element, pollODAGStatus) {
            const el = typeof element === 'string' ? DOM.get(element) : element;
            if (!el) return;

            const refreshBtn = DOM.get('.refresh-list-btn', el);
            if (refreshBtn) {
                DOM.on(refreshBtn, 'click', function() {
                    pollODAGStatus();
                });
            }
        },

        /**
         * Setup sidebar toggle handler
         * @param {Element|string} element - Extension element or selector
         * @param {Object} layout - Extension layout
         */
        setupSidebarToggleHandler: function(element, layout) {
            const el = typeof element === 'string' ? DOM.get(element) : element;
            if (!el) return;

            const toggleBtn = DOM.get('.sidebar-toggle-btn', el);
            if (!toggleBtn) return;

            DOM.on(toggleBtn, 'click', function() {
                const qId = layout.qInfo.qId;
                const panel = DOM.get('#apps-list-panel-' + qId);
                const iframe = DOM.get('#iframe-container-' + qId);
                const arrow = DOM.get('span', toggleBtn);
                const listWidth = 350;

                // Check if sidebar is currently hidden
                const isHidden = panel.style.marginLeft === '-' + listWidth + 'px';

                if (isHidden) {
                    // Show sidebar
                    panel.style.marginLeft = '0';
                    toggleBtn.style.left = listWidth + 'px';
                    if (arrow) DOM.setText(arrow, '◀');
                } else {
                    // Hide sidebar
                    panel.style.marginLeft = '-' + listWidth + 'px';
                    toggleBtn.style.left = '0';
                    if (arrow) DOM.setText(arrow, '▶');
                }
            });
        },

        /**
         * Setup app menu button handler (three dots)
         * @param {Element|string} listContainer - Container element or selector
         */
        setupAppMenuHandler: function(listContainer) {
            const container = typeof listContainer === 'string' ? DOM.get(listContainer) : listContainer;
            if (!container) return;

            const menuButtons = DOM.getAll('.app-menu-btn', container);
            menuButtons.forEach(function(button) {
                DOM.off(button, 'click');
                DOM.on(button, 'click', function(e) {
                    e.stopPropagation();
                    const menu = button.parentElement.querySelector('.app-menu-dropdown');
                    if (!menu) return;

                    // Hide all other menus
                    const allMenus = DOM.getAll('.app-menu-dropdown');
                    allMenus.forEach(function(m) {
                        if (m !== menu) DOM.hide(m);
                    });

                    // Toggle this menu
                    DOM.toggle(menu);
                });
            });

            // Close menu when clicking outside
            DOM.on(document, 'click', function(e) {
                const target = e.target;
                if (!target.closest('.app-menu-btn') && !target.closest('.app-menu-dropdown')) {
                    const allMenus = DOM.getAll('.app-menu-dropdown');
                    allMenus.forEach(function(menu) {
                        DOM.hide(menu);
                    });
                }
            });
        },

        /**
         * Setup app item click handler (for viewing in iframe)
         * @param {Element|string} listContainer - Container element or selector
         * @param {string} qId - Extension instance ID
         * @param {Function} debugLog - Debug logging function
         */
        setupAppItemClickHandler: function(listContainer, qId, debugLog) {
            const container = typeof listContainer === 'string' ? DOM.get(listContainer) : listContainer;
            if (!container) return;

            const appItems = DOM.getAll('.odag-app-item', container);
            appItems.forEach(function(item) {
                DOM.off(item, 'click');
                DOM.on(item, 'click', function(e) {
                    // Don't trigger if clicking on menu button or menu items
                    if (e.target.closest('.app-menu-btn') || e.target.closest('.app-menu-dropdown')) {
                        return;
                    }

                    const appIndex = parseInt(item.getAttribute('data-app-index'), 10);
                    const appData = window.odagGeneratedApps[appIndex];

                    // Extract app ID properly if it's an object
                    let appId = '';
                    if (appData.appId) {
                        if (typeof appData.appId === 'string' && appData.appId !== '[object Object]') {
                            appId = appData.appId;
                        } else if (typeof appData.appId === 'object') {
                            appId = appData.appId.id || appData.appId.appId || appData.appId.resourceId || '';
                            console.warn('Had to extract app ID from object:', appId);
                        }
                    }

                    debugLog('App item clicked:', {
                        appId: appId,
                        appData: appData,
                        status: appData.status
                    });

                    if (!appId || appId === '[object Object]') {
                        console.warn('App ID not available yet, status:', appData.status);
                        return;
                    }

                    if (appData.status !== 'succeeded') {
                        console.warn('App not ready yet, status:', appData.status);
                        return;
                    }

                    // Highlight selected app
                    const allItems = DOM.getAll('.odag-app-item', container);
                    allItems.forEach(function(i) {
                        DOM.removeClass(i, 'selected');
                    });
                    DOM.addClass(item, 'selected');

                    // Show iframe with app
                    const iframeContainer = DOM.get('#iframe-container-' + qId);
                    const appUrl = window.location.origin + '/sense/app/' + appId;

                    DOM.setHTML(iframeContainer, '<iframe src="' + appUrl + '" style="width:100%;height:100%;border:none;"></iframe>');
                    DOM.show(iframeContainer);
                });
            });
        },

        /**
         * Setup mobile dropdown selector
         * @param {Element|string} element - Extension element or selector
         * @param {string} qId - Extension instance ID
         * @param {Function} debugLog - Debug logging function
         */
        setupMobileDropdownHandler: function(element, qId, debugLog) {
            const el = typeof element === 'string' ? DOM.get(element) : element;
            if (!el) return;

            const mobileSelector = DOM.get('.mobile-app-selector', el);
            if (!mobileSelector) return;

            DOM.on(mobileSelector, 'change', function() {
                const selectedAppId = mobileSelector.value;

                if (!selectedAppId || selectedAppId === '') {
                    const iframeContainer = DOM.get('#iframe-container-' + qId);
                    if (iframeContainer) DOM.hide(iframeContainer);
                    return;
                }

                // Find app in generated apps
                const appData = window.odagGeneratedApps.find(function(app) {
                    let appId = '';
                    if (app.appId) {
                        if (typeof app.appId === 'string') {
                            appId = app.appId;
                        } else if (typeof app.appId === 'object') {
                            appId = app.appId.id || app.appId.appId || app.appId.resourceId || '';
                        }
                    }
                    return appId === selectedAppId;
                });

                if (!appData) {
                    console.warn('App not found for ID:', selectedAppId);
                    return;
                }

                debugLog('Mobile dropdown app selected:', {
                    appId: selectedAppId,
                    appData: appData
                });

                if (appData.status !== 'succeeded') {
                    console.warn('App not ready yet, status:', appData.status);
                    return;
                }

                // Show iframe with app
                const iframeContainer = DOM.get('#iframe-container-' + qId);
                const appUrl = window.location.origin + '/sense/app/' + selectedAppId;

                DOM.setHTML(iframeContainer, '<iframe src="' + appUrl + '" style="width:100%;height:100%;border:none;"></iframe>');
                DOM.show(iframeContainer);
            });
        },

        // ==================== Private Methods ====================

        /**
         * Cancel app generation
         * @private
         */
        _cancelApp: function(requestId, appIndex, qId, updateAppsList, showNotification, debugLog, getCookie) {
            const tenantUrl = window.qlikTenantUrl || window.location.origin;
            const isCloud = window.qlikEnvironment === 'cloud';

            // Cloud and On-Premise both use PUT with query parameters to cancel
            const xrfkey = CONSTANTS.API.XRF_KEY;
            const cancelUrl = isCloud
                ? tenantUrl + '/api/v1/odagrequests/' + requestId +
                    '?requestId=' + requestId +
                    '&action=cancel' +
                    '&ignoreSucceeded=true' +
                    '&delGenApp=false' +
                    '&autoAck=false'
                : tenantUrl + '/api/odag/v1/requests/' + requestId +
                    '?requestId=' + requestId +
                    '&action=cancel' +
                    '&ignoreSucceeded=true' +
                    '&delGenApp=false' +
                    '&autoAck=false' +
                    '&xrfkey=' + xrfkey;

            const headers = isCloud
                ? { 'qlik-csrf-token': getCookie('_csrfToken') || '' }
                : { 'X-Qlik-XrfKey': xrfkey };

            HTTP.put(cancelUrl, null, { headers: headers })
                .then(function(result) {
                    debugLog('Generation cancelled successfully (' + (isCloud ? 'Cloud' : 'On-Premise') + ')');
                    // Update status to 'cancelled' instead of removing
                    window.odagGeneratedApps[appIndex].status = 'cancelled';
                    updateAppsList(qId);
                    showNotification('Generation cancelled', 'success');
                })
                .catch(function(error) {
                    console.error('Failed to cancel generation:', error.message);
                    showNotification('Failed to cancel generation', 'error');
                });
        },

        /**
         * Reload app
         * @private
         */
        _reloadApp: function(requestId, appIndex, qId, item, updateAppsList, showNotification, debugLog, getCookie) {
            const tenantUrl = window.qlikTenantUrl || window.location.origin;
            const isCloud = window.qlikEnvironment === 'cloud';
            const xrfkey = CONSTANTS.API.XRF_KEY;

            // Note: Reload endpoint may not be available in On-Premise
            const reloadUrl = isCloud
                ? tenantUrl + '/api/v1/odagrequests/' + requestId + '/reloadApp'
                : tenantUrl + '/api/odag/v1/requests/' + requestId + '/reloadApp';

            const reloadHeaders = {
                'Content-Type': 'application/json',
                'qlik-csrf-token': getCookie('_csrfToken') || ''
            };

            HTTP.post(reloadUrl, null, { headers: reloadHeaders })
                .then(function(result) {
                    showNotification('App reload started successfully!', 'success');
                    DOM.addClass(item, 'reloading');

                    debugLog('Reload started, polling for updated timestamp...');

                    // Poll for updated request data to get new timestamp
                    const pollInterval = setInterval(function() {
                        const requestUrl = isCloud
                            ? tenantUrl + '/api/v1/odagrequests/' + requestId
                            : tenantUrl + '/api/odag/v1/requests/' + requestId + '?xrfkey=' + xrfkey;

                        const pollHeaders = isCloud
                            ? {
                                'Accept': 'application/json',
                                'qlik-csrf-token': getCookie('_csrfToken') || ''
                              }
                            : {
                                'Accept': 'application/json',
                                'X-Qlik-XrfKey': xrfkey
                              };

                        HTTP.get(requestUrl, { headers: pollHeaders })
                            .then(function(requestData) {
                                // Update the app entry with new modifiedDate
                                if (window.odagGeneratedApps && window.odagGeneratedApps[appIndex]) {
                                    const oldDate = window.odagGeneratedApps[appIndex].created;
                                    const newDate = requestData.modifiedDate || requestData.createdDate;

                                    if (newDate && newDate !== oldDate) {
                                        debugLog('Updating app timestamp:', {
                                            old: oldDate,
                                            new: newDate
                                        });

                                        window.odagGeneratedApps[appIndex].created = newDate;
                                        updateAppsList(qId);

                                        // Stop polling once we get the updated timestamp
                                        clearInterval(pollInterval);
                                        DOM.removeClass(item, 'reloading');
                                        showNotification('App reloaded and timestamp updated!', 'success');
                                    }
                                }
                            })
                            .catch(function() {
                                debugLog('Error polling for request data');
                            });
                    }, 2000); // Poll every 2 seconds

                    // Stop polling after 30 seconds max
                    setTimeout(function() {
                        clearInterval(pollInterval);
                        DOM.removeClass(item, 'reloading');
                    }, 30000);
                })
                .catch(function(error) {
                    showNotification('Failed to reload app', 'error');
                });
        },

        /**
         * Delete single app
         * @private
         */
        _deleteApp: function(requestId, appIndex, qId, updateAppsList, showNotification, debugLog, getCookie, checkODAGValidation) {
            debugLog('Starting delete request for:', requestId);
            // Mark as being deleted
            window.odagDeletingRequests.add(requestId);

            // Get app status to determine delete method
            const appStatus = window.odagGeneratedApps[appIndex].status;
            const isCancelled = appStatus === 'cancelled';
            const isFailed = appStatus === 'failed';

            // Delete ODAG app via API
            const tenantUrl = window.qlikTenantUrl || window.location.origin;
            const isCloud = window.qlikEnvironment === 'cloud';
            const xrfkey = CONSTANTS.API.XRF_KEY;

            // Build headers for Cloud vs On-Premise
            const deleteHeaders = isCloud
                ? { 'qlik-csrf-token': getCookie('_csrfToken') || '' }
                : {
                    'X-Qlik-XrfKey': xrfkey,
                    'Content-Type': 'application/json'
                  };

            // Different statuses need different delete endpoints:
            // - cancelled: PUT with action=ackcancel
            // - failed: PUT with action=ackfailure
            // - succeeded: DELETE /app endpoint
            let deleteUrl, deleteMethod;

            if (isCancelled) {
                // Cancelled apps need ackcancel action
                if (isCloud) {
                    deleteUrl = tenantUrl + '/api/v1/odagrequests/' + requestId +
                        '?requestId=' + requestId +
                        '&action=ackcancel' +
                        '&ignoreSucceeded=true' +
                        '&delGenApp=true' +
                        '&autoAck=true';
                    debugLog('Delete cancelled app (Cloud):', deleteUrl);
                } else {
                    deleteUrl = tenantUrl + '/api/odag/v1/requests/' + requestId +
                        '?requestId=' + requestId +
                        '&action=ackcancel' +
                        '&ignoreSucceeded=true' +
                        '&delGenApp=true' +
                        '&autoAck=true' +
                        '&xrfkey=' + xrfkey;
                    debugLog('Delete cancelled app (On-Premise):', deleteUrl);
                }
                deleteMethod = 'PUT';
            } else if (isFailed) {
                // Failed apps need ackfailure action
                if (isCloud) {
                    deleteUrl = tenantUrl + '/api/v1/odagrequests/' + requestId +
                        '?requestId=' + requestId +
                        '&action=ackfailure' +
                        '&ignoreSucceeded=true' +
                        '&delGenApp=true' +
                        '&autoAck=true';
                    debugLog('Delete failed app (Cloud):', deleteUrl);
                } else {
                    deleteUrl = tenantUrl + '/api/odag/v1/requests/' + requestId +
                        '?requestId=' + requestId +
                        '&action=ackfailure' +
                        '&ignoreSucceeded=true' +
                        '&delGenApp=true' +
                        '&autoAck=true' +
                        '&xrfkey=' + xrfkey;
                    debugLog('Delete failed app (On-Premise):', deleteUrl);
                }
                deleteMethod = 'PUT';
            } else {
                // Normal delete for succeeded apps
                deleteUrl = (isCloud ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + requestId + '/app?xrfkey=' + xrfkey;
                deleteMethod = 'DELETE';
                debugLog('Delete succeeded app (standard):', deleteUrl);
            }

            HTTP.request({
                url: deleteUrl,
                method: deleteMethod,
                headers: deleteHeaders
            }).then(function(result) {
                window.odagGeneratedApps.splice(appIndex, 1);
                updateAppsList(qId);
                showNotification('App deleted successfully!', 'success');

                // Hide iframe if this app was being viewed
                const iframeContainer = DOM.get('#iframe-container-' + qId);
                if (iframeContainer) DOM.hide(iframeContainer);

                // Re-run validation to check if generate button should be re-enabled
                if (checkODAGValidation) {
                    debugLog('Re-running validation after app deletion');
                    checkODAGValidation();
                }
            }).catch(function(error) {
                // Remove from deleting set on error (unless it's 404, which means already deleted)
                if (error.status !== 404) {
                    window.odagDeletingRequests.delete(requestId);
                }

                if (error.status === 404) {
                    showNotification('App was already deleted', 'info');
                    // Remove from our local array too
                    window.odagGeneratedApps.splice(appIndex, 1);
                    updateAppsList(qId);

                    // Re-run validation to check if generate button should be re-enabled
                    if (checkODAGValidation) {
                        debugLog('Re-running validation after app deletion (404)');
                        checkODAGValidation();
                    }
                } else {
                    showNotification('Failed to delete app: ' + error.status + ' ' + error.statusText, 'error');
                    console.error('Delete failed:', error.message);
                }
            });
        }
    };

    return ODAGEventHandlers;
});
