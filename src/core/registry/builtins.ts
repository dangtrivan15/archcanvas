/**
 * Built-in NodeDef definitions for ArchCanvas.
 * 15 nodedefs organized by namespace: compute, data, messaging, network, observability.
 *
 * Loaded from YAML files in builtins/core/ via the loader module.
 */

import type { NodeDef } from '@/types/nodedef';
import { loadAllBuiltinYaml } from './loader';

/**
 * All 15 built-in nodedefs, loaded from YAML files.
 * The loader parses YAML files that were imported as raw strings at build time.
 *
 * Order: Compute (4), Data (4), Messaging (3), Network (2), Observability (2)
 */
export const BUILTIN_NODEDEFS: NodeDef[] = loadAllBuiltinYaml();
