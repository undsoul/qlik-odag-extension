/**
 * ODAG Constants
 * Centralized configuration and magic numbers
 *
 * @version 3.4.0
 */

define([], function() {
    'use strict';

    const CONSTANTS = {

        /**
         * Timing constants (milliseconds)
         */
        TIMING: {
            PAINT_DEBOUNCE_MS: 100,
            AJAX_TIMEOUT_MS: 5000,
            VALIDATION_DEBOUNCE_MS: 300,
            STATUS_CHECK_INTERVAL_MS: 2000,
            TOP_BAR_AUTO_HIDE_MS: 10000,
            TOP_BAR_HIDE_AFTER_COMPLETE_MS: 10000,
            SELECTION_CHANGE_DEBOUNCE_MS: 300
        },

        /**
         * UI constants
         */
        UI: {
            MOBILE_BREAKPOINT_PX: 768,
            HOVER_ACTIVATION_DISTANCE_PX: 30,
            TOP_BAR_Z_INDEX: 100
        },

        /**
         * API constants
         */
        API: {
            XRF_KEY: 'abcdefghijklmnop',
            MAX_RETRIES: 2
        },

        /**
         * Environment detection
         */
        ENVIRONMENT: {
            CLOUD_DOMAINS: ['.qlikcloud.com', 'qlik.com'],
            ONPREMISE_QRS_PATH: '/qrs/about'
        },

        /**
         * ODAG Link ID validation patterns
         */
        VALIDATION: {
            CLOUD_LINK_ID_PATTERN: /^[a-f0-9]{24}$/i,
            ONPREMISE_LINK_ID_PATTERN: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
            SHEET_ID_PATTERN: /^[a-f0-9-]+$/i
        },

        /**
         * Status constants
         */
        STATUS: {
            QUEUED: 'queued',
            GENERATING: 'generating',
            VALIDATING: 'validating',
            LOADING: 'loading',
            READY: 'ready',
            ERROR: 'error',
            FAILED: 'failed',
            CANCELLED: 'cancelled'
        },

        /**
         * View modes
         */
        VIEW_MODE: {
            LIST: 'odagApp',
            DYNAMIC: 'latestOdagApp'
        },

        /**
         * Embed modes
         */
        EMBED_MODE: {
            CLASSIC_APP: 'classic/app',
            ANALYTICS_SHEET: 'analytics/sheet'
        },

        /**
         * Default configuration
         */
        DEFAULTS: {
            BUTTON_TEXT: 'Generate ODAG App',
            BUTTON_COLOR: '#009845',
            BUTTON_TEXT_COLOR: '#ffffff',
            ENABLE_DEBUG: true,
            INCLUDE_SELECTIONS: true,
            ALLOW_INTERACTIONS: true
        },

        /**
         * CSS class names
         */
        CSS_CLASSES: {
            CONTAINER: 'odag-extension-container',
            DYNAMIC_VIEW: 'odag-dynamic-view',
            LIST_VIEW: 'odag-list-view',
            TOP_BAR: 'dynamic-top-bar',
            GENERATE_BTN: 'odag-generate-btn-compact',
            REFRESH_BTN: 'odag-refresh-btn',
            CANCEL_BTN: 'odag-cancel-btn',
            CLOSE_BTN: 'odag-close-topbar-btn',
            STATUS_SPINNER: 'status-spinner'
        },

        /**
         * State keys (for state manager)
         */
        STATE_KEYS: {
            LAST_PAINT: 'lastPaint',
            CONFIG_HASH: 'configHash',
            BINDINGS_CACHE: 'bindingsCache',
            BINDINGS_FETCHING: 'bindingsFetching',
            ROW_EST_CONFIG: 'rowEstConfig',
            CHECK_VALIDATION: 'checkValidation',
            SELECTION_LISTENER: 'selectionListener',
            VALIDATION_TIMEOUT: 'validationTimeout',
            CLICK_HANDLER: 'clickHandler',
            SHOW_TOP_BAR: 'showTopBar',
            HIDE_TIMER: 'hideTimer',
            LAST_SELECTION_STATE: 'lastSelectionState',
            INIT_IN_PROGRESS: 'initInProgress',
            DYNAMIC_VIEW_INIT: 'dynamicViewInit',
            LAST_APP_ID: 'lastAppId',
            LAST_PAYLOAD: 'lastPayload'
        },

        /**
         * Error messages
         */
        ERRORS: {
            NO_ODAG_LINK: 'No ODAG Link ID configured',
            INVALID_LINK_ID: 'Invalid ODAG Link ID format',
            INVALID_SHEET_ID: 'Invalid Sheet ID format',
            API_CALL_FAILED: 'API call failed',
            VALIDATION_FAILED: 'Row estimation validation failed',
            GENERATION_FAILED: 'ODAG app generation failed',
            DELETE_FAILED: 'Failed to delete ODAG app',
            CANCEL_FAILED: 'Failed to cancel ODAG request',
            RELOAD_FAILED: 'Failed to reload ODAG app'
        }
    };

    return CONSTANTS;
});
