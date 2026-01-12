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
                                            return b.selectAppParamName || b.selectionAppParamName || b.fieldName || b.name || 'Unknown';
                                        }).join(', ');

                                        console.log('✅ Bindings cached:', bindings.length, 'bindings -', bindingFieldsStr);

                                        // DON'T try to update properties here - the paint() method will handle it
                                        // Just log success
                                        console.log('💡 Bindings cached in window. They will be saved to properties on next paint() cycle.');
                                        console.log('💡 Exit and re-enter edit mode to see them in the properties panel.');
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
                    _lastUpdateTimestamp: {
                        type: "number",
                        ref: "odagConfig._lastUpdateTimestamp",
                        defaultValue: 0,
                        show: false  // Hidden property to trigger panel refresh
                    },
                    _linksLoadedTimestamp: {
                        type: "number",
                        ref: "odagConfig._linksLoadedTimestamp",
                        defaultValue: 0,
                        show: false  // Hidden property to trigger dropdown refresh when links are loaded
                    },
                    refreshBindingsBtn: {
                        component: "button",
                        label: "Refresh Binding Fields",
                        action: function(layout) {
                            var odagLinkId = layout.odagConfig && layout.odagConfig.odagLinkId;
                            if (!odagLinkId || !odagLinkId.trim()) {
                                alert('⚠️ Please enter an ODAG Link ID first.');
                                return;
                            }

                            var isCloud = window.qlikEnvironment === 'cloud';

                            // Clear the cached bindings
                            var bindingsCacheKey = 'odagBindings_' + odagLinkId;
                            delete window[bindingsCacheKey];

                            console.log('🔄 Fetching bindings for ODAG Link:', odagLinkId, '| Environment:', isCloud ? 'Cloud' : 'On-Premise');

                            // Fetch bindings immediately
                            var tenantUrl = window.location.origin;
                            var linkDetailsUrl;

                            var ajaxConfig;

                            if (isCloud) {
                                // Cloud API endpoint - use selAppLinkUsages (same as paint())
                                var appId = window.location.pathname.match(/\/app\/([^\/]+)/);
                                if (!appId || !appId[1]) {
                                    alert('⚠️ Could not detect app ID from URL.');
                                    return;
                                }

                                linkDetailsUrl = tenantUrl + '/api/v1/odaglinks/selAppLinkUsages?selAppId=' + appId[1];
                                ajaxConfig = {
                                    url: linkDetailsUrl,
                                    type: 'POST',
                                    data: JSON.stringify({linkList: [odagLinkId]}),
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    },
                                    xhrFields: {withCredentials: true},
                                    timeout: 10000
                                };
                            } else {
                                // On-Premise API endpoint
                                var xrfkey = 'abcdefghijklmnop';
                                linkDetailsUrl = tenantUrl + '/api/odag/v1/links/' + odagLinkId + '?xrfkey=' + xrfkey;
                                ajaxConfig = {
                                    url: linkDetailsUrl,
                                    type: 'GET',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json'
                                    },
                                    xhrFields: {withCredentials: true},
                                    timeout: 10000
                                };
                            }

                            // Add environment-specific headers
                            if (isCloud) {
                                // Cloud uses CSRF token
                                var csrfToken = document.cookie.split('; ').find(function(row) {
                                    return row.startsWith('_csrfToken=');
                                });
                                if (csrfToken) {
                                    ajaxConfig.headers['qlik-csrf-token'] = csrfToken.split('=')[1];
                                }
                            } else {
                                // On-Premise uses XRF key
                                ajaxConfig.headers['X-Qlik-XrfKey'] = 'abcdefghijklmnop';
                            }

                            // Add success handler
                            ajaxConfig.success = function(response) {
                                console.log('✅ Fetched ODAG link details:', response);

                                // Extract bindings based on environment
                                var linkDetails, bindings = null;

                                if (isCloud) {
                                    // Cloud selAppLinkUsages returns array: [{link: {bindings: [...], ...}}]
                                    if (response && Array.isArray(response) && response.length > 0 && response[0].link) {
                                        linkDetails = response[0].link; // Extract link object from array
                                        if (linkDetails.bindings) {
                                            bindings = linkDetails.bindings;
                                        }
                                    }
                                } else {
                                    // On-Premise returns single link object
                                    linkDetails = response;
                                    if (linkDetails && linkDetails.objectDef && linkDetails.objectDef.bindings) {
                                        bindings = linkDetails.objectDef.bindings;
                                    } else if (linkDetails && linkDetails.bindings) {
                                        bindings = linkDetails.bindings;
                                    }
                                }

                                    if (bindings && Array.isArray(bindings) && bindings.length > 0) {
                                        // Cache the bindings
                                        window[bindingsCacheKey] = bindings;

                                        // Create readable binding fields string
                                        var bindingFieldsStr = bindings.map(function(b) {
                                            return b.selectAppParamName || b.selectionAppParamName || b.fieldName || b.name || 'Unknown';
                                        }).join(', ');

                                        console.log('✅ Bindings cached:', bindings.length, 'bindings -', bindingFieldsStr);

                                        // Try to update the layout with cached bindings (if app instance is available)
                                        var app = window.qlik ? window.qlik.currApp() : null;
                                        if (app && layout && layout.qInfo && layout.qInfo.qId) {
                                            app.getObject(layout.qInfo.qId).then(function(model) {
                                                model.getProperties().then(function(props) {
                                                    if (props.odagConfig) {
                                                        props.odagConfig._cachedBindingFields = bindingFieldsStr;
                                                        props.odagConfig.odagLinkId = odagLinkId;
                                                        props.odagConfig._lastUpdateTimestamp = Date.now(); // Must match hidden property name
                                                    }
                                                    model.setProperties(props).then(function() {
                                                        console.log('✅ Properties updated with refreshed bindings');
                                                        alert('✅ Binding fields refreshed!\n\nFound ' + bindings.length + ' binding(s):\n' + bindingFieldsStr);
                                                    });
                                                });
                                            }).catch(function(err) {
                                                console.warn('Could not update layout properties:', err);
                                                // Still show success alert even if we can't update layout
                                                alert('✅ Binding fields refreshed!\n\nFound ' + bindings.length + ' binding(s):\n' + bindingFieldsStr);
                                            });
                                        } else {
                                            // No app instance or layout - just show the bindings
                                            alert('✅ Binding fields refreshed!\n\nFound ' + bindings.length + ' binding(s):\n' + bindingFieldsStr);
                                        }
                                    } else {
                                        console.warn('⚠️ No bindings found in ODAG link');
                                        alert('⚠️ No bindings found for this ODAG link.\n\nPlease check if the ODAG Link ID is correct.');
                                    }
                            };

                            // Add error handler
                            ajaxConfig.error = function(xhr, status, error) {
                                console.error('❌ Failed to fetch ODAG link bindings:', error);
                                console.error('Response:', xhr.responseText);
                                alert('❌ Failed to fetch binding fields.\n\nError: ' + (xhr.status ? xhr.status + ' - ' : '') + error + '\n\nPlease check:\n- ODAG Link ID is correct\n- You have access to this ODAG link\n- Network connection is stable');
                            };

                            // Make the AJAX call
                            window.jQuery.ajax(ajaxConfig);
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
                label: "Appearance & Language",
                items: {
                    language: {
                        type: "string",
                        component: "dropdown",
                        ref: "odagConfig.language",
                        label: "Language / Dil / 语言",
                        options: [
                            { value: "en", label: "🇬🇧 English" },
                            { value: "tr", label: "🇹🇷 Türkçe" },
                            { value: "es", label: "🇪🇸 Español" },
                            { value: "zh", label: "🇨🇳 中文 (Chinese)" },
                            { value: "ar", label: "🇸🇦 العربية (Arabic)" }
                        ],
                        defaultValue: "en"
                    },
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
                        label: function(layout) {
                            var embedMode = layout.odagConfig && layout.odagConfig.embedMode;
                            if (embedMode === 'analytics/sheet') {
                                return "Sheet ID (Required for Analytics Embed)";
                            }
                            return "Sheet ID (Optional - leave empty for full app)";
                        },
                        expression: "optional",
                        defaultValue: ""
                    },
                    sheetIdWarning: {
                        component: "text",
                        label: "",
                        template: '<div style="padding: 8px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px; color: #991b1b; font-size: 11px;">' +
                                  '<strong>⚠️ Warning:</strong> Sheet ID is required for Analytics Sheet embed mode. Please provide a valid Sheet ID above.</div>',
                        show: function(layout) {
                            var embedMode = layout.odagConfig && layout.odagConfig.embedMode;
                            var sheetId = layout.odagConfig && layout.odagConfig.templateSheetId;
                            return embedMode === 'analytics/sheet' && (!sheetId || sheetId.trim() === '');
                        }
                    },
                    allowInteractions: {
                        type: "boolean",
                        ref: "odagConfig.allowInteractions",
                        label: "Allow Interactions",
                        defaultValue: true
                    },
                    autoRefreshOnSelectionChange: {
                        type: "boolean",
                        ref: "odagConfig.autoRefreshOnSelectionChange",
                        label: "Auto Refresh on Selection Change",
                        defaultValue: true,
                        show: function(layout) {
                            return layout.odagConfig && layout.odagConfig.viewMode === 'dynamicView';
                        }
                    },
                    webIntegrationId: {
                        type: "string",
                        ref: "odagConfig.webIntegrationId",
                        label: "Web Integration ID (for qlik-embed)",
                        expression: "optional",
                        defaultValue: ""
                    },
                    webIntegrationIdInfo: {
                        component: "text",
                        label: "",
                        template: function() {
                            return '<div style="padding: 8px; background: #e0f2fe; border-left: 3px solid #0284c7; border-radius: 4px; color: #0c4a6e; font-size: 11px;">' +
                                   '<strong>ℹ️ Web Integration ID:</strong><br/>' +
                                   '• Required for qlik-embed in Qlik Cloud<br/>' +
                                   '• Get it from Management Console → Web → Create new integration<br/>' +
                                   '• Add your domain to allowed origins</div>';
                        },
                        show: function() {
                            return window.qlikEnvironment === 'cloud';
                        }
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