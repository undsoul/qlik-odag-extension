# ODAG API Extension for Qlik Sense

A powerful Qlik Sense extension for managing On-Demand App Generation (ODAG) with advanced features including Dynamic View mode, **VARIABLE MAPPING**, real-time status monitoring, and intelligent selection tracking.

## 🎯 Built on Native Qlik ODAG

**100% Compatible with Qlik's ODAG Core Logic**

This extension uses the **exact same fundamentals and core principles** as Qlik's native ODAG functionality:
- ✅ Uses official Qlik ODAG APIs (`/api/v1/odaglinks`, `/api/v1/odagrequests`)
- ✅ Respects all ODAG template configurations and field mappings
- ✅ Follows the same selection state binding mechanisms
- ✅ Maintains the same security model and permissions
- ✅ Generates apps with identical data and structure

**What's Different? Enhanced User Experience**

This extension **doesn't change HOW ODAG works** — it changes **HOW YOU INTERACT with it**:
- 🎨 **Better UI/UX**: Modern interface with real-time status, auto-show, and visual feedback
- 🔄 **Smart Automation**: Auto-delete old apps, auto-show new apps, selection change detection
- 📊 **Variable Support**: Map Qlik variables to ODAG fields (single or multiple values)
- 🎯 **Dynamic View**: Specialized mode for maintaining only the latest app
- 📱 **Responsive**: Adapts to different container sizes

**The Result:**
Same reliable ODAG functionality you trust, with a significantly improved user experience.

## Features

### 🎯 Dynamic View Mode (Desktop Only)
- **Smart App Management**: Automatically maintains only the latest ODAG app
- **Selection Change Detection**: Visual indicators when selections change
- **Auto-Refresh**: Pulse animation on refresh button when selections differ
- **Blur Overlay**: Visual feedback during app generation
- **One-Click Refresh**: Regenerate apps with current selections instantly
- **Note**: Mobile devices automatically use List View for better navigation

### 📊 Standard List View
- **Side-by-Side Layout**: Apps list on left, embedded app preview on right (desktop)
- **Mobile Layout**: Vertical stacking with dropdown selector and app preview below
- **Real-time Status**: Live monitoring of app generation progress
- **Batch Operations**: Delete all apps with one click
- **Flexible Display**: Show full app or specific sheet based on Sheet ID configuration (desktop only)
- **Auto-Show**: Automatically displays newly generated apps
- **Mobile Optimization**: Automatically switches to list view on mobile devices (width < 768px)

### 🔧 Advanced Features
- **Variable Mapping**: Map Qlik variables to ODAG template fields
- **Custom Theming**: Configure button colors and themes
- **Debug Mode**: Optional detailed logging for troubleshooting
- **Responsive Design**: Adapts to small and large container sizes
- **Cancel Generation**: Stop in-progress app generation
- **Reload Apps**: Trigger data reload on generated apps

## Installation

1. Download the latest release from [Releases](../../releases)
2. Extract the files to your Qlik Sense extensions folder:
   - **Qlik Sense Desktop**: `Documents/Qlik/Sense/Extensions/`
   - **Qlik Sense Server**: `<Share>/StaticContent/Extensions/`
   - **Qlik Cloud**: Import via Management Console → Extensions
3. Restart Qlik Sense or refresh your browser
4. The extension will appear as "ODAG API Extension" in the visualization panel

## Configuration

### ODAG Configuration

#### Qlik Cloud
In Qlik Cloud, you'll manually enter the ODAG Link ID:

https://github.com/user-attachments/assets/f572f5c3-637f-4186-9bd6-b7fd9445e840

https://github.com/undsoul/qlik-odag-extension/blob/main/How-to.mov

<img width="500" height="500" alt="image" src="https://github.com/user-attachments/assets/264351a2-0282-4f5f-b00b-0683e95c64c6" />

#### On-Premise
In On-Premise environments, the extension automatically:
- Fetches all available ODAG links from your app
- Displays them in a searchable dropdown
- Shows link name and template app for easy selection
- Auto-refreshes when you change the ODAG link

**🚨 Qlik Cloud Only: Check CSP settings allow `cdn.jsdelivr.net`** - Add to Content Security Policy for embed functionality 🚨

#### Settings
- **ODAG Link ID/Selector**:
  - Cloud: Manual text input (required)
  - On-Premise: Dropdown selector (required)
- **Include Current Selections**: Whether to pass current selections to ODAG template (default: true)
- **Embed Mode**:
  - `classic/app`: Shows app with selection bar
  - `analytics/sheet`: Shows app without selection bar (cleaner view)

### Variable Mappings

Map Qlik variables to fields in your ODAG template. This allows you to pass variable values as selections to the ODAG template, just like regular field selections.

#### Single Value
```
Variable Name: vCustomer
Variable Value: "ACME Corp"
Target Field: CustomerID

Result: One selection → CustomerID = "ACME Corp"
```

#### Multiple Values (Comma-Separated)
You can pass multiple values by separating them with commas:
```
Variable Name: vProducts
Variable Value: "ProductA,ProductB,ProductC"
Target Field: Product

Result: Three selections → Product IN ("ProductA", "ProductB", "ProductC")
```

**How it works:**
- The extension automatically splits comma-separated values
- Each value becomes a separate selection
- Whitespace is trimmed automatically
- Empty values are filtered out

**Example Use Cases:**
1. **Multiple Customers**: `vCustomers = "Customer1,Customer2,Customer3"`
2. **Multiple IDs**: `vOrderIDs = "101,102,103,104"`
3. **Multiple Regions**: `vRegions = "North America, Europe, Asia"` (spaces are trimmed)
4. **From Input Box**: User enters comma-separated values in an input box
5. **From Expression**: `=Concat(DISTINCT Region, ',')`

### View Modes

The extension offers two view modes, both supporting flexible app/sheet display via the **Sheet ID** configuration.

#### 1. Standard List View (App/Sheet) - Default
Displays generated ODAG apps in a side-by-side layout with live preview.

**Features:**
- **Apps List (Left)**: Shows all generated apps with real-time status
- **Preview Panel (Right)**: Displays selected app or sheet
- **Auto-Show**: Newly generated apps automatically appear in preview
- **Batch Operations**: Delete all apps at once
- **Per-App Actions**: Open, reload, or delete individual apps

**Display Configuration:**
- **Sheet ID Empty**: Shows the full generated ODAG application
- **Sheet ID Set**: Shows the specific sheet from the generated app
- Applies to all apps in the list

#### 2. Dynamic View (Latest ODAG App Only) - Desktop Only
Specialized mode that maintains **only ONE latest ODAG app** at all times.

**Philosophy**: Perfect for dashboards and real-time analysis where you always want the most current data with current selections.

**Key Features:**
- **Automatic App Lifecycle Management**: Always keeps exactly one app
- **Selection Change Detection**: Yellow pulsing refresh button when selections change
- **One-Click Refresh**: Instantly regenerate with current selections
- **Blur Overlay**: Visual feedback during generation
- **Smart Cleanup**: Auto-deletes old app when new one succeeds

**Display Configuration:**
- **Sheet ID Empty**: Shows the full generated app
- **Sheet ID Set**: Shows the specific sheet from the generated app
- Same Sheet ID configuration applies as Standard List View

**Automatic Cleanup Behavior:**
- **Switching to Dynamic View**: Keeps only latest app, deletes all others immediately
- **Generating New App**: Old app deleted automatically when new one succeeds
- **Edit Mode Switch**: Cleanup runs even while in edit mode for instant results
- **Subsequent Loads**: Uses existing app if available, no unnecessary regeneration

**Mobile Behavior:**
- Dynamic View is **disabled on mobile devices** (width < 768px)
- Mobile automatically uses Standard List View with dropdown selector
- This ensures better navigation and usability on smaller screens

### Configuration Options

#### View Settings
- **View Mode**: Choose between Standard List View or Dynamic View
- **Sheet ID** (Optional):
  - Leave empty to show full app
  - Set a sheet ID to show specific sheet
  - Applies to both view modes

#### Appearance
- **Button Text**: Customize generate button label (default: "Generate ODAG App")
- **Button Color**: Set button background color in hex (default: #009845)
- **Text Color**: Set button text color in hex (default: #ffffff)
- **Theme**: Choose embed theme - `horizon` (default), `sense`, etc.
- **Allow Interactions**: Enable/disable user interactions in embedded apps (default: true)

#### Debug
- **Show Debug Info**: Enable detailed console logging and status display
- Useful for troubleshooting API calls, selection states, and app generation

## Usage Guide

### Quick Start

1. **Add the extension** to your Qlik Sense app
2. **Configure ODAG Link ID** (see instructions above)
3. **Choose View Mode**:
   - Standard List View: Manage multiple generated apps
   - Dynamic View: Always show the latest app only
4. **Optional: Set Sheet ID** to show a specific sheet instead of full app
5. **Exit edit mode** and start generating apps!

### Standard List View - Detailed Usage

**Generating Apps:**
1. Click the **"Generate ODAG App"** button
2. Watch real-time status: `Queued → Generating → Validating → Ready`
3. New app automatically appears in the preview panel (right side)

**Managing Apps:**
- **Click any app** in the list to preview it
- **⋮ Menu** on each app provides:
  - 🔗 **Open in new tab**: Launch app in full screen
  - 🔄 **Reload app data**: Trigger data refresh
  - 🗑️ **Delete app**: Remove individual app
- **Delete All** button: Remove all generated apps at once

**Real-Time Features:**
- Live status updates every second
- Spinning loader for in-progress apps
- Auto-show: Latest app displays automatically when ready
- Status colors:
  - 🟡 Yellow: Queued/Generating
  - 🟢 Green: Ready
  - 🔴 Red: Error

### Dynamic View - Detailed Usage

**Initial Setup:**
1. Switch to **"Dynamic View (Latest ODAG App Only)"**
2. Extension automatically cleans up:
   - Keeps the latest app
   - Deletes all older apps
   - Happens immediately, even in edit mode

**Working with Dynamic View:**

**Automatic Generation:**
- First load with no apps: Automatically generates one
- Subsequent loads: Uses existing app (no unnecessary regeneration)

**Selection Change Detection:**
1. Make selections in your Qlik app
2. 🟡 **Yellow pulse** appears on refresh button
3. Status text shows: "Selections changed - click refresh"
4. Click refresh to regenerate with new selections

**Regeneration Process:**
1. Click the pulsing refresh button
2. Blur overlay appears over current app
3. Old app stays visible (dimmed) during generation
4. New app appears when ready
5. Old app deleted automatically
6. Smooth transition to new app

**Benefits:**
- Always shows most current data
- One app = clean workspace
- Perfect for dashboards that need latest selections
- No manual cleanup required

### Sheet ID Configuration

Both view modes support showing a specific sheet instead of the full app:

**To Show Full App:**
- Leave **Sheet ID** field empty
- App overview/hub will be displayed

**To Show Specific Sheet:**
1. Open your ODAG template app
2. Open the sheet you want to display
3. Copy the sheet ID from the URL (the part after `/sheet/`)
   - Example URL: `https://tenant.qlikcloud.com/sense/app/ABC123/sheet/XYZ789/state/analysis`
   - Sheet ID: `XYZ789`
4. Paste into **Sheet ID** field in properties
5. That sheet will now display for all generated apps

**Use Cases:**
- Dashboard view: Show specific summary sheet
- Report view: Display pre-built analysis
- Focused analysis: Show one KPI sheet

---

## 🆕 Recent Improvements

### Version 4.0 Updates (Latest)

**Cloud Bindings & Properties Panel Enhancements**
- ✅ Fixed Cloud bindings refresh to use correct API response structure (`response[0].link.bindings`)
- ✅ Enhanced binding field name extraction with full property chain support
- ✅ Added comprehensive field name fallback: `selectAppParamName` → `selectionAppParamName` → `fieldName` → `name`
- ✅ Cloud bindings now correctly extract from `selAppLinkUsages` endpoint

**Properties Panel UX Improvements**
- ✅ Dynamic Sheet ID label changes based on embed mode (Required vs Optional)
- ✅ Sheet ID validation warning for Analytics Sheet mode when empty
- ✅ Visual warning box appears when Sheet ID is missing for analytics/sheet embed
- ✅ Automatic ODAG links dropdown population on extension load
- ✅ Properties panel auto-refresh when ODAG links are fetched

**Binding Fields Auto-Fetch**
- ✅ Bindings automatically fetch when ODAG link is selected from dropdown
- ✅ "Refresh Binding Fields" button now uses correct Cloud API endpoint
- ✅ Binding field display updates after one edit mode cycle (Qlik Sense limitation)
- ✅ Improved retry logic and error handling for binding updates
- ✅ Hidden timestamp properties trigger proper panel refresh

**On-Premise Enhancements**
- ✅ ODAG links dropdown now searchable with improved UX
- ✅ Links automatically load when extension is added to sheet
- ✅ Properties panel refreshes automatically when links are available
- ✅ Binding fields cache to window for persistence across paint cycles

**Code Quality & Architecture**
- ✅ Simplified change handler logic - removed complex property update patterns
- ✅ Better separation of concerns between properties panel and paint() method
- ✅ Comprehensive logging for debugging binding fetch and display issues
- ✅ Improved error handling with detailed console output

**User Experience**
- ✅ Clear visual feedback for missing Sheet ID in analytics mode
- ✅ Better error messages for binding fetch failures
- ✅ Consistent behavior between Cloud and On-Premise environments
- ✅ Reduced need for manual properties panel refresh

---

### Version 3.3.1 Updates

**ODAG Row Estimation Validation**
- ✅ Client-side validation based on `rowEstExpr` and `curRowEstHighBound` from ODAG configuration
- ✅ Real-time evaluation of row estimation expression (e.g., `count(DISTINCT BOLGE_ADI)`)
- ✅ Automatic comparison against configured row limit
- ✅ Prevents ODAG app generation when selection would exceed limits

**Dynamic UI Feedback**
- ✅ **List View**: Generate button grays out and becomes disabled when limit exceeded
- ✅ **Dynamic View**: Refresh button hides completely when limit exceeded
- ✅ Clear warning messages showing exact counts (e.g., "7 distinct values exceeds limit of 5")
- ✅ Clean UI when validation passes - no unnecessary success messages
- ✅ Red warning banner with actionable guidance to refine selections

**Real-Time Selection Tracking**
- ✅ Subscribes to Qlik's `changed` event to detect selection changes instantly
- ✅ Uses hypercube session objects for fresh, non-cached data evaluation
- ✅ Debounced validation (300ms) prevents rapid-fire checks during multi-selection
- ✅ Button states and messages update immediately as selections change
- ✅ Works seamlessly in both List View and Dynamic View modes

**Enhanced Dynamic View Behavior**
- ✅ Top bar stays visible during entire ODAG generation process
- ✅ Remains visible for 10 seconds after successful completion
- ✅ Users can clearly see generation status and completion messages
- ✅ Auto-hide re-enabled after status is visible long enough
- ✅ Fixed top bar blocking interactions with embedded app selection bar
- ✅ Added × close button for manual top bar hiding
- ✅ Hover activation distance reduced from 100px to 30px for less intrusion

**Debug Mode Improvements**
- ✅ All verbose console logs moved to `debugLog()` function
- ✅ Production console stays clean - no clutter
- ✅ Enable "Debug Mode" in properties to see detailed validation logs
- ✅ Debug logs include row estimation calculations, validation results, and selection tracking
- ✅ Critical errors and warnings still logged regardless of debug mode

**Technical Implementation**
- ✅ **Cloud**: Extracts from `/api/v1/odaglinks/{id}` → `properties.rowEstRange[0].highBound`
- ✅ **On-Premise**: Extracts from `/api/odag/v1/links/{id}` → `objectDef.properties.rowEstRange[0].highBound`
- ✅ Creates temporary hypercube session objects for live expression evaluation
- ✅ Validates before API calls to prevent unnecessary ODAG requests
- ✅ Graceful fallback: allows generation if no row limits configured
- ✅ Works with any ODAG link that has row estimation settings in both Cloud and On-Premise

**User Experience Benefits**
- ✅ Prevents wasted time generating apps that will fail server-side validation
- ✅ Immediate feedback when selections need refinement
- ✅ Clear guidance on what to do (reduce selections)
- ✅ No cryptic error messages - shows actual numbers
- ✅ Maintains consistent validation state across mode switches

---

## 🚀 Future Improvements

### 📊 Export Functionality
- **Export Apps List**: Download list of generated ODAG apps (CSV/JSON)
- **App Metadata**: Include creation date, selections, status, app ID
- **Quick Export Button**: One-click export from the apps list

---

## 🔄 Native ODAG vs This Extension

### What Stays the Same (Core ODAG Logic)
| Aspect | Native ODAG | This Extension |
|--------|-------------|----------------|
| **ODAG Template** | Configured in template app | ✅ Same - respects all template settings |
| **Field Mappings** | Defined in ODAG link | ✅ Same - uses configured field mappings |
| **Selection Binding** | bindSelectionState | ✅ Same - identical selection state binding |
| **Generated App Data** | Based on template + selections | ✅ Same - identical data and structure |
| **Security & Permissions** | Qlik's security model | ✅ Same - respects all permissions |
| **API Backend** | Qlik ODAG APIs | ✅ Same - uses official APIs |

### What's Enhanced (User Experience)
| Feature | Native ODAG | This Extension |
|---------|-------------|----------------|
| **UI/UX** | Basic navigation link | ✨ Modern interface with real-time feedback |
| **Status Visibility** | Limited | ✨ Live status: Queued → Generating → Ready |
| **Auto-Show** | Manual navigation required | ✨ Auto-displays new app when ready |
| **App Management** | Manual cleanup | ✨ Auto-delete old apps (Dynamic View) |
| **Selection Changes** | No indication | ✨ Visual indicators + yellow pulse |
| **Variable Support** | Not available | ✨ Map variables to fields (single/multiple) |
| **Multiple Apps** | Hard to manage | ✨ Side-by-side list with menu actions |
| **Cancellation** | Not easily accessible | ✨ Cancel button for in-progress apps |

### The Bottom Line
- **Core Logic**: 100% identical to native ODAG
- **Generated Apps**: Exactly the same as using Qlik's ODAG link
- **Reliability**: Built on official Qlik APIs
- **Enhancement**: Better UI/UX and automation features

**You get the same ODAG you know and trust, just easier to use.**

---

## API Endpoints Used

### Qlik Cloud APIs
- `GET /api/v1/odaglinks/{id}/requests` - List ODAG requests
- `POST /api/v1/odaglinks/{id}/requests` - Create new ODAG request
- `DELETE /api/v1/odagrequests/{id}` - Cancel pending request
- `DELETE /api/v1/odagrequests/{id}/app` - Delete generated app
- `POST /api/v1/odagrequests/{id}/reloadApp` - Reload app data

### On-Premise APIs
- `GET /api/odag/v1/links` - List all ODAG links (for dropdown)
- `GET /api/odag/v1/links/{id}/requests` - List ODAG requests
- `POST /api/odag/v1/links/{id}/requests` - Create new ODAG request
- `DELETE /api/odag/v1/requests/{id}` - Cancel pending request
- `DELETE /api/odag/v1/requests/{id}/app` - Delete generated app

## Architecture

### Key Components
- **paint()**: Main rendering function, sets up UI and handlers
- **buildPayload()**: Constructs ODAG API payload with selections
- **callODAGAPI()**: Makes authenticated API calls to Qlik Cloud
- **Dynamic View**: Specialized mode for single-app workflows
- **Status Monitoring**: Real-time tracking of app generation state

### Selection State Management
- Uses Qlik's `getCurrentSelections()` API
- Compares selection payloads using JSON stringify
- Stores baseline from ODAG API response
- Detects changes on every paint cycle

## Development

### File Structure
```
OdagExtension/
├── odag-api-extension.js       # Main extension code
├── odag-api-extension.qext     # Extension metadata
├── odag-api-properties.js      # Property panel definition
├── odag-api-extension.css      # Styles
└── README.md                   # This file
```

### Debug Mode
Enable debug mode in the property panel to see:
- API calls and payloads
- Selection state changes
- App generation progress
- Deletion operations
- Embed refresh events

Console output is suppressed when debug mode is off (production-ready).

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari

## Requirements

- Qlik Sense Cloud OR Qlik Sense Enterprise On-Premise
- ODAG license and configured ODAG links
- Appropriate permissions to create/delete apps
- **Qlik Cloud only**: CSP settings must allow `cdn.jsdelivr.net` for embed functionality

## Troubleshooting

### Apps not appearing
- Check ODAG Link ID is correct
- Verify you have permissions to the ODAG link
- Enable debug mode to see API responses

### Selection changes not detected
- Ensure Debug mode is working (check console)
- Verify you're in Dynamic View mode
- Check that selections are being applied to fields mapped in ODAG template

### Embed not loading
- **Qlik Cloud**: Check CSP settings allow `cdn.jsdelivr.net` (add to Content Security Policy)
- **On-Premise**: CSP configuration not required
- Verify app ID is valid
- Check browser console for errors

### Delete fails with 404
- App may already be deleted
- Check ODAG request ID is valid
- Enable debug mode for detailed error messages

### Console error: "TypeError: u[e] is not a function" in NebulaApp.jsx
- **This is a known Qlik embed framework limitation**, not an extension bug
- Occurs when qlik-embed elements are destroyed during mode switches (edit ↔ analysis)
- **Does not affect functionality** - the extension continues to work normally
- The error happens inside Qlik's own code (`qmfe-embed.js`, `NebulaApp.jsx`)
- Safe to ignore - it's a harmless cleanup timing issue in Qlik's framework

## Security

This extension:
- Uses Qlik's built-in authentication (CSRF tokens)
- Respects Qlik Cloud security policies
- Only logs sensitive data when debug mode is enabled
- Makes all API calls to the same origin (no CORS issues)

## License

MIT License - See [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in Qlik Sense
5. Submit a pull request

## Author

Created with ❤️ for the Qlik community

## Acknowledgments

- Built using Qlik Sense Extension API
- Uses Qlik's embed web components
- Inspired by the need for better ODAG management workflows

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Note**: This is a community-developed extension and is not officially supported by Qlik.
