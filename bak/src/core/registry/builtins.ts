/**
 * Built-in NodeDef definitions for ArchCanvas.
 * 42 nodedefs organized by namespace, loaded from YAML files in builtins/core/
 * via the loader module (which derives its file list from manifest.ts).
 */

import type { NodeDef } from '@/types/nodedef';
import { loadAllBuiltinYaml } from './loader';

/**
 * All 42 built-in nodedefs, loaded from YAML files.
 * The loader parses YAML files that were imported as raw strings at build time.
 */
export const BUILTIN_NODEDEFS: NodeDef[] = loadAllBuiltinYaml();
