/**
 * CLI NodeDef Loader.
 *
 * Loads built-in nodedef YAML files from disk using Node.js fs module.
 * The file list is driven by NODEDEF_MANIFEST — the same source of truth
 * used by the web loader (src/core/registry/loader.ts).
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
import { NODEDEF_MANIFEST } from '@/core/registry/manifest';

/** Cached nodedefs (loaded once, reused across calls). */
let _cachedDefs: NodeDef[] | null = null;

/**
 * Load all built-in nodedef YAML files from disk (synchronous).
 *
 * Reads each YAML file listed in NODEDEF_MANIFEST using Node.js fs.readFileSync
 * and parses with the yaml package. Returns an array of NodeDef objects ready
 * for RegistryManagerCore.initialize(). Results are cached after first call.
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

  for (const entry of NODEDEF_MANIFEST) {
    const filePath = join(builtinsDir, entry.filePath);
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseYaml(content) as NodeDef;
    defs.push(parsed);
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
