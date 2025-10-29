/**
 * ODAG App List View Renderer
 * Renders the ODAG apps list and generation form
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
    "../foundation/odag-payload-builder",
    "./odag-form-view",
    "./odag-toolbar-manager"
], function(qlik, $, ApiService, UIBuilder, ErrorHandler, StateManager, PayloadBuilder, FormView, ToolbarManager) {
    'use strict';

    const AppListView = {

        /**
         * Render app list view
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
            StateManager.set(extensionId, 'view', 'appList');
            StateManager.set(extensionId, 'app', app);

            // Create main container
            const $container = UIBuilder.createElement('div', {
                className: 'odag-app-list-container',
                styles: {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }
            });

            $element.append($container);

            // Show loading state
            const $loader = UIBuilder.createLoader('Loading ODAG configuration...');
            $container.append($loader);

            // Fetch ODAG link details
            return ApiService.fetchLinkDetails(odagConfig.odagLinkId)
                .then(function(linkDetails) {
                    StateManager.set(extensionId, 'linkDetails', linkDetails);

                    // Fetch existing ODAG apps
                    return ApiService.fetchRequests(odagConfig.odagLinkId, false);
                })
                .then(function(apps) {
                    StateManager.set(extensionId, 'apps', apps || []);

                    // Clear loading and render content
                    $container.empty();
                    self.renderContent($container, extensionId, odagConfig, eventManager);
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'AppListView.render', odagConfig.enableDebug);
                    $container.empty();

                    const $error = UIBuilder.createErrorBox(
                        'Failed to load ODAG configuration. Please check your ODAG Link ID.',
                        'Configuration Error'
                    );
                    $container.append($error);
                });
        },

        /**
         * Render main content (apps list + generation form)
         * @param {jQuery} $container - Container element
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        renderContent: function($container, extensionId, odagConfig, eventManager) {
            const self = this;
            const linkDetails = StateManager.get(extensionId, 'linkDetails');
            const apps = StateManager.get(extensionId, 'apps', []);

            // Create toolbar if enabled
            if (odagConfig.showAppsList !== false) {
                ToolbarManager.create($container, extensionId, {
                    title: 'ODAG Apps: ' + (linkDetails.name || 'Unknown'),
                    autoHide: true,
                    actions: [
                        {
                            id: 'refresh',
                            label: 'Refresh',
                            handler: function() {
                                self.refreshApps($container, extensionId, odagConfig, eventManager);
                            }
                        }
                    ]
                }, eventManager);
            }

            // Create content area (below toolbar)
            const $contentArea = UIBuilder.createElement('div', {
                className: 'odag-content-area',
                styles: {
                    flex: '1',
                    overflow: 'auto',
                    padding: '15px',
                    marginTop: odagConfig.showAppsList !== false ? '50px' : '0'
                }
            });

            // Render generation form
            const $formSection = FormView.render(extensionId, odagConfig, linkDetails, eventManager);
            $contentArea.append($formSection);

            // Render apps list if enabled
            if (odagConfig.showAppsList !== false) {
                const $appsSection = this.renderAppsList(extensionId, apps, odagConfig, eventManager);
                $contentArea.append($appsSection);
            }

            $container.append($contentArea);
        },

        /**
         * Render apps list section
         * @param {string} extensionId - Extension instance ID
         * @param {Array} apps - Array of ODAG apps
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         * @returns {jQuery} Apps list section
         */
        renderAppsList: function(extensionId, apps, odagConfig, eventManager) {
            const self = this;

            const $section = UIBuilder.createCard({
                title: 'Generated Apps (' + apps.length + ')',
                className: 'odag-apps-list-section'
            });

            const $cardBody = $section.find('.odag-card-body');

            if (apps.length === 0) {
                const $empty = UIBuilder.createElement('div', {
                    text: 'No apps generated yet. Use the form above to generate your first app.',
                    styles: {
                        textAlign: 'center',
                        padding: '40px',
                        color: '#999'
                    }
                });
                $cardBody.append($empty);
                return $section;
            }

            // Create apps table
            const headers = ['App Name', 'Status', 'Created', 'Rows', 'Actions'];
            const rows = apps.map(function(app) {
                return self.createAppRow(app, extensionId, odagConfig, eventManager);
            });

            const $table = UIBuilder.createTable({
                headers: headers,
                rows: rows,
                striped: true,
                bordered: true,
                className: 'odag-apps-table'
            });

            $cardBody.append($table);

            return $section;
        },

        /**
         * Create a table row for an app
         * @param {Object} app - App data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         * @returns {Array} Row data array
         */
        createAppRow: function(app, extensionId, odagConfig, eventManager) {
            const self = this;

            // App name
            const appName = app.genAppName || app.name || 'Unknown';

            // Status badge
            const status = app.status || app.genAppStatus || 'unknown';
            const statusVariant = this.getStatusVariant(status);
            const $statusBadge = UIBuilder.createBadge(status, statusVariant);

            // Created date
            const createdDate = app.createdDate || app.timestamp || 'N/A';
            const formattedDate = this.formatDate(createdDate);

            // Row count
            const rowCount = app.rowEstimate || app.rowCount || 'N/A';

            // Actions buttons
            const $actionsContainer = UIBuilder.createElement('div', {
                className: 'odag-app-actions',
                styles: {
                    display: 'flex',
                    gap: '5px'
                }
            });

            // Open button
            if (status === 'succeeded' || status === 'success') {
                const $openBtn = UIBuilder.createButton({
                    text: 'Open',
                    className: 'odag-btn-small',
                    color: '#009845'
                });

                eventManager.on($openBtn, 'click', function() {
                    self.openApp(app);
                });

                $actionsContainer.append($openBtn);
            }

            // Reload button
            if (status === 'succeeded' || status === 'success') {
                const $reloadBtn = UIBuilder.createButton({
                    text: 'Reload',
                    className: 'odag-btn-small',
                    color: '#0288d1'
                });

                eventManager.on($reloadBtn, 'click', function() {
                    self.reloadApp(app, extensionId, odagConfig, eventManager);
                });

                $actionsContainer.append($reloadBtn);
            }

            // Cancel button
            if (status === 'pending' || status === 'loading') {
                const $cancelBtn = UIBuilder.createButton({
                    text: 'Cancel',
                    className: 'odag-btn-small',
                    color: '#f57c00'
                });

                eventManager.on($cancelBtn, 'click', function() {
                    self.cancelRequest(app, extensionId, odagConfig, eventManager);
                });

                $actionsContainer.append($cancelBtn);
            }

            // Delete button
            const $deleteBtn = UIBuilder.createButton({
                text: 'Delete',
                className: 'odag-btn-small',
                color: '#d32f2f'
            });

            eventManager.on($deleteBtn, 'click', function() {
                self.deleteApp(app, extensionId, odagConfig, eventManager);
            });

            $actionsContainer.append($deleteBtn);

            return [appName, $statusBadge, formattedDate, rowCount, $actionsContainer];
        },

        /**
         * Get status badge variant
         * @param {string} status - App status
         * @returns {string} Badge variant
         */
        getStatusVariant: function(status) {
            const statusLower = String(status).toLowerCase();

            if (statusLower === 'succeeded' || statusLower === 'success') {
                return 'success';
            } else if (statusLower === 'failed' || statusLower === 'error') {
                return 'error';
            } else if (statusLower === 'pending' || statusLower === 'loading') {
                return 'warning';
            } else {
                return 'info';
            }
        },

        /**
         * Format date string
         * @param {string} dateStr - Date string
         * @returns {string} Formatted date
         */
        formatDate: function(dateStr) {
            if (!dateStr || dateStr === 'N/A') {
                return 'N/A';
            }

            try {
                const date = new Date(dateStr);
                return date.toLocaleString();
            } catch (e) {
                return dateStr;
            }
        },

        /**
         * Open an app
         * @param {Object} app - App data
         */
        openApp: function(app) {
            const appId = app.genAppId || app.id || app.appId;
            if (!appId) {
                console.error('No app ID found');
                return;
            }

            const isCloud = window.qlikEnvironment === 'cloud';
            const baseUrl = window.location.origin;

            let appUrl;
            if (isCloud) {
                appUrl = baseUrl + '/sense/app/' + appId;
            } else {
                appUrl = baseUrl + '/sense/app/' + appId;
            }

            window.open(appUrl, '_blank');
        },

        /**
         * Reload an app
         * @param {Object} app - App data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        reloadApp: function(app, extensionId, odagConfig, eventManager) {
            const self = this;
            const requestId = app.id || app.requestId;

            if (!requestId) {
                ErrorHandler.handle('No request ID found', 'reloadApp', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);
                return;
            }

            ApiService.reloadApp(requestId)
                .then(function() {
                    // Refresh apps list
                    const $container = StateManager.get(extensionId, 'eventManager').$element;
                    self.refreshApps($container, extensionId, odagConfig, eventManager);
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'reloadApp', odagConfig.enableDebug);
                });
        },

        /**
         * Cancel a pending request
         * @param {Object} app - App data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        cancelRequest: function(app, extensionId, odagConfig, eventManager) {
            const self = this;
            const requestId = app.id || app.requestId;

            if (!requestId) {
                ErrorHandler.handle('No request ID found', 'cancelRequest', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);
                return;
            }

            ApiService.cancelRequest(requestId)
                .then(function() {
                    // Refresh apps list
                    const $container = StateManager.get(extensionId, 'eventManager').$element;
                    self.refreshApps($container, extensionId, odagConfig, eventManager);
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'cancelRequest', odagConfig.enableDebug);
                });
        },

        /**
         * Delete an app
         * @param {Object} app - App data
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        deleteApp: function(app, extensionId, odagConfig, eventManager) {
            const self = this;
            const requestId = app.id || app.requestId;

            if (!requestId) {
                ErrorHandler.handle('No request ID found', 'deleteApp', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);
                return;
            }

            // Confirm deletion
            if (!confirm('Are you sure you want to delete this app?')) {
                return;
            }

            ApiService.deleteApp(requestId)
                .then(function() {
                    // Refresh apps list
                    const $container = StateManager.get(extensionId, 'eventManager').$element;
                    self.refreshApps($container, extensionId, odagConfig, eventManager);
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'deleteApp', odagConfig.enableDebug);
                });
        },

        /**
         * Refresh apps list
         * @param {jQuery} $container - Container element
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} eventManager - Event manager instance
         */
        refreshApps: function($container, extensionId, odagConfig, eventManager) {
            const self = this;

            // Show loading
            $container.empty();
            const $loader = UIBuilder.createLoader('Refreshing apps list...');
            $container.append($loader);

            // Fetch apps
            ApiService.fetchRequests(odagConfig.odagLinkId, false)
                .then(function(apps) {
                    StateManager.set(extensionId, 'apps', apps || []);

                    // Re-render
                    $container.empty();
                    self.renderContent($container, extensionId, odagConfig, eventManager);
                })
                .catch(function(error) {
                    ErrorHandler.handleApiError(error, 'refreshApps', odagConfig.enableDebug);
                    $container.empty();

                    const $error = UIBuilder.createErrorBox(
                        'Failed to refresh apps list.',
                        'Refresh Error'
                    );
                    $container.append($error);
                });
        }
    };

    return AppListView;
});
