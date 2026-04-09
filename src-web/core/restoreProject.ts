// ---------------------------------------------------------------------------
// restoreProject – persist & restore the active project path across updates
//
// Before Tauri's relaunch() during an app update, we write the current project
// path to localStorage. On the next startup, ProjectGate reads and deletes
// the entry (consume-on-read) so the user is seamlessly returned to their
// project without manual re-opening.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'archcanvas:restoreProject';

/** Maximum age (ms) before a restore entry is considered stale. */
const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

interface RestoreEntry {
  path: string;
  timestamp: number;
}

/**
 * Persist the current project path so the next launch can restore it.
 *
 * No-op when `projectPath` is null/empty or localStorage is unavailable.
 */
export function persistProjectForRestore(projectPath: string | null): void {
  if (!projectPath) return;
  try {
    const entry: RestoreEntry = { path: projectPath, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
}

/**
 * Read and immediately delete the restore entry (consume-on-read).
 *
 * Returns the project path if the entry exists, is valid JSON with the
 * expected shape, and is younger than `MAX_AGE_MS`. Otherwise returns `null`.
 */
export function consumeRestoreEntry(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Always remove, even if we end up discarding the value
    localStorage.removeItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as RestoreEntry).path !== 'string' ||
      typeof (parsed as RestoreEntry).timestamp !== 'number'
    ) {
      return null;
    }

    const entry = parsed as RestoreEntry;
    if (!entry.path) return null;
    if (Date.now() - entry.timestamp > MAX_AGE_MS) return null;

    return entry.path;
  } catch {
    // localStorage unavailable or corrupted JSON — nothing to restore
    return null;
  }
}
