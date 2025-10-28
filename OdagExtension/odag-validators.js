/**
 * ODAG Validators
 * Input validation and sanitization
 *
 * @version 3.4.0
 */

define(["./odag-constants"], function(CONSTANTS) {
    'use strict';

    const Validators = {

        /**
         * Validate ODAG Link ID format
         * @param {string} id - ODAG Link ID
         * @param {boolean} isCloud - Cloud vs On-Premise
         * @returns {{valid: boolean, error: string}} Validation result
         */
        odagLinkId: function(id, isCloud) {
            if (!id || typeof id !== 'string') {
                return {
                    valid: false,
                    error: 'ODAG Link ID is required'
                };
            }

            const trimmedId = id.trim();

            if (isCloud) {
                // Cloud: 24-character hexadecimal (MongoDB ObjectId)
                if (!CONSTANTS.VALIDATION.CLOUD_LINK_ID_PATTERN.test(trimmedId)) {
                    return {
                        valid: false,
                        error: 'Invalid Cloud ODAG Link ID format. Expected 24-character hex string.'
                    };
                }
            } else {
                // On-Premise: GUID format
                if (!CONSTANTS.VALIDATION.ONPREMISE_LINK_ID_PATTERN.test(trimmedId)) {
                    return {
                        valid: false,
                        error: 'Invalid On-Premise ODAG Link ID format. Expected GUID format.'
                    };
                }
            }

            return { valid: true, error: null };
        },

        /**
         * Validate and sanitize Sheet ID
         * @param {string} id - Sheet ID
         * @returns {{valid: boolean, sanitized: string, error: string}} Validation result
         */
        sheetId: function(id) {
            if (!id) {
                return { valid: true, sanitized: '', error: null };
            }

            if (typeof id !== 'string') {
                return {
                    valid: false,
                    sanitized: '',
                    error: 'Sheet ID must be a string'
                };
            }

            const trimmedId = id.trim();

            // Check for common mistakes
            if (trimmedId.indexOf('http') === 0) {
                return {
                    valid: false,
                    sanitized: '',
                    error: 'Sheet ID should not be a URL. Extract only the sheet ID portion.'
                };
            }

            if (trimmedId.indexOf('/sheet/') > -1) {
                return {
                    valid: false,
                    sanitized: '',
                    error: 'Sheet ID should not include "/sheet/". Use only the ID part.'
                };
            }

            if (trimmedId.indexOf('/state/') > -1) {
                return {
                    valid: false,
                    sanitized: '',
                    error: 'Sheet ID should not include "/state/". Use only the ID part.'
                };
            }

            // Validate format (hexadecimal with hyphens)
            if (!CONSTANTS.VALIDATION.SHEET_ID_PATTERN.test(trimmedId)) {
                return {
                    valid: false,
                    sanitized: '',
                    error: 'Invalid Sheet ID format. Should contain only alphanumeric characters and hyphens.'
                };
            }

            return {
                valid: true,
                sanitized: trimmedId,
                error: null
            };
        },

        /**
         * Sanitize user input to prevent XSS
         * @param {string} input - User input string
         * @returns {string} Sanitized string
         */
        sanitizeHtml: function(input) {
            if (!input) return '';

            const div = document.createElement('div');
            div.textContent = String(input);
            return div.innerHTML;
        },

        /**
         * Sanitize variable value
         * @param {any} value - Variable value
         * @returns {string} Sanitized value
         */
        variableValue: function(value) {
            if (value === null || value === undefined) {
                return '';
            }

            // Convert to string and remove dangerous characters
            return String(value)
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        },

        /**
         * Validate expression (for row estimation)
         * @param {string} expr - Qlik expression
         * @returns {{valid: boolean, error: string}} Validation result
         */
        expression: function(expr) {
            if (!expr || typeof expr !== 'string') {
                return {
                    valid: false,
                    error: 'Expression is required'
                };
            }

            const trimmed = expr.trim();

            if (trimmed.length === 0) {
                return {
                    valid: false,
                    error: 'Expression cannot be empty'
                };
            }

            // Check for dangerous patterns
            const dangerousPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i  // Event handlers like onclick=
            ];

            for (let i = 0; i < dangerousPatterns.length; i++) {
                if (dangerousPatterns[i].test(trimmed)) {
                    return {
                        valid: false,
                        error: 'Expression contains potentially dangerous content'
                    };
                }
            }

            return { valid: true, error: null };
        },

        /**
         * Validate numeric value
         * @param {any} value - Value to validate
         * @param {Object} options - Validation options (min, max, allowNegative)
         * @returns {{valid: boolean, parsed: number, error: string}} Validation result
         */
        number: function(value, options) {
            options = options || {};

            const parsed = Number(value);

            if (isNaN(parsed)) {
                return {
                    valid: false,
                    parsed: null,
                    error: 'Value must be a number'
                };
            }

            if (!options.allowNegative && parsed < 0) {
                return {
                    valid: false,
                    parsed: null,
                    error: 'Value cannot be negative'
                };
            }

            if (options.min !== undefined && parsed < options.min) {
                return {
                    valid: false,
                    parsed: null,
                    error: 'Value must be at least ' + options.min
                };
            }

            if (options.max !== undefined && parsed > options.max) {
                return {
                    valid: false,
                    parsed: null,
                    error: 'Value must be at most ' + options.max
                };
            }

            return {
                valid: true,
                parsed: parsed,
                error: null
            };
        },

        /**
         * Validate color hex code
         * @param {string} color - Hex color code
         * @returns {{valid: boolean, error: string}} Validation result
         */
        colorHex: function(color) {
            if (!color || typeof color !== 'string') {
                return {
                    valid: false,
                    error: 'Color is required'
                };
            }

            const hexPattern = /^#[0-9A-F]{6}$/i;

            if (!hexPattern.test(color)) {
                return {
                    valid: false,
                    error: 'Invalid color format. Expected hex color (e.g., #FF0000)'
                };
            }

            return { valid: true, error: null };
        },

        /**
         * Validate array of values
         * @param {any} value - Value to validate
         * @returns {{valid: boolean, array: Array, error: string}} Validation result
         */
        array: function(value) {
            if (!value) {
                return {
                    valid: true,
                    array: [],
                    error: null
                };
            }

            if (!Array.isArray(value)) {
                return {
                    valid: false,
                    array: null,
                    error: 'Value must be an array'
                };
            }

            return {
                valid: true,
                array: value,
                error: null
            };
        }
    };

    return Validators;
});
