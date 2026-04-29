import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { NodeDefRegistry } from '@/core/registry/core';
import { loadBuiltins, loadProjectLocal, createRegistry } from '@/core/registry';
import { loadLockfile, saveLockfile, generateLockfile } from '@/core/registry/lockfile';
import type { LockfileData } from '@/core/registry/lockfile';
import { downloadAndInstallNodeDef } from '@/core/registry/installer';
import type { RemoteNodeDefSummary } from '@/core/registry/remoteRegistry';
import { checkNodeDefUpdates } from '@/core/registry/updateChecker';

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

  availableUpdates: Map<string, string>;
  updatesCheckStatus: 'idle' | 'checking' | 'done';
  pinnedVersions: Map<string, string>;

  initialize(fs?: FileSystem, projectRoot?: string): Promise<void>;
  reloadProjectLocal(fs: FileSystem, projectRoot: string): Promise<void>;
  installRemoteNodeDef(fs: FileSystem, projectRoot: string, summary: RemoteNodeDefSummary): Promise<void>;
  checkForUpdates(signal?: AbortSignal): Promise<void>;
  applyUpdate(fs: FileSystem, projectRoot: string, namespace: string, name: string): Promise<void>;
  dismissUpdate(key: string, version: string): void;
  resolve(type: string): NodeDef | undefined;
  list(): NodeDef[];
  search(query: string): NodeDef[];
  listByNamespace(namespace: string): NodeDef[];
}

const PINNED_VERSIONS_KEY = 'archcanvas:registry-pinned-versions';

function loadPinnedVersions(): Map<string, string> {
  try {
    const raw = localStorage.getItem(PINNED_VERSIONS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(obj));
  } catch { return new Map(); }
}

function savePinnedVersions(map: Map<string, string>): void {
  try {
    localStorage.setItem(PINNED_VERSIONS_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch { /* ignore */ }
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
  availableUpdates: new Map(),
  updatesCheckStatus: 'idle',
  pinnedVersions: loadPinnedVersions(),

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

      if (remoteInstalled.size > 0) {
        // Fire-and-forget; errors are silent per spec
        get().checkForUpdates().catch(() => {/* silent */});
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
    get().checkForUpdates().catch(() => {});
  },

  checkForUpdates: async (signal?: AbortSignal) => {
    const { remoteInstalledVersions } = get();
    if (remoteInstalledVersions.size === 0) return;
    set({ updatesCheckStatus: 'checking' });
    const updates = await checkNodeDefUpdates(remoteInstalledVersions, signal);
    set({ availableUpdates: updates, updatesCheckStatus: 'done' });
  },

  applyUpdate: async (fs: FileSystem, projectRoot: string, namespace: string, name: string) => {
    const key = `${namespace}/${name}`;
    const latestVersion = get().availableUpdates.get(key);
    if (!latestVersion) return;

    // Construct a RemoteNodeDefSummary that satisfies z.infer<typeof RemoteNodeDefSummarySchema>.
    // tags and downloadCount have Zod .default() which makes them required in the inferred type.
    const summary: RemoteNodeDefSummary = {
      namespace,
      name,
      latestVer: latestVersion,  // installer reads summary.latestVer
      tags: [],
      downloadCount: 0,
    };
    await downloadAndInstallNodeDef(fs, projectRoot, summary);
    await get().reloadProjectLocal(fs, projectRoot);

    // Clear the update state for this entry
    const newUpdates = new Map(get().availableUpdates);
    newUpdates.delete(key);
    const newPinned = new Map(get().pinnedVersions);
    newPinned.delete(key);
    savePinnedVersions(newPinned);
    set({ availableUpdates: newUpdates, pinnedVersions: newPinned });
  },

  dismissUpdate: (key: string, version: string) => {
    const newPinned = new Map(get().pinnedVersions);
    newPinned.set(key, version);
    savePinnedVersions(newPinned);
    set({ pinnedVersions: newPinned });
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
