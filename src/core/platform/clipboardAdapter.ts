/**
 * ClipboardAdapter — Platform-agnostic clipboard access.
 *
 * Wraps navigator.clipboard.writeText() on web and @capacitor/clipboard
 * on native (iOS). Provides a consistent API so clipboard operations work
 * seamlessly on both platforms.
 *
 * Web fallback: textarea + document.execCommand('copy') for non-secure
 * contexts (e.g. HTTP without HTTPS).
 *
 * Use getClipboardAdapter() to obtain the correct implementation
 * for the current runtime platform.
 */

import { isNative } from './platformBridge';

// ─── Interface ──────────────────────────────────────────────────

/**
 * Platform-agnostic clipboard adapter.
 */
export interface ClipboardAdapter {
  /**
   * Copy text to the system clipboard.
   * @param text - The text string to copy
   */
  copyText(text: string): Promise<void>;
}

// ─── Web Implementation ─────────────────────────────────────────

/**
 * Web clipboard adapter using navigator.clipboard API
 * with textarea + execCommand('copy') fallback for non-secure contexts.
 */
export class WebClipboardAdapter implements ClipboardAdapter {
  async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts (HTTP, iframe restrictions, etc.)
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Prevent scroll jump
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }
}

// ─── Native Implementation ──────────────────────────────────────

/**
 * Native clipboard adapter using @capacitor/clipboard plugin.
 * Used when running inside a Capacitor native shell (iOS WKWebView).
 */
export class NativeClipboardAdapter implements ClipboardAdapter {
  async copyText(text: string): Promise<void> {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
  }
}

// ─── Factory ────────────────────────────────────────────────────

let _adapter: ClipboardAdapter | null = null;

/**
 * Returns the ClipboardAdapter for the current platform.
 *
 * - Web browser → WebClipboardAdapter (navigator.clipboard + execCommand fallback)
 * - Capacitor iOS → NativeClipboardAdapter (@capacitor/clipboard)
 *
 * The adapter is lazily created and cached for the lifetime of the app.
 */
export function getClipboardAdapter(): ClipboardAdapter {
  if (_adapter) return _adapter;

  if (isNative()) {
    _adapter = new NativeClipboardAdapter();
  } else {
    _adapter = new WebClipboardAdapter();
  }

  return _adapter;
}

/**
 * Reset the cached adapter (useful for testing).
 * @internal
 */
export function _resetClipboardAdapter(): void {
  _adapter = null;
}
