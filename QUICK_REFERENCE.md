# ODAG Extension - Quick Reference Guide

## What It Does
Enhanced UI for Qlik's native On-Demand App Generation (ODAG) with modern interface, automation, and variable support.

---

## Key Features at a Glance

### 🎯 Two View Modes

**List View** (Default)
- Manage multiple ODAG apps
- Side-by-side: Apps list + Preview
- Actions: Open, Reload, Cancel, Delete
- Works on mobile and desktop

**Dynamic View**
- Maintains only the latest app
- Auto-deletes old apps
- Shows warning when selections change
- Desktop only

### 📊 Variable Mapping
- Map Qlik variables to ODAG fields
- Single or multiple values
- Automatic change detection
- Example: `vRegion = "EMEA"` → Field "Region"

### ⚡ Real-Time Features
- Live status monitoring (Queued → Generating → Ready)
- Auto-show new apps when ready
- Selection change detection
- Validation before generation

### 🔧 Smart Automation
- Auto-cleanup of old apps (Dynamic View)
- Auto-hide UI after generation
- Intelligent state tracking
- Prevents duplicate generations

---

## Quick Setup

### 1. Required Configuration
**ODAG Link ID** - Get from:
- **Cloud**: Management Console → ODAG links → Copy ID (24 chars)
- **On-Premise**: QMC → ODAG links → Properties → ID (36 chars GUID)

### 2. Optional Settings
- **View Mode**: List View or Dynamic View
- **Variable Mappings**: Map variables to fields
- **Template Sheet ID**: Show specific sheet instead of full app
- **Button Customization**: Text, colors

---

## How It Works

### Basic Workflow
```
1. Make selections in app
2. Click "Generate ODAG App"
3. Extension validates selections
4. Calls Qlik ODAG API
5. Polls for status every 3 seconds
6. Shows app when ready
```

### Dynamic View Workflow
```
1. Make selections → Generate first app
2. Change selections → Warning appears
3. Click refresh → Generate new app
4. Old app auto-deleted
5. New app auto-shown
```

### Variable-Driven Workflow
```
1. Map variable (e.g., vRegion → Region)
2. Change variable value
3. Warning appears automatically
4. Click refresh to generate
```

---

## Architecture (Simplified)

```
Extension UI
    ↓
State Manager (preserves functions across paint cycles)
    ↓
Payload Builder (constructs requests from selections + variables)
    ↓
API Service (auto-detects Cloud vs On-Premise)
    ↓
Qlik ODAG API (native)
```

---

## Version 6.0 - What's New

### Major Bug Fixes
✅ **Published Apps Work** - No more "Access denied" errors
✅ **On-Premise Bindings** - Properties panel now shows binding fields
✅ **App Limit Validation** - Works correctly on On-Premise
✅ **Edit Mode Transitions** - No more blank page issues
✅ **Auto-Cleanup Works** - Dynamic View properly deletes old apps
✅ **Memory Leaks Fixed** - Proper embed cleanup in List View

### New Features
✨ **Variable Change Detection** - Automatically detects when variables change
✨ **Smart Top Bar** - Auto-hides after generation, shows on state change
✨ **Enhanced Logging** - Better debugging with detailed console logs

---

## File Structure (Modular)

```
OdagExtension/
├── odag-api-extension.js        # Main controller (3,500 lines)
├── odag-api-extension.qext      # Extension metadata
├── properties/                   # Properties panel
├── foundation/                   # Core services
│   ├── odag-api-service.js      # API wrapper
│   ├── odag-state-manager.js    # State management
│   ├── odag-constants.js        # Configuration
│   ├── odag-validators.js       # Validation
│   └── odag-error-handler.js    # Error handling
├── handlers/                     # Event handling
├── core/                         # Payload building
├── views/                        # View management
└── styles/                       # CSS
```

**Total**: ~6,500 lines across 11 modules

---

## Platform Support

### Works On
✅ Qlik Cloud (all regions)
✅ Qlik Sense Enterprise (On-Premise)
✅ Published apps (managed spaces)
✅ Chrome, Firefox, Edge, Safari
✅ Desktop and mobile devices

### Requirements
- ODAG link configured in QMC/Management Console
- Permissions to generate ODAG apps
- Modern browser with JavaScript enabled

---

## Common Issues - Quick Fixes

**"Invalid ODAG Link ID"**
- Cloud: Must be 24 characters (hex)
- On-Premise: Must be 36 characters (GUID)

**"Generate button doesn't appear"**
- Make required field selections
- Check row estimation limit
- Verify app limit not reached

**"Variable changes not detected"**
- Verify variable mapping configured
- Variable name should NOT include `$()`
- Enable debug mode to see logs

**"Extension shows blank"**
- Check browser console (F12) for errors
- Try incognito mode
- Clear browser cache
- Verify extension is v6.0.0

---

## Debug Mode

Enable in properties panel to see:
```
🌍 Environment detected: CLOUD
📋 Fetching ODAG bindings...
✅ Bindings cached: 2 bindings
🔔 Variable changed: vRegion
🔍 State changed (selections + variables): true
```

---

## API Endpoints Used

**Cloud**:
- `/api/v1/odaglinks/{id}` - Get bindings
- `/api/v1/odaglinks/{id}/requests` - Generate/fetch apps

**On-Premise**:
- `/api/odag/v1/links/{id}` - Get bindings
- `/api/odag/v1/links/{id}/requests` - Generate/fetch apps

All with proper XRF keys and authentication.

---

## Performance Metrics

- **Initial Load**: <500ms
- **Paint Cycle**: <100ms
- **Status Polling**: Every 3 seconds (when needed)
- **Memory**: Proper cleanup, no leaks
- **API Calls**: Optimized with caching

---

## Key Technical Decisions

### Why Global Window Storage?
- Paint() clears local state frequently
- Need persistence across paint cycles
- Shared between views
- Namespaced to prevent conflicts

### Why StateManager?
- No global pollution
- Per-instance isolation
- Function preservation across paints
- Easy cleanup on config change

### Why Modular Architecture?
- Separation of concerns
- Easier maintenance
- Reusable components
- Better testability

### Why Single Codebase for Cloud/On-Premise?
- Automatic environment detection
- Consistent user experience
- Easier updates
- Reduced maintenance

---

## Support & Resources

- **Version**: 6.0.0 (Production Ready)
- **Author**: MuchachoAI
- **Email**: onderaltinbilek@bitechnology.com
- **GitHub**: https://github.com/undsoul/qlik-odag-extension
- **License**: MIT

---

## Quick Troubleshooting Checklist

Before reporting issues:
- [ ] Extension version is 6.0.0
- [ ] ODAG Link ID format is correct (24 or 36 chars)
- [ ] ODAG link exists and is active
- [ ] You have permissions to generate apps
- [ ] Native ODAG works outside extension
- [ ] Browser console shows no errors
- [ ] Debug mode enabled to see logs

If all checked and still doesn't work → Provide console logs with debug enabled.

---

**Last Updated**: October 30, 2024
**Document**: Quick Reference v1.0
