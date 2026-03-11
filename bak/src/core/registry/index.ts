/**
 * Node definition registry barrel export.
 */

// Registry manager
export { RegistryManager } from './registryManager';
export { RegistryManagerCore } from './registryCore';

// Built-in node definitions
export { BUILTIN_NODEDEFS } from './builtins';

// Manifest (single source of truth for built-in YAML files)
export type { NodeDefManifestEntry } from './manifest';
export { NODEDEF_MANIFEST } from './manifest';

// YAML loader
export type { YamlNodeDefSource } from './loader';
export { YAML_SOURCES, parseNodeDefYaml, loadAllBuiltinYaml } from './loader';

// Source tracking types
export type { NodeDefSourceKind, NodeDefSource, NodeDefEntry } from './registrySource';

// Reactive registry store
export type { RegistryStoreState } from './registryStore';
export { useRegistryStore, initRegistryBridge } from './registryStore';

// Validation (Zod schemas)
export type { ValidatedNodeDef } from './nodedefValidator';
export { validateNodeDef, safeValidateNodeDef, nodeDefSchema } from './nodedefValidator';
