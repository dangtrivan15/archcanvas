import type { FileSystem } from '@/platform/fileSystem';
import type { NodeDef } from '@/types';
import { parseNodeDef } from './validator';
import { builtinNodeDefs } from './builtins';
import type { LockfileData } from './lockfile';

export { builtinNodeDefs } from './builtins';

export interface LoadProjectLocalResult {
  nodeDefs: Map<string, NodeDef>;                // authored (non-remote) files
  remoteInstalledNodeDefs: Map<string, NodeDef>; // remote-installed files (source:'remote' in lockfile)
  errors: Array<{ file: string; message: string }>;
}

export function loadBuiltins(): Map<string, NodeDef> {
  const map = new Map<string, NodeDef>();

  for (const def of builtinNodeDefs) {
    const key = `${def.metadata.namespace}/${def.metadata.name}`;
    map.set(key, def);
  }

  return map;
}

const NODEDEFS_DIR = '.archcanvas/nodedefs';

export async function loadProjectLocal(
  fs: FileSystem,
  projectRoot: string,
  lockfile?: LockfileData | null,
): Promise<LoadProjectLocalResult> {
  const allLoaded = new Map<string, NodeDef>();
  const errors: Array<{ file: string; message: string }> = [];

  const dir = projectRoot ? `${projectRoot}/${NODEDEFS_DIR}` : NODEDEFS_DIR;

  const dirExists = await fs.exists(dir);
  if (!dirExists) {
    return { nodeDefs: new Map(), remoteInstalledNodeDefs: new Map(), errors };
  }

  const files = await fs.listFiles(dir);
  const yamlFiles = files.filter(
    (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
  );

  for (const file of yamlFiles) {
    const filePath = `${dir}/${file}`;
    try {
      const content = await fs.readFile(filePath);
      const result = parseNodeDef(content);
      if ('error' in result) {
        errors.push({ file, message: result.error });
      } else {
        const key = `${result.nodeDef.metadata.namespace}/${result.nodeDef.metadata.name}`;
        allLoaded.set(key, result.nodeDef);
      }
    } catch (e) {
      errors.push({
        file,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Classification pass: split into authored vs remote-installed using lockfile source field
  const nodeDefs = new Map<string, NodeDef>();
  const remoteInstalledNodeDefs = new Map<string, NodeDef>();

  for (const [key, def] of allLoaded) {
    if (lockfile?.entries[key]?.source === 'remote') {
      remoteInstalledNodeDefs.set(key, def);
    } else {
      nodeDefs.set(key, def);
    }
  }

  return { nodeDefs, remoteInstalledNodeDefs, errors };
}
