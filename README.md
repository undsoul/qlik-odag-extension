# ODAG Extension for Qlik Sense

A production-ready Qlik Sense extension for On-Demand App Generation (ODAG) with better UI, variable support, and mobile compatibility.

[![Version](https://img.shields.io/badge/version-9.1.1-blue.svg)](https://github.com/undsoul/qlik-odag-extension/releases)
[![Qlik Cloud](https://img.shields.io/badge/Qlik-Cloud-green.svg)](https://www.qlik.com/us/products/qlik-sense)
[![On-Premise](https://img.shields.io/badge/Qlik-On--Premise-green.svg)](https://www.qlik.com/us/products/qlik-sense)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)

---

## Why Use This Extension?

**Native Qlik Dynamic View is object-based** - you can only embed single charts, not whole sheets. This extension gives you:

- Full sheet embedding (not just single objects)
- Better UI with real-time status monitoring
- Faster response with auto-refresh on selection change
- Variable support - map Qlik variables to ODAG fields
- Mobile compatible (Qlik Cloud app)
- 5 languages (EN, TR, ES, CN, AR)
- Works on both Qlik Cloud & On-Premise

---

## Screenshots

### List View
Manage multiple ODAG apps with side-by-side preview — apps list on the left, embedded app on the right.

<!-- TODO: List View screenshot -->

### Dynamic View
Always shows the latest app; auto-deletes predecessors and auto-refreshes on selection change.

<!-- TODO: Dynamic View screenshot -->

### Properties Panel
ODAG link, view mode, embed mode, variable mappings, language — all configurable from the standard Qlik properties panel.

<!-- TODO: Properties Panel screenshot -->

### Generation Flow
Real-time status polling (Queued → Generating → Ready) with visual indicators.

<!-- TODO: Generation Flow screenshot -->

---

## View Modes

### List View (Default)
Manage multiple ODAG apps with side-by-side preview:
- Apps list on left, embedded preview on right
- Auto-show new apps when ready
- Delete all or individual apps

### Dynamic View
Always shows the latest app only:
- Auto-deletes old apps when new one succeeds
- Auto-refresh when selections change
- Variable change detection
- Clean, full-screen experience

---

## Features

- **Real-Time Status**: Live polling (Queued → Generating → Ready)
- **Variable Mapping**: Map Qlik variables to ODAG fields
- **Selection Validation**: Row limits, field bindings, app limits
- **Auto-Refresh**: Regenerates app when selections change
- **Multilingual**: EN, TR, ES, CN, AR
- **Zero Dependencies**: Pure vanilla JavaScript

---

## Installation

### Qlik Cloud
1. Download ZIP from [Releases](https://github.com/undsoul/qlik-odag-extension/releases)
2. Management Console → Extensions → Add
3. Upload ZIP file

> **Air-gapped friendly (v9.2.14+):** DOMPurify is now bundled inside the extension — no CDN access required. Works in fully air-gapped environments out of the box.

### On-Premise
1. Download ZIP
2. QMC → Extensions → Import
3. Approve extension

---

## Configuration

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

### 2. Other Settings

- **View Mode**: List View or Dynamic View
- **Embed Mode**: classic/app, analytics/sheet, classic/sheet
- **Template Sheet ID**: Show specific sheet
- **Variable Mappings**: Map variables to ODAG fields
- **Language**: EN, TR, ES, CN, AR

---

## Mobile Support

**Required settings for Qlik Cloud mobile app:**

```
- View Mode: Dynamic View (NOT List View)
- Embed Mode: analytics/sheet (NOT classic/app)
- Template Sheet ID: [required]
```

**Why:**
- List View layout doesn't fit mobile screens
- `classic/app` mode causes popup issues on mobile
- `analytics/sheet` is the only working mode

---

## Troubleshooting

### Invalid ODAG Link ID
- Cloud: 24 characters (e.g., `602c0332db186b0001f7dc38`)
- On-Premise: 36 characters GUID

### Variable Changes Not Detected
- Don't include `$()` in variable names
- Names are case-sensitive

### App Generation Fails
Check console (F12):
- Selection required → Make selections
- Row limit exceeded → Reduce scope
- App limit reached → Delete old apps

---

## Architecture

```
OdagExtension/
├── odag-api-extension.js       # Main controller
├── foundation/                 # API, state, language, validators
├── handlers/                   # Event handling
├── core/                       # Payload builder
├── views/                      # View management
└── styles/                     # CSS
```

---

## Links

- [GitHub Repository](https://github.com/undsoul/qlik-odag-extension)
- [Report Issues](https://github.com/undsoul/qlik-odag-extension/issues)
- [Qlik ODAG Documentation](https://help.qlik.com/en-US/sense/November2023/Subsystems/Hub/Content/Sense_Hub/LoadData/on-demand-app-generation.htm)

---

## License

MIT License - see [LICENSE](LICENSE)

---

**Author:** MuchachoAI (onderaltinbilek@bitechnology.com)
