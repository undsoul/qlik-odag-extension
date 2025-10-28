/**
 * ODAG UI Builder
 * Sanitized HTML construction utilities with XSS protection
 *
 * @version 5.0.0-beta
 */

define(["jquery", "./odag-validators"], function($, Validators) {
    'use strict';

    const UIBuilder = {

        /**
         * Create a safe element with sanitized content
         * @param {string} tagName - HTML tag name
         * @param {Object} options - Element options
         * @param {string} options.className - CSS class name(s)
         * @param {string} options.id - Element ID
         * @param {string} options.text - Text content (will be sanitized)
         * @param {string} options.html - HTML content (will be sanitized)
         * @param {Object} options.attrs - Additional attributes
         * @param {Object} options.styles - Inline styles
         * @param {Object} options.data - Data attributes
         * @returns {jQuery} jQuery element
         */
        createElement: function(tagName, options) {
            options = options || {};
            const $element = $('<' + tagName + '></' + tagName + '>');

            // Set class
            if (options.className) {
                $element.addClass(options.className);
            }

            // Set ID (sanitized)
            if (options.id) {
                $element.attr('id', Validators.sanitizeHtml(options.id));
            }

            // Set text content (safe - jQuery handles escaping)
            if (options.text) {
                $element.text(options.text);
            }

            // Set HTML content (sanitized)
            if (options.html) {
                $element.html(Validators.sanitizeHtml(options.html));
            }

            // Set attributes (sanitized)
            if (options.attrs) {
                for (let key in options.attrs) {
                    if (options.attrs.hasOwnProperty(key)) {
                        $element.attr(key, Validators.sanitizeHtml(String(options.attrs[key])));
                    }
                }
            }

            // Set styles
            if (options.styles) {
                $element.css(options.styles);
            }

            // Set data attributes
            if (options.data) {
                for (let key in options.data) {
                    if (options.data.hasOwnProperty(key)) {
                        $element.data(key, options.data[key]);
                    }
                }
            }

            return $element;
        },

        /**
         * Create a button with safe content
         * @param {Object} options - Button options
         * @param {string} options.text - Button text
         * @param {string} options.className - CSS class
         * @param {string} options.color - Background color
         * @param {string} options.textColor - Text color
         * @param {boolean} options.disabled - Disabled state
         * @param {string} options.icon - Icon class/HTML
         * @returns {jQuery} Button element
         */
        createButton: function(options) {
            options = options || {};

            const $button = this.createElement('button', {
                className: 'odag-button ' + (options.className || ''),
                text: options.text || 'Button',
                attrs: {
                    type: 'button',
                    disabled: options.disabled || false
                },
                styles: {
                    backgroundColor: options.color || '#009845',
                    color: options.textColor || '#ffffff'
                }
            });

            // Add icon if provided
            if (options.icon) {
                const $icon = $('<i>').addClass(options.icon);
                $button.prepend($icon).prepend(' ');
            }

            return $button;
        },

        /**
         * Create an input field with label
         * @param {Object} options - Input options
         * @param {string} options.label - Label text
         * @param {string} options.type - Input type
         * @param {string} options.name - Input name
         * @param {string} options.value - Input value
         * @param {string} options.placeholder - Placeholder text
         * @param {boolean} options.required - Required field
         * @param {boolean} options.disabled - Disabled state
         * @param {string} options.helpText - Help text
         * @returns {jQuery} Input container element
         */
        createInput: function(options) {
            options = options || {};

            const $container = this.createElement('div', {
                className: 'odag-input-group'
            });

            // Create label
            if (options.label) {
                const $label = this.createElement('label', {
                    text: options.label + (options.required ? ' *' : ''),
                    className: 'odag-label'
                });
                $container.append($label);
            }

            // Create input
            const $input = this.createElement('input', {
                className: 'odag-input',
                attrs: {
                    type: options.type || 'text',
                    name: options.name || '',
                    placeholder: options.placeholder || '',
                    required: options.required || false,
                    disabled: options.disabled || false
                }
            });

            // Set value safely
            if (options.value !== undefined) {
                $input.val(Validators.sanitizeHtml(String(options.value)));
            }

            $container.append($input);

            // Add help text
            if (options.helpText) {
                const $help = this.createElement('small', {
                    text: options.helpText,
                    className: 'odag-help-text'
                });
                $container.append($help);
            }

            return $container;
        },

        /**
         * Create a select dropdown with options
         * @param {Object} options - Select options
         * @param {string} options.label - Label text
         * @param {string} options.name - Select name
         * @param {Array} options.options - Array of {value, label} objects
         * @param {string} options.value - Selected value
         * @param {boolean} options.required - Required field
         * @param {boolean} options.disabled - Disabled state
         * @returns {jQuery} Select container element
         */
        createSelect: function(options) {
            options = options || {};

            const $container = this.createElement('div', {
                className: 'odag-select-group'
            });

            // Create label
            if (options.label) {
                const $label = this.createElement('label', {
                    text: options.label + (options.required ? ' *' : ''),
                    className: 'odag-label'
                });
                $container.append($label);
            }

            // Create select
            const $select = this.createElement('select', {
                className: 'odag-select',
                attrs: {
                    name: options.name || '',
                    required: options.required || false,
                    disabled: options.disabled || false
                }
            });

            // Add options
            if (options.options && Array.isArray(options.options)) {
                options.options.forEach(function(opt) {
                    const $option = $('<option>')
                        .val(opt.value)
                        .text(opt.label || opt.value);

                    if (opt.value === options.value) {
                        $option.attr('selected', 'selected');
                    }

                    $select.append($option);
                });
            }

            $container.append($select);

            return $container;
        },

        /**
         * Create an error message box
         * @param {string} message - Error message
         * @param {string} title - Error title
         * @returns {jQuery} Error box element
         */
        createErrorBox: function(message, title) {
            const $box = this.createElement('div', {
                className: 'odag-error-box',
                styles: {
                    padding: '20px',
                    color: '#d32f2f',
                    background: '#ffebee',
                    border: '1px solid #d32f2f',
                    borderRadius: '4px',
                    marginBottom: '10px'
                }
            });

            if (title) {
                const $title = this.createElement('strong', {
                    text: '⚠️ ' + title
                });
                $box.append($title).append('<br>');
            }

            const $message = this.createElement('span', {
                text: message
            });
            $box.append($message);

            return $box;
        },

        /**
         * Create a warning message box
         * @param {string} message - Warning message
         * @param {string} title - Warning title
         * @returns {jQuery} Warning box element
         */
        createWarningBox: function(message, title) {
            const $box = this.createElement('div', {
                className: 'odag-warning-box',
                styles: {
                    padding: '20px',
                    color: '#f57c00',
                    background: '#fff3e0',
                    border: '1px solid #f57c00',
                    borderRadius: '4px',
                    marginBottom: '10px'
                }
            });

            if (title) {
                const $title = this.createElement('strong', {
                    text: '⚠️ ' + title
                });
                $box.append($title).append('<br>');
            }

            const $message = this.createElement('span', {
                text: message
            });
            $box.append($message);

            return $box;
        },

        /**
         * Create an info message box
         * @param {string} message - Info message
         * @param {string} title - Info title
         * @returns {jQuery} Info box element
         */
        createInfoBox: function(message, title) {
            const $box = this.createElement('div', {
                className: 'odag-info-box',
                styles: {
                    padding: '20px',
                    color: '#0288d1',
                    background: '#e1f5fe',
                    border: '1px solid #0288d1',
                    borderRadius: '4px',
                    marginBottom: '10px'
                }
            });

            if (title) {
                const $title = this.createElement('strong', {
                    text: 'ℹ️ ' + title
                });
                $box.append($title).append('<br>');
            }

            const $message = this.createElement('span', {
                text: message
            });
            $box.append($message);

            return $box;
        },

        /**
         * Create a success message box
         * @param {string} message - Success message
         * @param {string} title - Success title
         * @returns {jQuery} Success box element
         */
        createSuccessBox: function(message, title) {
            const $box = this.createElement('div', {
                className: 'odag-success-box',
                styles: {
                    padding: '20px',
                    color: '#388e3c',
                    background: '#e8f5e9',
                    border: '1px solid #388e3c',
                    borderRadius: '4px',
                    marginBottom: '10px'
                }
            });

            if (title) {
                const $title = this.createElement('strong', {
                    text: '✅ ' + title
                });
                $box.append($title).append('<br>');
            }

            const $message = this.createElement('span', {
                text: message
            });
            $box.append($message);

            return $box;
        },

        /**
         * Create a loading spinner
         * @param {string} message - Loading message
         * @returns {jQuery} Loading element
         */
        createLoader: function(message) {
            const $container = this.createElement('div', {
                className: 'odag-loader-container',
                styles: {
                    textAlign: 'center',
                    padding: '40px'
                }
            });

            const $spinner = this.createElement('div', {
                className: 'odag-spinner',
                styles: {
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #009845',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 10px'
                }
            });

            $container.append($spinner);

            if (message) {
                const $message = this.createElement('div', {
                    text: message,
                    className: 'odag-loader-text'
                });
                $container.append($message);
            }

            return $container;
        },

        /**
         * Create a table with headers and rows
         * @param {Object} options - Table options
         * @param {Array} options.headers - Array of header labels
         * @param {Array} options.rows - Array of row data arrays
         * @param {string} options.className - Additional CSS class
         * @param {boolean} options.striped - Striped rows
         * @param {boolean} options.bordered - Bordered table
         * @returns {jQuery} Table element
         */
        createTable: function(options) {
            options = options || {};

            const classes = ['odag-table'];
            if (options.className) classes.push(options.className);
            if (options.striped) classes.push('odag-table-striped');
            if (options.bordered) classes.push('odag-table-bordered');

            const $table = this.createElement('table', {
                className: classes.join(' ')
            });

            // Create thead
            if (options.headers && options.headers.length > 0) {
                const $thead = $('<thead>');
                const $headerRow = $('<tr>');

                options.headers.forEach(function(header) {
                    const $th = $('<th>').text(header);
                    $headerRow.append($th);
                });

                $thead.append($headerRow);
                $table.append($thead);
            }

            // Create tbody
            if (options.rows && options.rows.length > 0) {
                const $tbody = $('<tbody>');

                options.rows.forEach(function(rowData) {
                    const $row = $('<tr>');

                    rowData.forEach(function(cellData) {
                        const $td = $('<td>');

                        // If cellData is a jQuery object or DOM element, append it
                        if (cellData instanceof $ || cellData instanceof HTMLElement) {
                            $td.append(cellData);
                        } else {
                            // Otherwise, set as text (safe)
                            $td.text(cellData);
                        }

                        $row.append($td);
                    });

                    $tbody.append($row);
                });

                $table.append($tbody);
            }

            return $table;
        },

        /**
         * Create a badge/label element
         * @param {string} text - Badge text
         * @param {string} variant - Badge variant (success, error, warning, info)
         * @returns {jQuery} Badge element
         */
        createBadge: function(text, variant) {
            variant = variant || 'default';

            const colorMap = {
                success: { bg: '#388e3c', color: '#fff' },
                error: { bg: '#d32f2f', color: '#fff' },
                warning: { bg: '#f57c00', color: '#fff' },
                info: { bg: '#0288d1', color: '#fff' },
                default: { bg: '#757575', color: '#fff' }
            };

            const colors = colorMap[variant] || colorMap.default;

            return this.createElement('span', {
                text: text,
                className: 'odag-badge odag-badge-' + variant,
                styles: {
                    display: 'inline-block',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    backgroundColor: colors.bg,
                    color: colors.color
                }
            });
        },

        /**
         * Create a card/panel container
         * @param {Object} options - Card options
         * @param {string} options.title - Card title
         * @param {string} options.content - Card content (text)
         * @param {jQuery} options.$content - Card content (jQuery element)
         * @param {string} options.className - Additional CSS class
         * @returns {jQuery} Card element
         */
        createCard: function(options) {
            options = options || {};

            const $card = this.createElement('div', {
                className: 'odag-card ' + (options.className || ''),
                styles: {
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '15px',
                    backgroundColor: '#fff'
                }
            });

            // Card header
            if (options.title) {
                const $header = this.createElement('div', {
                    className: 'odag-card-header',
                    text: options.title,
                    styles: {
                        padding: '15px',
                        borderBottom: '1px solid #ddd',
                        fontWeight: 'bold',
                        backgroundColor: '#f5f5f5'
                    }
                });
                $card.append($header);
            }

            // Card body
            const $body = this.createElement('div', {
                className: 'odag-card-body',
                styles: {
                    padding: '15px'
                }
            });

            if (options.content) {
                $body.text(options.content);
            } else if (options.$content) {
                $body.append(options.$content);
            }

            $card.append($body);

            return $card;
        },

        /**
         * Sanitize and escape HTML string
         * Uses the existing Validators.sanitizeHtml method
         * @param {string} html - HTML string to sanitize
         * @returns {string} Sanitized HTML
         */
        sanitize: function(html) {
            return Validators.sanitizeHtml(html);
        },

        /**
         * Create a safe link element
         * @param {Object} options - Link options
         * @param {string} options.text - Link text
         * @param {string} options.href - Link URL (will be validated)
         * @param {string} options.target - Link target
         * @param {string} options.className - CSS class
         * @returns {jQuery} Link element
         */
        createLink: function(options) {
            options = options || {};

            // Validate URL to prevent javascript: URLs
            let safeHref = '#';
            if (options.href) {
                const href = String(options.href);
                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')) {
                    safeHref = href;
                }
            }

            return this.createElement('a', {
                text: options.text || 'Link',
                className: options.className || 'odag-link',
                attrs: {
                    href: safeHref,
                    target: options.target || '_self'
                }
            });
        }
    };

    return UIBuilder;
});
