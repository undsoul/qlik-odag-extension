/**
 * ODAG Form View Renderer
 * Renders the ODAG generation form with bindings and variables
 *
 * @version 5.0.0-beta
 */

define([
    "qlik",
    "jquery",
    "./odag-api-service",
    "./odag-ui-builder",
    "./odag-error-handler",
    "./odag-validators",
    "./odag-state-manager"
], function(qlik, $, ApiService, UIBuilder, ErrorHandler, Validators, StateManager) {
    'use strict';

    const FormView = {

        /**
         * Render generation form
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} linkDetails - ODAG link details
         * @param {Object} eventManager - Event manager instance
         * @returns {jQuery} Form section
         */
        render: function(extensionId, odagConfig, linkDetails, eventManager) {
            const self = this;
            const app = StateManager.get(extensionId, 'app');

            const $section = UIBuilder.createCard({
                title: 'Generate New App',
                className: 'odag-form-section'
            });

            const $cardBody = $section.find('.odag-card-body');

            // Create form
            const $form = UIBuilder.createElement('form', {
                className: 'odag-generation-form'
            });

            // Render binding fields
            if (linkDetails.bindings && linkDetails.bindings.length > 0) {
                const $bindingsSection = this.renderBindingFields(
                    linkDetails.bindings,
                    extensionId,
                    odagConfig,
                    app
                );
                $form.append($bindingsSection);
            } else {
                const $noBindings = UIBuilder.createInfoBox(
                    'No binding fields required for this ODAG link.',
                    'Info'
                );
                $form.append($noBindings);
            }

            // Render variable mappings if configured
            if (odagConfig.variableMappings && odagConfig.variableMappings.length > 0) {
                const $variablesSection = this.renderVariableFields(
                    odagConfig.variableMappings,
                    extensionId,
                    app
                );
                $form.append($variablesSection);
            }

            // Submit button
            const $submitBtn = UIBuilder.createButton({
                text: odagConfig.buttonText || 'Generate ODAG App',
                color: odagConfig.buttonColor || '#009845',
                textColor: odagConfig.buttonTextColor || '#ffffff',
                className: 'odag-submit-btn'
            });

            // Bind submit handler
            eventManager.on($submitBtn, 'click', function(e) {
                e.preventDefault();
                self.handleSubmit(extensionId, odagConfig, linkDetails, $form);
            });

            $form.append($submitBtn);

            $cardBody.append($form);

            return $section;
        },

        /**
         * Render binding fields section
         * @param {Array} bindings - Array of binding definitions
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} app - Qlik app instance
         * @returns {jQuery} Bindings section
         */
        renderBindingFields: function(bindings, extensionId, odagConfig, app) {
            const self = this;

            const $section = UIBuilder.createElement('div', {
                className: 'odag-bindings-section',
                styles: {
                    marginBottom: '20px'
                }
            });

            const $title = UIBuilder.createElement('h3', {
                text: 'Selection Bindings',
                styles: {
                    fontSize: '16px',
                    marginBottom: '15px',
                    color: '#333'
                }
            });

            $section.append($title);

            bindings.forEach(function(binding) {
                const fieldName = binding.selectionField || binding.fieldName;
                const isRequired = binding.required !== false;

                // Get current selections for this field
                const currentSelections = self.getFieldSelections(app, fieldName);

                const $fieldGroup = UIBuilder.createElement('div', {
                    className: 'odag-binding-field',
                    styles: {
                        marginBottom: '15px'
                    }
                });

                // Label
                const $label = UIBuilder.createElement('label', {
                    text: fieldName + (isRequired ? ' *' : ''),
                    className: 'odag-field-label',
                    styles: {
                        display: 'block',
                        marginBottom: '5px',
                        fontWeight: 'bold'
                    }
                });

                // Input showing current selections
                const selectionText = currentSelections.length > 0
                    ? currentSelections.join(', ')
                    : 'No selections';

                const $input = UIBuilder.createElement('input', {
                    className: 'odag-binding-input',
                    attrs: {
                        type: 'text',
                        readonly: true,
                        'data-field': fieldName,
                        'data-required': isRequired
                    },
                    styles: {
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f5f5f5'
                    }
                });

                $input.val(selectionText);

                // Help text
                const $help = UIBuilder.createElement('small', {
                    text: 'Current selections from ' + fieldName + ' field',
                    styles: {
                        color: '#666',
                        fontSize: '12px'
                    }
                });

                $fieldGroup.append($label).append($input).append($help);
                $section.append($fieldGroup);
            });

            return $section;
        },

        /**
         * Render variable mapping fields section
         * @param {Array} variableMappings - Array of variable mappings
         * @param {string} extensionId - Extension instance ID
         * @param {Object} app - Qlik app instance
         * @returns {jQuery} Variables section
         */
        renderVariableFields: function(variableMappings, extensionId, app) {
            const self = this;

            const $section = UIBuilder.createElement('div', {
                className: 'odag-variables-section',
                styles: {
                    marginBottom: '20px'
                }
            });

            const $title = UIBuilder.createElement('h3', {
                text: 'Variable Mappings',
                styles: {
                    fontSize: '16px',
                    marginBottom: '15px',
                    color: '#333'
                }
            });

            $section.append($title);

            variableMappings.forEach(function(mapping) {
                if (!mapping.sourceVariable || !mapping.targetVariable) {
                    return;
                }

                const $fieldGroup = UIBuilder.createElement('div', {
                    className: 'odag-variable-field',
                    styles: {
                        marginBottom: '15px'
                    }
                });

                // Label
                const $label = UIBuilder.createElement('label', {
                    text: mapping.targetVariable,
                    className: 'odag-field-label',
                    styles: {
                        display: 'block',
                        marginBottom: '5px',
                        fontWeight: 'bold'
                    }
                });

                // Get current variable value
                const variableValue = self.getVariableValue(app, mapping.sourceVariable);

                const $input = UIBuilder.createElement('input', {
                    className: 'odag-variable-input',
                    attrs: {
                        type: 'text',
                        readonly: true,
                        'data-source-var': mapping.sourceVariable,
                        'data-target-var': mapping.targetVariable
                    },
                    styles: {
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        backgroundColor: '#f5f5f5'
                    }
                });

                $input.val(variableValue || 'Not set');

                // Help text
                const $help = UIBuilder.createElement('small', {
                    text: 'Maps from variable: ' + mapping.sourceVariable,
                    styles: {
                        color: '#666',
                        fontSize: '12px'
                    }
                });

                $fieldGroup.append($label).append($input).append($help);
                $section.append($fieldGroup);
            });

            return $section;
        },

        /**
         * Get current selections for a field
         * @param {Object} app - Qlik app instance
         * @param {string} fieldName - Field name
         * @returns {Array} Array of selected values
         */
        getFieldSelections: function(app, fieldName) {
            // This is a placeholder - actual implementation would use Qlik Engine API
            // to get current selections for the field
            const selections = [];

            try {
                const field = app.field(fieldName);
                // In real implementation, would call field.getData() or similar
                // For now, return empty array
            } catch (e) {
                console.warn('Could not get selections for field:', fieldName);
            }

            return selections;
        },

        /**
         * Get variable value
         * @param {Object} app - Qlik app instance
         * @param {string} variableName - Variable name
         * @returns {string} Variable value
         */
        getVariableValue: function(app, variableName) {
            // This is a placeholder - actual implementation would use Qlik Engine API
            // to get variable value
            try {
                // In real implementation, would call app.variable.getContent()
                return '';
            } catch (e) {
                console.warn('Could not get variable value:', variableName);
                return '';
            }
        },

        /**
         * Handle form submission
         * @param {string} extensionId - Extension instance ID
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} linkDetails - ODAG link details
         * @param {jQuery} $form - Form element
         */
        handleSubmit: function(extensionId, odagConfig, linkDetails, $form) {
            const self = this;
            const app = StateManager.get(extensionId, 'app');

            // Validate form
            const validation = this.validateForm($form, linkDetails);
            if (!validation.valid) {
                const $error = UIBuilder.createErrorBox(validation.error, 'Validation Error');
                $form.prepend($error);

                // Remove error after 5 seconds
                setTimeout(function() {
                    $error.fadeOut(function() {
                        $error.remove();
                    });
                }, 5000);

                return;
            }

            // Disable submit button
            const $submitBtn = $form.find('.odag-submit-btn');
            $submitBtn.prop('disabled', true).text('Generating...');

            // Build request payload
            const payload = this.buildPayload(app, odagConfig, linkDetails);

            // Create ODAG request
            ApiService.createRequest(odagConfig.odagLinkId, payload)
                .then(function(response) {
                    // Success
                    $submitBtn.prop('disabled', false).text(odagConfig.buttonText || 'Generate ODAG App');

                    const $success = UIBuilder.createSuccessBox(
                        'ODAG app generation started successfully!',
                        'Success'
                    );
                    $form.prepend($success);

                    // Refresh apps list after 2 seconds
                    setTimeout(function() {
                        $success.fadeOut(function() {
                            $success.remove();
                        });

                        // Trigger refresh event
                        StateManager.set(extensionId, 'needsRefresh', true);
                    }, 2000);
                })
                .catch(function(error) {
                    $submitBtn.prop('disabled', false).text(odagConfig.buttonText || 'Generate ODAG App');

                    ErrorHandler.handleApiError(error, 'FormView.handleSubmit', odagConfig.enableDebug);

                    const $error = UIBuilder.createErrorBox(
                        'Failed to generate ODAG app. ' + (error.message || 'Unknown error'),
                        'Generation Error'
                    );
                    $form.prepend($error);

                    setTimeout(function() {
                        $error.fadeOut(function() {
                            $error.remove();
                        });
                    }, 5000);
                });
        },

        /**
         * Validate form before submission
         * @param {jQuery} $form - Form element
         * @param {Object} linkDetails - ODAG link details
         * @returns {Object} {valid: boolean, error: string}
         */
        validateForm: function($form, linkDetails) {
            // Check required binding fields
            const $requiredFields = $form.find('.odag-binding-input[data-required="true"]');

            for (let i = 0; i < $requiredFields.length; i++) {
                const $field = $($requiredFields[i]);
                const value = $field.val();
                const fieldName = $field.data('field');

                if (!value || value === 'No selections') {
                    return {
                        valid: false,
                        error: 'Please make selections for required field: ' + fieldName
                    };
                }
            }

            return { valid: true };
        },

        /**
         * Build ODAG request payload
         * @param {Object} app - Qlik app instance
         * @param {Object} odagConfig - ODAG configuration
         * @param {Object} linkDetails - ODAG link details
         * @returns {Object} Request payload
         */
        buildPayload: function(app, odagConfig, linkDetails) {
            const isCloud = window.qlikEnvironment === 'cloud';

            // Get current selection state
            const selectionState = this.getSelectionState(app);

            const payload = {
                selectionState: selectionState,
                userSelections: []
            };

            // Add bindings
            if (linkDetails.bindings) {
                linkDetails.bindings.forEach(function(binding) {
                    const fieldName = binding.selectionField || binding.fieldName;
                    // In real implementation, would get actual selections
                    payload.userSelections.push({
                        fieldName: fieldName,
                        selectedValues: []
                    });
                });
            }

            // Add variable mappings
            if (odagConfig.variableMappings && odagConfig.variableMappings.length > 0) {
                payload.variables = {};

                odagConfig.variableMappings.forEach(function(mapping) {
                    if (mapping.sourceVariable && mapping.targetVariable) {
                        // In real implementation, would get actual variable value
                        payload.variables[mapping.targetVariable] = '';
                    }
                });
            }

            return payload;
        },

        /**
         * Get current selection state
         * @param {Object} app - Qlik app instance
         * @returns {string} Selection state
         */
        getSelectionState: function(app) {
            // This is a placeholder - actual implementation would use Qlik Engine API
            // to get current selection state
            try {
                // In real implementation, would call app.getAppLayout() and extract selection state
                return '';
            } catch (e) {
                console.warn('Could not get selection state');
                return '';
            }
        }
    };

    return FormView;
});
