// ---------------------------------------------------------------------------
// Official NodeDef sync — downloads registry-hosted official NodeDefs
// and stamps them with source:'remote-official' in the lockfile.
// ---------------------------------------------------------------------------

import type { FileSystem } from '@/platform/fileSystem';
import type { LockfileData } from './lockfile';
import { downloadAndInstallNodeDef } from './installer';
import { browseRegistry, checkUpdatesRemote, fetchNodeDefDetail } from './remoteRegistry';

const OFFICIAL_NAMESPACES = [
  'compute', 'data', 'messaging', 'network', 'client',
  'integration', 'security', 'observability', 'ai',
] as const;

/**
 * Sync official NodeDefs from the registry to local disk.
 *
 * Branch A (no remote-official entries in lockfile): fetches all 9 namespaces.
 * Branch B (remote-official entries exist): delta-checks and downloads only updates.
 *
 * All network errors are swallowed — offline/network-down is silent.
 * Returns true if any downloads happened, false if nothing changed.
 * Caller should call reloadProjectLocal only if this returns true.
 */
export async function syncOfficialNodeDefs(
  fs: FileSystem,
  projectRoot: string,
  lockfile: LockfileData | null,
  signal?: AbortSignal,
): Promise<boolean> {
  let anyDownloaded = false;
  try {
    const officialEntries = lockfile
      ? Object.entries(lockfile.entries)
          .filter(([key, e]) => e.source === 'remote-official' && key.split('/').length === 2)
          .map(([key]) => {
            const [namespace, name] = key.split('/');
            return { namespace: namespace!, name: name! };
          })
      : [];

    if (officialEntries.length === 0) {
      // Branch A: first-time hydration — fetch all 9 namespaces
      for (const namespace of OFFICIAL_NAMESPACES) {
        try {
          const { items } = await browseRegistry({ namespace }, signal);
          for (const summary of items) {
            try {
              await downloadAndInstallNodeDef(fs, projectRoot, summary, 'remote-official');
              anyDownloaded = true;
            } catch {
              // Per-item errors are swallowed — continue with remaining items
            }
          }
        } catch {
          // Per-namespace errors are swallowed — continue with remaining namespaces
        }
      }
    } else {
      // Branch B: delta update — check only what changed
      const changed = await checkUpdatesRemote(officialEntries, signal);
      for (const update of changed) {
        try {
          const installedVersion = lockfile?.entries[`${update.namespace}/${update.name}`]?.version;
          if (installedVersion && update.latestVersion === installedVersion) continue; // already up-to-date
          const detail = await fetchNodeDefDetail(update.namespace, update.name, update.latestVersion, signal);
          await downloadAndInstallNodeDef(fs, projectRoot, detail.nodedef, 'remote-official');
          anyDownloaded = true;
        } catch {
          // Per-entry errors are swallowed
        }
      }
    }
  } catch {
    // Top-level catch — swallow all errors (offline/network-down is silent)
  }
  return anyDownloaded;
}
