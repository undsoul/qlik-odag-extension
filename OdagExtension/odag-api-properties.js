define([], function() {
    'use strict';

    return {
        type: "items",
        component: "accordion",
        items: {
            odagSettings: {
                type: "items",
                label: "ODAG Configuration",
                items: {
                    // On-Premise: Combobox with search for all links
                    odagLinkIdOnPremise: {
                        type: "string",
                        component: "dropdown",
                        ref: "odagConfig.odagLinkId",
                        label: "Select ODAG Link",
                        options: function() {
                            if (window.odagAllLinks && Array.isArray(window.odagAllLinks)) {
                                return window.odagAllLinks.map(function(link) {
                                    return {
                                        value: link.id,
                                        label: link.name + ' → ' + (link.templateApp ? link.templateApp.name : 'N/A')
                                    };
                                });
                            }
                            return [{
                                value: "",
                                label: "Loading links... (refresh properties panel)"
                            }];
                        },
                        defaultValue: "",
                        searchEnabled: true,
                        change: function(layout) {
                            // Fetch bindings immediately when ODAG Link ID changes
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;

                            if (!odagLinkId || !odagLinkId.trim()) {
                                // Clear if empty
                                window.odagLastLinkId = '';
                                return;
                            }

                            // If it's the same as before, no need to fetch again
                            if (odagLinkId === window.odagLastLinkId) {
                                return;
                            }

                            var oldCacheKey = 'odagBindings_' + window.odagLastLinkId;
                            var newCacheKey = 'odagBindings_' + odagLinkId;

                            // Clear old cache
                            if (window[oldCacheKey]) {
                                delete window[oldCacheKey];
                            }

                            console.log('🔄 ODAG Link ID changed to:', odagLinkId, '- fetching bindings immediately...');

                            // Store current link ID
                            window.odagLastLinkId = odagLinkId;

                            // Fetch bindings immediately for On-Premise
                            var app = window.qlik ? window.qlik.currApp() : null;
                            if (!app) return;

                            var currentUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
                            var xrfkey = 'abcdefghijklmnop';
                            var linkDetailsUrl = currentUrl + '/api/odag/v1/links/' + odagLinkId + '?xrfkey=' + xrfkey;

                            window.jQuery.ajax({
                                url: linkDetailsUrl,
                                type: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    'X-Qlik-XrfKey': xrfkey
                                },
                                xhrFields: {withCredentials: true},
                                timeout: 5000,
                                success: function(linkDetails) {
                                    console.log('✅ Fetched ODAG link details:', linkDetails);

                                    // Extract bindings
                                    var bindings = null;
                                    if (linkDetails && linkDetails.objectDef && linkDetails.objectDef.bindings) {
                                        bindings = linkDetails.objectDef.bindings;
                                    } else if (linkDetails && linkDetails.bindings) {
                                        bindings = linkDetails.bindings;
                                    }

                                    if (bindings && Array.isArray(bindings) && bindings.length > 0) {
                                        // Cache the bindings
                                        window[newCacheKey] = bindings;

                                        // Create readable binding fields string
                                        var bindingFieldsStr = bindings.map(function(b) {
                                            return b.fieldName || b.name || 'Unknown';
                                        }).join(', ');

                                        console.log('✅ Bindings cached:', bindings.length, 'bindings -', bindingFieldsStr);

                                        // Update the layout with cached bindings
                                        app.getObject(layout.qInfo.qId).then(function(model) {
                                            model.getProperties().then(function(props) {
                                                if (props.odagConfig) {
                                                    props.odagConfig._cachedBindingFields = bindingFieldsStr;
                                                    props.odagConfig.odagLinkId = odagLinkId;
                                                }
                                                model.setProperties(props);
                                            });
                                        });
                                    } else {
                                        console.warn('⚠️ No bindings found in ODAG link');
                                    }
                                },
                                error: function(xhr, status, error) {
                                    console.error('❌ Failed to fetch ODAG link bindings:', error);
                                    console.error('Response:', xhr.responseText);
                                }
                            });
                        },
                        show: function() {
                            return window.qlikEnvironment !== 'cloud';
                        }
                    },
                    // Cloud: Manual input
                    odagLinkIdCloud: {
                        type: "string",
                        ref: "odagConfig.odagLinkId",
                        label: "ODAG Link ID",
                        expression: "optional",
                        defaultValue: "",
                        change: function(layout) {
                            // Clear cached bindings when ODAG Link ID changes
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            if (odagLinkId && window.odagLastLinkId && odagLinkId !== window.odagLastLinkId) {
                                var oldCacheKey = 'odagBindings_' + window.odagLastLinkId;

                                // Clear old cache
                                if (window[oldCacheKey]) {
                                    delete window[oldCacheKey];
                                }

                                // Clear stored bindings from layout since we're switching to a different ODAG link
                                var app = window.qlik ? window.qlik.currApp() : null;
                                if (app) {
                                    app.getObject(layout.qInfo.qId).then(function(model) {
                                        model.getProperties().then(function(props) {
                                            // Preserve all existing properties
                                            if (props.odagConfig) {
                                                props.odagConfig._cachedBindingFields = '';
                                                props.odagConfig.odagLinkId = odagLinkId;
                                            }
                                            model.setProperties(props);
                                        });
                                    });
                                }

                                console.log('🔄 ODAG Link ID changed from', window.odagLastLinkId, 'to', odagLinkId, '- cleared old bindings, will fetch new bindings on next paint');
                            }

                            // Store current link ID
                            window.odagLastLinkId = odagLinkId;
                        },
                        show: function() {
                            return window.qlikEnvironment === 'cloud';
                        }
                    },
                    includeCurrentSelections: {
                        type: "boolean",
                        ref: "odagConfig.includeCurrentSelections",
                        label: "Include Current Selections",
                        defaultValue: true
                    },
                    cachedBindingFields: {
                        type: "string",
                        ref: "odagConfig._cachedBindingFields",
                        label: "Required Binding Fields (auto-fetched)",
                        expression: "optional",
                        defaultValue: "",
                        readOnly: true,
                        show: function(layout) {
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            return odagLinkId && odagLinkId.trim() !== '';
                        }
                    },
                    refreshBindingsBtn: {
                        component: "button",
                        label: "Refresh Binding Fields",
                        action: function(layout) {
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            if (!odagLinkId) {
                                alert('⚠️ Please enter an ODAG Link ID first.');
                                return;
                            }

                            // Clear the cached bindings to force a refresh
                            var bindingsCacheKey = 'odagBindings_' + odagLinkId;
                            delete window[bindingsCacheKey];

                            // Clear the stored binding fields in layout
                            var app = window.qlik ? window.qlik.currApp() : null;
                            if (app) {
                                app.getObject(layout.qInfo.qId).then(function(model) {
                                    model.getProperties().then(function(props) {
                                        // Preserve all existing properties
                                        if (props.odagConfig) {
                                            props.odagConfig._cachedBindingFields = '';
                                            // Add a timestamp to force repaint
                                            props.odagConfig._refreshTimestamp = Date.now();
                                        }
                                        model.setProperties(props).then(function() {
                                            console.log('🔄 Cleared bindings cache and triggered repaint.');
                                            // Wait a moment for the repaint to complete, then notify
                                            setTimeout(function() {
                                                alert('✅ Binding fields refreshed!\n\nThe updated binding fields should now appear in the field above.');
                                            }, 500);
                                        });
                                    });
                                });
                            }
                        },
                        show: function(layout) {
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            return odagLinkId && odagLinkId.trim() !== '';
                        }
                    },
                    bindingsInfo: {
                        component: "text",
                        label: "",
                        template: function() {
                            return '<div style="padding: 8px; background: #e0f2fe; border-left: 3px solid #0284c7; border-radius: 4px; color: #0c4a6e; font-size: 11px;">' +
                                   '<strong>ℹ️ About Binding Fields:</strong><br/>' +
                                   '• Binding fields are automatically fetched when you enter an ODAG Link ID<br/>' +
                                   '• They are cached and reused for all generation requests (no repeated API calls)<br/>' +
                                   '• If the ODAG link configuration is updated in Qlik, click "Refresh Binding Fields" to reload them<br/>' +
                                   '• Switching to a different ODAG Link ID automatically clears the old bindings</div>';
                        },
                        show: function(layout) {
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            return odagLinkId && odagLinkId.trim() !== '';
                        }
                    }
                }
            },
            variableMappings: {
                type: "array",
                ref: "odagConfig.variableMappings",
                label: "Variable to Field Mappings",
                itemTitleRef: function(data) {
                    return (data.variableName || "Variable") + " → " + (data.fieldName || "Field");
                },
                allowAdd: true,
                allowRemove: true,
                allowMove: true,
                addTranslation: "Add Variable Mapping",
                items: {
                    variableName: {
                        type: "string",
                        ref: "variableName",
                        label: "Variable Name (e.g. vTest)",
                        expression: "optional",
                        defaultValue: ""
                    },
                    fieldName: {
                        type: "string",
                        ref: "fieldName",
                        label: "Target Field Name (e.g. Dim1)",
                        expression: "optional",
                        defaultValue: ""
                    }
                }
            },
            appearance: {
                type: "items",
                label: "Button Appearance",
                items: {
                    buttonText: {
                        type: "string",
                        ref: "odagConfig.buttonText",
                        label: "Button Text",
                        expression: "optional",
                        defaultValue: "Generate ODAG App"
                    },
                    buttonColor: {
                        type: "string",
                        ref: "odagConfig.buttonColor",
                        label: "Button Color",
                        expression: "optional",
                        defaultValue: "#009845"
                    },
                    buttonTextColor: {
                        type: "string",
                        ref: "odagConfig.buttonTextColor",
                        label: "Text Color",
                        expression: "optional",
                        defaultValue: "#ffffff"
                    }
                }
            },
            viewSettings: {
                type: "items",
                label: "View Settings",
                items: {
                    viewMode: {
                        type: "string",
                        component: "dropdown",
                        ref: "odagConfig.viewMode",
                        label: "View Mode",
                        options: [{
                            value: "odagApp",
                            label: "Standard List View (App/Sheet)"
                        }, {
                            value: "dynamicView",
                            label: "Dynamic View (Latest ODAG App Only)"
                        }],
                        defaultValue: "odagApp"
                    },
                    embedMode: {
                        type: "string",
                        component: "dropdown",
                        ref: "odagConfig.embedMode",
                        label: "Embed Mode",
                        options: [{
                            value: "classic/app",
                            label: "Classic App (with selection bar)"
                        }, {
                            value: "analytics/sheet",
                            label: "Analytics Sheet (no selection bar)"
                        }],
                        defaultValue: "classic/app"
                    },
                    templateSheetId: {
                        type: "string",
                        ref: "odagConfig.templateSheetId",
                        label: "Sheet ID (Optional - leave empty for full app)",
                        expression: "optional",
                        defaultValue: ""
                    },
                    allowInteractions: {
                        type: "boolean",
                        ref: "odagConfig.allowInteractions",
                        label: "Allow Interactions",
                        defaultValue: true
                    }
                }
            },
            settings: {
                uses: "settings"
            },
            debug: {
                type: "items",
                label: "Debug",
                items: {
                    enableDebug: {
                        type: "boolean",
                        ref: "odagConfig.enableDebug",
                        label: "Show Debug Info",
                        defaultValue: false
                    }
                }
            }
        }
    };
});