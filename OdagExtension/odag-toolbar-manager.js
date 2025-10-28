/**
 * ODAG Toolbar Manager
 * Manages top toolbar lifecycle with smart auto-hide/show
 *
 * @version 5.0.0-beta
 */

define([
    "jquery",
    "./odag-ui-builder",
    "./odag-state-manager"
], function($, UIBuilder, StateManager) {
    'use strict';

    const ToolbarManager = {

        /**
         * Create and show toolbar
         * @param {jQuery} $container - Container element
         * @param {string} extensionId - Extension instance ID
         * @param {Object} options - Toolbar options
         * @param {Object} eventManager - Event manager instance
         * @returns {jQuery} Toolbar element
         */
        create: function($container, extensionId, options, eventManager) {
            options = options || {};

            // Create toolbar element
            const $toolbar = UIBuilder.createElement('div', {
                className: 'odag-toolbar',
                styles: {
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    height: options.height || '50px',
                    backgroundColor: options.backgroundColor || '#026670',
                    color: options.textColor || '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 15px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: options.zIndex || '1000',
                    transition: 'transform 0.3s ease'
                },
                data: {
                    extensionId: extensionId
                }
            });

            // Left section - Title
            const $leftSection = UIBuilder.createElement('div', {
                className: 'odag-toolbar-left',
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }
            });

            if (options.title) {
                const $title = UIBuilder.createElement('span', {
                    text: options.title,
                    className: 'odag-toolbar-title',
                    styles: {
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                });
                $leftSection.append($title);
            }

            // Right section - Actions
            const $rightSection = UIBuilder.createElement('div', {
                className: 'odag-toolbar-right',
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }
            });

            // Add custom actions
            if (options.actions && Array.isArray(options.actions)) {
                options.actions.forEach(function(action) {
                    const $button = UIBuilder.createElement('button', {
                        text: action.label || '',
                        className: 'odag-toolbar-button',
                        styles: {
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                            border: '1px solid rgba(255,255,255,0.5)',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        },
                        data: {
                            action: action.id
                        }
                    });

                    // Bind action handler
                    if (action.handler) {
                        eventManager.on($button, 'click', action.handler);
                    }

                    $rightSection.append($button);
                });
            }

            // Add close button if enabled
            if (options.closeable !== false) {
                const $closeButton = UIBuilder.createElement('button', {
                    text: '×',
                    className: 'odag-toolbar-close',
                    styles: {
                        backgroundColor: 'transparent',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '28px',
                        lineHeight: '1',
                        cursor: 'pointer',
                        padding: '0',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                });

                // Bind close handler
                const self = this;
                eventManager.on($closeButton, 'click', function() {
                    self.close($toolbar, extensionId);
                });

                $rightSection.append($closeButton);
            }

            // Assemble toolbar
            $toolbar.append($leftSection).append($rightSection);

            // Prepend to container
            $container.prepend($toolbar);

            // Store toolbar state
            StateManager.set(extensionId, 'toolbar', {
                $element: $toolbar,
                visible: true,
                manuallyClosed: false,
                autoHide: options.autoHide !== false
            });

            // Setup auto-hide behavior if enabled
            if (options.autoHide !== false) {
                this.setupAutoHide($container, $toolbar, extensionId, eventManager);
            }

            return $toolbar;
        },

        /**
         * Setup auto-hide behavior for toolbar
         * @param {jQuery} $container - Container element
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} extensionId - Extension instance ID
         * @param {Object} eventManager - Event manager instance
         */
        setupAutoHide: function($container, $toolbar, extensionId, eventManager) {
            const self = this;
            const toolbarHeight = $toolbar.outerHeight();

            // Auto-hide after initial delay
            const hideTimer = eventManager.setTimeout(function() {
                const toolbarState = StateManager.get(extensionId, 'toolbar');
                if (toolbarState && !toolbarState.manuallyClosed) {
                    self.hide($toolbar, extensionId);
                }
            }, 3000);

            // Show on container hover
            eventManager.on($container, 'mouseenter', function() {
                const toolbarState = StateManager.get(extensionId, 'toolbar');
                if (toolbarState && !toolbarState.manuallyClosed) {
                    self.show($toolbar, extensionId);
                }
            });

            // Hide on container leave (after delay)
            eventManager.on($container, 'mouseleave', eventManager.debounce(function() {
                const toolbarState = StateManager.get(extensionId, 'toolbar');
                if (toolbarState && !toolbarState.manuallyClosed) {
                    self.hide($toolbar, extensionId);
                }
            }, 500));
        },

        /**
         * Show toolbar
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} extensionId - Extension instance ID
         */
        show: function($toolbar, extensionId) {
            $toolbar.css('transform', 'translateY(0)');

            const toolbarState = StateManager.get(extensionId, 'toolbar');
            if (toolbarState) {
                toolbarState.visible = true;
                StateManager.set(extensionId, 'toolbar', toolbarState, true);
            }
        },

        /**
         * Hide toolbar
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} extensionId - Extension instance ID
         */
        hide: function($toolbar, extensionId) {
            const toolbarHeight = $toolbar.outerHeight();
            $toolbar.css('transform', 'translateY(-' + toolbarHeight + 'px)');

            const toolbarState = StateManager.get(extensionId, 'toolbar');
            if (toolbarState) {
                toolbarState.visible = false;
                StateManager.set(extensionId, 'toolbar', toolbarState, true);
            }
        },

        /**
         * Close toolbar (manual close - won't reappear on hover)
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} extensionId - Extension instance ID
         */
        close: function($toolbar, extensionId) {
            this.hide($toolbar, extensionId);

            const toolbarState = StateManager.get(extensionId, 'toolbar');
            if (toolbarState) {
                toolbarState.manuallyClosed = true;
                StateManager.set(extensionId, 'toolbar', toolbarState, true);
            }
        },

        /**
         * Reopen toolbar (reset manual close state)
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} extensionId - Extension instance ID
         */
        reopen: function($toolbar, extensionId) {
            const toolbarState = StateManager.get(extensionId, 'toolbar');
            if (toolbarState) {
                toolbarState.manuallyClosed = false;
                StateManager.set(extensionId, 'toolbar', toolbarState, true);
            }

            this.show($toolbar, extensionId);
        },

        /**
         * Update toolbar title
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} title - New title
         */
        updateTitle: function($toolbar, title) {
            $toolbar.find('.odag-toolbar-title').text(title);
        },

        /**
         * Add action button to toolbar
         * @param {jQuery} $toolbar - Toolbar element
         * @param {Object} action - Action definition
         * @param {Object} eventManager - Event manager instance
         */
        addAction: function($toolbar, action, eventManager) {
            const $rightSection = $toolbar.find('.odag-toolbar-right');

            const $button = UIBuilder.createElement('button', {
                text: action.label || '',
                className: 'odag-toolbar-button',
                styles: {
                    backgroundColor: 'transparent',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.5)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                },
                data: {
                    action: action.id
                }
            });

            // Bind action handler
            if (action.handler) {
                eventManager.on($button, 'click', action.handler);
            }

            // Insert before close button
            const $closeButton = $rightSection.find('.odag-toolbar-close');
            if ($closeButton.length > 0) {
                $button.insertBefore($closeButton);
            } else {
                $rightSection.append($button);
            }
        },

        /**
         * Remove action button from toolbar
         * @param {jQuery} $toolbar - Toolbar element
         * @param {string} actionId - Action ID to remove
         */
        removeAction: function($toolbar, actionId) {
            $toolbar.find('[data-action="' + actionId + '"]').remove();
        },

        /**
         * Check if toolbar is visible
         * @param {string} extensionId - Extension instance ID
         * @returns {boolean} true if visible
         */
        isVisible: function(extensionId) {
            const toolbarState = StateManager.get(extensionId, 'toolbar');
            return toolbarState ? toolbarState.visible : false;
        },

        /**
         * Check if toolbar was manually closed
         * @param {string} extensionId - Extension instance ID
         * @returns {boolean} true if manually closed
         */
        isManuallyClosed: function(extensionId) {
            const toolbarState = StateManager.get(extensionId, 'toolbar');
            return toolbarState ? toolbarState.manuallyClosed : false;
        },

        /**
         * Get toolbar element
         * @param {string} extensionId - Extension instance ID
         * @returns {jQuery|null} Toolbar element or null
         */
        getToolbar: function(extensionId) {
            const toolbarState = StateManager.get(extensionId, 'toolbar');
            return toolbarState ? toolbarState.$element : null;
        },

        /**
         * Destroy toolbar and cleanup
         * @param {string} extensionId - Extension instance ID
         */
        destroy: function(extensionId) {
            const toolbarState = StateManager.get(extensionId, 'toolbar');
            if (toolbarState && toolbarState.$element) {
                toolbarState.$element.remove();
            }

            StateManager.delete(extensionId, 'toolbar');
        }
    };

    return ToolbarManager;
});
