// ---------------------------------------------------------------------------
// Community NodeDef installer
// Downloads a NodeDef from the remote registry, validates it, writes it to
// disk, and updates the lockfile with source:'remote'.
// ---------------------------------------------------------------------------

import type { FileSystem } from '@/platform/fileSystem';
import { parseNodeDef } from './validator';
import { loadLockfile, saveLockfile } from './lockfile';
import { NODEDEFS_DIR } from './loader';
import { fetchNodeDefYaml } from './remoteRegistry';
import type { RemoteNodeDefSummary } from './remoteRegistry';

const ARCHCANVAS_DIR = '.archcanvas';

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
  // 0. Validate namespace and name against path-unsafe characters before any
  //    I/O — prevents directory traversal (e.g. a name containing "/" could
  //    escape .archcanvas/nodedefs/).
  if (/[/\\]/.test(summary.namespace) || /[/\\]/.test(summary.name)) {
    throw new Error(
      `Invalid NodeDef identifier: namespace and name must not contain path separators (got: "${summary.namespace}/${summary.name}")`,
    );
  }

  // 1. Fetch YAML from registry
  const yaml = await fetchNodeDefYaml(summary.namespace, summary.name, summary.latestVer);

  // 2. Validate before writing — reject malformed or schema-invalid content
  const parsed = parseNodeDef(yaml);
  if ('error' in parsed) {
    throw new Error(`Invalid NodeDef from registry: ${parsed.error}`);
  }

  // 3. Write to .archcanvas/nodedefs/ — create parent dirs first
  const archcanvasDir = projectRoot ? `${projectRoot}/${ARCHCANVAS_DIR}` : ARCHCANVAS_DIR;
  const nodedefsDir = projectRoot ? `${projectRoot}/${NODEDEFS_DIR}` : NODEDEFS_DIR;
  await fs.mkdir(archcanvasDir);
  await fs.mkdir(nodedefsDir);
  const filename = `${summary.namespace}-${summary.name}.yaml`;
  await fs.writeFile(`${nodedefsDir}/${filename}`, yaml);

  // 4. Update lockfile — null guard: create empty lockfile if none exists.
  //    Build a new object rather than mutating in place so that if saveLockfile
  //    throws, the caller's reference to the original is unchanged.
  const existingLockfile = (await loadLockfile(fs, projectRoot)) ?? {
    lockfileVersion: 1,
    resolvedAt: new Date().toISOString(),
    entries: {},
  };
  const key = `${summary.namespace}/${summary.name}`;
  const newLockfile = {
    ...existingLockfile,
    resolvedAt: new Date().toISOString(),
    entries: {
      ...existingLockfile.entries,
      [key]: { version: summary.latestVer, source: 'remote' as const },
    },
  };
  await saveLockfile(fs, projectRoot, newLockfile);
}
