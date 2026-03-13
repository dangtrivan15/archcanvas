import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { NodeDefRegistry } from '@/core/registry/core';
import { builtinNodeDefs, createRegistry } from '@/core/registry';

interface RegistryStoreState {
  registry: NodeDefRegistry | null;
  status: 'idle' | 'loading' | 'ready' | 'error';

  initialize(fs?: FileSystem): Promise<void>;
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

export const useRegistryStore = create<RegistryStoreState>((set, get) => ({
  registry: null,
  status: 'idle',

  initialize: async (_fs?: FileSystem) => {
    set({ status: 'loading' });
    try {
      // Build builtins map from static TS objects (no YAML parsing)
      const builtins = new Map<string, NodeDef>();
      for (const def of builtinNodeDefs) {
        const key = `${def.metadata.namespace}/${def.metadata.name}`;
        builtins.set(key, def);
      }
      // Project-local loading is deferred — pass empty map for now
      const { registry } = createRegistry(builtins, new Map());
      set({ registry, status: 'ready' });
    } catch (err) {
      set({ status: 'error' });
      throw err;
    }
  },

  resolve: (type: string): NodeDef | undefined => {
    return get().registry?.resolve(type);
  },

  list: (): NodeDef[] => {
    return get().registry?.list() ?? [];
  },

  search: (query: string): NodeDef[] => {
    return get().registry?.search(query) ?? [];
  },

  listByNamespace: (namespace: string): NodeDef[] => {
    return get().registry?.listByNamespace(namespace) ?? [];
  },
}));
