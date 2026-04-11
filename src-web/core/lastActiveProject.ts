// ---------------------------------------------------------------------------
// lastActiveProject – persist the last-opened project path for desktop restart
//
// Unlike restoreProject.ts (which handles update-triggered relaunches with
// consume-on-read semantics and a 15-minute staleness guard), this module
// simply records which project was last active. It is read-only (not consumed),
// has no staleness guard, and persists until overwritten — so that closing
// and re-opening the desktop app days later still returns the user to their
// project.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'archcanvas:lastActiveProject';

/**
 * Record the currently active project path.
 *
 * Called on every successful project load. No-op when `projectPath` is
 * null/empty (Web filesystem) or localStorage is unavailable.
 */
export function setLastActiveProject(projectPath: string | null): void {
  if (!projectPath) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: projectPath }));
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}

/**
 * Retrieve the last active project path.
 *
 * Unlike `consumeRestoreEntry()`, this does **not** delete the entry —
 * the value persists until overwritten by the next project load.
 * Returns `null` if no entry exists or the entry is malformed.
 */
export function getLastActiveProject(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { path: string }).path !== 'string'
    ) {
      return null;
    }

    const { path } = parsed as { path: string };
    return path || null; // reject empty strings
  } catch {
    // localStorage unavailable or corrupted JSON — nothing to restore
    return null;
  }
}

/**
 * Clear the last active project entry.
 *
 * Called when a stored path points to a directory that no longer exists,
 * preventing an infinite retry loop on startup.
 */
export function clearLastActiveProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — silently ignore
  }
}
