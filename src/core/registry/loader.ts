import type { FileSystem } from '@/platform/fileSystem';
import type { NodeDef } from '@/types';
import { parseNodeDef } from './validator';
import { builtinYamlStrings } from './builtins';

export interface LoadProjectLocalResult {
  nodeDefs: Map<string, NodeDef>;
  errors: Array<{ file: string; message: string }>;
}

export function loadBuiltins(): Map<string, NodeDef> {
  const map = new Map<string, NodeDef>();

  for (const yamlStr of builtinYamlStrings) {
    const result = parseNodeDef(yamlStr);
    if ('error' in result) {
      throw new Error(`Invalid built-in NodeDef: ${result.error}`);
    }
    const key = `${result.nodeDef.metadata.namespace}/${result.nodeDef.metadata.name}`;
    map.set(key, result.nodeDef);
  }

  return map;
}

const NODEDEFS_DIR = '.archcanvas/nodedefs';

export async function loadProjectLocal(
  fs: FileSystem,
  projectRoot: string,
): Promise<LoadProjectLocalResult> {
  const nodeDefs = new Map<string, NodeDef>();
  const errors: Array<{ file: string; message: string }> = [];

  const dir = projectRoot ? `${projectRoot}/${NODEDEFS_DIR}` : NODEDEFS_DIR;

  const dirExists = await fs.exists(dir);
  if (!dirExists) {
    return { nodeDefs, errors };
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
        nodeDefs.set(key, result.nodeDef);
      }
    } catch (e) {
      errors.push({
        file,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { nodeDefs, errors };
}
