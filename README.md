# ODAG API Extension for Qlik Sense

A powerful, production-ready Qlik Sense extension for managing On-Demand App Generation (ODAG) with enterprise features including Dynamic View mode, variable mapping, real-time status monitoring, and intelligent app lifecycle management.

[![Version](https://img.shields.io/badge/version-5.0-blue.svg)](https://github.com/undsoul/qlik-odag-extension/releases)
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
- ⚡ **Production Ready** - Enterprise-grade error handling, proper cleanup, status normalization

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
- **Auto-Refresh**: Pulsing refresh button on selection changes
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

#### **Selection State Validation**
- **Row Estimation**: Validates selections against ODAG row limits
- **Real-Time Feedback**: Disables generation when limits exceeded
- **Clear Warnings**: Shows exact counts and limit values
- **Field Binding Validation**: Ensures required fields are selected

### 🎨 Customization

- **Button Text**: Customize generate button label
- **Colors**: Set button background and text colors (hex)
- **Theme**: Choose embed theme (horizon, sense, etc.)
- **Interactions**: Enable/disable user interactions in embedded apps
- **Sheet Display**: Show full app or specific sheet by Sheet ID
- **Debug Mode**: Detailed console logging for troubleshooting

---

## 📦 Installation

### Qlik Sense Desktop

**Manual Installation:**
1. Download the extension ZIP file from [GitHub Releases](https://github.com/undsoul/qlik-odag-extension/releases)
2. Extract the ZIP file
3. Copy the `OdagExtension` folder to:
   ```
   Documents/Qlik/Sense/Extensions/
   ```
4. Restart Qlik Sense Desktop
5. The extension will appear in the visualization panel

### Qlik Sense Enterprise (On-Premise)

**Import via QMC (Qlik Management Console):**

1. **Prepare Extension Package:**
   - Download the extension ZIP file from [GitHub Releases](https://github.com/undsoul/qlik-odag-extension/releases)
   - Keep the ZIP file as-is (do not extract)

2. **Access QMC:**
   - Open your browser and navigate to Qlik Management Console
   - URL format: `https://your-server/qmc`
   - Log in with administrator credentials

3. **Import Extension:**
   - In QMC, go to **Extensions** (under "Manage Resources" section)
   - Click **Import** button at the bottom
   - Click **Choose File** and select the extension ZIP file
   - Click **Import** to upload

4. **Verify Installation:**
   - The extension should appear in the extensions list
   - Status should show as "Available"
   - Note: No need to manually copy files to server directories

5. **Apply to Apps:**
   - Open any Qlik Sense app in Hub
   - Enter edit mode
   - The extension will appear in the visualization panel under "Custom objects"

**Important Notes:**
- You need QMC administrator access to import extensions
- The extension will be available to all users once imported
- No server restart required after import

### Qlik Cloud

**Import via Management Console:**

1. **Prepare Extension:**
   - Download the extension ZIP file from [GitHub Releases](https://github.com/undsoul/qlik-odag-extension/releases)
   - Keep the ZIP file as-is (do not extract)

2. **Access Management Console:**
   - Go to **Management Console** → **Extensions**
   - Click **Add** button

3. **Upload Extension:**
   - Click **Browse** or drag and drop the ZIP file
   - Click **Upload**
   - The extension will be validated automatically

4. **Enable for Spaces:**
   - After upload, click on the extension
   - Click **Add to spaces**
   - Select the spaces where you want to use the extension
   - Click **Add**

5. **Configure CSP (Critical):**
   - Go to **Management Console** → **Settings** → **Content Security Policy**
   - Add `cdn.jsdelivr.net` to the allowed domains list
   - This is required for the embed functionality to work
   - Click **Save**

6. **Use in Apps:**
   - Open any app in an enabled space
   - Enter edit mode → Add visualization
   - Find **"ODAG API Extension"** under Custom Objects

**Important Notes:**
- You need tenant admin access to import extensions
- CSP configuration is mandatory for Cloud - extension won't work without it
- Extension must be explicitly enabled for each space

### Post-Installation Verification

**For All Platforms:**
1. Open any Qlik Sense app
2. Enter edit mode (Edit button)
3. Click **+** to add a new visualization
4. Look for **"ODAG API Extension"** in the Custom Objects section
5. If you see it, installation was successful! ✅

**Troubleshooting:**
- **Extension not appearing?**
  - Desktop: Check folder path is correct
  - Enterprise: Verify import completed in QMC
  - Cloud: Verify extension is added to your current space
- **Embed not loading in Cloud?** Check CSP settings include `cdn.jsdelivr.net`

---

## ⚙️ Configuration

### 1. ODAG Link Setup

#### **Qlik Cloud** (Manual Entry)

**Finding Your ODAG Link ID:**

📹 **Video Tutorial**: [How to find ODAG Link ID](https://github.com/undsoul/qlik-odag-extension/blob/main/How-to.mov)

<img width="500" height="500" alt="Finding ODAG Link ID in Qlik Cloud" src="https://github.com/user-attachments/assets/264351a2-0282-4f5f-b00b-0683e95c64c6" />

**Steps:**
1. Go to **Management Console** → **Data** → **ODAG Links**
2. Find your ODAG link and click to open
3. Copy the **Link ID** from the URL (24-character hex string)
4. Paste it into the extension's **ODAG Link ID** field

**Example Link ID**: `6901cd6e65b3db1f1a54bf3c`

**URL Format**:
```
https://your-tenant.qlikcloud.com/console/odag-links/{LINK-ID}
                                                        ↑
                                                Copy this part
```

#### **On-Premise** (Dropdown Selector)

**Automatic Link Selection:**
- Extension automatically fetches all available ODAG links from your environment
- Select from searchable dropdown in property panel
- Shows link name and template app for easy identification
- No manual ID entry required

### 2. View Mode Selection

**Standard List View** (Default)
- Best for: Managing multiple ODAG apps
- Features: Side-by-side layout, batch operations, app history
- Use when: You need to keep multiple generated apps

**Dynamic View** (Latest App Only)
- Best for: Real-time dashboards with latest data
- Features: Single app, auto-cleanup, selection change detection
- Use when: You always want the most current app only

### 3. Display Configuration

**Sheet ID** (Optional)
- Leave empty: Shows full generated app
- Set a value: Shows specific sheet from generated app
- Find Sheet ID: Open app → Go to sheet → Copy ID from URL
- Example: `https://tenant.qlikcloud.com/sense/app/ABC/sheet/XYZ789` → Use `XYZ789`

### 4. Variable Mappings

Map Qlik variables to ODAG template fields:

**Single Value Example:**
```
Variable Name: vCustomer
Target Field: CustomerID
Result: CustomerID = "ACME Corp"
```

**Multiple Values Example:**
```
Variable Name: vProducts
Value: "ProductA,ProductB,ProductC"
Target Field: Product
Result: Product IN ("ProductA", "ProductB", "ProductC")
```

### 5. Appearance

- **Button Text**: Default: "Generate ODAG App"
- **Button Color**: Default: `#009845` (Qlik green)
- **Text Color**: Default: `#ffffff` (white)
- **Theme**: Default: `horizon`
- **Allow Interactions**: Default: `true`

### 6. Advanced Settings

- **Embed Mode**: `classic/app` (with selection bar) or `analytics/sheet` (clean view)
- **Include Current Selections**: Pass current selections to ODAG template
- **Show Debug Info**: Enable detailed console logging

---

## 🎓 Usage Guide

### Quick Start (3 Steps)

1. **Add Extension** → Drag "ODAG API Extension" to your sheet
2. **Configure ODAG Link** → Enter Link ID (Cloud) or select from dropdown (On-Premise)
3. **Generate Apps** → Exit edit mode and click "Generate ODAG App"

### Standard List View - Detailed Workflow

#### **Generating Apps**
1. Click **"Generate ODAG App"** button
2. Watch real-time status updates:
   - `Queued` - Waiting in queue
   - `Generating` - Creating app
   - `Validating` - Checking data
   - `Ready` - App available
3. New app automatically displays in preview panel

#### **Managing Apps**
- **Click any app** in the list to preview it
- **⋮ Menu** on each app:
  - 🔗 **Open in new tab** - Launch app in full screen
  - 🔄 **Reload data** - Trigger data refresh
  - ⏹️ **Cancel** - Stop generation (in-progress only)
  - 🗑️ **Delete** - Remove app
- **🗑️ Delete All** button - Remove all apps at once
- **🔄 Refresh** button - Reload apps list

#### **App Status Colors**
- 🟡 **Yellow** - Queued/Generating/Validating
- 🟢 **Green** - Ready (succeeded)
- 🔴 **Red** - Failed
- ⏹️ **Gray** - Cancelled

### Dynamic View - Detailed Workflow

#### **Initial Setup**
1. Switch to **"Dynamic View (Latest ODAG App Only)"**
2. Extension automatically:
   - Keeps only the latest app
   - Deletes all older apps immediately
   - Works even in edit mode

#### **Automatic Behavior**
- **First Load**: Generates app automatically if none exists
- **Subsequent Loads**: Uses existing app (no regeneration)
- **Selection Changes**: Yellow pulse on refresh button

#### **Selection Change Detection**
1. Make new selections in your app
2. 🟡 **Yellow pulsing refresh button** appears
3. Status shows: "Selections changed - click refresh"
4. Click refresh to regenerate with new selections

#### **Regeneration Process**
1. Click pulsing refresh button
2. Blur overlay appears over current app
3. Old app stays visible (dimmed) during generation
4. Status updates show progress
5. New app appears when ready
6. Old app deleted automatically
7. Smooth transition to new app

### Row Estimation Validation

The extension validates selections against ODAG row limits before generation:

**When Limit Exceeded:**
- **List View**: Generate button becomes disabled and grayed out
- **Dynamic View**: Refresh button hides completely
- **Warning Message**: "X distinct values exceeds limit of Y"
- **Action Required**: Refine selections to proceed

**When Validation Passes:**
- Buttons enabled and functional
- No unnecessary success messages
- Clean UI ready for generation

---

## 🔧 API Endpoints Reference

### Cloud Endpoints

#### **Cancel Generation**
```
PUT /api/v1/odagrequests/{id}?requestId={id}&action=cancel&ignoreSucceeded=true&delGenApp=false&autoAck=false
Header: qlik-csrf-token
```

#### **Delete Cancelled App**
```
PUT /api/v1/odagrequests/{id}?requestId={id}&action=ackcancel&ignoreSucceeded=true&delGenApp=true&autoAck=true
Header: qlik-csrf-token
```

#### **Delete Normal App**
```
DELETE /api/v1/odagrequests/{id}/app?xrfkey={key}
Header: qlik-csrf-token
```

#### **Poll Status**
```
GET /api/v1/odaglinks/{linkId}/requests?pending=true
Header: qlik-csrf-token
```

### On-Premise Endpoints

#### **Cancel Generation**
```
PUT /api/odag/v1/requests/{id}?requestId={id}&action=cancel&ignoreSucceeded=true&delGenApp=false&autoAck=false&xrfkey={key}
Header: X-Qlik-XrfKey
```

#### **Delete Cancelled App**
```
PUT /api/odag/v1/requests/{id}?requestId={id}&action=ackcancel&ignoreSucceeded=true&delGenApp=true&autoAck=true&xrfkey={key}
Header: X-Qlik-XrfKey
```

#### **Delete Normal App**
```
DELETE /api/odag/v1/requests/{id}/app?xrfkey={key}
Header: X-Qlik-XrfKey
```

#### **Poll Status**
```
GET /api/odag/v1/links/{linkId}/requests?pending=true&xrfkey={key}
Header: X-Qlik-XrfKey
```

---

## 📋 V5.0 - What's New

### 🐛 Critical Bug Fixes

#### **Cancelled App Detection Fix**
- **Problem**: API returns `state: "canceled"` (US), code checked for `"cancelled"` (UK)
- **Impact**: Cancelled apps treated as normal apps, wrong delete endpoints used
- **Solution**: Status normalization at API read time (line 2513-2514)
- **Result**: Correct endpoint detection for all app states

#### **Delete All Button Fix**
- **Problem**: Delete All always used DELETE method, ignored cancelled status
- **Impact**: Failed to delete cancelled apps properly
- **Solution**: Added status checking and proper endpoint routing
- **Result**: Delete All now handles all app states correctly

#### **On-Premise Cancelled App Delete**
- **Problem**: Used `action=cancel` instead of `action=ackcancel`
- **Impact**: Delete cancelled apps failed on On-Premise
- **Solution**: Changed to `action=ackcancel` for both Cloud and On-Premise
- **Result**: Consistent delete behavior across platforms

#### **Polling Optimization**
- **Problem**: Polling continued after app cancellation
- **Impact**: Unnecessary API calls, resource waste
- **Solution**: Added 'cancelled' to final statuses array
- **Result**: Polling stops automatically when appropriate

### 🚀 Enhancements

- **Status Normalization**: Automatic conversion of API spelling to internal format
- **Consistent Delete Logic**: Single and batch operations now identical
- **Better Error Handling**: Comprehensive validation and user feedback
- **Dynamic View Messages**: Shortened messages for compact status bar
- **Complete Documentation**: API reference, changelog, testing checklist

### 📝 New Documentation

- **V5_ENHANCEMENTS.md**: Complete changelog with technical details
- **V5_SUMMARY.md**: Architecture overview and design decisions
- **README.md**: Rewritten from scratch (this file)

---

## 🏗️ Architecture

### File Structure
```
OdagExtension/
├── odag-api-extension.js          # Main extension (4,759 lines)
├── odag-api-extension.qext        # Extension metadata
├── foundation/
│   ├── odag-api-service.js        # API calls with CSRF handling
│   ├── odag-constants.js          # Constants and patterns
│   ├── odag-error-handler.js      # Centralized error handling
│   ├── odag-state-manager.js      # State persistence
│   └── odag-validators.js         # Input validation
├── properties/
│   └── odag-api-properties.js     # Property panel definition
├── styles/
│   └── odag-api-extension.css     # Extension styles
└── README.md                       # This file
```

### Key Components

**Main Extension** (`odag-api-extension.js`)
- `paint()`: Main rendering function, UI setup
- `buildPayload()`: Constructs ODAG API payload
- `callODAGAPI()`: Authenticated API calls
- `loadExistingRequests()`: Fetches and normalizes app status
- `startStatusMonitoring()`: Real-time polling management
- `updateAppsList()`: Dynamic UI updates

**State Manager** (`odag-state-manager.js`)
- Manages extension state without polluting global namespace
- Tracks timers and intervals for proper cleanup
- Observes state changes with callback support
- Memory-efficient per-instance storage

**Validators** (`odag-validators.js`)
- ODAG Link ID format validation (Cloud vs On-Premise)
- Sheet ID validation and sanitization
- XSS prevention for user inputs
- Expression validation for row estimation

**Error Handler** (`odag-error-handler.js`)
- Centralized error handling and logging
- User-friendly error messages
- Debug mode integration

### Status Flow

```
User Action → API Call → Status Polling → Status Normalization → UI Update
                              ↓
                    "canceled" (API) → "cancelled" (Internal)
                              ↓
                    Correct Endpoint Selection
```

### Cleanup Strategy

- **State Manager**: Tracks all timers, intervals, observers per instance
- **Lifecycle Method**: `destroy()` calls cleanup for current instance
- **Polling**: Stops automatically when all apps reach final status
- **Memory**: Map-based storage prevents memory leaks

---

## 🔍 Troubleshooting

### Apps Not Appearing

**Symptoms:** Generate button works but no apps show in list

**Solutions:**
1. Check ODAG Link ID is correct (Cloud) or link selected (On-Premise)
2. Verify you have permissions to the ODAG link
3. Enable debug mode → Check console for API responses
4. Confirm ODAG link has correct field bindings
5. Check browser console for errors

### Selection Changes Not Detected

**Symptoms:** Yellow pulse doesn't appear in Dynamic View

**Solutions:**
1. Ensure you're in Dynamic View mode (not List View)
2. Make selections in fields that are mapped in ODAG template
3. Check that selections actually changed (compare before/after)
4. Enable debug mode → Look for selection tracking logs
5. Verify ODAG link has "Include Selections" enabled

### Embed Not Loading

**Symptoms:** Preview panel is blank or shows error

**Solutions:**
1. **Qlik Cloud**: Check CSP allows `cdn.jsdelivr.net`
   - Go to Management Console → Content Security Policy
   - Add domain to allowed list
2. **On-Premise**: Verify app ID is valid
3. Check Sheet ID (if set) exists in generated app
4. Look for browser console errors
5. Try switching embed mode (classic/app vs analytics/sheet)

### Delete Fails with 404

**Symptoms:** Delete operation shows 404 error

**Solutions:**
1. App may already be deleted - refresh list
2. Check ODAG request ID is valid
3. Enable debug mode → Check delete endpoint being called
4. Verify you have permission to delete apps
5. Check if app was cancelled (requires different endpoint)

### Cancelled Apps Not Deleting

**Symptoms:** Delete button doesn't work on cancelled apps

**Solutions:**
1. Verify you're on V5.0 or later (check extension version)
2. Enable debug mode → Check if status is 'cancelled'
3. Look for `action=ackcancel` in API call (not `action=cancel`)
4. Check console for endpoint errors
5. Verify app state in Qlik Management Console

### Row Validation Not Working

**Symptoms:** Generate button enabled even when limit exceeded

**Solutions:**
1. Verify ODAG link has row estimation configured
2. Check expression is valid Qlik syntax
3. Enable debug mode → Look for validation logs
4. Ensure row limit is set in ODAG link configuration
5. Test expression in Qlik expression editor

### Console Errors

**"TypeError: u[e] is not a function" in NebulaApp.jsx**
- This is a **known Qlik embed framework limitation**
- Occurs during mode switches (edit ↔ analysis)
- **Does NOT affect functionality** - safe to ignore
- Happens in Qlik's code (`qmfe-embed.js`)
- No fix needed - extension works normally

---

## 🛡️ Security

### Authentication
- Uses Qlik's built-in CSRF token authentication
- Respects Qlik Cloud security policies
- All API calls to same origin (no CORS issues)

### Data Protection
- No external API calls
- No data storage outside Qlik
- Debug logs only when explicitly enabled
- Input sanitization prevents XSS attacks

### Permissions
- Respects Qlik's permission model
- Only users with ODAG permissions can generate apps
- Only users with delete permissions can remove apps

---

## 🧪 Testing Checklist

### Cloud Environment
- [ ] Generate new ODAG app
- [ ] Cancel in-progress generation
- [ ] Delete succeeded app
- [ ] Delete cancelled app
- [ ] Delete all apps
- [ ] Switch to Dynamic View (auto-cleanup)
- [ ] Generate with selection changes (yellow pulse)
- [ ] Embed loads correctly in preview
- [ ] Mobile view switches to List View

### On-Premise Environment
- [ ] ODAG links dropdown populates
- [ ] Generate new ODAG app
- [ ] Cancel in-progress generation
- [ ] Delete succeeded app
- [ ] Delete cancelled app
- [ ] Delete all apps
- [ ] XRF key authentication works
- [ ] Polling stops after final status

### Both Environments
- [ ] Row estimation validation prevents over-limit generation
- [ ] Variable mapping works (single and multiple values)
- [ ] Sheet ID displays correct sheet
- [ ] Status updates in real-time
- [ ] Debug mode shows detailed logs
- [ ] No console errors (except known Nebula warning)

---

## 📊 Comparison: Native ODAG vs This Extension

### What's Identical (Core ODAG Logic)

| Aspect | Native ODAG | This Extension |
|--------|-------------|----------------|
| ODAG Template | Configured in template app | ✅ Same - respects all settings |
| Field Mappings | Defined in ODAG link | ✅ Same - uses configured mappings |
| Selection Binding | bindSelectionState | ✅ Same - identical binding |
| Generated App Data | Based on template | ✅ Same - identical data |
| Security Model | Qlik permissions | ✅ Same - respects all permissions |
| API Backend | Qlik ODAG APIs | ✅ Same - official APIs only |

### What's Enhanced (User Experience)

| Feature | Native ODAG | This Extension |
|---------|-------------|----------------|
| UI/UX | Basic navigation link | ✨ Modern interface with feedback |
| Status Visibility | Limited | ✨ Real-time: Queued → Generating → Ready |
| Auto-Show | Manual navigation | ✨ Auto-displays when ready |
| App Management | Manual cleanup | ✨ Auto-delete in Dynamic View |
| Selection Changes | No indication | ✨ Visual indicators + yellow pulse |
| Variable Support | Not available | ✨ Map variables to fields |
| Multiple Apps | Hard to manage | ✨ Side-by-side list with actions |
| Cancellation | Not accessible | ✨ Cancel button for in-progress |
| Batch Operations | Not available | ✨ Delete all apps at once |

### The Bottom Line

- ✅ **Core Logic**: 100% identical to native ODAG
- ✅ **Generated Apps**: Exactly the same as using Qlik's ODAG link
- ✅ **Reliability**: Built on official Qlik APIs
- ✨ **Enhancement**: Better UI/UX and automation

**You get the same ODAG you know and trust, just easier to use.**

---

## 🚀 Roadmap

### Planned Features

- [ ] Export apps list (CSV/JSON)
- [ ] App metadata download
- [ ] Custom status notifications
- [ ] Scheduled generation
- [ ] App tagging and filtering
- [ ] Generation history tracking

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test in both Cloud and On-Premise
- Update documentation
- Test on mobile devices

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Önder Altınbilek**

Created with ❤️ for the Qlik community

---

## 🙏 Acknowledgments

- Built using Qlik Sense Extension API
- Uses Qlik's embed web components (`qlik-embed`)
- Inspired by the need for better ODAG management workflows
- Thanks to the Qlik community for feedback and testing

---

## 📞 Support

### Getting Help

- 📖 **Documentation**: Read this README and V5_ENHANCEMENTS.md
- 🐛 **Issues**: [GitHub Issues](https://github.com/undsoul/qlik-odag-extension/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/undsoul/qlik-odag-extension/discussions)
- 📧 **Email**: onderaltinbilek@bitechnology.com

### Before Reporting Issues

1. Enable **Debug Mode** in extension properties
2. Check browser console for errors
3. Verify ODAG link configuration in QMC
4. Test with simple ODAG link first
5. Include debug logs in issue report

---

## ⚠️ Disclaimer

This is a **community-developed extension** and is not officially supported by Qlik. Use at your own discretion. Always test in a development environment before deploying to production.

---

## 📚 Additional Documentation

- [V5_ENHANCEMENTS.md](V5_ENHANCEMENTS.md) - Complete V5 changelog with technical details
- [V5_SUMMARY.md](V5_SUMMARY.md) - Architecture overview and design decisions
- [LICENSE](LICENSE) - MIT License full text

---

**Version**: 5.0
**Last Updated**: 2025-10-29
**Status**: Production Ready ✅
