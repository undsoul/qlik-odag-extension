/**
 * ODAG Render Coordinator
 * Orchestrates the paint() lifecycle and delegates to specialized renderers
 *
 * @version 5.0.0-beta
 */

define([
    "qlik",
    "jquery",
    "./odag-constants",
    "./odag-validators",
    "./odag-error-handler",
    "./odag-state-manager",
    "./odag-ui-builder"
], function(qlik, $, CONSTANTS, Validators, ErrorHandler, StateManager, UIBuilder) {
    'use strict';

    /**
     * Render Coordinator
     * Determines view mode and delegates to appropriate renderer
     */
    const RenderCoordinator = {

        /**
         * Main paint orchestration
         * @param {jQuery} $element - Container element
         * @param {Object} layout - Extension layout
         * @param {Object} renderers - Map of view renderers
         * @param {Object} eventManager - Event manager instance
         * @returns {Promise} Render promise
         */
        paint: function($element, layout, renderers, eventManager) {
            const self = this;
            const app = qlik.currApp();
            const extensionId = layout.qInfo.qId;
            const odagConfig = layout.odagConfig || {};
            const elementHeight = $element.height();
            const elementWidth = $element.width();

            // Initialize state for this instance if not exists
            if (!StateManager.has(extensionId, 'initialized')) {
                StateManager.set(extensionId, 'initialized', true);
                StateManager.set(extensionId, 'app', app);
                StateManager.set(extensionId, 'eventManager', eventManager);
            }

            // Debug logger
            const debugLog = function() {
                if (odagConfig.enableDebug) {
                    console.log.apply(console, ['[ODAG RenderCoordinator]'].concat(Array.prototype.slice.call(arguments)));
                }
            };

            debugLog('paint() called', {
                extensionId: extensionId,
                viewMode: odagConfig.viewMode,
                odagLinkId: odagConfig.odagLinkId,
                dimensions: { width: elementWidth, height: elementHeight }
            });

            // Early validation
            const validationResult = this.validateConfig(odagConfig);
            if (!validationResult.valid) {
                const $error = UIBuilder.createErrorBox(
                    validationResult.error,
                    'Configuration Error'
                );
                $element.empty().append($error);
                return qlik.Promise.resolve();
            }

            // Store config in state
            StateManager.set(extensionId, 'config', odagConfig);
            StateManager.set(extensionId, 'dimensions', { width: elementWidth, height: elementHeight });

            // Determine view mode
            const viewMode = odagConfig.viewMode || 'odagApp';
            debugLog('Determined view mode:', viewMode);

            // Delegate to appropriate renderer
            return this.delegateRender($element, layout, viewMode, renderers, eventManager)
                .then(function() {
                    debugLog('Render complete');
                })
                .catch(function(error) {
                    debugLog('Render error:', error);
                    ErrorHandler.handle(error, 'RenderCoordinator.paint', ErrorHandler.SEVERITY.ERROR, true, odagConfig.enableDebug);

                    const $error = UIBuilder.createErrorBox(
                        'Failed to render extension. Check console for details.',
                        'Render Error'
                    );
                    $element.empty().append($error);
                });
        },

        /**
         * Validate ODAG configuration
         * @param {Object} config - ODAG configuration
         * @returns {Object} {valid: boolean, error: string}
         */
        validateConfig: function(config) {
            // Check ODAG Link ID
            if (!config.odagLinkId || config.odagLinkId.trim() === '') {
                return {
                    valid: false,
                    error: 'ODAG Link ID is required. Please configure it in the properties panel.'
                };
            }

            // Validate ODAG Link ID format
            const isCloud = window.qlikEnvironment === 'cloud';
            const linkValidation = Validators.odagLinkId(config.odagLinkId, isCloud);
            if (!linkValidation.valid) {
                return {
                    valid: false,
                    error: linkValidation.error
                };
            }

            // Validate Sheet ID for analytics mode
            if (config.embedMode === 'analytics/sheet' || config.embedMode === 'classic/sheet') {
                if (!config.templateSheetId || config.templateSheetId.trim() === '') {
                    return {
                        valid: false,
                        error: 'Sheet ID is required for sheet embed mode. Please configure it in the properties panel.'
                    };
                }
            }

            return { valid: true };
        },

        /**
         * Delegate rendering to appropriate view renderer
         * @param {jQuery} $element - Container element
         * @param {Object} layout - Extension layout
         * @param {string} viewMode - View mode (odagApp, dynamic, analytics)
         * @param {Object} renderers - Map of view renderers
         * @param {Object} eventManager - Event manager instance
         * @returns {Promise} Render promise
         */
        delegateRender: function($element, layout, viewMode, renderers, eventManager) {
            const extensionId = layout.qInfo.qId;
            const odagConfig = layout.odagConfig || {};

            // Clear existing content
            $element.empty();

            // Add base container class
            $element.addClass('odag-extension-container');

            switch (viewMode) {
                case 'odagApp':
                    // ODAG Apps List & Generation Form view
                    if (!renderers.appListView) {
                        return qlik.Promise.reject(new Error('App List View renderer not available'));
                    }
                    return renderers.appListView.render($element, layout, eventManager);

                case 'dynamic':
                    // Dynamic embed view (auto-generates and embeds)
                    if (!renderers.dynamicView) {
                        return qlik.Promise.reject(new Error('Dynamic View renderer not available'));
                    }
                    return renderers.dynamicView.render($element, layout, eventManager);

                case 'analytics':
                    // Analytics embed view (embed without generation UI)
                    if (!renderers.analyticsView) {
                        // Analytics view uses dynamic view with different config
                        return renderers.dynamicView.render($element, layout, eventManager);
                    }
                    return renderers.analyticsView.render($element, layout, eventManager);

                default:
                    return qlik.Promise.reject(new Error('Unknown view mode: ' + viewMode));
            }
        },

        /**
         * Determine if running in edit mode
         * @returns {boolean} true if in edit mode
         */
        isEditMode: function() {
            // Check if we're in edit mode by looking for edit-mode class or other indicators
            return $('body').hasClass('qv-edit-mode') ||
                   window.location.href.indexOf('/state/edit') > -1;
        },

        /**
         * Get environment info
         * @returns {Object} Environment information
         */
        getEnvironment: function() {
            return {
                isCloud: window.qlikEnvironment === 'cloud',
                isOnPremise: window.qlikEnvironment === 'onpremise',
                hostname: window.location.hostname,
                origin: window.location.origin
            };
        },

        /**
         * Calculate responsive dimensions based on container size
         * @param {number} width - Container width
         * @param {number} height - Container height
         * @returns {Object} Responsive sizing info
         */
        calculateResponsiveDimensions: function(width, height) {
            return {
                isMobile: width < 480,
                isTablet: width >= 480 && width < 768,
                isDesktop: width >= 768,
                isCompact: height < 400,
                isNarrow: width < 600,
                breakpoint: width < 480 ? 'mobile' :
                           width < 768 ? 'tablet' :
                           width < 1024 ? 'desktop' : 'wide'
            };
        },

        /**
         * Create loading state
         * @param {jQuery} $element - Container element
         * @param {string} message - Loading message
         */
        showLoading: function($element, message) {
            const $loader = UIBuilder.createLoader(message || 'Loading...');
            $element.empty().append($loader);
        },

        /**
         * Create error state
         * @param {jQuery} $element - Container element
         * @param {string} message - Error message
         * @param {string} title - Error title
         */
        showError: function($element, message, title) {
            const $error = UIBuilder.createErrorBox(message, title || 'Error');
            $element.empty().append($error);
        },

        /**
         * Create warning state
         * @param {jQuery} $element - Container element
         * @param {string} message - Warning message
         * @param {string} title - Warning title
         */
        showWarning: function($element, message, title) {
            const $warning = UIBuilder.createWarningBox(message, title || 'Warning');
            $element.empty().append($warning);
        },

        /**
         * Create info state
         * @param {jQuery} $element - Container element
         * @param {string} message - Info message
         * @param {string} title - Info title
         */
        showInfo: function($element, message, title) {
            const $info = UIBuilder.createInfoBox(message, title || 'Information');
            $element.empty().append($info);
        },

        /**
         * Create empty state
         * @param {jQuery} $element - Container element
         * @param {string} message - Empty state message
         * @param {string} icon - Icon class
         */
        showEmptyState: function($element, message, icon) {
            const $container = UIBuilder.createElement('div', {
                className: 'odag-empty-state',
                styles: {
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#999'
                }
            });

            if (icon) {
                const $icon = UIBuilder.createElement('div', {
                    styles: {
                        fontSize: '48px',
                        marginBottom: '20px',
                        opacity: '0.5'
                    }
                });
                $icon.html(icon);
                $container.append($icon);
            }

            const $message = UIBuilder.createElement('div', {
                text: message || 'No data available',
                styles: {
                    fontSize: '16px'
                }
            });

            $container.append($message);
            $element.empty().append($container);
        },

        /**
         * Cleanup coordinator state
         * @param {string} extensionId - Extension instance ID
         */
        cleanup: function(extensionId) {
            // Get event manager and clean up
            const eventManager = StateManager.get(extensionId, 'eventManager');
            if (eventManager && eventManager.cleanup) {
                eventManager.cleanup();
            }

            // Clean up state
            StateManager.cleanup(extensionId);
        }
    };

    return RenderCoordinator;
});
