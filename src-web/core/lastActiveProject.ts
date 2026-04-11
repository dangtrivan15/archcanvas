// ---------------------------------------------------------------------------
// lastActiveProject – persist & restore the last-opened project on startup
//
// On every successful project load (not on close — more reliable since it
// survives crashes and force-quit), we write the project path to localStorage.
// On the next startup, ProjectGate reads the entry (without consuming it) and
// auto-opens the project. This is Tauri-only — web browser users are unaffected.
//
// Unlike restoreProject.ts (consume-on-read, 15-min staleness window), this
// module uses read-only semantics with no staleness guard, since the user's
// last active project is always relevant regardless of how long ago the app
// was closed.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'archcanvas:lastActiveProject';

/**
 * Persist the current project path so the next launch can restore it.
 *
 * Called after every successful project load (openProject / completeOnboarding).
 * No-op when `projectPath` is null/empty or localStorage is unavailable.
 */
export function persistLastActiveProject(projectPath: string | null): void {
  if (!projectPath) return;
  try {
    localStorage.setItem(STORAGE_KEY, projectPath);
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}

/**
 * Read the last active project path (read-only — does NOT remove the entry).
 *
 * Returns the stored path string if present and non-empty, otherwise `null`.
 */
export function getLastActiveProject(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value || null;
  } catch {
    // localStorage unavailable — nothing to restore
    return null;
  }
}

/**
 * Remove the last active project entry.
 *
 * Useful for explicit "close project" flows or testing.
 */
export function clearLastActiveProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — silently ignore
  }
}
