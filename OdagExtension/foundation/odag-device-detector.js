/**
 * ODAG Device Detector
 * Detects whether the extension runs inside the native Qlik Sense mobile
 * app (vs. a regular browser). Adapted from the IsThatYou extension.
 *
 * Viewport width alone (elementWidth < 768) misses iPad/landscape native
 * app, where width is desktop-sized but the runtime is the mobile webview.
 * Detection layers (any one match → native app):
 *   1. user agent: QlikSenseMobile, Qlik Sense Mobile, QlikClient
 *   2. globals: window.QlikMobile, cordova, Capacitor, QlikAndroid, Android
 *   3. url params: ?qmobile=true or ?mobile=true
 *   4. qlik api: qlik.navigation.isMobileView()
 *   5. ios bridge: window.webkit.messageHandlers
 *   6. referrer scheme: qliksense:// or qlik://
 *
 * @version 9.2.10
 */
define([], function() {
    'use strict';

    const ODAGDeviceDetector = {

        _cached: null,
        _detectionMethod: null,

        /**
         * Returns true if running inside the native Qlik Sense mobile app.
         * Result is cached after first call (UA/globals don't change mid-session).
         * @param {Object} qlik - Optional Qlik API object for isMobileView() check
         * @returns {boolean}
         */
        isNativeMobileApp: function(qlik) {
            if (this._cached !== null) return this._cached;

            const userAgent = navigator.userAgent || '';

            // Qlik renamed the native iOS/Android app from "Qlik Sense Mobile" to
            // "Qlik Analytics Mobile" around v12.27xx. UA strings differ accordingly.
            const mobileAppUAs = [
                'QlikSenseMobile', 'Qlik Sense Mobile',
                'QlikAnalyticsMobile', 'Qlik Analytics Mobile',
                'QlikClient'
            ];
            for (let i = 0; i < mobileAppUAs.length; i++) {
                if (userAgent.indexOf(mobileAppUAs[i]) !== -1) {
                    this._detectionMethod = 'userAgent:' + mobileAppUAs[i];
                    return (this._cached = true);
                }
            }

            if (typeof window.QlikMobile !== 'undefined') {
                this._detectionMethod = 'window.QlikMobile';
                return (this._cached = true);
            }
            if (typeof window.cordova !== 'undefined' || typeof window.Capacitor !== 'undefined') {
                this._detectionMethod = 'cordova/capacitor';
                return (this._cached = true);
            }
            if (typeof window.QlikAndroid !== 'undefined' || typeof window.Android !== 'undefined') {
                this._detectionMethod = 'android-bridge';
                return (this._cached = true);
            }

            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get('qmobile') === 'true' || params.get('mobile') === 'true') {
                    this._detectionMethod = 'url-param';
                    return (this._cached = true);
                }
            } catch (e) {}

            try {
                if (qlik && qlik.navigation && typeof qlik.navigation.isMobileView === 'function' && qlik.navigation.isMobileView()) {
                    this._detectionMethod = 'qlik.navigation.isMobileView';
                    return (this._cached = true);
                }
            } catch (e) {}

            if (window.webkit && window.webkit.messageHandlers) {
                this._detectionMethod = 'webkit-bridge';
                return (this._cached = true);
            }

            const referrer = document.referrer || '';
            if (referrer.indexOf('qliksense://') === 0 || referrer.indexOf('qlik://') === 0) {
                this._detectionMethod = 'referrer-scheme';
                return (this._cached = true);
            }

            this._detectionMethod = 'browser';
            return (this._cached = false);
        },

        /**
         * Returns the detection method used (for debugging).
         * Call after isNativeMobileApp().
         * @returns {string|null}
         */
        getDetectionMethod: function() {
            return this._detectionMethod;
        }
    };

    return ODAGDeviceDetector;
});
