import type { NodeDef } from '@/types';

export interface NodeDefRegistry {
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

export function createRegistry(
  builtins: Map<string, NodeDef>,
  projectLocal: Map<string, NodeDef>,
): { registry: NodeDefRegistry; warnings: string[] } {
  const warnings: string[] = [];

  for (const key of projectLocal.keys()) {
    if (builtins.has(key)) {
      warnings.push(
        `NodeDef '${key}' overridden by project-local definition`,
      );
    }
  }

  function resolve(type: string): NodeDef | undefined {
    return projectLocal.get(type) ?? builtins.get(type);
  }

  function allNodeDefs(): NodeDef[] {
    const merged = new Map(builtins);
    for (const [key, def] of projectLocal) {
      merged.set(key, def);
    }
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
    registry: { resolve, list, search, listByNamespace },
    warnings,
  };
}
