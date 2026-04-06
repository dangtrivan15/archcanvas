/**
 * Diff orchestrator — ties git baseline reading, diff engine, and diffStore together.
 *
 * This is the main entry point for triggering a diff from UI code.
 */

import { useFileStore } from '@/store/fileStore';
import { useDiffStore } from '@/store/diffStore';
import { readGitBaseline, isGitRepo } from './gitBaseline';

/**
 * Whether the current platform can run git commands (Tauri or Node.js).
 * Use this to hide diff UI on platforms where it can't work (e.g. web browser).
 */
export function canUseDiff(): boolean {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return true;
  if (typeof process !== 'undefined' && process.versions?.node) return true;
  return false;
}

/**
 * Run a diff against a git ref. Returns true on success, false on failure.
 *
 * Reads base canvas data from the git ref, then delegates to diffStore
 * to compute and store the diff.
 */
export async function runGitDiff(ref: string = 'HEAD'): Promise<boolean> {
  const { projectPath, fs } = useFileStore.getState();
  const diffStore = useDiffStore.getState();

  if (!fs) {
    useDiffStore.setState({ error: 'No filesystem available — open a project first' });
    return false;
  }

  // Resolve project path
  const path = projectPath ?? fs.getPath();
  if (!path) {
    useDiffStore.setState({ error: 'No project path — the web environment cannot run git commands' });
    return false;
  }

  try {
    useDiffStore.setState({ loading: true, error: null });

    // Check if it's a git repo (throws on unexpected failures like missing shell scope)
    const isRepo = await isGitRepo(path);
    if (!isRepo) {
      useDiffStore.setState({ loading: false, error: `"${path}" is not inside a git repository` });
      return false;
    }

    const baseline = await readGitBaseline(path, ref, fs);

    if (baseline.canvases.size === 0) {
      useDiffStore.setState({
        loading: false,
        error: 'No baseline data found in git ref: ' + ref,
      });
      return false;
    }

    diffStore.computeFromCanvases(baseline.canvases, ref);
    return true;
  } catch (err) {
    useDiffStore.setState({
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Toggle diff overlay. If enabling, runs git diff against HEAD.
 * If disabling, clears the diff state.
 */
/** Auto-clear error after a delay so the status bar badge doesn't stick forever. */
function scheduleErrorClear(ms = 5000) {
  setTimeout(() => {
    const { enabled, error } = useDiffStore.getState();
    // Only clear if diff is still off — don't wipe an active diff's error
    if (!enabled && error) {
      useDiffStore.setState({ error: null });
    }
  }, ms);
}

export async function toggleDiffOverlay(): Promise<void> {
  if (!canUseDiff()) {
    alert('Git Diff Overlay is only available in the ArchCanvas desktop app.');
    return;
  }

  const { enabled } = useDiffStore.getState();

  if (enabled) {
    useDiffStore.getState().disable();
  } else {
    const success = await runGitDiff('HEAD');
    // If runGitDiff succeeded, diffStore.enabled is already true (set by computeFromCanvases).
    // If it failed, diffStore.error has the reason — don't enable the empty overlay.
    if (!success) {
      scheduleErrorClear();
    }
  }
}
