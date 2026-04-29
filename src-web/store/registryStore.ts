import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { NodeDefRegistry } from '@/core/registry/core';
import { loadBuiltins, loadProjectLocal, createRegistry } from '@/core/registry';
import { loadLockfile, saveLockfile, generateLockfile } from '@/core/registry/lockfile';
import type { LockfileData } from '@/core/registry/lockfile';
import { downloadAndInstallNodeDef } from '@/core/registry/installer';
import type { RemoteNodeDefSummary } from '@/core/registry/remoteRegistry';

interface RegistryStoreState {
  registry: NodeDefRegistry | null;
  status: 'idle' | 'loading' | 'ready' | 'error';

  // Metadata for status dashboard and AI awareness
  builtinCount: number;
  projectLocalCount: number;
  projectLocalKeys: Set<string>;
  remoteInstalledCount: number;
  remoteInstalledKeys: Set<string>;
  remoteInstalledVersions: Map<string, string>;
  overrides: string[];
  loadErrors: Array<{ file: string; message: string }>;
  lockfile: LockfileData | null;

  initialize(fs?: FileSystem, projectRoot?: string): Promise<void>;
  reloadProjectLocal(fs: FileSystem, projectRoot: string): Promise<void>;
  installRemoteNodeDef(fs: FileSystem, projectRoot: string, summary: RemoteNodeDefSummary): Promise<void>;
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
  remoteInstalledCount: 0,
  remoteInstalledKeys: new Set(),
  remoteInstalledVersions: new Map(),
  overrides: [],
  loadErrors: [],
  lockfile: null,

  initialize: async (fs?: FileSystem, projectRoot?: string) => {
    set({ status: 'loading' });
    try {
      const builtins = loadBuiltins();

      let authored = new Map<string, NodeDef>();
      let remoteInstalled = new Map<string, NodeDef>();
      let loadErrors: Array<{ file: string; message: string }> = [];

      let lockfile: LockfileData | null = null;
      if (fs && projectRoot !== undefined) {
        // Load lockfile FIRST — needed for file classification
        lockfile = await loadLockfile(fs, projectRoot);
        // Classify files using the lockfile's source field
        const result = await loadProjectLocal(fs, projectRoot, lockfile);
        authored = result.nodeDefs;
        remoteInstalled = result.remoteInstalledNodeDefs;
        loadErrors = result.errors;
      }

      const { registry, warnings } = createRegistry(builtins, authored, lockfile, remoteInstalled);

      // Auto-generate lockfile if none existed
      if (!lockfile && fs && projectRoot !== undefined) {
        lockfile = generateLockfile(registry, new Set(authored.keys()), new Set(remoteInstalled.keys()));
        await saveLockfile(fs, projectRoot, lockfile);
      }

      const overrides = extractOverrideKeys(warnings);

      set({
        registry,
        status: 'ready',
        builtinCount: builtins.size,
        projectLocalCount: authored.size,
        projectLocalKeys: new Set(authored.keys()),
        remoteInstalledCount: remoteInstalled.size,
        remoteInstalledKeys: new Set(remoteInstalled.keys()),
        remoteInstalledVersions: lockfile
          ? new Map(
              Object.entries(lockfile.entries)
                .filter(([, e]) => e.source === 'remote')
                .map(([k, e]) => [k, e.version]),
            )
          : new Map(),
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

      // Step 1: Load existing lockfile BEFORE loadProjectLocal (for classification)
      const existingLockfile = await loadLockfile(fs, projectRoot);

      // Step 2: Classify files using existing lockfile
      const { nodeDefs: authored, remoteInstalledNodeDefs: remoteInstalled, errors: loadErrors } =
        await loadProjectLocal(fs, projectRoot, existingLockfile);

      // Step 3: Generate fresh lockfile — pass remoteInstalled to temp registry
      //         so generateLockfile sees ALL defs via registry.list()
      const { registry: tempRegistry } = createRegistry(
        builtins, authored, undefined, remoteInstalled,
      );
      const lockfile = generateLockfile(
        tempRegistry,
        new Set(authored.keys()),
        new Set(remoteInstalled.keys()),  // preserves source:'remote' entries
      );
      await saveLockfile(fs, projectRoot, lockfile);

      // Step 4: Final registry with lockfile for resolveVersioned()
      const { registry, warnings } = createRegistry(
        builtins, authored, lockfile, remoteInstalled,
      );

      const overrides = extractOverrideKeys(warnings);

      set({
        registry,
        status: 'ready',
        builtinCount: builtins.size,
        projectLocalCount: authored.size,
        projectLocalKeys: new Set(authored.keys()),
        remoteInstalledCount: remoteInstalled.size,
        remoteInstalledKeys: new Set(remoteInstalled.keys()),
        remoteInstalledVersions: lockfile
          ? new Map(
              Object.entries(lockfile.entries)
                .filter(([, e]) => e.source === 'remote')
                .map(([k, e]) => [k, e.version]),
            )
          : new Map(),
        overrides,
        loadErrors,
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

  installRemoteNodeDef: async (fs: FileSystem, projectRoot: string, summary: RemoteNodeDefSummary) => {
    await downloadAndInstallNodeDef(fs, projectRoot, summary);
    await get().reloadProjectLocal(fs, projectRoot);
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
