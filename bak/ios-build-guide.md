# ArchCanvas iOS Build Guide

## Overview

ArchCanvas uses [Capacitor](https://capacitorjs.com/) to wrap the React web app as a native iOS application. The web app is built with Vite, then synced into the Xcode project which handles code signing and distribution.

## Prerequisites

- **Node.js 20+** and **npm 10+**
- **Xcode 15+** (with iOS 16+ SDK)
- **Apple Developer Account** (free for device testing, paid for App Store)
- **macOS** (required for iOS builds)

## Project Structure

```
ios/
  App/
    App/                    # iOS app source
      AppDelegate.swift     # App lifecycle delegate
      Info.plist            # App configuration
      Assets.xcassets/      # App icons and assets
      public/               # Synced web assets (from dist/)
      capacitor.config.json # Generated Capacitor config
    App.xcodeproj/          # Xcode project
    CapApp-SPM/             # Swift Package Manager dependencies
  debug.xcconfig            # Debug-only Capacitor flag
```

## Build Configurations

| Setting | Debug | Release |
|---------|-------|---------|
| Code Signing | Automatic | Automatic |
| iOS Deployment Target | 16.0 | 16.0 |
| Swift Optimization | `-Onone` | `-O` (whole module) |
| Debug Symbols | DWARF | DWARF + dSYM |
| Assertions | Enabled | Disabled |
| Product Validation | No | Yes |
| Capacitor Debug | `true` | Not set |

## Development Workflow

### 1. Running on Simulator/Device with Live Reload

```bash
# Start the Vite dev server + launch on iOS Simulator with live reload
npm run dev:ios
```

This sets `CAPACITOR_DEV=true`, which configures Capacitor to load from
the Vite dev server (`localhost:5173`) instead of bundled assets.

### 2. Running a Production Build on Device

```bash
# Build web app and sync to iOS
npm run build:ios

# Open in Xcode and run on device
npm run cap:open:ios
# In Xcode: Select device > Product > Run (Cmd+R)
```

## Release Build (App Store / TestFlight)

### Quick Start

```bash
# Automated: Build, validate, and optionally open Xcode
./scripts/build-release-ios.sh --open
```

### Manual Steps

#### Step 1: Build the Web App

```bash
npm run build:release
```

This runs TypeScript compilation, Vite production build, and syncs to iOS.
The `CAPACITOR_DEV` env var must NOT be set.

#### Step 2: Configure Code Signing in Xcode

1. Open Xcode: `npm run cap:open:ios`
2. Select the **App** target in the project navigator
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** (Apple Developer account)
6. Xcode will create/download the required provisioning profiles

> **First time setup:** You may need to add your Apple ID in
> Xcode > Settings > Accounts, then select your team.

#### Step 3: Create an Archive

1. In Xcode, select scheme: **App** (or **ArchCanvas**)
2. Set destination to: **Any iOS Device (arm64)**
   - Archives cannot target a simulator
3. Menu: **Product > Archive** (or `Cmd+Shift+B` for build, then Archive)
4. Wait for the archive to complete

#### Step 4: Distribute the App

After archiving, the **Organizer** window opens:

**For TestFlight (internal testing):**
1. Select the archive > **Distribute App**
2. Choose **App Store Connect**
3. Select **Upload**
4. Follow the prompts (Xcode handles signing automatically)
5. After upload, go to [App Store Connect](https://appstoreconnect.apple.com)
6. Add testers to the TestFlight build

**For Ad Hoc (direct device install):**
1. Select the archive > **Distribute App**
2. Choose **Ad Hoc**
3. Select devices (from registered device list)
4. Export the .ipa file
5. Install via Xcode Devices, Apple Configurator, or Finder

**For App Store:**
1. Select the archive > **Distribute App**
2. Choose **App Store Connect**
3. Select **Upload**
4. Complete the app listing in App Store Connect
5. Submit for review

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev:ios` | Live reload on iOS device/simulator |
| `npm run build:ios` | Build web + sync to iOS project |
| `npm run build:release` | Full production build + iOS sync |
| `npm run cap:sync` | Sync web assets to all platforms |
| `npm run cap:open:ios` | Open iOS project in Xcode |
| `npm run cap:run` | Run on iOS device (no live reload) |

## Troubleshooting

### "No signing certificate found"
- Open Xcode > Settings > Accounts
- Add your Apple ID
- Download certificates: Manage Certificates > "+" > Apple Development

### "Provisioning profile not found"
- In Xcode target > Signing & Capabilities
- Uncheck then re-check "Automatically manage signing"
- Select your team

### Archive is greyed out
- Ensure destination is set to "Any iOS Device" (not a simulator)
- Ensure you have a valid signing identity

### App shows blank screen after install
- Run `npm run build:release` to ensure web assets are fresh
- Check that `ios/App/App/public/index.html` exists
- Verify `CAPACITOR_DEV` is NOT set during build

### Build fails with "duplicate symbols"
- Run `npm run cap:sync` to refresh native plugins
- Clean Xcode build: Product > Clean Build Folder (Cmd+Shift+K)

## Version Management

Update version numbers before each release:

1. **package.json**: Update `"version"` field
2. **Xcode project**: Update `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`
   - Or in Xcode: Target > General > Identity section

The `MARKETING_VERSION` (e.g., "1.0") is the user-visible version.
The `CURRENT_PROJECT_VERSION` (e.g., "1") is the build number (increment for each upload).
