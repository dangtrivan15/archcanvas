import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { NodeDefRegistry } from '@/core/registry/core';
import { loadBuiltins, loadProjectLocal, createRegistry } from '@/core/registry';
import { loadLockfile, saveLockfile, generateLockfile } from '@/core/registry/lockfile';
import type { LockfileData } from '@/core/registry/lockfile';

interface RegistryStoreState {
  registry: NodeDefRegistry | null;
  status: 'idle' | 'loading' | 'ready' | 'error';

  // Metadata for status dashboard and AI awareness
  builtinCount: number;
  projectLocalCount: number;
  projectLocalKeys: Set<string>;
  overrides: string[];
  loadErrors: Array<{ file: string; message: string }>;
  lockfile: LockfileData | null;

  initialize(fs?: FileSystem, projectRoot?: string): Promise<void>;
  reloadProjectLocal(fs: FileSystem, projectRoot: string): Promise<void>;
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

/** Extract override keys from registry warning messages. */
function extractOverrideKeys(warnings: string[]): string[] {
  return warnings
    .map(w => {
      const match = w.match(/^NodeDef '(.+)' overridden/);
      return match ? match[1] : null;
    })
    .filter((k): k is string => k !== null);
}

export const useRegistryStore = create<RegistryStoreState>((set, get) => ({
  registry: null,
  status: 'idle',
  builtinCount: 0,
  projectLocalCount: 0,
  projectLocalKeys: new Set(),
  overrides: [],
  loadErrors: [],
  lockfile: null,

  initialize: async (fs?: FileSystem, projectRoot?: string) => {
    set({ status: 'loading' });
    try {
      const builtins = loadBuiltins();

      let projectLocal = new Map<string, NodeDef>();
      let loadErrors: Array<{ file: string; message: string }> = [];

      if (fs && projectRoot !== undefined) {
        const result = await loadProjectLocal(fs, projectRoot);
        projectLocal = result.nodeDefs;
        loadErrors = result.errors;
      }

      let lockfile: LockfileData | null = null;
      if (fs && projectRoot !== undefined) {
        lockfile = await loadLockfile(fs, projectRoot);
      }

      const { registry, warnings } = createRegistry(builtins, projectLocal, lockfile);

      // Auto-generate lockfile if none existed
      if (!lockfile && fs && projectRoot !== undefined) {
        lockfile = generateLockfile(registry, new Set(projectLocal.keys()));
        await saveLockfile(fs, projectRoot, lockfile);
      }

      const overrides = extractOverrideKeys(warnings);

      set({
        registry,
        status: 'ready',
        builtinCount: builtins.size,
        projectLocalCount: projectLocal.size,
        projectLocalKeys: new Set(projectLocal.keys()),
        overrides,
        loadErrors,
        lockfile,
      });

      if (loadErrors.length > 0) {
        console.warn('[registryStore] NodeDef load errors:', loadErrors);
      }
      if (warnings.length > 0) {
        console.warn('[registryStore] Registry warnings:', warnings);
      }
    } catch (err) {
      set({ status: 'error' });
      throw err;
    }
  },

  reloadProjectLocal: async (fs: FileSystem, projectRoot: string) => {
    try {
      const builtins = loadBuiltins();
      const result = await loadProjectLocal(fs, projectRoot);
      const { registry, warnings } = createRegistry(builtins, result.nodeDefs);

      const lockfile = generateLockfile(registry, new Set(result.nodeDefs.keys()));
      await saveLockfile(fs, projectRoot, lockfile);

      const overrides = extractOverrideKeys(warnings);

      set({
        registry,
        status: 'ready',
        builtinCount: builtins.size,
        projectLocalCount: result.nodeDefs.size,
        projectLocalKeys: new Set(result.nodeDefs.keys()),
        overrides,
        loadErrors: result.errors,
        lockfile,
      });
    } catch (err) {
      // Surface the error in loadErrors so the UI can display it.
      // Keep the previous registry working for continuity.
      const errorMessage = err instanceof Error ? err.message : String(err);
      set({
        loadErrors: [{ file: '(reload)', message: errorMessage }],
      });
      console.error('[registryStore] Reload failed:', err);
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
