import type { NodeDef } from '@/types';
import type { LockfileData, LockfileEntry } from './lockfile';
import {
  parseSemVer,
  versionSatisfies,
  type TypeRef,
} from './version';

export type ResolveResult = {
  nodeDef: NodeDef | undefined;
  versionMatch: boolean;
  locked?: LockfileEntry;
};

export interface NodeDefRegistry {
  resolve(type: string): NodeDef | undefined;
  resolveVersioned(typeRef: TypeRef): ResolveResult;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

export function createRegistry(
  builtins: Map<string, NodeDef>,
  authored: Map<string, NodeDef>,
  lockfile?: LockfileData | null,
  remoteInstalled?: Map<string, NodeDef>,
): { registry: NodeDefRegistry; warnings: string[] } {
  const warnings: string[] = [];

  for (const key of authored.keys()) {
    if (builtins.has(key)) {
      warnings.push(
        `NodeDef '${key}' overridden by project-local definition`,
      );
    } else if (remoteInstalled?.has(key)) {
      warnings.push(
        `NodeDef '${key}' overridden by project-local definition (shadows community install)`,
      );
    }
  }

  function resolveByKey(typeKey: string): NodeDef | undefined {
    return authored.get(typeKey) ?? builtins.get(typeKey) ?? remoteInstalled?.get(typeKey);
  }

  function resolve(type: string): NodeDef | undefined {
    // Support version-qualified type strings transparently
    const atIdx = type.indexOf('@');
    const typeKey = atIdx === -1 ? type : type.substring(0, atIdx);
    return resolveByKey(typeKey);
  }

  function resolveVersioned(typeRef: TypeRef): ResolveResult {
    const nodeDef = resolveByKey(typeRef.typeKey);
    if (!nodeDef) return { nodeDef: undefined, versionMatch: false };

    const locked = lockfile?.entries[typeRef.typeKey];

    if (!typeRef.constraint) {
      // No version constraint — always matches
      return { nodeDef, versionMatch: true, locked };
    }

    const actual = parseSemVer(nodeDef.metadata.version);
    if (!actual) {
      // Version field isn't valid semver — can't check, assume match
      return { nodeDef, versionMatch: true, locked };
    }

    const match = versionSatisfies(actual, typeRef.constraint);
    return { nodeDef, versionMatch: match, locked };
  }

  function allNodeDefs(): NodeDef[] {
    // Build from lowest-to-highest priority so that last write wins:
    // remoteInstalled (lowest) → builtins (mid) → authored (highest)
    const merged = new Map(remoteInstalled ?? []);
    for (const [key, def] of builtins) merged.set(key, def);
    for (const [key, def] of authored) merged.set(key, def);
    return Array.from(merged.values());
  }

  function list(): NodeDef[] {
    return allNodeDefs();
  }

  function search(query: string): NodeDef[] {
    const q = query.toLowerCase();
    return allNodeDefs().filter((def) => {
      const { name, displayName, description } = def.metadata;
      const tags = def.metadata.tags ?? [];
      return (
        name.toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        description.toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  function listByNamespace(namespace: string): NodeDef[] {
    return allNodeDefs().filter((def) => def.metadata.namespace === namespace);
  }

  return {
    registry: { resolve, resolveVersioned, list, search, listByNamespace },
    warnings,
  };
}
