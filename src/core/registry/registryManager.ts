/**
 * NodeDef Registry Manager.
 * Loads, validates, and resolves nodedef YAML files.
 * Provides lookup by type (namespace/name), listing by namespace, and search.
 *
 * This class extends RegistryManagerCore with automatic built-in nodedef loading
 * via Vite's ?raw YAML imports. For CLI/Node.js usage where Vite is unavailable,
 * use RegistryManagerCore directly and provide nodedefs via initialize(defs).
 */

import { RegistryManagerCore } from './registryCore';
import { BUILTIN_NODEDEFS } from './builtins';

export class RegistryManager extends RegistryManagerCore {
  /**
   * Initialize the registry by loading and validating all built-in nodedefs.
   * Must be called before any other operations.
   *
   * Overrides RegistryManagerCore.initialize() to automatically use
   * the BUILTIN_NODEDEFS loaded via Vite's ?raw YAML imports.
   */
  override initialize(): void {
    super.initialize(BUILTIN_NODEDEFS);
  }
}
