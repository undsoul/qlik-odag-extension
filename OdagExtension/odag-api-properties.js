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
                    odagLinkId: {
                        type: "string",
                        ref: "odagConfig.odagLinkId",
                        label: "ODAG Link ID (or use link selector in extension below)",
                        expression: "optional",
                        defaultValue: ""
                    },
                    odagLinkName: {
                        type: "string",
                        ref: "odagConfig.odagLinkName",
                        label: "Selected Link Name (read-only)",
                        expression: "optional",
                        defaultValue: "",
                        show: function(data) {
                            return data.odagConfig && data.odagConfig.odagLinkName;
                        }
                    },
                    odagLinkSelectorHint: {
                        component: "text",
                        label: "💡 Exit edit mode to see the ODAG Link Selector below",
                        style: "hint"
                    },
                    includeCurrentSelections: {
                        type: "boolean",
                        ref: "odagConfig.includeCurrentSelections",
                        label: "Include Current Selections",
                        defaultValue: true
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
                    templateSheetId: {
                        type: "string",
                        ref: "odagConfig.templateSheetId",
                        label: "Sheet ID (Optional - leave empty for full app)",
                        expression: "optional",
                        defaultValue: ""
                    },
                    embedTheme: {
                        type: "string",
                        ref: "odagConfig.embedTheme",
                        label: "Theme",
                        expression: "optional",
                        defaultValue: "sense"
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