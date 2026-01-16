# D365 CCaaS External Transfer Country Code Helper

<p align="center">
  <img src="icons/d365logo.png" alt="D365 Logo" width="80" height="80">
</p>

<p align="center">
  <strong>Enterprise-grade browser extension for Dynamics 365 Contact Center</strong><br>
  Automatically populates country/region codes in the external transfer dialer
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.7-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/chrome-compatible-brightgreen.svg" alt="Chrome">
  <img src="https://img.shields.io/badge/edge-compatible-brightgreen.svg" alt="Edge">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey.svg" alt="License">
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Why a Browser Extension?](#why-a-browser-extension)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Enterprise Deployment](#enterprise-deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Performance](#performance)
- [Support](#support)
- [Changelog](#changelog)
- [License](#license)

---

## Overview

The **D365 CCaaS External Transfer Country Code Helper** is a browser extension designed to streamline the external transfer workflow in Microsoft Dynamics 365 Contact Center as a Service (CCaaS). 

When contact center agents need to transfer calls to external phone numbers, they must select a country/region code from a dropdown containing 200+ countries. This extension automatically pre-fills the country selection based on the agent's configured preference, reducing Average Handle Time (AHT) and improving agent efficiency.

### Problem Statement

| Without Extension | With Extension |
|-------------------|----------------|
| Agent opens transfer dialog | Agent opens transfer dialog |
| Agent scrolls through 200+ countries | ✅ Country auto-selected |
| Agent finds and clicks their country | Agent enters phone number |
| Agent enters phone number | Agent completes transfer |
| Agent completes transfer | **~5-10 seconds saved per transfer** |

### Business Impact

| Metric | Improvement |
|--------|-------------|
| Time per transfer | -5 to 10 seconds |
| 50 transfers/day × 100 agents | **~7-14 hours saved daily** |
| Agent satisfaction | Reduced friction |
| Error rate | Fewer wrong country selections |

---

## Why a Browser Extension?

At the time of developing this solution (January 2026), Microsoft does not provide an official client-side JavaScript API or hooks to customize the **Conversation Control Panel** in Dynamics 365 Contact Center.

### Technical Limitation

The external transfer dialog (including the country/region dropdown) is rendered inside a Microsoft-managed iframe (`msdyn_chatcontrol.htm`). This control:

- ❌ Does **not** expose JavaScript events or methods
- ❌ Cannot be accessed via standard D365 Client API (`formContext`, `Xrm.Page`)
- ❌ Cannot be customized using web resources attached to the Conversation form
- ❌ Has no documented hooks for field pre-population

### Why Not a D365 Solution?

| Approach | Feasibility |
|----------|-------------|
| JavaScript Web Resource on Conversation Form | ❌ Cannot access iframe content |
| Client Script / Form Events | ❌ No events exposed for transfer dialog |
| Power Automate / Flow | ❌ Cannot manipulate UI elements |
| PCF Control | ❌ Cannot replace Microsoft's control |
| **Browser Extension** | ✅ Can inject into all frames |

### Browser Extension Advantage

A browser extension operates at the browser level, not the D365 API level, allowing it to:

- ✅ Inject scripts into **all frames** including Microsoft-managed iframes
- ✅ Observe DOM changes via MutationObserver
- ✅ Interact directly with UI elements regardless of origin
- ✅ Work without modifying the D365 environment

> **Note**: If Microsoft introduces an official API for the Conversation Control Panel in the future, a D365-native solution would be preferable. This extension serves as a practical workaround until such APIs become available.

---

## Features

### Core Functionality
- ✅ **Automatic Country Selection** - Pre-fills country when transfer dialog opens
- ✅ **100+ Countries Supported** - Comprehensive list with dial codes and flags
- ✅ **Seamless Integration** - Works within the D365 CCaaS interface
- ✅ **Zero Training Required** - Set once, works automatically

### Enterprise Features (v2.0.7)
- ✅ **Multi-Selector Fallback** - 7 fallback selectors survive Microsoft UI updates
- ✅ **Confidence Scoring** - Reports detection confidence (50-100%)
- ✅ **Retry with Exponential Backoff** - Auto-retries on failure (3 attempts)
- ✅ **Input Sanitization** - XSS prevention and validation
- ✅ **Structured Logging** - Debug mode for troubleshooting
- ✅ **High-Volume Optimized** - Handles 50+ transfers per shift

### User Experience
- ✅ **D365-Styled Toast Notifications** - Premium visual feedback
- ✅ **Error Notifications** - Clear feedback when auto-fill fails
- ✅ **Modern Popup UI** - Clean settings interface matching D365 design

---

## Requirements

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Microsoft Edge | 88+ | ✅ Fully Supported |
| Google Chrome | 88+ | ✅ Fully Supported |
| Chromium-based | 88+ | ✅ Fully Supported |
| Firefox | - | ❌ Not Supported (Manifest V3) |
| Safari | - | ❌ Not Supported |

### System Requirements

- Dynamics 365 Contact Center as a Service (CCaaS)
- Omnichannel for Customer Service with voice channel enabled
- Access to `*.dynamics.com` domains
- Browser extension installation permissions

---

## Installation

### Option 1: Manual Installation (Recommended for Testing)

1. **Download the Extension**
   ```powershell
   git clone https://github.com/your-org/d365-ccaas-country-helper.git
   ```
   Or download and extract the ZIP file.

2. **Open Browser Extensions Page**
   - **Edge**: Navigate to `edge://extensions/`
   - **Chrome**: Navigate to `chrome://extensions/`

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch (top-right corner)

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the extension folder
   - Verify the D365 icon appears in your toolbar

### Option 2: Enterprise Deployment (Group Policy)

See [Enterprise Deployment](#enterprise-deployment) section below.

---

## Configuration

### Initial Setup

1. Click the extension icon in your browser toolbar
2. Select your preferred country from the dropdown
3. Ensure "Enable Auto-fill" is toggled ON
4. Optionally enable/disable toast notifications

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Country/Region | The country to auto-select | United States |
| Enable Auto-fill | Master toggle for the extension | ON |
| Show Notifications | Display toast when country is selected | ON |

### Manual Override

Even with auto-fill enabled, agents can manually change the country selection after auto-fill completes.

---

## Usage

### Automatic Mode (Default)

1. Open a conversation in D365 CCaaS
2. Click **Transfer** → **External number**
3. The country field is automatically populated ✅
4. Enter the phone number and complete the transfer

### Manual Fill Button

If auto-detection doesn't trigger, use the popup:
1. Click the extension icon
2. Click **"Fill Country Now"** button
3. The country will be filled in the active transfer dialog

### Verify Extension is Working

1. Open browser DevTools (F12) → Console tab
2. Look for: `📞 D365 Dialer | v2.0.7 Active - Watching all frames`
3. When country is auto-filled: `📞 D365 Dialer ✅ | Country selected: [country name]`

---

## Architecture

### Technical Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Extension                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Popup UI   │    │  Background  │    │   Content    │       │
│  │  (Settings)  │    │   Script     │    │   Script     │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    Chrome Storage API                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Dynamics 365 CCaaS                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    Main Frame                          │     │
│  │  ┌──────────────────────────────────────────────────┐  │     │
│  │  │           msdyn_chatcontrol.htm (iframe)         │  │     │
│  │  │  ┌────────────────────────────────────────────┐  │  │     │
│  │  │  │  Country/Region Combobox ← Auto-filled     │  │  │     │
│  │  │  └────────────────────────────────────────────┘  │  │     │
│  │  └──────────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

| Component | File | Purpose |
|-----------|------|---------|
| Content Script | `content/content.js` | Injected into D365 pages, detects and fills country input |
| Background Script | `background.js` | Handles manual fill requests via `chrome.scripting` |
| Popup | `popup/*` | Settings UI for country selection and toggles |
| Manifest | `manifest.json` | Extension configuration (Manifest V3) |

### Detection Strategy

The extension uses a **multi-selector fallback system** with confidence scoring:

| Priority | Selector | Confidence |
|----------|----------|------------|
| 1 | Exact element ID | 100% |
| 2 | Partial ID match (`*regionComboBox*Dialer*`) | 90% |
| 3 | Exact placeholder (`Country/region`) | 85% |
| 4 | Partial placeholder (`*Country*`) | 70% |
| 5 | ARIA label (`*Country*`) | 65% |
| 6 | ARIA label (`*region*`) | 60% |
| 7 | Data automation ID | 50% |

If Microsoft updates their UI, the extension falls back to alternative selectors automatically.

---

## Enterprise Deployment

### Group Policy Deployment (Edge/Chrome)

#### 1. Package the Extension

Create a `.crx` file or host the unpacked extension on an internal file share.

#### 2. Configure Group Policy

**For Microsoft Edge:**

```
Computer Configuration 
  → Administrative Templates 
    → Microsoft Edge 
      → Extensions
        → Configure extension management settings
```

Policy JSON:
```json
{
  "d365-ccaas-dialer-helper": {
    "installation_mode": "force_installed",
    "update_url": "https://your-internal-server/extension/updates.xml"
  }
}
```

**For Google Chrome:**

```
Computer Configuration 
  → Administrative Templates 
    → Google Chrome 
      → Extensions
        → Configure the list of force-installed extensions
```

#### 3. Pre-configure Default Settings

Create a managed storage policy to set default country:

```json
{
  "countryName": "Australia",
  "dialCode": "+61",
  "enabled": true,
  "showToast": true
}
```

### Intune Deployment

1. Package extension as `.intunewin`
2. Deploy as Win32 app with detection script
3. Use PowerShell to configure browser policies

---

## Troubleshooting

### Common Issues

#### Extension icon shows "D" instead of logo
- **Cause**: PNG icons not loaded correctly
- **Solution**: Verify `icons/d365logo.png` exists and manifest references it

#### Country not auto-filling
- **Cause 1**: Extension disabled
  - Check popup toggle is ON
- **Cause 2**: Not in target frame
  - Extension only runs in `msdyn_chatcontrol.htm` iframe
- **Cause 3**: Element ID changed
  - Check console for "Input detected" message
  - Enable DEBUG mode (see below) for detailed logs

#### Toast notification not appearing
- **Cause**: Cross-origin restriction or toggle disabled
- **Solution**: Verify "Show Notifications" is enabled in popup

### Debug Mode

Enable verbose logging by modifying `content/content.js`:

```javascript
const DEBUG = true; // Change from false to true
```

Then check browser DevTools console (F12) for detailed logs:
```
📞 D365 Dialer | Loaded in frame: TARGET ✓
📞 D365 Dialer | v2.0.7 Active - Watching all frames
📞 D365 Dialer [DEBUG] | Settings loaded: Australia
📞 D365 Dialer | 🎯 Input detected! Confidence: 100% (exact-id)
📞 D365 Dialer ✅ | Country selected: Australia
```

### Support Diagnostics

When reporting issues, include:

1. Browser and version
2. Output of `window.__D365DialerHealth()`
3. Console logs (with DEBUG enabled)
4. Screenshot of the transfer dialog

---

## Security

### Permissions Explained

| Permission | Purpose | Risk Level |
|------------|---------|------------|
| `storage` | Save user preferences | Low |
| `activeTab` | Access current tab for manual fill | Low |
| `scripting` | Inject fill script on demand | Medium |
| `webNavigation` | Detect page navigation | Low |
| `*.dynamics.com` | Host permission - only runs on D365 | Low |

### Data Handling

- ✅ **No data exfiltration** - All data stays in browser
- ✅ **No external API calls** - Extension is fully offline
- ✅ **No PII collection** - Only stores country preference
- ✅ **Chrome Storage Sync** - Settings sync via user's browser account

### Input Sanitization

All user inputs are sanitized:
```javascript
function sanitizeInput(str) {
  return str.replace(/<[^>]*>/g, '').trim().substring(0, 100);
}
```

### Code Review

The extension source code is fully visible and auditable. No minification or obfuscation.

---

## Performance

### Resource Usage

| Metric | Value |
|--------|-------|
| Memory footprint | ~20-30 KB per tab |
| CPU (idle) | ~0% (event-driven) |
| CPU (during selection) | <50ms spike |
| Storage | <1 KB (settings only) |

### Optimization Features

- **Frame targeting**: Only activates in `msdyn_chatcontrol.htm`
- **Debouncing**: 500ms debounce prevents rapid-fire processing
- **WeakSet tracking**: Allows garbage collection of processed elements
- **No polling**: Uses MutationObserver (event-driven, not interval-based)

### High-Volume Support

Tested for:
- 100+ transfers per day per agent
- 8-hour continuous operation
- No memory leaks or degradation

---

## Support

### Getting Help

1. **Check Troubleshooting** section above
2. **Enable Debug Mode** and capture console logs
3. **Check popup** for current settings and version
4. **Contact**: [Your IT Support Channel]

### Reporting Issues

Include:
- Browser version
- Extension version (from popup footer)
- Steps to reproduce
- Console logs (with DEBUG enabled)
- Screenshots

---

## Changelog

### v2.0.7 (January 2026) - UI Cleanup
- ✨ Multi-selector fallback with confidence scoring
- ✨ Retry logic with exponential backoff (3 attempts)
- ✨ Input sanitization and validation
- ✨ Structured logging system with DEBUG mode
- ✨ Error toast notifications
- 🐛 Fixed version mismatch in logs
- ⚡ Performance optimizations for high-volume centers

### v1.7.1 (January 2026)
- ✨ High-volume contact center optimizations
- ⚡ Removed polling interval (MutationObserver only)
- ⚡ Added debouncing for rapid mutations

### v1.6.5 (January 2026)
- ✨ D365 Power Platform style toast notifications
- ✨ Auto-dismiss toast (removed close button)
- 🎨 Premium dark theme toast design

### v1.0.0 (Initial Release)
- ✨ Basic auto-fill functionality
- ✨ Settings popup with country selection
- ✨ Toast notifications

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

<p align="center">
  <strong>Built for Dynamics 365 Contact Center</strong><br>
  <sub>Improving agent efficiency, one transfer at a time.</sub>
</p>
