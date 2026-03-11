import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ThemeProvider } from '@/theme';
import './index.css';

// Register PWA service worker for offline support.
// autoUpdate mode: new SW activates immediately without prompting.
// updateSW can be called to trigger a reload when a new SW is available
// Side-effect: registers the SW and sets up auto-update
registerSW({
  onNeedRefresh() {
    // Auto-update: new version detected, will activate on next load
    console.log('[PWA] New content available; will activate on next reload.');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use.');
  },
  onRegisteredSW(swUrl, registration) {
    console.log(`[PWA] Service worker registered: ${swUrl}`);
    // Check for SW updates every hour
    if (registration) {
      setInterval(
        () => {
          registration.update();
        },
        60 * 60 * 1000,
      );
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
