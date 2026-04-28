// ---------------------------------------------------------------------------
// Community NodeDef installer
// Downloads a NodeDef from the remote registry, validates it, writes it to
// disk, and updates the lockfile with source:'remote'.
// ---------------------------------------------------------------------------

import type { FileSystem } from '@/platform/fileSystem';
import { parseNodeDef } from './validator';
import { loadLockfile, saveLockfile } from './lockfile';
import { fetchNodeDefYaml } from './remoteRegistry';
import type { RemoteNodeDefSummary } from './remoteRegistry';

const NODEDEFS_DIR = '.archcanvas/nodedefs';

/**
 * Download a community NodeDef from the registry, validate it, write it to
 * `.archcanvas/nodedefs/`, and record it in the lockfile as source:'remote'.
 *
 * Throws if the download fails, the YAML is invalid, or the file cannot be written.
 */
export async function downloadAndInstallNodeDef(
  fs: FileSystem,
  projectRoot: string,
  summary: RemoteNodeDefSummary,
): Promise<void> {
  // 1. Fetch YAML from registry
  const yaml = await fetchNodeDefYaml(summary.namespace, summary.name, summary.version);

  // 2. Validate before writing — reject malformed or schema-invalid content
  const parsed = parseNodeDef(yaml);
  if ('error' in parsed) {
    throw new Error(`Invalid NodeDef from registry: ${parsed.error}`);
  }

  // 3. Write to .archcanvas/nodedefs/
  const dir = projectRoot ? `${projectRoot}/${NODEDEFS_DIR}` : NODEDEFS_DIR;
  await fs.mkdir(dir);
  const filename = `${summary.namespace}-${summary.name}.yaml`;
  await fs.writeFile(`${dir}/${filename}`, yaml);

  // 4. Update lockfile — null guard: create empty lockfile if none exists
  const existingLockfile = (await loadLockfile(fs, projectRoot)) ?? {
    lockfileVersion: 1,
    resolvedAt: new Date().toISOString(),
    entries: {},
  };
  const key = `${summary.namespace}/${summary.name}`;
  existingLockfile.entries[key] = {
    version: summary.version,
    source: 'remote',
  };
  existingLockfile.resolvedAt = new Date().toISOString();
  await saveLockfile(fs, projectRoot, existingLockfile);
}
