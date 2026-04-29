// ---------------------------------------------------------------------------
// NodeDef Update Checker
// Calls the registry's batch check-updates endpoint and returns a map of
// "namespace/name" → latestVersion for entries where a newer version exists.
// All errors are caught and suppressed (offline → silent, per spec).
// ---------------------------------------------------------------------------

import { checkUpdatesRemote } from './remoteRegistry';

/**
 * Check the community registry for available updates to the given installed NodeDefs.
 *
 * @param lockedVersions - Map of "namespace/name" → currently installed version
 * @param signal - Optional AbortSignal for cancellation
 * @returns Map of "namespace/name" → latestVersion (only entries with a newer version)
 */
export async function checkNodeDefUpdates(
  lockedVersions: Map<string, string>,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  if (lockedVersions.size === 0) return new Map();
  try {
    const entries = [...lockedVersions.keys()].map(key => {
      const [namespace, name] = key.split('/');
      return { namespace, name };
    });
    const results = await checkUpdatesRemote(entries, signal);
    const updates = new Map<string, string>();
    for (const { namespace, name, latestVersion } of results) {
      const key = `${namespace}/${name}`;
      const current = lockedVersions.get(key);
      if (current && latestVersion !== current) {
        updates.set(key, latestVersion);
      }
    }
    return updates;
  } catch {
    return new Map(); // offline or any error → silent
  }
}
