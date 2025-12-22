# ODAG Extension for Qlik Sense

A powerful, production-ready Qlik Sense extension for managing On-Demand App Generation (ODAG) with enterprise features including Dynamic View mode, variable mapping, real-time status monitoring, and intelligent app lifecycle management.

[![Version](https://img.shields.io/badge/version-8.0.22-blue.svg)](https://github.com/undsoul/qlik-odag-extension/releases)
[![Qlik Cloud](https://img.shields.io/badge/Qlik-Cloud-green.svg)](https://www.qlik.com/us/products/qlik-sense)
[![On-Premise](https://img.shields.io/badge/Qlik-On--Premise-green.svg)](https://www.qlik.com/us/products/qlik-sense)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

---

## 🎯 What is this Extension?

This extension provides an **enhanced user interface** for Qlik's native ODAG functionality. It uses the same official Qlik APIs and generates identical apps - just with a modern, intuitive interface and powerful automation features.

### Why Use This Extension?

- ✅ **100% Native Qlik ODAG** - Uses official APIs, respects all ODAG configurations
- 🎨 **Modern UI/UX** - Real-time status updates, visual indicators, responsive design
- 🔄 **Smart Automation** - Auto-delete old apps, auto-show new apps, intelligent lifecycle management
- 📊 **Variable Support** - Map Qlik variables to ODAG fields (single or multiple values)
- 🎯 **Dynamic View** - Maintain only the latest app with automatic cleanup
- 📱 **Responsive** - Works on desktop, tablet, and mobile devices
- 🌍 **Multilingual** - Support for 5 languages (English, Turkish, Spanish, Chinese, Arabic)
- ⚡ **Production Ready** - Enterprise-grade error handling, proper cleanup, Cloud & On-Premise support

---

## 🆕 Version 8.0 - Vanilla JS Migration & Fast Selection Tracking

### 🚀 Complete Vanilla JS Migration

The extension has been completely rewritten from jQuery to pure vanilla JavaScript, resulting in:

- **Zero jQuery Dependency**: No external library required for DOM operations
- **Smaller Bundle Size**: Reduced footprint without jQuery overhead
- **Better Performance**: Native browser APIs are faster than jQuery abstractions
- **Modern Codebase**: ES6+ syntax with async/await patterns
- **Enhanced Security**: Built-in HTML sanitization without DOMPurify dependency

### ⚡ Fast Selection Tracking (Critical Fix)

Fixed the "quick selection" race condition where rapid selections weren't captured correctly:

**The Problem:**
When users made quick selections and immediately clicked "Generate", the ODAG app was created with OLD selection values instead of the latest ones.

**The Solution:**
Implemented aggressive engine synchronization before querying selections:

```javascript
// Step 1: Wait for pending selection commands (100ms)
await new Promise(resolve => setTimeout(resolve, 100));

// Step 2: Double getAppLayout() for guaranteed engine sync
await enigmaApp.getAppLayout();
await enigmaApp.getAppLayout();

// Step 3: Create fresh SelectionObject via Enigma API
const selectionObj = await enigmaApp.createSessionObject({...});

// Step 4: Brief wait for SelectionObject population (50ms)
await new Promise(resolve => setTimeout(resolve, 50));

// Step 5: Get layout with guaranteed fresh data
const selectionLayout = await selectionObj.getLayout();
```

**Result:** Selections are now captured correctly even with rapid user interactions.

### 🔧 New Utility Modules

#### DOM Helper (`utils/dom-helper.js`)
- jQuery-compatible API with vanilla JS implementation
- Built-in HTML sanitization (removes script tags, event handlers, javascript: URLs)
- Safe fallback when DOMPurify isn't available
- Methods: `get()`, `getAll()`, `on()`, `off()`, `addClass()`, `removeClass()`, `setHTML()`, `setText()`, etc.

#### HTTP Helper (`utils/http-helper.js`)
- Promise-based HTTP client using Fetch API
- Automatic JSON parsing
- Timeout support
- Error handling with status codes

### 🐛 Bug Fixes in v8.0

#### Fixed: Bindings Race Condition
- **Issue**: "No cached ODAG bindings found" error on initial load
- **Cause**: `buildPayload` was called before bindings fetch completed
- **Fix**: Store fetch Promise in window, `buildPayload` now awaits if fetch is in progress

#### Fixed: Console Warning Spam
- **Issue**: "[DOMHelper] Setting HTML without sanitization" warning appeared 100+ times
- **Fix**: Added `_basicSanitize()` function as fallback when DOMPurify isn't loaded

#### Fixed: Engine Sync for Fresh Selections
- **Issue**: Enigma SelectionObject sometimes returned stale data
- **Fix**: Double `getAppLayout()` calls + delays ensure engine processes all pending operations

### 📦 Architecture Changes

```
OdagExtension/
├── odag-api-extension.js       # Main extension (vanilla JS)
├── foundation/
│   ├── odag-language.js        # NEW: Multi-language support
│   └── odag-state-manager.js   # Enhanced with Promise support
├── utils/
│   ├── dom-helper.js           # NEW: jQuery replacement
│   ├── http-helper.js          # NEW: Fetch API wrapper
│   └── dompurify-loader.js     # NEW: Optional sanitization
├── core/
│   └── odag-payload-builder.js # Enhanced with engine sync
└── handlers/
    └── odag-event-handlers.js  # Vanilla JS event handling
```

---

## 🌍 Version 7.0.0 - Multilingual Support & Cross-Page Selection Tracking

### 🌍 New Feature: Multilingual Interface

The extension now supports **5 languages** out of the box, making it accessible to users worldwide:

- 🇬🇧 **English** (Default)
- 🇹🇷 **Türkçe** (Turkish)
- 🇪🇸 **Español** (Spanish)
- 🇨🇳 **中文** (Chinese - Simplified)
- 🇸🇦 **العربية** (Arabic)

#### What's Translated

All user-facing messages are now available in multiple languages:

- **Button Labels**: Generate, Refresh, Cancel, Delete, Open, Reload, Close
- **Status Messages**: Queued, Generating, Validating, Ready, Failed, Loading
- **Progress Indicators**: "Generating ODAG app...", "Loading app...", "Deleting app..."
- **Validation Messages**: Selection required, Row limit exceeded, App limit reached
- **Warning Messages**: Selections changed, State changed, Dynamic view alerts
- **Error Messages**: Load failed, Generation failed, API errors, Access denied
- **Info Messages**: Select an app, Required fields, Generated on, Last reloaded

#### How to Use

1. Open the extension properties panel
2. Go to **"Appearance & Language"** section
3. Select your preferred language from the dropdown
4. All UI text will automatically update to the selected language

#### Technical Details

- New module: `foundation/odag-language.js` (~600 lines)
- Language messages organized by category (buttons, status, progress, validation, errors, warnings, success, info)
- Seamless integration with existing codebase
- Messages stored in StateManager for global access
- Fallback to English if translation is missing
- No performance impact - all translations loaded at startup

#### Benefits

- **Global Accessibility**: Users can work in their native language
- **Better UX**: Clear, localized messages reduce confusion
- **Enterprise Ready**: Supports multinational deployments
- **Easy to Extend**: New languages can be added easily to the language module

### 🔄 Fixed: Selection Tracking Across Page Navigation (Dynamic View)

#### The Problem
When users made binding field selections, navigated to another sheet, and returned to the extension, the selections were lost. The extension couldn't detect that selections had changed because they were only stored in memory, which cleared during page navigation.

#### The Solution
Implemented persistent selection tracking using sessionStorage with stable storage keys and automatic app regeneration:

- **Persistent Current Selections**: Extension now stores `currentBindSelections` to sessionStorage whenever selections are checked
- **Cross-Page Memory**: When you navigate away and return, stored selections are automatically restored
- **Smart Comparison**: On page reload, extension compares restored selections with baseline (`lastGeneratedPayload`)
- **Auto-Trigger Refresh**: If selections changed, extension automatically triggers refresh (as if user clicked the button)
- **Seamless Experience**: New app generation starts automatically without manual intervention
- **Clean Lifecycle**: Stored selections are cleared after successful generation (they become the new baseline)

#### What Changed

**StateManager** (`foundation/odag-state-manager.js`):
- Added `currentBindSelections` to persistent keys
- Enhanced `delete()` to support custom storage keys
- Better cross-page-load persistence

**Main Extension** (`odag-api-extension.js`):
- Created stable storage key for current selections (using `app.id + odagLinkId`)
- Store selections continuously to sessionStorage
- Restore and compare selections after page navigation
- Auto-trigger refresh button click when selections changed (after 1 second delay)
- Clear stored selections after successful generation

#### How It Works Now

```
1. User makes selections → Stored to sessionStorage
2. User navigates to another sheet → Selections persist
3. User returns to extension → Selections restored and compared with baseline
4. Extension detects change → Automatically triggers refresh after 1 second
5. New app generation starts → Without manual button click
6. App completes → Old app deleted, new app displayed
7. Stored selections cleared → Now part of new baseline
```

#### Benefits

- ✅ **No Lost Selections**: Selections survive page navigation
- ✅ **Fully Automatic**: No manual refresh needed - app regenerates automatically
- ✅ **Seamless Experience**: Users just navigate and the extension handles everything
- ✅ **Zero Friction**: Navigate away, make changes, come back - new app starts generating
- ✅ **Stable Tracking**: Uses stable keys that don't change between page loads

---

## Version 6.0.0 - Production Release

### Major Features

#### **Variable Change Detection in Dynamic View**
- Automatically detects when mapped variables change
- Shows top bar with refresh warning when state changes
- Highlights refresh button in orange when action needed
- Works seamlessly with field selections

#### **Enhanced Cloud & On-Premise Support**
- Full compatibility with both Qlik Cloud and On-Premise
- Automatic environment detection
- Proper API routing for each platform

#### **Improved Dynamic View Experience**
- Auto-hides top bar after successful generation
- Only shows top bar when user changes selections or variables
- Cleaner UI with less clutter
- Smart state tracking prevents unnecessary refreshes

### Bug Fixes in v6.0.0

#### **Fixed: Access Denied Errors in Published Apps**
- **Issue**: Extension failed in published apps with "Access denied (Error code: 5)"
- **Cause**: Attempted to create session objects and modify properties without write permissions
- **Fix**: Added graceful error handling for all session object operations
- **Result**: Extension now works perfectly in published apps on both Cloud and On-Premise

#### **Fixed: On-Premise Binding Fields Not Displaying**
- **Issue**: "Required Binding Fields" box was empty in On-Premise properties panel
- **Cause**: Binding fetch was blocked when in edit mode due to incorrect condition
- **Fix**: Removed `!isEditMode` condition that prevented fetch
- **Result**: Binding fields now display correctly in properties panel

#### **Fixed: On-Premise App Limit Validation Not Working**
- **Issue**: App limit validation didn't work on On-Premise
- **Cause**: Full ODAG link data wasn't being cached (only bindings were cached)
- **Fix**: Added caching of complete link data including `genAppLimit` properties
- **Result**: App limit validation now works correctly on On-Premise

#### **Fixed: Blank Page After Exiting Edit Mode**
- **Issue**: Dynamic View showed blank page after entering and exiting edit mode
- **Cause**: Top bar was being hidden when reloading existing apps, not just new ones
- **Fix**: Only hide top bar for newly generated apps, not existing apps being reloaded
- **Result**: Smooth transitions between edit and analysis modes

#### **Fixed: Dynamic View Not Deleting Old Apps**
- **Issue**: Old ODAG apps accumulated in Dynamic View instead of being deleted
- **Cause**: `window.odagGeneratedApps` was empty in Dynamic View (only used by List View)
- **Fix**: Fetch existing apps from API before generating, extract request IDs for deletion
- **Result**: Old apps are now properly deleted, maintaining only the latest

#### **Fixed: Proper Embed Cleanup**
- **Issue**: Potential memory leaks when switching between apps in List View
- **Cause**: Previous embeds might not be destroyed properly
- **Fix**: Added explicit `existingEmbed.remove()` before creating new embed
- **Result**: Clean transitions with proper resource cleanup

### Technical Improvements

- **Error Handling**: All session object operations wrapped with access denied detection
- **State Management**: Improved variable state tracking across paint cycles
- **API Compatibility**: Handles differences between Cloud and On-Premise responses
- **Debug Logging**: Enhanced logging for troubleshooting app limit and binding issues
- **Code Organization**: Modular architecture with separated concerns

---

## 🚀 Features

### 🎯 View Modes

#### **Standard List View** (Default)
Manage multiple ODAG apps with side-by-side preview:
- **Apps List (Left)**: All generated apps with real-time status
- **Preview Panel (Right)**: Embedded app or sheet display
- **Auto-Show**: New apps automatically appear when ready
- **Batch Operations**: Delete all apps with one click
- **Per-App Actions**: Open, reload, cancel, or delete individual apps
- **Mobile Optimized**: Vertical layout with dropdown selector

#### **Dynamic View** (Latest App Only)
Specialized mode for always showing the most current data:
- **Single App Management**: Maintains exactly one latest app
- **Selection Change Detection**: Visual indicators when selections differ
- **Variable Change Detection**: Monitors mapped variables for changes
- **Auto-Refresh**: Pulsing refresh button on state changes
- **Smart Cleanup**: Automatically deletes old app when new one succeeds
- **Blur Overlay**: Visual feedback during generation
- **Desktop Only**: Mobile devices automatically use List View

### 🔧 Core Features

#### **Real-Time Status Monitoring**
- Live polling of app generation status (every 3 seconds)
- Status progression: `Queued → Generating → Validating → Ready`
- Visual indicators: Spinning loader, status colors, progress messages
- Automatic polling stop when app reaches final state

#### **App Lifecycle Management**
- **Generate**: Create new ODAG apps with current selections
- **Cancel**: Stop in-progress generation (Cloud and On-Premise)
- **Delete**: Remove individual apps or all apps at once
- **Reload**: Trigger data refresh on generated apps
- **Auto-Cleanup**: Dynamic View automatically deletes old apps

#### **Variable Mapping**
Map Qlik variables to ODAG template fields:
- **Single Values**: `vCustomer = "ACME Corp"`
- **Multiple Values**: `vProducts = "ProductA,ProductB,ProductC"`
- **Automatic Splitting**: Comma-separated values become multiple selections
- **Expression Support**: `=Concat(DISTINCT Region, ',')`
- **Change Detection**: Automatically detects variable value changes

#### **Selection State Validation**
- **Row Estimation**: Validates selections against ODAG row limits
- **Real-Time Feedback**: Disables generation when limits exceeded
- **Clear Warnings**: Shows exact counts and limit values
- **Field Binding Validation**: Ensures required fields are selected
- **App Limit Validation**: Prevents generation when app limit reached

### 🎨 Customization

- **Button Text**: Customize generate button label
- **Colors**: Set button background and text colors (hex)
- **Embed Mode**: Choose between classic/app, analytics/sheet, or classic/sheet
- **Interactions**: Enable/disable user interactions in embedded apps
- **Sheet Display**: Show full app or specific sheet by Sheet ID
- **Debug Mode**: Detailed console logging for troubleshooting

---

## 📦 Installation

### Qlik Cloud

**Via Management Console:**
1. Download the latest extension ZIP from [GitHub Releases](https://github.com/undsoul/qlik-odag-extension/releases)
2. Go to Management Console → Extensions
3. Click "Add" and upload the ZIP file
4. The extension will be available in all apps

**CSP Configuration (Required for Qlik Cloud):**
The extension uses Font Awesome icons from CDN. Add the following to your CSP settings:

1. Go to Management Console → Settings → Content Security Policy
2. Add `cdn.jsdelivr.net` to the allowed domains for:
   - **script-src** (for Font Awesome JavaScript)
   - **style-src** (for Font Awesome CSS)
   - **font-src** (for Font Awesome fonts)

Example CSP directive:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' cdn.jsdelivr.net;
font-src 'self' data: cdn.jsdelivr.net;
```

### Qlik Sense Enterprise (On-Premise)

**Via QMC:**
1. Download the extension ZIP file
2. Open Qlik Management Console (QMC)
3. Navigate to Extensions
4. Click "Import" and select the ZIP file
5. Approve the extension for use

**Manual Installation:**
1. Extract the ZIP file
2. Copy the `OdagExtension` folder to:
   ```
   \\server\QlikShare\Extensions\
   ```
3. Restart Qlik services if needed

### Qlik Sense Desktop

**Manual Installation:**
1. Download the extension ZIP file
2. Extract to:
   ```
   Documents/Qlik/Sense/Extensions/
   ```
3. Restart Qlik Sense Desktop

---

## 🔧 Configuration

### 1. ODAG Link Setup (In QMC or Management Console)

Before using the extension, set up your ODAG link:

**Qlik Cloud:**
1. Management Console → Data → ODAG links
2. Create a new ODAG link or use existing
3. Configure template app and selection mappings
4. Copy the ODAG Link ID

**On-Premise:**
1. QMC → ODAG links
2. Create/configure ODAG link
3. Note the Link ID (GUID format)

### 2. Extension Configuration

Add the extension to your selection app:

#### **Required Settings:**

**ODAG Link ID** (Required)
- Cloud format: 24-character hex (e.g., `602c0332db186b0001f7dc38`)
- On-Premise format: 36-character GUID (e.g., `52792d6c-72d7-462b-bed3-c4bda0481726`)
- Where to find:
  - Cloud: Management Console → ODAG links → Copy ID
  - On-Premise: QMC → ODAG links → Properties

#### **Optional Settings:**

**Language**
- Choose your preferred interface language
- Options: English (default), Türkçe, Español, 中文, العربية
- All UI text updates automatically when you change the language
- Located in "Appearance & Language" section

**View Mode**
- `List View` (default): Show all generated apps in a list
- `Dynamic View`: Show only the latest app, auto-delete old ones

**Variable Mappings** (Optional)
Add variable-to-field mappings:
- Variable Name: `vRegion` (name without `$()`)
- Field Name: `Region` (ODAG template field name)
- Supports multiple mappings
- Automatically detects changes

**Embed Mode**
- `classic/app`: Full app embed (default)
- `analytics/sheet`: Cloud analytics sheet mode
- `classic/sheet`: Classic sheet embed

**Template Sheet ID** (Optional)
- Show specific sheet instead of full app
- Must be exact Sheet ID (36 characters)
- Cloud: Use `object-id` for analytics/sheet mode

**Button Customization**
- Button Text: Custom label (default: "Generate ODAG App")
- Button Color: Hex code (default: `#009845`)
- Text Color: Hex code (default: `#ffffff`)

**Advanced**
- Allow Interactions: Enable/disable user interactions in embeds
- Enable Debug: Show detailed console logs

---

## 📋 Usage Examples

### Example 1: Basic Setup with Field Selections

```
Settings:
- ODAG Link ID: 602c0332db186b0001f7dc38
- View Mode: List View
- Include Current Selections: ✓

Usage:
1. Make selections in your app (Region, Product, etc.)
2. Click "Generate ODAG App"
3. App appears in list when ready
4. Click app to view in embedded panel
```

### Example 2: Dynamic View with Variables

```
Settings:
- ODAG Link ID: 602c0332db186b0001f7dc38
- View Mode: Dynamic View
- Variable Mappings:
  - vRegion → Region
  - vYear → Year

Usage:
1. Set variable values (buttons, input boxes, etc.)
2. Top bar shows with refresh warning when variables change
3. Click refresh to generate new app
4. Old app is automatically deleted
5. New app loads automatically
```

### Example 3: Sheet-Specific View

```
Settings:
- ODAG Link ID: 52792d6c-72d7-462b-bed3-c4bda0481726
- View Mode: List View
- Embed Mode: classic/sheet
- Template Sheet ID: a5b8c3d4-e6f7-4a8b-9c0d-1e2f3a4b5c6d

Usage:
1. Make selections
2. Generate app
3. Specific sheet loads instead of full app
4. Cleaner, focused view
```

---

## 🐛 Troubleshooting

### Common Issues

#### "Access denied" Error in Published Apps
**Fixed in v6.0.0** - If you still see this, ensure you're using the latest version.

#### Binding Fields Empty on On-Premise
**Fixed in v6.0.0** - Bindings now fetch correctly in both edit and analysis modes.

#### Apps Not Deleting in Dynamic View
**Fixed in v6.0.0** - Old apps are now properly deleted after new app succeeds.

#### Blank Page After Edit Mode
**Fixed in v6.0.0** - Edit mode transitions now work smoothly.

#### Invalid ODAG Link ID Error

**Cloud:**
- Must be 24 characters (MongoDB ObjectId format)
- Example: `602c0332db186b0001f7dc38`
- Where to find: Management Console → ODAG links → Copy ID

**On-Premise:**
- Must be 36 characters (GUID format)
- Example: `52792d6c-72d7-462b-bed3-c4bda0481726`
- Where to find: QMC → ODAG links → Properties → ID

#### Variable Changes Not Detected

Check:
1. Variable names in mappings don't include `$()`
2. Variable name exactly matches (case-sensitive)
3. Field name matches ODAG template binding
4. Debug mode enabled to see logs

#### App Generation Fails

Check console logs (F12) for:
- `Selection required` → Make required selections
- `Row limit exceeded` → Reduce selection scope
- `App limit reached` → Delete old apps first
- `ODAG Link not found` → Verify Link ID

---

## 🏗️ Architecture

### Modular Design

```
OdagExtension/
├── odag-api-extension.js       # Main extension controller
├── odag-api-extension.qext     # Extension metadata
├── properties/
│   └── odag-api-properties.js  # Properties panel definition
├── foundation/
│   ├── odag-api-service.js     # ODAG API wrapper
│   ├── odag-state-manager.js   # State management
│   ├── odag-constants.js       # Configuration constants
│   ├── odag-validators.js      # Input validation
│   └── odag-error-handler.js   # Error handling
├── handlers/
│   └── odag-event-handlers.js  # UI event handling
├── core/
│   └── odag-payload-builder.js # Payload construction
├── views/
│   └── odag-view-manager.js    # View management
└── styles/
    └── odag-api-extension.css  # Styling
```

### Key Components

- **State Manager**: Centralized state without global pollution
- **Payload Builder**: Selection and variable mapping logic
- **View Manager**: Dynamic and List view rendering
- **Event Handlers**: User interaction management
- **Error Handler**: Graceful error recovery

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**MuchachoAI**
- Email: onderaltinbilek@bitechnology.com
- GitHub: [@undsoul](https://github.com/undsoul)

---

## 🙏 Acknowledgments

- Built using Qlik's official ODAG APIs
- Follows Qlik Sense extension development best practices
- Tested on both Qlik Cloud and Qlik Sense Enterprise

---

## 📊 Version History

### v8.0.22 (Current)
- 🚀 **Vanilla JS Migration**: Complete rewrite from jQuery to pure vanilla JavaScript
- ⚡ **Fast Selection Tracking**: Fixed race condition with quick selections using Enigma API sync
- 🔧 **DOM Helper**: New utility module replacing jQuery with built-in HTML sanitization
- 🔧 **HTTP Helper**: New Fetch API wrapper for HTTP operations
- 🐛 **Bindings Race Condition**: Fixed "No cached ODAG bindings found" error
- 🐛 **Console Warning Spam**: Eliminated DOMHelper sanitization warnings
- 🐛 **Engine Sync**: Double getAppLayout() ensures fresh selection data
- 📦 **Zero Dependencies**: No jQuery or DOMPurify required
- 🔒 **Enhanced Security**: Basic HTML sanitization built-in

### v7.0.0
- 🌍 **Multilingual Support**: Added support for 5 languages (English, Türkçe, Español, 中文, العربية)
- 🎨 **Language Selection**: New dropdown in properties panel for language preference
- 📝 **Comprehensive Translations**: All user-facing messages translated
- 🏗️ **New Module**: Created `foundation/odag-language.js` with 600+ lines of translations
- ✨ **Auto-Update**: UI text automatically updates when language changes
- 🔧 **Global Access**: Messages stored in StateManager for use across all modules
- 🔄 **Fixed: Cross-Page Selection Tracking**: Selections now persist across page navigation in Dynamic View
- 💾 **Persistent State**: Current selections stored to sessionStorage with stable keys
- 🎯 **Smart Comparison**: Automatically compares stored selections with baseline after page reload
- 🤖 **Auto-Trigger Refresh**: Automatically starts app regeneration when selections changed (no manual click needed)
- ⚡ **Zero-Click Experience**: Navigate away, make changes, come back - app regenerates automatically

### v6.0.0
- ✨ Added variable change detection in Dynamic View
- 🐛 Fixed "Access denied" errors in published apps
- 🐛 Fixed On-Premise binding fields not displaying
- 🐛 Fixed On-Premise app limit validation
- 🐛 Fixed blank page after exiting edit mode
- 🐛 Fixed Dynamic View not deleting old apps
- 🐛 Fixed proper embed cleanup in List View
- 🔧 Enhanced error handling for session objects
- 🔧 Improved Cloud/On-Premise compatibility
- 📝 Renamed files to remove version suffix

### v5.0.0
- Added Dynamic View mode
- Enhanced variable mapping support
- Improved mobile responsiveness
- Real-time status monitoring

### v4.0.0
- Added On-Premise support alongside Cloud
- Unified API handling for both platforms
- Environment auto-detection

### v3.x
- Initial production releases
- Cloud-only support
- Basic ODAG functionality

---

## 🔗 Resources

- [Qlik ODAG Documentation](https://help.qlik.com/en-US/sense/November2023/Subsystems/Hub/Content/Sense_Hub/LoadData/on-demand-app-generation.htm)
- [Extension Development Guide](https://qlik.dev/extend/build-an-extension/overview)
- [GitHub Repository](https://github.com/undsoul/qlik-odag-extension)
- [Report Issues](https://github.com/undsoul/qlik-odag-extension/issues)

---

**Made with ❤️ by MuchachoAI**
