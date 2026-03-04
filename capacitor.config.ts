import type { CapacitorConfig } from '@capacitor/cli';

// Use CAPACITOR_DEV=true to enable live reload from Vite dev server.
// This is only for iOS simulator/device development — production builds
// serve from the bundled dist/ directory with no server URL.
const isCapacitorDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.archcanvas.app',
  appName: 'ArchCanvas',
  webDir: 'dist',

  ios: {
    // Build scheme matching the Xcode target
    scheme: 'ArchCanvas',
    // Disable link previews for a native app feel (no peek/pop on links)
    allowsLinkPreview: false,
    // Disable scroll bounce — React Flow handles its own pan/zoom
    scrollEnabled: false,
    // Use mobile content mode for consistent rendering
    preferredContentMode: 'mobile',
    // Never adjust content inset — app manages its own safe areas
    contentInset: 'never',
  },

  server: {
    // When CAPACITOR_DEV=true, load from the Vite dev server for live reload.
    // The --external flag on `cap run` resolves the machine's LAN IP automatically,
    // so we only need localhost here as a base — Capacitor CLI rewrites it.
    ...(isCapacitorDev
      ? {
          url: 'http://localhost:5173',
          cleartext: true,
        }
      : {}),
    // Allow navigation to the app's own origin only
    allowNavigation: ['localhost'],
  },
};

export default config;
