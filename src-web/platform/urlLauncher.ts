/**
 * Abstraction for opening URLs in the system browser.
 * On Tauri: uses @tauri-apps/plugin-shell open() to avoid opening in the embedded webview.
 * On web: uses window.open with noopener/noreferrer.
 *
 * This module is URL-agnostic — it accepts any string and has no knowledge of registry URLs.
 */
export interface UrlLauncher {
  open(url: string): Promise<void>;
}

class WebUrlLauncher implements UrlLauncher {
  async open(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

class TauriUrlLauncher implements UrlLauncher {
  async open(url: string): Promise<void> {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  }
}

/**
 * Detect environment and return the appropriate UrlLauncher implementation.
 * Accepts an override for testability (dependency injection).
 */
export function createUrlLauncher(override?: UrlLauncher): UrlLauncher {
  if (override) return override;

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return new TauriUrlLauncher();
  }

  return new WebUrlLauncher();
}
