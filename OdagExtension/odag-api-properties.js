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
                        label: "ODAG Link ID",
                        expression: "optional",
                        defaultValue: ""
                    },
                    odagLinkIdHelp: {
                        component: "text",
                        label: "How to find ODAG Link ID:",
                        style: "hint"
                    },
                    odagLinkIdHelpCloud: {
                        component: "text",
                        label: "CLOUD: DevTools Method",
                        style: "hint"
                    },
                    odagLinkIdHelpStep1: {
                        component: "text",
                        label: "Step 1: Open Browser DevTools (Press F12 / Cmd+Opt+I)",
                        style: "hint"
                    },
                    odagLinkIdHelpStep1Detail: {
                        component: "text",
                        label: "→ Go to Network tab\n→ Clear network log\n",
                        style: "hint"
                    },
                    odagLinkIdHelpStep2: {
                        component: "text",
                        label: "Step 2: Create ODAG link",
                        style: "hint"
                    },
                    odagLinkIdHelpStep2Detail: {
                        component: "text",
                        label: "→ Go to App navigation links\n→ Create new\n→ Configure settings\n→ Click Create\n",
                        style: "hint"
                    },
                    odagLinkIdHelpStep3: {
                        component: "text",
                        label: "Step 3: Find the ID in Network tab",
                        style: "hint"
                    },
                    odagLinkIdHelpStep3Detail: {
                        component: "text",
                        label: "→ Find 'selAppLink' request\n→ Click it\n→ Go to Response tab\n→ Copy 'id' value at top",
                        style: "hint"
                    },
                    odagLinkIdHelpOnPremise: {
                        component: "text",
                        label: "ON-PREMISE: API Method",
                        style: "hint"
                    },
                    odagLinkIdHelpOnPremiseDetail: {
                        component: "text",
                        label: "→ Open: https://your-server/api/odag/v1/links?xrfkey=abcdefghijklmnop\n→ Add Header: X-Qlik-XrfKey: abcdefghijklmnop\n→ Find your link in JSON response\n→ Copy 'id' field value",
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