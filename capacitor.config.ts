import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

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
    // During development, load from the Vite dev server for live reload
    ...(isDev
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
