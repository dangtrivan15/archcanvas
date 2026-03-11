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

  plugins: {
    // @capacitor/app — custom URL scheme for deep linking
    App: {
      // Register archcanvas:// URL scheme so other apps can open files via
      // archcanvas://open?file=<path> or archcanvas://file/<path>
      url: 'archcanvas',
    },

    // @capacitor/splash-screen — polished launch experience
    SplashScreen: {
      // Use the native launch storyboard (LaunchScreen.storyboard) which references
      // the Splash image set in Assets.xcassets (supports light/dark appearance).
      launchShowDuration: 0, // Don't auto-hide on a fixed timer
      launchAutoHide: false, // We manually hide after the app is interactive
      launchFadeOutDuration: 300, // Smooth 300ms fade-out transition
      backgroundColor: '#1a1a2e', // Dark theme background (matches splash image)
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false, // Clean launch — no spinner
      splashFullScreen: true, // Cover the full screen including status bar
      splashImmersive: true, // Immersive mode for a clean launch experience
    },
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
