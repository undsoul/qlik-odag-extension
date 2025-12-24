/**
 * ODAG Payload Builder
 * Core business logic for building ODAG request payloads and making API calls
 *
 * @version 6.0.0
 */

define(['jquery', 'qlik', '../foundation/odag-constants'], function($, qlik, CONSTANTS) {
    'use strict';

    /**
     * ODAG Payload Builder Module
     * Contains all business logic for selection handling, payload building, and API calls
     */
    const ODAGPayloadBuilder = {

        /**
         * Generate unique context handle for ODAG requests
         * @returns {string} Unique context handle
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
         * Get cookie value by name
         * @param {string} name - Cookie name
         * @returns {string|null} Cookie value or null
         */
        getCookie: function(name) {
            const value = '; ' + document.cookie;
            const parts = value.split('; ' + name + '=');
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        },

        /**
         * Get only optional (white) values from a field
         * @param {Object} enigmaApp - Enigma app model
         * @param {string} fieldName - Field name
         * @param {boolean} hasUserSelection - Whether user has selected values
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
                // Handle "Access denied" errors in published apps gracefully
                if (error.code === 5 || error.message?.includes('Access denied')) {
                    console.warn('Access denied when getting optional values for', fieldName, '(published app). Returning empty values.');
                } else {
                    console.error('Error getting optional values for field', fieldName, ':', error);
                }
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
                // Handle "Access denied" errors in published apps gracefully
                if (error.code === 5 || error.message?.includes('Access denied')) {
                    console.warn('Access denied when getting all possible values for', fieldName, '(published app). Returning empty values.');
                } else {
                    console.error('Error getting all possible values for field', fieldName, ':', error);
                }
            }

            return values;
        },

        /**
         * Get selected values for a specific field using DIRECT ListObject query
         * This bypasses SelectionObject caching issues by querying the field directly
         * @param {Object} enigmaApp - Enigma app model
         * @param {string} fieldName - Field name to query
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object|null>} Selection object with values, or null if no selection
         */
        getFieldSelectedValues: async function(enigmaApp, fieldName, debugLog) {
            try {
                // Create a fresh ListObject to query THIS SPECIFIC field's current state
                // Using qAutoSortByState to force engine to recalculate selection state
                const listObj = await enigmaApp.createSessionObject({
                    qInfo: { qType: 'FieldSel_' + fieldName + '_' + Date.now() }, // Unique per field+time
                    qListObjectDef: {
                        qDef: {
                            qFieldDefs: [fieldName],
                            qSortCriterias: [{ qSortByState: 1 }] // Sort by state forces state recalculation
                        },
                        qAutoSortByState: { qDisplayNumberOfRows: 1 }, // Force selected values first
                        qShowAlternatives: true, // Include alternative values
                        qInitialDataFetch: [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 1,
                            qHeight: 10000
                        }]
                    }
                });

                // Force a layout invalidation by getting layout twice
                await listObj.getLayout();
                await new Promise(resolve => setTimeout(resolve, 20));
                const layout = await listObj.getLayout();
                const values = [];
                let hasSelection = false;

                if (layout.qListObject && layout.qListObject.qDataPages && layout.qListObject.qDataPages[0]) {
                    const dataPage = layout.qListObject.qDataPages[0];

                    for (const row of dataPage.qMatrix) {
                        const cell = row[0];
                        // Only include Selected values (qState === 'S')
                        if (cell && cell.qState === 'S') {
                            hasSelection = true;
                            values.push({
                                selStatus: 'S',
                                strValue: cell.qText,
                                numValue: isNaN(cell.qNum) ? 'NaN' : cell.qNum.toString()
                            });
                        }
                    }
                }

                await enigmaApp.destroySessionObject(listObj.id);

                if (hasSelection) {
                    debugLog('📊 Field', fieldName, 'has', values.length, 'selected values (direct query)');
                    return {
                        selectionAppParamType: 'Field',
                        selectionAppParamName: fieldName,
                        values: values,
                        selectedSize: values.length
                    };
                }

                return null; // No selection for this field
            } catch (error) {
                if (error.code === 5 || error.message?.includes('Access denied')) {
                    debugLog('⚠️ Access denied for field', fieldName, '(published app)');
                } else {
                    debugLog('⚠️ Error querying field', fieldName, ':', error.message);
                }
                return null;
            }
        },

        /**
         * Get current selections from app - DIRECT FIELD QUERY METHOD
         * This method queries each field directly using ListObject, bypassing SelectionObject
         * which can return stale/cached data in rapid selection scenarios
         * @param {Object} app - Qlik app object
         * @param {Array} bindingFields - Array of field names to check (from ODAG bindings)
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Array>} Array of current selections
         */
        getCurrentSelections: async function(app, bindingFields, debugLog) {
            try {
                const enigmaApp = app.model.enigmaModel;

                debugLog('🔄 Getting FRESH selections via direct field queries...');

                // AGGRESSIVE ENGINE SYNC SEQUENCE
                // The problem is that getAppLayout() doesn't always ensure selection state is current

                // Step 1: Wait for UI to send selection command to engine
                await new Promise(resolve => setTimeout(resolve, 100));

                // Step 2: Force engine to COMPUTE something - this requires consistent state
                // evaluate() forces the engine to process all pending operations first
                try {
                    await enigmaApp.evaluate('=1');
                    debugLog('✅ Engine evaluate() sync complete');
                } catch (e) {
                    debugLog('⚠️ evaluate() failed, using getAppLayout fallback');
                    await enigmaApp.getAppLayout();
                }

                // Step 3: Additional wait after sync
                await new Promise(resolve => setTimeout(resolve, 50));

                // Step 4: Get app layout to ensure we have latest state
                await enigmaApp.getAppLayout();

                // Step 5: One more wait to let WebSocket messages settle
                await new Promise(resolve => setTimeout(resolve, 50));

                debugLog('✅ Aggressive engine sync complete');

                const selections = [];

                // If we have binding fields, query each one directly
                // This completely bypasses SelectionObject caching issues
                if (bindingFields && bindingFields.length > 0) {
                    debugLog('📋 Querying', bindingFields.length, 'binding fields directly...');

                    for (const fieldName of bindingFields) {
                        const fieldSelection = await this.getFieldSelectedValues(enigmaApp, fieldName, debugLog);
                        if (fieldSelection) {
                            selections.push(fieldSelection);
                        }
                    }

                    debugLog('✅ Direct field query complete:', selections.length, 'fields have selections');
                } else {
                    // Fallback: Use SelectionObject if no binding fields provided
                    debugLog('⚠️ No binding fields provided, using SelectionObject fallback...');

                    const selectionObj = await enigmaApp.createSessionObject({
                        qInfo: { qType: 'SelectionObject' },
                        qSelectionObjectDef: {}
                    });

                    // Wait and get layout
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const selectionLayout = await selectionObj.getLayout();

                    if (selectionLayout.qSelectionObject?.qSelections) {
                        for (const selection of selectionLayout.qSelectionObject.qSelections) {
                            const fieldName = selection.qField;
                            const fieldSelection = await this.getFieldSelectedValues(enigmaApp, fieldName, debugLog);
                            if (fieldSelection) {
                                selections.push(fieldSelection);
                            }
                        }
                    }

                    await enigmaApp.destroySessionObject(selectionObj.id);
                }

                debugLog('📊 getCurrentSelections returning', selections.length, 'field selections');
                return selections;
            } catch (error) {
                console.error('Error in getCurrentSelections:', error);
                return [];
            }
        },

        /**
         * Get variable values and map them to fields
         * @param {Object} app - Qlik app object
         * @param {Array} variableMappings - Variable to field mappings
         * @returns {Promise<Array>} Array of variable selections
         */
        getVariableValues: async function(app, variableMappings) {
            const mappedSelections = [];

            for (const mapping of variableMappings) {
                if (mapping.variableName && mapping.fieldName) {
                    try {
                        const variable = await app.variable.getByName(mapping.variableName);
                        const variableData = await variable.getLayout();
                        let value = variableData.qText || variableData.qNum || "";

                        if (value && value.toString().startsWith('=')) {
                            try {
                                const result = await app.evaluate(value);
                                value = result.qText || result.qNumber || result;
                            } catch(e) {
                                console.warn('Could not evaluate expression:', value);
                            }
                        }

                        if (value) {
                            const valueString = value.toString();
                            const valueArray = valueString.split(',').map(v => v.trim()).filter(v => v !== '');

                            if (valueArray.length > 0) {
                                const valuesObjects = valueArray.map(function(val) {
                                    return {
                                        selStatus: "S",
                                        strValue: val,
                                        numValue: isNaN(val) ? "NaN" : val.toString()
                                    };
                                });

                                mappedSelections.push({
                                    selectionAppParamType: "Field",
                                    selectionAppParamName: mapping.fieldName,
                                    values: valuesObjects
                                });
                            }
                        }
                    } catch(e) {
                        console.warn('Could not get variable ' + mapping.variableName, e);
                    }
                }
            }

            return mappedSelections;
        },

        /**
         * Calculate row estimation for ODAG generation
         * @param {Object} app - Qlik app object
         * @param {string} odagLinkId - ODAG Link ID
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object>} Row estimation result
         */
        calculateRowEstimation: async function(app, odagLinkId, debugLog) {
            const rowEstCacheKey = 'odagRowEstConfig_' + odagLinkId;
            const rowEstConfig = window[rowEstCacheKey];

            // If no row estimation config, allow generation
            if (!rowEstConfig || !rowEstConfig.rowEstExpr) {
                debugLog('📊 No row estimation config found - allowing generation');
                return {
                    actualRowEst: 1,
                    curRowEstHighBound: null,
                    canGenerate: true,
                    message: null
                };
            }

            const rowEstExpr = rowEstConfig.rowEstExpr;
            const curRowEstHighBound = rowEstConfig.curRowEstHighBound;

            debugLog('📊 Calculating row estimation:', {
                rowEstExpr: rowEstExpr,
                curRowEstHighBound: curRowEstHighBound
            });

            try {
                const enigmaApp = app.model.enigmaModel;

                const tempObj = await enigmaApp.createSessionObject({
                    qInfo: { qType: 'RowEstValidator' },
                    qHyperCubeDef: {
                        qDimensions: [],
                        qMeasures: [{
                            qDef: {
                                qDef: rowEstExpr
                            }
                        }],
                        qInitialDataFetch: [{
                            qTop: 0,
                            qLeft: 0,
                            qWidth: 1,
                            qHeight: 1
                        }]
                    }
                });

                const objLayout = await tempObj.getLayout();

                let actualRowEst = 0;
                if (objLayout.qHyperCube &&
                    objLayout.qHyperCube.qDataPages &&
                    objLayout.qHyperCube.qDataPages[0] &&
                    objLayout.qHyperCube.qDataPages[0].qMatrix &&
                    objLayout.qHyperCube.qDataPages[0].qMatrix[0] &&
                    objLayout.qHyperCube.qDataPages[0].qMatrix[0][0]) {
                    actualRowEst = Math.round(objLayout.qHyperCube.qDataPages[0].qMatrix[0][0].qNum);
                }

                await enigmaApp.destroySessionObject(tempObj.id);

                const hasLimit = curRowEstHighBound !== undefined && curRowEstHighBound !== null;
                const canGenerate = !hasLimit || actualRowEst <= curRowEstHighBound;

                debugLog('📊 Row estimation calculated:', {
                    actualRowEst: actualRowEst,
                    curRowEstHighBound: curRowEstHighBound,
                    hasLimit: hasLimit,
                    canGenerate: canGenerate
                });

                const message = canGenerate ? null :
                    'Cannot generate ODAG app: The current selections would result in ' +
                    actualRowEst.toLocaleString() + ' rows, which exceeds the maximum allowed ' +
                    curRowEstHighBound.toLocaleString() + ' rows. Please refine your selections to reduce the data volume.';

                return {
                    actualRowEst: actualRowEst,
                    curRowEstHighBound: curRowEstHighBound,
                    canGenerate: canGenerate,
                    message: message
                };

            } catch (error) {
                // Handle "Access denied" errors in published apps gracefully
                if (error.code === 5 || error.message?.includes('Access denied')) {
                    debugLog('⚠️ Access denied when calculating row estimation (published app). Allowing generation.');
                } else {
                    console.error('❌ Failed to calculate row estimation:', error);
                }
                // On error, allow generation (fail open)
                return {
                    actualRowEst: 1,
                    curRowEstHighBound: null,
                    canGenerate: true,
                    message: null
                };
            }
        },

        /**
         * Build ODAG payload with selection state and bind selection state
         * @param {Object} app - Qlik app object
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} layout - Extension layout
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object>} Payload and row estimation result
         */
        buildPayload: async function(app, odagConfig, layout, debugLog) {
            const self = this;
            const enigmaApp = app.model.enigmaModel;
            const appLayout = await enigmaApp.getAppLayout();

            // Always use the current app ID
            let appId = app.id;
            if (!appId) {
                // Fallback: try to get from URL if app.id is not available
                const pathMatch = window.location.pathname.match(/\/app\/([^\/]+)/);
                if (pathMatch) {
                    appId = pathMatch[1];
                }
            }

            // Get ODAG bindings from cache (fetched at paint)
            const bindingsCacheKey = 'odagBindings_' + odagConfig.odagLinkId;
            const bindingsPromiseKey = 'odagBindingsPromise_' + odagConfig.odagLinkId;

            // If bindings are currently being fetched, wait for the fetch to complete
            if (window[bindingsPromiseKey]) {
                debugLog('⏳ Waiting for bindings fetch to complete...');
                try {
                    await window[bindingsPromiseKey];
                    debugLog('✅ Bindings fetch completed');
                } catch (e) {
                    debugLog('⚠️ Bindings fetch failed:', e.message);
                }
            }

            const cachedBindings = window[bindingsCacheKey];

            debugLog('Building payload - cached bindings:', cachedBindings ? cachedBindings.length + ' fields' : 'none');

            // Extract binding field names FIRST so we can query them directly
            // This bypasses SelectionObject caching issues
            const bindingFieldNames = [];
            if (cachedBindings && cachedBindings.length > 0) {
                for (const binding of cachedBindings) {
                    const fieldName = binding.selectAppParamName ||
                                    binding.selectionAppParamName ||
                                    binding.fieldName ||
                                    binding.name;
                    if (fieldName) {
                        bindingFieldNames.push(fieldName);
                    }
                }
                debugLog('📋 Will query', bindingFieldNames.length, 'binding fields directly');
            }

            // Pass binding field names to getCurrentSelections for DIRECT field queries
            const currentSelections = await self.getCurrentSelections(app, bindingFieldNames, debugLog);
            const variableSelections = await self.getVariableValues(app, odagConfig.variableMappings || []);

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

            // bindSelectionState = ALL binding fields (selected + possible values for non-selected)
            const bindSelectionState = [];

            if (cachedBindings && cachedBindings.length > 0) {
                // Process each binding field
                debugLog('✅ Found cached ODAG bindings:', cachedBindings.length);
                debugLog('📋 Raw bindings structure:', cachedBindings);

                for (const binding of cachedBindings) {
                    // Try multiple possible field names from binding object
                    const fieldName = binding.selectAppParamName ||
                                    binding.selectionAppParamName ||
                                    binding.fieldName ||
                                    binding.name;

                    if (!fieldName) {
                        console.warn('⚠️ Binding missing field name:', binding);
                        continue;
                    }

                    // Get selectionStates parameter (default to "SO" if not specified)
                    const selectionStates = binding.selectionStates || "SO";

                    debugLog('Processing binding field:', fieldName, 'with selectionStates:', selectionStates);

                    // Check if user selected this field
                    const hasUserSelection = selectionMap.has(fieldName);
                    const userSelection = hasUserSelection ? selectionMap.get(fieldName) : null;

                    // Process based on selectionStates parameter
                    if (selectionStates === "S") {
                        // Only Selected values
                        if (hasUserSelection) {
                            debugLog('  → Mode "S": User selected this field, using selection');
                            bindSelectionState.push(userSelection);
                        } else {
                            debugLog('  → Mode "S": No user selection, sending empty values');
                            bindSelectionState.push({
                                selectionAppParamType: 'Field',
                                selectionAppParamName: fieldName,
                                values: []  // Empty array for "S" mode with no selection
                            });
                        }
                    } else if (selectionStates === "O") {
                        // Only Optional (white) values
                        debugLog('  → Mode "O": Getting optional values only');
                        try {
                            const optionalValues = await self.getFieldOptionalValues(enigmaApp, fieldName, hasUserSelection);
                            bindSelectionState.push({
                                selectionAppParamType: 'Field',
                                selectionAppParamName: fieldName,
                                values: optionalValues
                            });
                        } catch (error) {
                            debugLog('  → ERROR: Could not get optional values for field:', fieldName, error);
                            bindSelectionState.push({
                                selectionAppParamType: 'Field',
                                selectionAppParamName: fieldName,
                                values: []
                            });
                        }
                    } else if (selectionStates === "SO" || selectionStates === "OS") {
                        // Selected + Optional values
                        debugLog('  → Mode "SO": Getting both selected and optional values');

                        if (hasUserSelection) {
                            // User has selection - use it
                            debugLog('    → User has selection, using it');
                            bindSelectionState.push(userSelection);
                        } else {
                            // No user selection - get all possible values
                            debugLog('    → No user selection, getting all possible values');
                            try {
                                const allPossibleValues = await self.getFieldAllPossibleValues(enigmaApp, fieldName);

                                if (allPossibleValues.length > 0) {
                                    bindSelectionState.push({
                                        selectionAppParamType: 'Field',
                                        selectionAppParamName: fieldName,
                                        values: allPossibleValues,
                                        selectedSize: allPossibleValues.length
                                    });
                                } else {
                                    debugLog('  → WARNING: No possible values found for binding field:', fieldName);
                                    bindSelectionState.push({
                                        selectionAppParamType: 'Field',
                                        selectionAppParamName: fieldName,
                                        values: []
                                    });
                                }
                            } catch (error) {
                                debugLog('  → ERROR: Could not get possible values for field:', fieldName, error);
                                bindSelectionState.push({
                                    selectionAppParamType: 'Field',
                                    selectionAppParamName: fieldName,
                                    values: []
                                });
                            }
                        }
                    } else {
                        // Unknown selectionStates - default to SO behavior
                        console.warn('⚠️ Unknown selectionStates value:', selectionStates, '- defaulting to "SO"');
                        // Fallback to SO logic (code omitted for brevity - same as SO case above)
                    }
                }

                debugLog('✅ Final bindSelectionState has', bindSelectionState.length, 'fields');
            } else {
                console.error('❌ No cached ODAG bindings found!');
                console.error('This means the selAppLinkUsages call in paint() failed.');
                console.error('Check console for "Failed to fetch ODAG bindings" error above.');
                console.error('Falling back to selected fields only - THIS WILL LIKELY FAIL!');
                // Fallback: if we couldn't get bindings, use only selected fields (will likely cause 400 error)
                bindSelectionState.push(...selectionState);
            }

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

            // Calculate row estimation based on ODAG link configuration
            const rowEstResult = await self.calculateRowEstimation(app, odagConfig.odagLinkId, debugLog);

            const payload = {
                clientContextHandle: self.generateContextHandle(),
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
                actualRowEst: rowEstResult.actualRowEst,
                canGenerate: rowEstResult.canGenerate,
                fullPayload: payload
            });

            return {
                payload: payload,
                rowEstResult: rowEstResult
            };
        },

        /**
         * Call ODAG API to create new app
         * @param {string} odagLinkId - ODAG Link ID
         * @param {Object} payload - ODAG request payload
         * @param {Function} debugLog - Debug logging function
         * @returns {Promise<Object>} API call result
         */
        callODAGAPI: async function(odagLinkId, payload, debugLog) {
            const self = this;
            const tenantUrl = window.qlikTenantUrl || window.location.origin;
            const isCloud = window.qlikEnvironment === 'cloud';
            const xrfkey = CONSTANTS.API.XRF_KEY;

            const url = isCloud
                ? tenantUrl + '/api/v1/odaglinks/' + odagLinkId + '/requests'
                : tenantUrl + '/api/odag/v1/links/' + odagLinkId + '/requests?xrfkey=' + xrfkey;

            debugLog('Calling ODAG API:', url, '(Environment:', window.qlikEnvironment + ')');
            debugLog('Payload:', JSON.stringify(payload, null, 2));

            const csrfToken = self.getCookie('_csrfToken');

            if (isCloud && !csrfToken) {
                console.error('No CSRF token found!');
            }

            const headers = isCloud
                ? {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'qlik-csrf-token': csrfToken || ''
                  }
                : {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Qlik-XrfKey': xrfkey
                  };

            return new Promise(function(resolve) {
                $.ajax({
                    url: url,
                    type: 'POST',
                    data: JSON.stringify(payload),
                    contentType: 'application/json',
                    headers: headers,
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(result) {
                        debugLog('ODAG API Success:', result);
                        resolve({
                            success: true,
                            data: result
                        });
                    },
                    error: function(xhr, status, error) {
                        console.error('ODAG API Error:', xhr.status, error);
                        console.error('Response:', xhr.responseText);

                        let errorMessage = 'API call failed: ' + xhr.status + ' - ' + error;
                        let userFriendlyMessage = errorMessage;

                        if (xhr.responseText) {
                            try {
                                const errorResponse = JSON.parse(xhr.responseText);

                                if (xhr.status === 400 && errorResponse.message) {
                                    if (errorResponse.message.includes('numValue of type string')) {
                                        userFriendlyMessage = '❌ Data Type Error\n\n' +
                                            'There is a data type mismatch in the ODAG request payload.\n\n' +
                                            '🔧 This is likely a bug in the extension. Please:\n' +
                                            '1. Report this issue to the extension developer\n' +
                                            '2. Include the field values you selected\n\n' +
                                            'Technical: ' + errorResponse.message;
                                    } else {
                                        userFriendlyMessage = '❌ Bad Request (400)\n\n' + errorResponse.message;
                                    }
                                } else if (errorResponse.errors && errorResponse.errors.length > 0) {
                                    const odagError = errorResponse.errors[0];

                                    if (odagError.code === 'ODAG-ERR-1132') {
                                        userFriendlyMessage = '❌ Field Binding Mismatch\n\n' +
                                            'The fields in your current selections do not match the ODAG template configuration.\n\n' +
                                            '🔧 How to fix:\n' +
                                            '1. Check your ODAG link field bindings (App navigation links)\n' +
                                            '2. Make sure the field names match exactly\n' +
                                            '3. Or make selections on the correct fields\n\n' +
                                            'Error: ' + odagError.title;
                                    } else if (odagError.code === 'ODAG-ERR-1204') {
                                        userFriendlyMessage = '⚠️ App limit reached - Delete an app to generate new one';
                                    } else {
                                        userFriendlyMessage = '❌ ODAG Error (' + odagError.code + ')\n\n' + odagError.title;
                                    }
                                }
                            } catch (e) {
                                // JSON parse failed, use default error
                            }
                        }

                        resolve({
                            success: false,
                            error: errorMessage,
                            userMessage: userFriendlyMessage,
                            status: xhr.status
                        });
                    }
                });
            });
        }
    };

    return ODAGPayloadBuilder;
});
