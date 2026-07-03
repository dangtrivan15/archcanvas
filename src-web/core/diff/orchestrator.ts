/**
 * Diff orchestrator — ties GitProvider baseline reading, the diff engine,
 * and diffStore together. The single entry point for triggering a diff.
 */

import { useFileStore } from '@/store/fileStore';
import { useDiffStore } from '@/store/diffStore';
import { createGitProvider } from '@/platform';
import { readGitBaseline } from './gitBaseline';

/** Recompute whether the diff feature is available (a .git is exposed). */
export async function refreshDiffAvailability(): Promise<void> {
  const { fs } = useFileStore.getState();
  if (!fs) {
    useDiffStore.getState().setAvailable(false);
    return;
  }
  try {
    const available = await createGitProvider(fs).isRepository();
    useDiffStore.getState().setAvailable(available);
  } catch {
    useDiffStore.getState().setAvailable(false);
  }
}

export async function runGitDiff(ref: string = 'HEAD'): Promise<boolean> {
  const { fs } = useFileStore.getState();
  const diffStore = useDiffStore.getState();

  if (!fs) {
    useDiffStore.setState({ error: 'No filesystem available — open a project first' });
    return false;
  }

  try {
    useDiffStore.setState({ loading: true, error: null });

    const git = createGitProvider(fs);
    if (!(await git.isRepository())) {
      useDiffStore.setState({ loading: false, error: 'This project is not inside a git repository' });
      return false;
    }

    const baseline = await readGitBaseline(ref, git, fs);
    if (baseline.canvases.size === 0) {
      useDiffStore.setState({ loading: false, error: 'No baseline data found in git ref: ' + ref });
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

function scheduleErrorClear(ms = 5000) {
  setTimeout(() => {
    const { enabled, error } = useDiffStore.getState();
    if (!enabled && error) {
      useDiffStore.setState({ error: null });
    }
  }, ms);
}

export async function toggleDiffOverlay(): Promise<void> {
  const { available } = useDiffStore.getState();
  if (!available) return; // UI hides the control; this is a defensive no-op

  const { enabled } = useDiffStore.getState();
  if (enabled) {
    useDiffStore.getState().disable();
  } else {
    const success = await runGitDiff('HEAD');
    if (!success) scheduleErrorClear();
  }
}
