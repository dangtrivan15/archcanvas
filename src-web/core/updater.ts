import { useUpdaterStore } from '@/store/updaterStore';
import { useFileStore } from '@/store/fileStore';
import { persistProjectForRestore } from '@/core/restoreProject';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Cached reference to the pending update, used by downloadAndInstall. */
let pendingUpdate: { version: string; downloadAndInstall: () => Promise<void> } | null = null;

/**
 * Check GitHub Releases for a newer version.
 * No-op outside the Tauri desktop environment.
 */
export async function checkForUpdate(): Promise<void> {
  if (!isTauri()) return;

  const store = useUpdaterStore.getState();
  store.setStatus('checking');

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (update) {
      pendingUpdate = update;
      store.setUpdateAvailable(update.version);
    } else {
      pendingUpdate = null;
      store.setStatus('up-to-date');
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Download and install the pending update.
 * Call only after checkForUpdate() found an update.
 */
export async function downloadAndInstall(): Promise<void> {
  if (!pendingUpdate) return;

  const store = useUpdaterStore.getState();
  store.setStatus('downloading');

  try {
    await pendingUpdate.downloadAndInstall();
    store.setStatus('ready-to-restart');
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Restart the app to apply the downloaded update.
 *
 * A 200ms delay is inserted between persist and relaunch to allow
 * localStorage writes to flush to disk. WebView2 (Windows) and
 * WKWebView (macOS) buffer storage writes asynchronously — without
 * the delay, tauriRelaunch() can kill the process before the write
 * is committed.
 */
export async function relaunch(): Promise<void> {
  if (!isTauri()) return;
  persistProjectForRestore(useFileStore.getState().projectPath);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const { relaunch: tauriRelaunch } = await import('@tauri-apps/plugin-process');
  await tauriRelaunch();
}
