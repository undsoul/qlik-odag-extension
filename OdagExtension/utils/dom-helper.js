/**
 * DOM Helper Utility (Vanilla JS)
 * Replaces jQuery with modern, secure vanilla JavaScript
 *
 * @version 8.0.0
 * @description Lightweight DOM manipulation without jQuery dependencies
 */

define([], function() {
    'use strict';

    /**
     * DOM Helper - Vanilla JS replacement for jQuery
     * Provides safe, modern DOM manipulation methods
     */
    const DOMHelper = {

        /**
         * Select single element by selector
         * Replaces: $('#id') or $('.class')
         *
         * @param {string} selector - CSS selector
         * @returns {Element|null} DOM element or null
         */
        get: function(selector) {
            if (!selector) return null;

            // Optimize for ID selector (most common case)
            if (selector.startsWith('#')) {
                return document.getElementById(selector.slice(1));
            }

            return document.querySelector(selector);
        },

        /**
         * Select multiple elements by selector
         * Replaces: $('.class')
         *
         * @param {string} selector - CSS selector
         * @param {Element|string} context - Optional context element or selector to search within
         * @returns {Array<Element>} Array of DOM elements
         */
        getAll: function(selector, context) {
            if (!selector) return [];

            // If context is provided, use it; otherwise use document
            let searchContext = document;
            if (context) {
                searchContext = typeof context === 'string' ? this.get(context) : context;
                if (!searchContext) return [];
            }

            return Array.from(searchContext.querySelectorAll(selector));
        },

        /**
         * Add CSS class to element
         * Replaces: $(el).addClass('class')
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} className - Class name to add
         */
        addClass: function(element, className) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && className) {
                el.classList.add(className);
            }
        },

        /**
         * Remove CSS class from element
         * Replaces: $(el).removeClass('class')
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} className - Class name to remove
         */
        removeClass: function(element, className) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && className) {
                el.classList.remove(className);
            }
        },

        /**
         * Toggle CSS class on element
         * Replaces: $(el).toggleClass('class')
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} className - Class name to toggle
         */
        toggleClass: function(element, className) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && className) {
                el.classList.toggle(className);
            }
        },

        /**
         * Check if element has class
         * Replaces: $(el).hasClass('class')
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} className - Class name to check
         * @returns {boolean} True if element has class
         */
        hasClass: function(element, className) {
            const el = typeof element === 'string' ? this.get(element) : element;
            return el ? el.classList.contains(className) : false;
        },

        /**
         * Basic HTML sanitization (removes dangerous elements/attributes)
         * Not as comprehensive as DOMPurify but handles common XSS vectors
         * @param {string} html - HTML content to sanitize
         * @returns {string} Sanitized HTML
         */
        _basicSanitize: function(html) {
            if (!html || typeof html !== 'string') return html;

            // Remove script tags and their content
            let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

            // Remove event handlers (onclick, onerror, onload, etc.)
            sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
            sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

            // Remove javascript: URLs
            sanitized = sanitized.replace(/javascript\s*:/gi, '');

            // Remove data: URLs that could contain scripts
            sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');

            return sanitized;
        },

        /**
         * Set HTML content with optional sanitization
         * Replaces: $(el).html(content)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} html - HTML content
         * @param {boolean|string} options - false to skip sanitization, 'trusted' for internal HTML
         */
        setHTML: function(element, html, options) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (!el) return;

            // If options is 'trusted', this is internally generated HTML - use basic sanitization
            if (options === 'trusted') {
                el.innerHTML = this._basicSanitize(html);
                return;
            }

            // If options is false, skip sanitization entirely (use with caution)
            if (options === false) {
                el.innerHTML = html;
                return;
            }

            // Default: Use DOMPurify if available, otherwise basic sanitization
            if (window.DOMPurify) {
                el.innerHTML = window.DOMPurify.sanitize(html);
            } else {
                // Use basic sanitization as fallback (no warning spam)
                el.innerHTML = this._basicSanitize(html);
            }
        },

        /**
         * Get HTML content
         * Replaces: $(el).html()
         *
         * @param {Element|string} element - DOM element or selector
         * @returns {string} HTML content
         */
        getHTML: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            return el ? el.innerHTML : '';
        },

        /**
         * Set text content (SAFE - no XSS risk)
         * Replaces: $(el).text(content)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} text - Text content
         */
        setText: function(element, text) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                el.textContent = text;
            }
        },

        /**
         * Get text content
         * Replaces: $(el).text()
         *
         * @param {Element|string} element - DOM element or selector
         * @returns {string} Text content
         */
        getText: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            return el ? el.textContent : '';
        },

        /**
         * Add event listener
         * Replaces: $(el).on(event, handler)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} event - Event name
         * @param {Function} handler - Event handler
         */
        on: function(element, event, handler) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && event && handler) {
                el.addEventListener(event, handler);
            }
        },

        /**
         * Remove event listener
         * Replaces: $(el).off(event, handler)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} event - Event name
         * @param {Function} handler - Event handler
         */
        off: function(element, event, handler) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && event && handler) {
                el.removeEventListener(event, handler);
            }
        },

        /**
         * Trigger click event
         * Replaces: $(el).click()
         *
         * @param {Element|string} element - DOM element or selector
         */
        click: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                el.click();
            }
        },

        /**
         * Show element
         * Replaces: $(el).show()
         *
         * @param {Element|string} element - DOM element or selector
         */
        show: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                el.style.display = '';
            }
        },

        /**
         * Hide element
         * Replaces: $(el).hide()
         *
         * @param {Element|string} element - DOM element or selector
         */
        hide: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                el.style.display = 'none';
            }
        },

        /**
         * Toggle element visibility
         * Replaces: $(el).toggle()
         *
         * @param {Element|string} element - DOM element or selector
         */
        toggle: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                const currentDisplay = window.getComputedStyle(el).display;
                el.style.display = (currentDisplay === 'none') ? '' : 'none';
            }
        },

        /**
         * Remove element from DOM
         * Replaces: $(el).remove()
         *
         * @param {Element|string} element - DOM element or selector
         */
        remove: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        },

        /**
         * Empty element (remove all children)
         * Replaces: $(el).empty()
         *
         * @param {Element|string} element - DOM element or selector
         */
        empty: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el) {
                el.innerHTML = '';
            }
        },

        /**
         * Append HTML to element
         * Replaces: $(el).append(html)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} html - HTML to append
         * @param {boolean} sanitize - Whether to sanitize (default: true)
         */
        append: function(element, html, sanitize) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (!el) return;

            const content = (sanitize !== false && window.DOMPurify)
                ? window.DOMPurify.sanitize(html)
                : html;

            el.insertAdjacentHTML('beforeend', content);
        },

        /**
         * Get attribute value
         * Replaces: $(el).attr(name)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} name - Attribute name
         * @returns {string|null} Attribute value
         */
        getAttr: function(element, name) {
            const el = typeof element === 'string' ? this.get(element) : element;
            return el ? el.getAttribute(name) : null;
        },

        /**
         * Set attribute value
         * Replaces: $(el).attr(name, value)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} name - Attribute name
         * @param {string} value - Attribute value
         */
        setAttr: function(element, name, value) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && name) {
                el.setAttribute(name, value);
            }
        },

        /**
         * Remove attribute
         * Replaces: $(el).removeAttr(name)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} name - Attribute name
         */
        removeAttr: function(element, name) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (el && name) {
                el.removeAttribute(name);
            }
        },

        /**
         * Check if element exists in DOM
         * Replaces: $(el).length > 0
         *
         * @param {Element|string} element - DOM element or selector
         * @returns {boolean} True if element exists
         */
        exists: function(element) {
            const el = typeof element === 'string' ? this.get(element) : element;
            return el !== null && el !== undefined;
        },

        /**
         * Get or set CSS property
         * Replaces: $(el).css(prop, value)
         *
         * @param {Element|string} element - DOM element or selector
         * @param {string} property - CSS property name
         * @param {string} value - CSS value (optional, for setter)
         * @returns {string|undefined} CSS value if getter
         */
        css: function(element, property, value) {
            const el = typeof element === 'string' ? this.get(element) : element;
            if (!el) return;

            // Setter
            if (value !== undefined) {
                el.style[property] = value;
            } else {
                // Getter
                return window.getComputedStyle(el)[property];
            }
        },

        /**
         * Create element with optional attributes and content
         *
         * @param {string} tag - HTML tag name
         * @param {Object} attrs - Attributes object (optional)
         * @param {string} content - Text content (optional)
         * @returns {Element} Created element
         */
        create: function(tag, attrs, content) {
            const el = document.createElement(tag);

            // Set attributes
            if (attrs) {
                Object.keys(attrs).forEach(function(key) {
                    if (key === 'class') {
                        el.className = attrs[key];
                    } else {
                        el.setAttribute(key, attrs[key]);
                    }
                });
            }

            // Set content
            if (content) {
                el.textContent = content;
            }

            return el;
        }
    };

    return DOMHelper;
});
