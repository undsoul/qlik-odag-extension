/**
 * ODAG Error Handler
 * Unified error handling and logging
 *
 * @version 3.4.0
 */

define(["./odag-constants"], function(CONSTANTS) {
    'use strict';

    const ErrorHandler = {

        /**
         * Error severity levels
         */
        SEVERITY: {
            INFO: 'info',
            WARNING: 'warning',
            ERROR: 'error',
            CRITICAL: 'critical'
        },

        /**
         * Handle error with consistent logging and user feedback
         * @param {Error|Object|string} error - Error object or message
         * @param {string} context - Context where error occurred
         * @param {string} severity - Error severity level
         * @param {boolean} showUser - Whether to show message to user
         * @param {boolean} enableDebug - Debug mode flag
         * @returns {Object} Error information object
         */
        handle: function(error, context, severity, showUser, enableDebug) {
            severity = severity || this.SEVERITY.ERROR;
            showUser = showUser !== undefined ? showUser : (severity === this.SEVERITY.CRITICAL);
            enableDebug = enableDebug !== undefined ? enableDebug : false;

            const errorInfo = this._normalizeError(error, context, severity);

            // Log to console based on severity and debug mode
            this._logToConsole(errorInfo, enableDebug);

            // Show to user if needed
            if (showUser) {
                this._showUserMessage(errorInfo);
            }

            return errorInfo;
        },

        /**
         * Normalize error to consistent format
         * @param {Error|Object|string} error - Error
         * @param {string} context - Context
         * @param {string} severity - Severity
         * @returns {Object} Normalized error info
         * @private
         */
        _normalizeError: function(error, context, severity) {
            let message, stack, details;

            if (error instanceof Error) {
                message = error.message;
                stack = error.stack;
                details = {};
            } else if (typeof error === 'object' && error !== null) {
                message = error.message || error.statusText || 'Unknown error';
                stack = error.stack;
                details = {
                    status: error.status,
                    response: error.response,
                    url: error.url,
                    method: error.method
                };
            } else {
                message = String(error);
                stack = null;
                details = {};
            }

            return {
                message: message,
                context: context || 'Unknown',
                severity: severity,
                timestamp: new Date().toISOString(),
                stack: stack,
                details: details
            };
        },

        /**
         * Log error to console
         * @param {Object} errorInfo - Error information
         * @param {boolean} enableDebug - Debug mode
         * @private
         */
        _logToConsole: function(errorInfo, enableDebug) {
            const prefix = '[ODAG Extension Error]';

            // Always log critical errors
            if (errorInfo.severity === this.SEVERITY.CRITICAL) {
                console.error(prefix, errorInfo);
                return;
            }

            // Log other errors only in debug mode
            if (!enableDebug) {
                return;
            }

            switch (errorInfo.severity) {
                case this.SEVERITY.INFO:
                    console.info(prefix, errorInfo);
                    break;
                case this.SEVERITY.WARNING:
                    console.warn(prefix, errorInfo);
                    break;
                case this.SEVERITY.ERROR:
                    console.error(prefix, errorInfo);
                    break;
            }
        },

        /**
         * Show user-friendly error message
         * @param {Object} errorInfo - Error information
         * @private
         */
        _showUserMessage: function(errorInfo) {
            const userMessage = this._getUserFriendlyMessage(errorInfo);

            // In a real implementation, this might show a toast/notification
            // For now, we'll use console.error to ensure it's visible
            console.error('[User Error]', userMessage);
        },

        /**
         * Convert technical error to user-friendly message
         * @param {Object} errorInfo - Error information
         * @returns {string} User-friendly message
         * @private
         */
        _getUserFriendlyMessage: function(errorInfo) {
            const context = errorInfo.context;
            const message = errorInfo.message;

            // Map contexts to user-friendly messages
            const contextMessages = {
                'fetchLinkDetails': 'Failed to load ODAG link configuration. Please check your ODAG Link ID.',
                'fetchRequests': 'Failed to load ODAG applications. Please try refreshing.',
                'createRequest': 'Failed to generate ODAG application. Please try again.',
                'deleteApp': 'Failed to delete ODAG application. Please try again.',
                'cancelRequest': 'Failed to cancel ODAG request. Please try again.',
                'reloadApp': 'Failed to reload ODAG application. Please try again.',
                'calculateRowEstimation': 'Failed to validate row estimation. Generation may proceed.',
                'validation': 'Validation failed: ' + message
            };

            return contextMessages[context] || 'An error occurred: ' + message;
        },

        /**
         * Handle API error specifically
         * @param {Object} error - API error from ODAGApiService
         * @param {string} operation - Operation name (e.g., 'fetchRequests')
         * @param {boolean} enableDebug - Debug mode
         * @returns {Object} Error information
         */
        handleApiError: function(error, operation, enableDebug) {
            const severity = error.status >= 500
                ? this.SEVERITY.CRITICAL
                : this.SEVERITY.ERROR;

            const showUser = severity === this.SEVERITY.CRITICAL;

            return this.handle(error, operation, severity, showUser, enableDebug);
        },

        /**
         * Handle validation error
         * @param {string} message - Validation error message
         * @param {string} field - Field that failed validation
         * @param {boolean} enableDebug - Debug mode
         * @returns {Object} Error information
         */
        handleValidationError: function(message, field, enableDebug) {
            const context = 'validation:' + (field || 'unknown');
            return this.handle(message, context, this.SEVERITY.WARNING, true, enableDebug);
        },

        /**
         * Log info message (only in debug mode)
         * @param {string} message - Info message
         * @param {Object} data - Additional data
         * @param {boolean} enableDebug - Debug mode
         */
        info: function(message, data, enableDebug) {
            if (!enableDebug) return;

            console.info('[ODAG Extension]', message, data || '');
        },

        /**
         * Log warning message (only in debug mode)
         * @param {string} message - Warning message
         * @param {Object} data - Additional data
         * @param {boolean} enableDebug - Debug mode
         */
        warn: function(message, data, enableDebug) {
            if (!enableDebug) return;

            console.warn('[ODAG Extension]', message, data || '');
        }
    };

    return ErrorHandler;
});
