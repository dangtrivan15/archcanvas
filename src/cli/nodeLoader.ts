/**
 * CLI NodeDef Loader.
 *
 * Loads built-in nodedef YAML files from disk using Node.js fs module.
 * This is the CLI equivalent of the Vite-based loader (src/core/registry/loader.ts)
 * which uses Vite's ?raw import suffix.
 *
 * Usage:
 *   const defs = loadBuiltinNodeDefs();
 *   const registry = new RegistryManagerCore();
 *   registry.initialize(defs);
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { NodeDef } from '@/types/nodedef';

/**
 * Mapping of all 15 built-in nodedef YAML file paths, organized by namespace.
 * Relative to the builtins/core/ directory.
 */
const YAML_FILE_MAP: Record<string, string[]> = {
  compute: ['service.yaml', 'function.yaml', 'worker.yaml', 'api-gateway.yaml'],
  data: ['database.yaml', 'cache.yaml', 'object-storage.yaml', 'repository.yaml'],
  messaging: ['message-queue.yaml', 'event-bus.yaml', 'stream-processor.yaml'],
  network: ['load-balancer.yaml', 'cdn.yaml'],
  observability: ['logging.yaml', 'monitoring.yaml'],
};

/** Cached nodedefs (loaded once, reused across calls). */
let _cachedDefs: NodeDef[] | null = null;

/**
 * Load all 15 built-in nodedef YAML files from disk (synchronous).
 *
 * Reads each YAML file using Node.js fs.readFileSync and parses with the yaml package.
 * Returns an array of NodeDef objects ready for RegistryManagerCore.initialize().
 * Results are cached after first call.
 *
 * @returns Array of parsed NodeDef objects
 * @throws If any YAML file cannot be read or parsed
 */
export function loadBuiltinNodeDefs(): NodeDef[] {
  if (_cachedDefs) {
    return _cachedDefs;
  }

  // Resolve the builtins directory relative to this file's location
  // This file is at: src/cli/nodeLoader.ts
  // Builtins are at: src/core/registry/builtins/core/
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const builtinsDir = resolve(thisDir, '../core/registry/builtins/core');

  const defs: NodeDef[] = [];

  for (const [namespace, files] of Object.entries(YAML_FILE_MAP)) {
    for (const filename of files) {
      const filePath = join(builtinsDir, namespace, filename);
      const content = readFileSync(filePath, 'utf-8');
      const parsed = parseYaml(content) as NodeDef;
      defs.push(parsed);
    }
  }

  _cachedDefs = defs;
  return defs;
}

/**
 * Reset the cached nodedefs (for testing).
 * @internal
 */
export function _resetNodeLoaderCache(): void {
  _cachedDefs = null;
}
