# ODAG Extension for Qlik Sense

A powerful, production-ready Qlik Sense extension for managing On-Demand App Generation (ODAG) with enterprise features including Dynamic View mode, variable mapping, real-time status monitoring, and intelligent app lifecycle management.

[![Version](https://img.shields.io/badge/version-6.0.0-blue.svg)](https://github.com/undsoul/qlik-odag-extension/releases)
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
- ⚡ **Production Ready** - Enterprise-grade error handling, proper cleanup, Cloud & On-Premise support

---

## 🆕 Version 6.0.0 - Production Release

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

### v6.0.0 (Current)
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
