// ---------------------------------------------------------------------------
// Official NodeDef sync — downloads registry-hosted official NodeDefs
// and stamps them with source:'remote-official' in the lockfile.
// ---------------------------------------------------------------------------

import type { FileSystem } from '@/platform/fileSystem';
import type { LockfileData } from './lockfile';
import { downloadAndInstallNodeDef } from './installer';
import { browseRegistry, checkUpdatesRemote } from './remoteRegistry';

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
 * Caller is responsible for calling reloadProjectLocal after this resolves.
 */
export async function syncOfficialNodeDefs(
  fs: FileSystem,
  projectRoot: string,
  lockfile: LockfileData | null,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const officialEntries = lockfile
      ? Object.entries(lockfile.entries)
          .filter(([, e]) => e.source === 'remote-official')
          .map(([key]) => {
            const [namespace, name] = key.split('/');
            return { namespace, name };
          })
      : [];

    if (officialEntries.length === 0) {
      // Branch A: first-time hydration — fetch all 9 namespaces
      for (const namespace of OFFICIAL_NAMESPACES) {
        try {
          const { items } = await browseRegistry({ namespace }, signal);
          for (const summary of items) {
            await downloadAndInstallNodeDef(fs, projectRoot, summary, 'remote-official');
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
          const { items } = await browseRegistry({ namespace: update.namespace }, signal);
          const summary = items.find(
            (item) => item.namespace === update.namespace && item.name === update.name,
          );
          if (summary) {
            await downloadAndInstallNodeDef(fs, projectRoot, summary, 'remote-official');
          }
        } catch {
          // Per-entry errors are swallowed
        }
      }
    }
  } catch {
    // Top-level catch — swallow all errors (offline/network-down is silent)
  }
}
