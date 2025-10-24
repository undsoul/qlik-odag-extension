# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Qlik Sense Custom Visualization Extension** for generating On-Demand Apps (ODAG) with variable support and dynamic field mapping. The extension integrates with Qlik Sense's ODAG API to create dynamically generated applications based on user selections and configured variable mappings.

## Key Architecture Concepts

### Module System
- Uses AMD (Asynchronous Module Definition) with RequireJS, which is Qlik Sense's module system
- Main module definition: `define(["qlik", "jquery", "./properties", "css!./odag-api-extension.css"], function(qlik, $, properties) { ... })`
- All dependencies are loaded at runtime by Qlik Sense - there is no build process

### Extension Lifecycle
1. **Initialization**: Qlik Sense loads the extension via the .qext manifest file
2. **Configuration**: User configures the extension through the properties panel
3. **Rendering**: The `paint()` function is called whenever the visualization needs to update
4. **User Interaction**: Button clicks trigger ODAG API calls to generate new apps

### State Management
- Global state stored in `window.odagGeneratedApps` array for tracking generated applications
- Configuration accessed via `layout.odagConfig` object passed to the paint function
- No state management library - direct DOM manipulation with jQuery

## Common Development Tasks

### Testing the Extension
Since there's no build process or test infrastructure:
1. Copy the entire `OdagExtension` folder to Qlik Sense Extensions directory:
   - Desktop: `C:\Users\[Username]\Documents\Qlik\Sense\Extensions\`
   - Server: `C:\ProgramData\Qlik\Sense\Extensions\`
2. Refresh Qlik Sense in the browser (F5)
3. The extension appears in the visualization panel as "ODAG Variable Extension"

### Debugging
- Enable debug mode in the properties panel configuration
- Check browser console for logged messages
- API calls can be monitored in the Network tab

### Packaging for Distribution
To create a distributable package:
```bash
# From the parent directory containing OdagExtension folder
zip -r OdagExtension.zip OdagExtension/
```

## API Integration Points

### ODAG REST API Endpoints
The extension communicates with these Qlik Sense APIs:
- `GET /api/v1/odaglinks/{odagLinkId}/requests?pending=true` - Load existing requests
- `POST /api/v1/odaglinks/{odagLinkId}/requests` - Create new ODAG request
- `POST /api/v1/odagrequests/{requestId}/reloadApp` - Reload generated app
- `DELETE /api/v1/odagrequests/{requestId}/app` - Delete generated app

All API calls require CSRF token authentication (retrieved from cookies).

### Qlik JavaScript API
- `app.variable.getByName()` - Retrieve variable values
- `app.getObject()` - Get selection state
- `qlik.navigation.gotoApp()` - Navigate to generated app

## Code Organization

### Main Files
- `odag-api-extension.js`: Core extension logic (620 lines)
  - `paint()`: Main rendering function
  - `buildPayload()`: Constructs ODAG API request payload
  - `callODAGAPI()`: Handles API communication
  - `getVariableValues()`: Extracts Qlik variables
  - `getCurrentSelections()`: Gets current field selections

- `odag-api-properties.js`: Properties panel definition (preferred)
- `properties.js`: Alternative properties definition (backup)
- `odag-api-extension.css`: Styling for responsive layouts
- `odag-api-extension.qext`: Extension manifest

### Layout Modes
The extension supports 4 responsive layout modes configured via properties:
- `list-left`: Apps list on the left, iframe on right
- `list-right`: Apps list on the right, iframe on left
- `list-top`: Apps list on top, iframe below
- `list-bottom`: Apps list on bottom, iframe above

## Important Implementation Details

### Variable Mapping
Variables are mapped from source app to ODAG template via:
```javascript
variableMappings: [
  { variableName: "vSourceVar", targetField: "TargetField" }
]
```

### Selection State Handling
The extension captures current selections and includes them in ODAG requests when `includeSelections` is enabled. Selections are formatted as:
```javascript
{
  fieldName: "Region",
  values: [{ fieldValue: "North" }, { fieldValue: "South" }]
}
```

### Error Handling Pattern
All API calls use this pattern:
```javascript
$.ajax({
  // ... config
  success: function(data) { /* handle success */ },
  error: function(xhr) {
    showNotification("Error: " + xhr.responseText, "error");
  }
});
```

## Version Requirements
- Qlik Sense >= 3.2.x (specified in .qext)
- Modern browser with ES6 support for qlik-embed components