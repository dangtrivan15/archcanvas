/**
 * Bring the current Tauri window to the foreground.
 *
 * This is a best-effort operation — the OS may block focus-stealing
 * depending on platform policy. Errors are silently swallowed so callers
 * can fire-and-forget without try/catch.
 *
 * No-op outside the Tauri desktop environment.
 */
export async function focusCurrentWindow(): Promise<void> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFocus();
  } catch {
    // Silent failure — focus is best-effort
  }
}
