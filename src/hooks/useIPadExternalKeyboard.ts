/**
 * iPad External Keyboard Support Hook.
 *
 * When an external keyboard (Magic Keyboard, Smart Keyboard Folio) is connected
 * to an iPad running the app in Capacitor's WKWebView, certain Cmd+key shortcuts
 * may be intercepted by WKWebView's native handler before JavaScript sees them.
 *
 * This hook adds a **capture-phase** keydown listener that calls preventDefault()
 * on shortcuts we handle, ensuring WKWebView's native behavior is suppressed
 * (e.g., built-in undo/redo, select-all, bold/italic in text fields).
 *
 * The capture phase fires before the bubble phase used by useKeyboardShortcuts,
 * so the shortcut still reaches our normal handler — we only prevent the *default*
 * browser/native action, not event propagation.
 *
 * This hook is active on iPad and Mac platforms. On Windows/Linux it's a no-op.
 *
 * Known iOS system shortcuts that CANNOT be overridden (handled at OS level):
 *   - Cmd+Space  → Spotlight Search
 *   - Cmd+Tab    → App Switcher
 *   - Cmd+H      → Home Screen
 *   - Globe+key  → System actions (Globe+C = Control Center, etc.)
 *   - Cmd+Shift+3/4 → Screenshots
 */

import { useEffect } from 'react';
import { getCurrentPlatform, isCmdPlatform } from '@/core/input';
import { isActiveElementTextInput } from '@/core/input/focusZones';

/**
 * Set of Cmd+key combinations that WKWebView might intercept.
 * We must preventDefault in capture phase for these.
 * Only active when the platform modifier (Cmd) is held.
 */
const INTERCEPTED_CMD_KEYS = new Set([
  's',          // Save (WKWebView has no save, but prevent any default)
  'z',          // Undo (WKWebView built-in undo)
  'y',          // Redo alternate (some iOS contexts)
  'n',          // New (WKWebView might open new window in some configs)
  'o',          // Open (prevent any file dialog)
  'k',          // Command palette
  'd',          // Duplicate (prevent bookmark dialog)
  'a',          // Select all (WKWebView native select-all)
  'b',          // Bold (WKWebView rich text)
  'i',          // Italic (WKWebView rich text)
  'u',          // Underline (WKWebView rich text)
  '0',          // Fit view / zoom reset
  '1',          // Zoom 100%
  '=',          // Zoom in
  '+',          // Zoom in (shifted =)
  '-',          // Zoom out
]);

/**
 * Set of Cmd+Shift+key combinations to intercept.
 */
const INTERCEPTED_CMD_SHIFT_KEYS = new Set([
  'z',          // Redo (Cmd+Shift+Z)
  's',          // Save As (Cmd+Shift+S)
  'a',          // Select All Edges (Cmd+Shift+A)
]);

/**
 * Capture-phase keydown handler.
 * Calls preventDefault() on shortcuts that WKWebView/iOS might intercept,
 * but does NOT stopPropagation — the event still reaches our bubble-phase
 * handler in useKeyboardShortcuts.
 */
function capturePhaseHandler(e: KeyboardEvent): void {
  // Only intercept when the platform modifier (Cmd on Mac/iPad) is held
  const platform = getCurrentPlatform();
  if (!isCmdPlatform(platform)) return;

  // Check for Cmd key (metaKey on Mac/iPad)
  if (!e.metaKey) return;

  const key = e.key.toLowerCase();

  // Cmd+Shift+key combinations
  if (e.shiftKey && INTERCEPTED_CMD_SHIFT_KEYS.has(key)) {
    e.preventDefault();
    return;
  }

  // Cmd+key combinations (no shift)
  if (!e.shiftKey && INTERCEPTED_CMD_KEYS.has(key)) {
    // Special case: Allow Cmd+B/I/U in text inputs for native text formatting
    // unless the app explicitly handles them
    if ((key === 'b' || key === 'i' || key === 'u') && isActiveElementTextInput()) {
      // Let WKWebView handle bold/italic/underline in text fields
      return;
    }

    e.preventDefault();
    return;
  }

  // Also intercept Cmd+Shift+= (zoom in with shift on some keyboards)
  if (e.shiftKey && (key === '=' || key === '+')) {
    e.preventDefault();
    return;
  }
}

/**
 * Hook that installs capture-phase keyboard event interception for iPad/Mac.
 *
 * On iPad with an external keyboard in Capacitor's WKWebView, certain Cmd+key
 * shortcuts (Cmd+Z undo, Cmd+A select-all, Cmd+B bold, etc.) may be intercepted
 * by WKWebView's native UIKit responder chain before JavaScript processes them.
 *
 * This hook prevents that by calling `preventDefault()` in the capture phase
 * (which fires before the bubble phase used by useKeyboardShortcuts).
 * Event propagation is NOT stopped, so our normal shortcut handler still fires.
 *
 * The hook is active on Mac and iPad platforms (both use Cmd as primary modifier).
 * On Windows/Linux, it's a no-op.
 *
 * @example
 * ```tsx
 * function App() {
 *   useIPadExternalKeyboard(); // Must be before useKeyboardShortcuts
 *   useKeyboardShortcuts();
 *   // ...
 * }
 * ```
 */
export function useIPadExternalKeyboard(): void {
  useEffect(() => {
    const platform = getCurrentPlatform();
    if (!isCmdPlatform(platform)) {
      return; // No-op on Windows/Linux
    }

    // Capture phase = fires BEFORE bubble phase
    document.addEventListener('keydown', capturePhaseHandler, { capture: true });
    return () => {
      document.removeEventListener('keydown', capturePhaseHandler, { capture: true });
    };
  }, []);
}

// ── Exported for testing ──────────────────────────────────────────

export { capturePhaseHandler as _capturePhaseHandlerForTesting };

/**
 * iOS System Keyboard Shortcuts (cannot be overridden by web apps):
 *
 * | Shortcut        | Action              |
 * |-----------------|---------------------|
 * | Cmd+Space       | Spotlight Search    |
 * | Cmd+Tab         | App Switcher        |
 * | Cmd+H           | Home Screen         |
 * | Cmd+Shift+3     | Screenshot          |
 * | Cmd+Shift+4     | Screenshot (region) |
 * | Globe+C         | Control Center      |
 * | Globe+N         | Notification Center |
 * | Globe+A         | Dock                |
 * | Globe+Q         | Quick Note          |
 *
 * These are handled at the iOS system level before the app receives them.
 * ArchCanvas cannot intercept or override these shortcuts.
 */
