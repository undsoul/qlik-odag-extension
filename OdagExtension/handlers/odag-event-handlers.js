/**
 * ODAG Event Handlers
 * Manages all user interaction handlers (buttons, clicks, etc.)
 *
 * @version 6.0.0
 */

define([
    'jquery',
    '../foundation/odag-constants'
], function($, CONSTANTS) {
    'use strict';

    /**
     * Event Handlers Module
     * Extracted from monolithic main file for better maintainability
     */
    const ODAGEventHandlers = {

        /**
         * Setup app item handlers (open, cancel, reload, delete)
         * @param {jQuery} $listContainer - Container element
         * @param {string} qId - Extension instance ID
         * @param {Function} updateAppsList - Callback to update apps list
         * @param {Function} showNotification - Notification function
         * @param {Function} debugLog - Debug logging function
         * @param {Function} getCookie - Cookie getter function
         * @param {Function} checkODAGValidation - Validation check callback (optional)
         */
        setupAppItemHandlers: function($listContainer, qId, updateAppsList, showNotification, debugLog, getCookie, checkODAGValidation) {
            const self = this;

            // Open app handler
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

            // Cancel app handler
            $listContainer.find('.cancel-app').off('click').on('click', function(e) {
                e.stopPropagation();
                const requestId = $(this).closest('.odag-app-item').data('request-id');
                const appIndex = $(this).closest('.odag-app-item').data('app-index');
                const appName = window.odagGeneratedApps[appIndex].name;

                if (confirm('Are you sure you want to cancel generation of "' + appName + '"?')) {
                    self._cancelApp(requestId, appIndex, qId, updateAppsList, showNotification, debugLog, getCookie);
                }

                $(this).closest('.app-menu-dropdown').hide();
            });

            // Reload app handler
            $listContainer.find('.reload-app').off('click').on('click', function(e) {
                e.stopPropagation();
                const requestId = $(this).closest('.odag-app-item').data('request-id');
                const $item = $(this).closest('.odag-app-item');

                self._reloadApp(requestId, $item, showNotification, getCookie);

                $(this).closest('.app-menu-dropdown').hide();
            });

            // Delete app handler
            $listContainer.find('.delete-app').off('click').on('click', function(e) {
                e.stopPropagation();
                e.preventDefault();

                debugLog('Delete button clicked');

                const requestId = $(this).closest('.odag-app-item').data('request-id');
                const appIndex = $(this).closest('.odag-app-item').data('app-index');
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
                $(this).closest('.app-menu-dropdown').hide();
            });
        },

        /**
         * Setup generate button handler
         * @param {jQuery} $generateButtons - Generate button elements
         * @param {Function} generateODAGApp - Generate app callback
         * @param {Object} odagConfig - ODAG configuration
         */
        setupGenerateHandler: function($generateButtons, generateODAGApp, odagConfig) {
            $generateButtons.on('click', function(e) {
                console.log('🔘 Generate button clicked!', {
                    odagLinkId: odagConfig.odagLinkId,
                    bindingsCached: !!window['odagBindings_' + odagConfig.odagLinkId],
                    buttonElement: this
                });
                e.preventDefault();
                e.stopPropagation();
                generateODAGApp();
            });
        },

        /**
         * Setup delete all button handler
         * @param {jQuery} $element - Extension element
         * @param {Object} layout - Extension layout
         * @param {Function} updateAppsList - Callback to update apps list
         * @param {Function} showNotification - Notification function
         * @param {Function} debugLog - Debug logging function
         * @param {Function} getCookie - Cookie getter function
         */
        setupDeleteAllHandler: function($element, layout, updateAppsList, showNotification, debugLog, getCookie) {
            const self = this;

            $element.find('.delete-all-btn').on('click', function() {
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
                    const $btn = $(this);
                    $btn.prop('disabled', true);
                    $btn.html('⏳');

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

                                // Check if app is cancelled
                                const isCancelled = app.status === 'cancelled';

                                // Build proper URL, method and headers based on status and environment
                                let deleteUrl, deleteMethod;

                                if (isCancelled) {
                                    // Cancelled apps need special action parameter
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
                                } else {
                                    // Normal delete for succeeded/failed apps
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

                                $.ajax({
                                    url: deleteUrl,
                                    type: deleteMethod,
                                    headers: deleteHeaders,
                                    xhrFields: {
                                        withCredentials: true
                                    },
                                    success: function() {
                                        deleteCount++;
                                        debugLog('Deleted app:', app.name);
                                        resolve();
                                    },
                                    error: function(xhr) {
                                        // Remove from deleting set on non-404 errors
                                        if (xhr.status !== 404) {
                                            window.odagDeletingRequests.delete(app.requestId);
                                        }

                                        if (xhr.status === 404) {
                                            // Already deleted, count as success
                                            deleteCount++;
                                            debugLog('App already deleted:', app.name);
                                        } else {
                                            errorCount++;
                                            console.error('Failed to delete app:', app.name, xhr.status, xhr.responseText);
                                        }
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
        },

        /**
         * Setup refresh list button handler
         * @param {jQuery} $element - Extension element
         * @param {Function} pollODAGStatus - Polling function
         */
        setupRefreshHandler: function($element, pollODAGStatus) {
            $element.find('.refresh-list-btn').on('click', function() {
                pollODAGStatus();
            });
        },

        /**
         * Setup sidebar toggle handler
         * @param {jQuery} $element - Extension element
         * @param {Object} layout - Extension layout
         */
        setupSidebarToggleHandler: function($element, layout) {
            $element.find('.sidebar-toggle-btn').on('click', function() {
                const qId = layout.qInfo.qId;
                const $panel = $('#apps-list-panel-' + qId);
                const $iframe = $('#iframe-container-' + qId);
                const $toggleBtn = $(this);
                const $arrow = $toggleBtn.find('span');
                const listWidth = 350;

                // Check if sidebar is currently hidden
                const isHidden = $panel.css('margin-left') === '-' + listWidth + 'px';

                if (isHidden) {
                    // Show sidebar
                    $panel.css('margin-left', '0');
                    $toggleBtn.css('left', listWidth + 'px');
                    $arrow.text('◀');
                } else {
                    // Hide sidebar
                    $panel.css('margin-left', '-' + listWidth + 'px');
                    $toggleBtn.css('left', '0');
                    $arrow.text('▶');
                }
            });
        },

        /**
         * Setup app menu button handler (three dots)
         * @param {jQuery} $listContainer - Container element
         */
        setupAppMenuHandler: function($listContainer) {
            $listContainer.find('.app-menu-btn').off('click').on('click', function(e) {
                e.stopPropagation();
                const $menu = $(this).siblings('.app-menu-dropdown');

                // Hide all other menus
                $('.app-menu-dropdown').not($menu).hide();

                // Toggle this menu
                $menu.toggle();
            });

            // Close menu when clicking outside
            $(document).on('click', function(e) {
                if (!$(e.target).closest('.app-menu-btn, .app-menu-dropdown').length) {
                    $('.app-menu-dropdown').hide();
                }
            });
        },

        /**
         * Setup app item click handler (for viewing in iframe)
         * @param {jQuery} $listContainer - Container element
         * @param {string} qId - Extension instance ID
         * @param {Function} debugLog - Debug logging function
         */
        setupAppItemClickHandler: function($listContainer, qId, debugLog) {
            $listContainer.find('.odag-app-item').off('click').on('click', function(e) {
                // Don't trigger if clicking on menu button or menu items
                if ($(e.target).closest('.app-menu-btn, .app-menu-dropdown').length) {
                    return;
                }

                const appIndex = $(this).data('app-index');
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
                $listContainer.find('.odag-app-item').removeClass('selected');
                $(this).addClass('selected');

                // Show iframe with app
                const $iframeContainer = $('#iframe-container-' + qId);
                const appUrl = window.location.origin + '/sense/app/' + appId;

                $iframeContainer.html('<iframe src="' + appUrl + '" style="width:100%;height:100%;border:none;"></iframe>');
                $iframeContainer.show();
            });
        },

        /**
         * Setup mobile dropdown selector
         * @param {jQuery} $element - Extension element
         * @param {string} qId - Extension instance ID
         * @param {Function} debugLog - Debug logging function
         */
        setupMobileDropdownHandler: function($element, qId, debugLog) {
            $element.find('.mobile-app-selector').on('change', function() {
                const selectedAppId = $(this).val();

                if (!selectedAppId || selectedAppId === '') {
                    $('#iframe-container-' + qId).hide();
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
                const $iframeContainer = $('#iframe-container-' + qId);
                const appUrl = window.location.origin + '/sense/app/' + selectedAppId;

                $iframeContainer.html('<iframe src="' + appUrl + '" style="width:100%;height:100%;border:none;"></iframe>');
                $iframeContainer.show();
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
            if (isCloud) {
                const cancelUrl = tenantUrl + '/api/v1/odagrequests/' + requestId +
                    '?requestId=' + requestId +
                    '&action=cancel' +
                    '&ignoreSucceeded=true' +
                    '&delGenApp=false' +
                    '&autoAck=false';
                $.ajax({
                    url: cancelUrl,
                    type: 'PUT',
                    headers: {
                        'qlik-csrf-token': getCookie('_csrfToken') || ''
                    },
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(result) {
                        debugLog('Generation cancelled successfully (Cloud)');
                        // Update status to 'cancelled' instead of removing
                        window.odagGeneratedApps[appIndex].status = 'cancelled';
                        updateAppsList(qId);
                        showNotification('Generation cancelled', 'success');
                    },
                    error: function(xhr) {
                        console.error('Failed to cancel generation:', xhr.responseText);
                        showNotification('Failed to cancel generation', 'error');
                    }
                });
            } else {
                // On-Premise uses PUT with query parameters (same as Cloud structure)
                const xrfkey = CONSTANTS.API.XRF_KEY;
                const cancelUrl = tenantUrl + '/api/odag/v1/requests/' + requestId +
                    '?requestId=' + requestId +
                    '&action=cancel' +
                    '&ignoreSucceeded=true' +
                    '&delGenApp=false' +
                    '&autoAck=false' +
                    '&xrfkey=' + xrfkey;
                $.ajax({
                    url: cancelUrl,
                    type: 'PUT',
                    headers: {
                        'X-Qlik-XrfKey': xrfkey
                    },
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(result) {
                        debugLog('Generation cancelled successfully (On-Premise)');
                        // Update status to 'cancelled' instead of removing
                        window.odagGeneratedApps[appIndex].status = 'cancelled';
                        updateAppsList(qId);
                        showNotification('Generation cancelled', 'success');
                    },
                    error: function(xhr) {
                        console.error('Failed to cancel generation:', xhr.responseText);
                        showNotification('Failed to cancel generation', 'error');
                    }
                });
            }
        },

        /**
         * Reload app
         * @private
         */
        _reloadApp: function(requestId, $item, showNotification, getCookie) {
            const tenantUrl = window.qlikTenantUrl || window.location.origin;
            const isCloud = window.qlikEnvironment === 'cloud';

            // Note: Reload endpoint may not be available in On-Premise
            const reloadUrl = isCloud
                ? tenantUrl + '/api/v1/odagrequests/' + requestId + '/reloadApp'
                : tenantUrl + '/api/odag/v1/requests/' + requestId + '/reloadApp';

            $.ajax({
                url: reloadUrl,
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

            // For cancelled apps, use PUT with action parameter
            // For other apps, use DELETE /app endpoint
            let deleteUrl, deleteMethod;

            if (isCancelled) {
                // Cancelled apps need special action parameter
                if (isCloud) {
                    // Cloud: use ackcancel
                    deleteUrl = tenantUrl + '/api/v1/odagrequests/' + requestId +
                        '?requestId=' + requestId +
                        '&action=ackcancel' +
                        '&ignoreSucceeded=true' +
                        '&delGenApp=true' +
                        '&autoAck=true';
                    debugLog('Delete cancelled app (Cloud):', deleteUrl);
                } else {
                    // On-Premise: use ackcancel with delGenApp=true
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
            } else {
                // Normal delete for succeeded/failed apps
                deleteUrl = (isCloud ? tenantUrl + '/api/v1/odagrequests/' : tenantUrl + '/api/odag/v1/requests/') + requestId + '/app?xrfkey=' + xrfkey;
                deleteMethod = 'DELETE';
                debugLog('Delete app (standard):', deleteUrl);
            }

            $.ajax({
                url: deleteUrl,
                type: deleteMethod,
                headers: deleteHeaders,
                xhrFields: {
                    withCredentials: true
                },
                success: function(result) {
                    window.odagGeneratedApps.splice(appIndex, 1);
                    updateAppsList(qId);
                    showNotification('App deleted successfully!', 'success');

                    // Hide iframe if this app was being viewed
                    $('#iframe-container-' + qId).hide();

                    // Re-run validation to check if generate button should be re-enabled
                    if (checkODAGValidation) {
                        debugLog('Re-running validation after app deletion');
                        checkODAGValidation();
                    }
                },
                error: function(xhr) {
                    // Remove from deleting set on error (unless it's 404, which means already deleted)
                    if (xhr.status !== 404) {
                        window.odagDeletingRequests.delete(requestId);
                    }

                    if (xhr.status === 404) {
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
                        showNotification('Failed to delete app: ' + xhr.status + ' ' + xhr.statusText, 'error');
                        console.error('Delete failed:', xhr.responseText);
                    }
                }
            });
        }
    };

    return ODAGEventHandlers;
});
