/**
 * ODAG Payload Builder
 * Builds ODAG API payloads with full selectionStates support
 *
 * @version 5.0.0-beta
 */

define([
    "qlik",
    "jquery",
    "./odag-constants"
], function(qlik, $, CONSTANTS) {
    'use strict';

    /**
     * Payload Builder
     * Handles all payload construction logic with selectionStates support
     */
    const PayloadBuilder = {

        /**
         * Generate random 6-character context handle
         * @returns {string} Random handle
         */
        generateContextHandle: function() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let handle = '';
            for (let i = 0; i < 6; i++) {
                handle += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return handle;
        },

        /**
         * Get only optional (white) values from a field
         * @param {Object} enigmaApp - Enigma app model
         * @param {string} fieldName - Field name
         * @param {boolean} hasUserSelection - Whether user has selection in this field
         * @returns {Promise<Array>} Array of optional values
         */
        getFieldOptionalValues: async function(enigmaApp, fieldName, hasUserSelection) {
            const values = [];
            try {
                const listObj = await enigmaApp.createSessionObject({
                    qInfo: { qType: 'ListObject' },
                    qListObjectDef: {
                        qDef: { qFieldDefs: [fieldName] },
                        qInitialDataFetch: [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 1,
                            qHeight: 10000
                        }]
                    }
                });

                const layout = await listObj.getLayout();

                if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                    const dataPage = layout.qListObject.qDataPages[0];

                    for (const row of dataPage.qMatrix) {
                        const cell = row[0];
                        // Only include Optional values (qState === 'O')
                        if (cell && cell.qState === 'O') {
                            values.push({
                                selStatus: 'S',
                                strValue: cell.qText,
                                numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum.toString()
                            });
                        }
                    }
                }

                await enigmaApp.destroySessionObject(listObj.id);
            } catch (error) {
                console.error('Error getting optional values for field', fieldName, ':', error);
            }

            return values;
        },

        /**
         * Get all possible values (Selected + Optional) from a field
         * @param {Object} enigmaApp - Enigma app model
         * @param {string} fieldName - Field name
         * @returns {Promise<Array>} Array of all possible values
         */
        getFieldAllPossibleValues: async function(enigmaApp, fieldName) {
            const values = [];
            try {
                const listObj = await enigmaApp.createSessionObject({
                    qInfo: { qType: 'ListObject' },
                    qListObjectDef: {
                        qDef: { qFieldDefs: [fieldName] },
                        qInitialDataFetch: [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 1,
                            qHeight: 10000
                        }]
                    }
                });

                const layout = await listObj.getLayout();

                if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                    const dataPage = layout.qListObject.qDataPages[0];

                    for (const row of dataPage.qMatrix) {
                        const cell = row[0];
                        // Include both Selected and Optional values (not Excluded)
                        if (cell && (cell.qState === 'S' || cell.qState === 'O')) {
                            values.push({
                                selStatus: 'S',
                                strValue: cell.qText,
                                numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum.toString()
                            });
                        }
                    }
                }

                await enigmaApp.destroySessionObject(listObj.id);
            } catch (error) {
                console.error('Error getting all possible values for field', fieldName, ':', error);
            }

            return values;
        },

        /**
         * Get current selections using multiple fallback methods
         * @param {Object} app - Qlik app object
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Array>} Array of selections
         */
        getCurrentSelections: async function(app, debugLog) {
            debugLog = debugLog || function() {};

            try {
                const reply = await new Promise(function(resolve) {
                    app.getList("CurrentSelections", function(reply) {
                        resolve(reply);
                    });
                });

                const selections = [];
                const enigmaApp = app.model.enigmaModel;

                if (reply.qSelectionObject && reply.qSelectionObject.qSelections) {
                    // Process each selected field
                    for (const selection of reply.qSelectionObject.qSelections) {
                        const fieldName = selection.qField;
                        const selectedCount = selection.qSelectedCount;

                        debugLog('Getting selected values for field:', fieldName, 'Count:', selectedCount);

                        // Get the actual selected values using multiple methods for reliability
                        try {
                            const fieldSelection = {
                                selectionAppParamType: "Field",
                                selectionAppParamName: fieldName,
                                values: [],
                                selectedSize: selectedCount
                            };

                            // Method 1: Try using field.getData() with proper parameters
                            // Add small delay to ensure field API is ready (fixes timing issue after 1133 error)
                            await new Promise(resolve => setTimeout(resolve, 50));

                            const field = app.field(fieldName);
                            let fieldData = null;

                            try {
                                // Method 1a: Try simple getData() first
                                fieldData = await field.getData();

                                // If rows are empty, try with parameters
                                if (!fieldData.rows || fieldData.rows.length === 0) {
                                    debugLog('Method 1a returned empty, trying with parameters...');
                                    fieldData = await field.getData({
                                        rows: 10000,
                                        frequencyMode: 'V'
                                    });
                                }
                            } catch (e) {
                                debugLog('Field getData error, will use fallback:', e.message);
                            }

                            // Extract selected values from field data
                            if (fieldData && fieldData.rows && fieldData.rows.length > 0) {
                                fieldData.rows.forEach(function(row) {
                                    if (row.qState === 'S') { // S = Selected
                                        fieldSelection.values.push({
                                            selStatus: "S",
                                            strValue: row.qText,
                                            numValue: isNaN(row.qNum) ? "NaN" : String(row.qNum)
                                        });
                                    }
                                });
                                debugLog('Method 1: Found', fieldSelection.values.length, 'selected values for', fieldName);
                            }

                            // Method 2: If no values yet, try using qSelected text
                            if (fieldSelection.values.length === 0 && selection.qSelected) {
                                debugLog('Method 2: Using qSelected text for', fieldName, ':', selection.qSelected);
                                const values = selection.qSelected.split(', ');
                                values.forEach(function(value) {
                                    // Skip aggregated values like "5 of 10"
                                    if (!value.includes(' of ')) {
                                        fieldSelection.values.push({
                                            selStatus: "S",
                                            strValue: value.trim(),
                                            numValue: isNaN(value) ? "NaN" : String(value)
                                        });
                                    }
                                });
                                debugLog('Method 2: Extracted', fieldSelection.values.length, 'values from qSelected');
                            }

                            // Method 3: Use session object if still no values
                            if (fieldSelection.values.length === 0 && selectedCount > 0) {
                                debugLog('Method 3: Creating session object to fetch values for', fieldName);
                                const sessionObj = await enigmaApp.createSessionObject({
                                    qInfo: { qType: 'CurrentSelections' },
                                    qListObjectDef: {
                                        qDef: { qFieldDefs: [fieldName] },
                                        qInitialDataFetch: [{
                                            qTop: 0,
                                            qLeft: 0,
                                            qWidth: 1,
                                            qHeight: Math.min(selectedCount * 2, 10000)
                                        }]
                                    }
                                });

                                const sessionLayout = await sessionObj.getLayout();
                                if (sessionLayout.qListObject && sessionLayout.qListObject.qDataPages &&
                                    sessionLayout.qListObject.qDataPages[0]) {
                                    const dataPage = sessionLayout.qListObject.qDataPages[0];
                                    dataPage.qMatrix.forEach(function(row) {
                                        const cell = row[0];
                                        if (cell && cell.qState === 'S') {
                                            fieldSelection.values.push({
                                                selStatus: "S",
                                                strValue: cell.qText,
                                                numValue: isNaN(cell.qNum) ? "NaN" : String(cell.qNum)
                                            });
                                        }
                                    });
                                    debugLog('Method 3: Found', fieldSelection.values.length, 'values via session object');
                                }

                                await enigmaApp.destroySessionObject(sessionObj.id);
                            }

                            if (fieldSelection.values.length > 0) {
                                selections.push(fieldSelection);
                            } else {
                                debugLog('⚠️ WARNING: No values found for selected field:', fieldName);
                            }

                        } catch (error) {
                            console.error('Error getting selection for field', fieldName, ':', error);
                        }
                    }
                }

                return selections;
            } catch (error) {
                console.error('Error getting current selections:', error);
                return [];
            }
        },

        /**
         * Get variable values from extension configuration
         * @param {Object} app - Qlik app object
         * @param {Array} variableMappings - Variable mapping configuration
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Array>} Array of variable selections
         */
        getVariableValues: async function(app, variableMappings, debugLog) {
            debugLog = debugLog || function() {};
            const selections = [];

            if (!variableMappings || variableMappings.length === 0) {
                return selections;
            }

            for (const mapping of variableMappings) {
                try {
                    const varName = mapping.variableName;
                    const paramName = mapping.templateVariable;

                    if (!varName || !paramName) {
                        continue;
                    }

                    const variable = await app.variable.getByName(varName);
                    const varLayout = await variable.getLayout();
                    const value = varLayout.qText || varLayout.qNum;

                    if (value !== null && value !== undefined && value !== '') {
                        selections.push({
                            selectionAppParamType: "Variable",
                            selectionAppParamName: paramName,
                            values: [{
                                selStatus: "S",
                                strValue: String(value),
                                numValue: isNaN(value) ? "NaN" : String(value)
                            }]
                        });
                    }
                } catch (error) {
                    debugLog('Error getting variable value:', error);
                }
            }

            return selections;
        },

        /**
         * Calculate row estimation based on ODAG link configuration
         * @param {Object} app - Qlik app object
         * @param {string} odagLinkId - ODAG link ID
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object>} Row estimation result
         */
        calculateRowEstimation: async function(app, odagLinkId, debugLog) {
            debugLog = debugLog || function() {};

            try {
                const tenantUrl = window.qlikTenantUrl || window.location.origin;
                const isCloud = window.qlikEnvironment === 'cloud';
                const xrfkey = CONSTANTS.API.XRF_KEY;

                // Fetch ODAG link details to get row estimation config
                const linkUrl = isCloud
                    ? tenantUrl + '/api/v1/odaglinks/' + odagLinkId
                    : tenantUrl + '/api/odag/v1/links/' + odagLinkId + '?xrfkey=' + xrfkey;

                const headers = isCloud
                    ? { 'qlik-csrf-token': this.getCookie('_csrfToken') || '' }
                    : {
                        'Content-Type': 'application/json',
                        'X-Qlik-XrfKey': xrfkey
                      };

                const linkDetails = await $.ajax({
                    url: linkUrl,
                    type: 'GET',
                    headers: headers,
                    xhrFields: { withCredentials: true }
                });

                const rowEstMin = linkDetails.rowEstMin || 0;
                const rowEstMax = linkDetails.rowEstMax || 0;

                // Calculate actual row estimation (simplified - can be enhanced)
                const actualRowEst = Math.floor((rowEstMin + rowEstMax) / 2) || 1000;

                return {
                    actualRowEst: actualRowEst,
                    canGenerate: true,
                    message: ''
                };

            } catch (error) {
                debugLog('Row estimation error:', error);
                return {
                    actualRowEst: 1000,
                    canGenerate: true,
                    message: ''
                };
            }
        },

        /**
         * Get cookie value by name
         * @param {string} name - Cookie name
         * @returns {string} Cookie value
         */
        getCookie: function(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? match[2] : '';
        },

        /**
         * Build complete ODAG payload with selectionStates support
         * @param {Object} app - Qlik app object
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} layout - Extension layout
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object>} {payload, rowEstResult}
         */
        buildPayload: async function(app, odagConfig, layout, debugLog) {
            debugLog = debugLog || function() {};

            const enigmaApp = app.model.enigmaModel;
            const appLayout = await enigmaApp.getAppLayout();

            // Get app ID
            let appId = app.id;
            if (!appId) {
                const pathMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
                if (pathMatch) {
                    appId = pathMatch[1];
                }
            }

            // Get ODAG bindings from cache
            const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;
            const cachedBindings = window[bindingsCacheKey];

            debugLog('Building payload - cached bindings:', cachedBindings ? cachedBindings.length + ' fields' : 'none');

            const currentSelections = await this.getCurrentSelections(app, debugLog);
            const variableSelections = await this.getVariableValues(app, odagConfig.variableMappings || [], debugLog);

            // Create map of actually selected fields
            const selectionMap = new Map();

            if (odagConfig.includeCurrentSelections) {
                currentSelections.forEach(selection => {
                    selectionMap.set(selection.selectionAppParamName, selection);
                });
            }

            variableSelections.forEach(selection => {
                selectionMap.set(selection.selectionAppParamName, selection);
            });

            // selectionState = only fields user actually selected
            const selectionState = Array.from(selectionMap.values());

            // bindSelectionState = ALL binding fields
            const bindSelectionState = [];

            if (cachedBindings && cachedBindings.length > 0) {
                debugLog('✅ Found cached ODAG bindings:', cachedBindings.length);

                for (const binding of cachedBindings) {
                    const fieldName = binding.selectAppParamName ||
                                    binding.selectionAppParamName ||
                                    binding.fieldName ||
                                    binding.name;

                    if (!fieldName) {
                        console.warn('⚠️ Binding missing field name:', binding);
                        continue;
                    }

                    // Get selectionStates parameter (default to "SO")
                    const selectionStates = binding.selectionStates || "SO";

                    debugLog('Processing binding field:', fieldName, 'with selectionStates:', selectionStates);

                    // Check if user selected this field
                    const hasUserSelection = selectionMap.has(fieldName);
                    const userSelection = hasUserSelection ? selectionMap.get(fieldName) : null;

                    // Process based on selectionStates parameter
                    if (selectionStates === "S") {
                        // Only Selected values
                        if (hasUserSelection) {
                            debugLog('  → Mode "S": User selected, using selection');
                            bindSelectionState.push(userSelection);
                        } else {
                            debugLog('  → Mode "S": No selection, sending empty');
                            bindSelectionState.push({
                                selectionAppParamType: 'Field',
                                selectionAppParamName: fieldName,
                                values: []
                            });
                        }
                    } else if (selectionStates === "O") {
                        // Only Optional values
                        debugLog('  → Mode "O": Getting optional values only');
                        const optionalValues = await this.getFieldOptionalValues(enigmaApp, fieldName, hasUserSelection);
                        bindSelectionState.push({
                            selectionAppParamType: 'Field',
                            selectionAppParamName: fieldName,
                            values: optionalValues
                        });
                    } else if (selectionStates === "SO" || selectionStates === "OS") {
                        // Selected + Optional values
                        debugLog('  → Mode "SO": Both selected and optional');

                        if (hasUserSelection) {
                            bindSelectionState.push(userSelection);
                        } else {
                            const allPossibleValues = await this.getFieldAllPossibleValues(enigmaApp, fieldName);
                            bindSelectionState.push({
                                selectionAppParamType: 'Field',
                                selectionAppParamName: fieldName,
                                values: allPossibleValues,
                                selectedSize: allPossibleValues.length
                            });
                        }
                    }
                }

                debugLog('✅ Final bindSelectionState has', bindSelectionState.length, 'fields');
            } else {
                console.error('❌ No cached ODAG bindings found!');
                bindSelectionState.push(...selectionState);
            }

            // Get sheet ID
            let sheetId = "";
            try {
                const navigation = qlik.navigation;
                if (navigation && navigation.getCurrentSheetId) {
                    const currentSheet = navigation.getCurrentSheetId();
                    if (currentSheet && currentSheet.sheetId) {
                        sheetId = currentSheet.sheetId;
                    }
                }
            } catch(e) {
                debugLog('Could not get sheet ID');
            }

            // Calculate row estimation
            const rowEstResult = await this.calculateRowEstimation(app, odagConfig.odagLinkId, debugLog);

            const payload = {
                clientContextHandle: this.generateContextHandle(),
                actualRowEst: rowEstResult.actualRowEst,
                selectionApp: appId,
                bindSelectionState: bindSelectionState,
                selectionState: selectionState
            };

            if (sheetId) {
                payload.sheetname = sheetId;
            }

            debugLog('✅ Built ODAG payload:', {
                selectionState: selectionState.map(s => s.selectionAppParamName),
                bindSelectionState: bindSelectionState.map(s => s.selectionAppParamName),
                bindSelectionStateCount: bindSelectionState.length,
                actualRowEst: rowEstResult.actualRowEst
            });

            return {
                payload: payload,
                rowEstResult: rowEstResult
            }
        },

        /**
         * Validate bindings and return detailed error info
         * @param {Object} payload - Built payload
         * @param {string} odagLinkId - ODAG link ID
         * @param {Function} debugLog - Debug logging function
         * @returns {Object} {valid, missingFields, shortMessage, fullMessage}
         */
        validateBindings: function(payload, odagLinkId, debugLog) {
            debugLog = debugLog || function() {};

            const cachedBindings = window['odagBindings_' + odagLinkId];

            if (!cachedBindings || cachedBindings.length === 0) {
                return { valid: true };
            }

            // Create map of binding field values
            const bindingValueMap = new Map();
            for (const bindingField of payload.bindSelectionState) {
                bindingValueMap.set(bindingField.selectionAppParamName, bindingField.values || []);
            }

            // Check for missing required fields
            const missingFields = [];
            const missingFieldDetails = [];

            for (const binding of cachedBindings) {
                const fieldName = binding.selectAppParamName || binding.selectionAppParamName;
                const selectionStates = binding.selectionStates || "SO";
                const fieldValues = bindingValueMap.get(fieldName) || [];

                if (selectionStates === "S" && fieldValues.length === 0) {
                    missingFields.push(fieldName);
                    missingFieldDetails.push({ field: fieldName, mode: selectionStates });
                }
            }

            if (missingFields.length === 0) {
                return { valid: true };
            }

            // Build short message
            const shortMessage = 'Selection required in: ' + missingFields.join(', ');

            // Build full HTML message
            const fieldListHTML = missingFieldDetails.map(detail => {
                const prefix = detail.mode === 'S' ? '$(odags_' + detail.field + ')' : '$(odag_' + detail.field + ')';
                return '<div style="margin: 4px 0; padding-left: 8px;">• <strong>' + detail.field + '</strong> → ' + prefix + '</div>';
            }).join('');

            const fullMessage =
                '<div style="margin-bottom: 8px;"><strong>⚠️ Selection Required</strong></div>' +
                '<div style="margin-bottom: 8px;">The following fields require selections to generate the app:</div>' +
                fieldListHTML +
                '<div style="margin-top: 8px; font-size: 0.9em; opacity: 0.9;">These fields use "selected values only" mode (selectionStates: "S"). ' +
                'The template app expects selected values in variables like $(odags_FieldName).</div>';

            return {
                valid: false,
                missingFields: missingFields,
                shortMessage: shortMessage,
                fullMessage: fullMessage
            };
        }
    };

    return PayloadBuilder;
});
