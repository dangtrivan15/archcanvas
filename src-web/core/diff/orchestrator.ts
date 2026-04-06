/**
 * Diff orchestrator — ties git baseline reading, diff engine, and diffStore together.
 *
 * This is the main entry point for triggering a diff from UI code.
 */

import { useFileStore } from '@/store/fileStore';
import { useDiffStore } from '@/store/diffStore';
import { readGitBaseline, isGitRepo } from './gitBaseline';

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
    diffStore.clear();
    return false;
  }

  // Resolve project path
  const path = projectPath ?? fs.getPath();
  if (!path) {
    // Web environment without a filesystem path — can't run git commands
    diffStore.clear();
    return false;
  }

  // Check if it's a git repo
  const isRepo = await isGitRepo(path);
  if (!isRepo) {
    diffStore.clear();
    return false;
  }

  try {
    useDiffStore.setState({ loading: true, error: null });

    const baseline = await readGitBaseline(path, ref, fs);

    if (baseline.canvases.size === 0) {
      // No baseline data found (maybe first commit)
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
export async function toggleDiffOverlay(): Promise<void> {
  const { enabled } = useDiffStore.getState();

  if (enabled) {
    useDiffStore.getState().disable();
  } else {
    const success = await runGitDiff('HEAD');
    if (!success) {
      // If git diff failed, still enable with empty state so user sees
      // the toolbar button is toggled (they'll see the error in status bar)
      useDiffStore.getState().enable();
    }
  }
}
