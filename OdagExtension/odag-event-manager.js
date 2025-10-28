/**
 * ODAG Event Manager
 * Centralized event handling with proper cleanup
 *
 * @version 5.0.0-beta
 */

define(["jquery"], function($) {
    'use strict';

    /**
     * Event Manager Class
     * Manages event listeners with automatic cleanup to prevent memory leaks
     */
    function EventManager() {
        this.listeners = [];
        this.timers = [];
        this.intervals = [];
    }

    /**
     * Add event listener with tracking for cleanup
     * @param {jQuery|HTMLElement} $element - Element to attach event to
     * @param {string} eventName - Event name (e.g., 'click', 'change')
     * @param {string} selector - Optional selector for delegation
     * @param {Function} handler - Event handler function
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.on = function($element, eventName, selector, handler) {
        // Handle optional selector parameter
        if (typeof selector === 'function') {
            handler = selector;
            selector = null;
        }

        // Convert to jQuery if needed
        if (!($element instanceof $)) {
            $element = $($element);
        }

        // Attach event
        if (selector) {
            $element.on(eventName, selector, handler);
        } else {
            $element.on(eventName, handler);
        }

        // Track for cleanup
        this.listeners.push({
            $element: $element,
            eventName: eventName,
            selector: selector,
            handler: handler
        });

        return this;
    };

    /**
     * Add one-time event listener
     * @param {jQuery|HTMLElement} $element - Element to attach event to
     * @param {string} eventName - Event name
     * @param {string} selector - Optional selector for delegation
     * @param {Function} handler - Event handler function
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.once = function($element, eventName, selector, handler) {
        // Handle optional selector parameter
        if (typeof selector === 'function') {
            handler = selector;
            selector = null;
        }

        const self = this;
        const wrappedHandler = function() {
            handler.apply(this, arguments);
            self.off($element, eventName, selector, wrappedHandler);
        };

        return this.on($element, eventName, selector, wrappedHandler);
    };

    /**
     * Remove event listener
     * @param {jQuery|HTMLElement} $element - Element to remove event from
     * @param {string} eventName - Event name
     * @param {string} selector - Optional selector
     * @param {Function} handler - Optional specific handler
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.off = function($element, eventName, selector, handler) {
        // Handle optional parameters
        if (typeof selector === 'function') {
            handler = selector;
            selector = null;
        }

        // Convert to jQuery if needed
        if (!($element instanceof $)) {
            $element = $($element);
        }

        // Remove event
        if (selector && handler) {
            $element.off(eventName, selector, handler);
        } else if (selector) {
            $element.off(eventName, selector);
        } else if (handler) {
            $element.off(eventName, handler);
        } else {
            $element.off(eventName);
        }

        // Remove from tracking
        this.listeners = this.listeners.filter(function(listener) {
            return !(
                listener.$element[0] === $element[0] &&
                listener.eventName === eventName &&
                (!selector || listener.selector === selector) &&
                (!handler || listener.handler === handler)
            );
        });

        return this;
    };

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @param {boolean} immediate - Trigger on leading edge instead of trailing
     * @returns {Function} Debounced function
     */
    EventManager.prototype.debounce = function(func, wait, immediate) {
        let timeout;
        const self = this;

        return function debounced() {
            const context = this;
            const args = arguments;

            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            const callNow = immediate && !timeout;

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            // Track timeout for cleanup
            if (!self.timers.includes(timeout)) {
                self.timers.push(timeout);
            }

            if (callNow) func.apply(context, args);
        };
    };

    /**
     * Throttle a function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    EventManager.prototype.throttle = function(func, limit) {
        let inThrottle;
        let lastFunc;
        let lastRan;
        const self = this;

        return function throttled() {
            const context = this;
            const args = arguments;

            if (!inThrottle) {
                func.apply(context, args);
                lastRan = Date.now();
                inThrottle = true;
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));

                // Track timeout for cleanup
                if (!self.timers.includes(lastFunc)) {
                    self.timers.push(lastFunc);
                }
            }
        };
    };

    /**
     * Set a timeout with tracking for cleanup
     * @param {Function} func - Function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Timer ID
     */
    EventManager.prototype.setTimeout = function(func, delay) {
        const timerId = setTimeout(func, delay);
        this.timers.push(timerId);
        return timerId;
    };

    /**
     * Set an interval with tracking for cleanup
     * @param {Function} func - Function to execute
     * @param {number} delay - Interval delay in milliseconds
     * @returns {number} Interval ID
     */
    EventManager.prototype.setInterval = function(func, delay) {
        const intervalId = setInterval(func, delay);
        this.intervals.push(intervalId);
        return intervalId;
    };

    /**
     * Clear a specific timeout
     * @param {number} timerId - Timer ID to clear
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.clearTimeout = function(timerId) {
        clearTimeout(timerId);
        this.timers = this.timers.filter(function(id) {
            return id !== timerId;
        });
        return this;
    };

    /**
     * Clear a specific interval
     * @param {number} intervalId - Interval ID to clear
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.clearInterval = function(intervalId) {
        clearInterval(intervalId);
        this.intervals = this.intervals.filter(function(id) {
            return id !== intervalId;
        });
        return this;
    };

    /**
     * Clean up all event listeners and timers
     * Call this when the extension is unmounted
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.cleanup = function() {
        // Remove all event listeners
        this.listeners.forEach(function(listener) {
            if (listener.selector && listener.handler) {
                listener.$element.off(listener.eventName, listener.selector, listener.handler);
            } else if (listener.selector) {
                listener.$element.off(listener.eventName, listener.selector);
            } else if (listener.handler) {
                listener.$element.off(listener.eventName, listener.handler);
            } else {
                listener.$element.off(listener.eventName);
            }
        });

        // Clear all timers
        this.timers.forEach(function(timerId) {
            clearTimeout(timerId);
        });

        // Clear all intervals
        this.intervals.forEach(function(intervalId) {
            clearInterval(intervalId);
        });

        // Reset tracking arrays
        this.listeners = [];
        this.timers = [];
        this.intervals = [];

        return this;
    };

    /**
     * Trigger a custom event on an element
     * @param {jQuery|HTMLElement} $element - Element to trigger event on
     * @param {string} eventName - Event name
     * @param {*} data - Optional event data
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.trigger = function($element, eventName, data) {
        // Convert to jQuery if needed
        if (!($element instanceof $)) {
            $element = $($element);
        }

        $element.trigger(eventName, data);
        return this;
    };

    /**
     * Delegate event to multiple elements
     * @param {jQuery|HTMLElement} $container - Container element
     * @param {Object} eventMap - Map of selector -> event -> handler
     * @example
     * eventManager.delegate($container, {
     *   '.button': { 'click': handleClick },
     *   '.input': { 'change': handleChange, 'blur': handleBlur }
     * });
     * @returns {EventManager} this for chaining
     */
    EventManager.prototype.delegate = function($container, eventMap) {
        const self = this;

        for (let selector in eventMap) {
            if (eventMap.hasOwnProperty(selector)) {
                const events = eventMap[selector];

                for (let eventName in events) {
                    if (events.hasOwnProperty(eventName)) {
                        self.on($container, eventName, selector, events[eventName]);
                    }
                }
            }
        }

        return this;
    };

    /**
     * Get count of active listeners
     * @returns {number} Number of active listeners
     */
    EventManager.prototype.getListenerCount = function() {
        return this.listeners.length;
    };

    /**
     * Get count of active timers
     * @returns {number} Number of active timers
     */
    EventManager.prototype.getTimerCount = function() {
        return this.timers.length + this.intervals.length;
    };

    /**
     * Check if any listeners are registered for an element
     * @param {jQuery|HTMLElement} $element - Element to check
     * @returns {boolean} true if listeners exist
     */
    EventManager.prototype.hasListeners = function($element) {
        // Convert to jQuery if needed
        if (!($element instanceof $)) {
            $element = $($element);
        }

        return this.listeners.some(function(listener) {
            return listener.$element[0] === $element[0];
        });
    };

    // Factory function to create new EventManager instances
    return {
        create: function() {
            return new EventManager();
        }
    };
});
