/**
 * Reactive Zustand store for the NodeDef registry.
 *
 * Mirrors the contents of RegistryManagerCore in a reactive Map so that
 * UI components can subscribe to nodedef changes at runtime.
 *
 * Usage:
 *   const entry = useRegistryStore(s => s.resolve('compute/service'));
 *   const all = useRegistryStore(s => s.listAll());
 *   const version = useRegistryStore(s => s.version);
 *
 * Wiring (call once after coreStore.initialize()):
 *   initRegistryBridge(registry);
 */

import { create } from 'zustand';
import type { NodeDefEntry } from './registrySource';
import type { RegistryManagerCore } from './registryCore';

export interface RegistryStoreState {
  /**
   * Reactive snapshot of the registry.
   * A new Map reference is created on every mutation for Zustand reactivity.
   */
  entries: Map<string, NodeDefEntry>;

  /**
   * Monotonic counter, incremented on every register/unregister.
   * Cheap selector for "did anything change?" without Map inspection.
   */
  version: number;

  /**
   * Internal callback wired into RegistryManagerCore.onChange.
   * Not intended for direct use by UI consumers.
   */
  _onDefChanged: (type: string, entry: NodeDefEntry | null) => void;
}

export const useRegistryStore = create<RegistryStoreState>((set) => ({
  entries: new Map(),
  version: 0,

  _onDefChanged: (type, entry) => {
    set((state) => {
      const next = new Map(state.entries);
      if (entry === null) {
        next.delete(type);
      } else {
        next.set(type, entry);
      }
      return { entries: next, version: state.version + 1 };
    });
  },
}));

/** Guard to ensure the bridge is only wired once. */
let _bridgeWired = false;

/**
 * Wire a RegistryManagerCore instance into the reactive store.
 *
 * Call once after the registry has been initialized (e.g. after
 * coreStore.initialize() completes). This:
 *   1. Installs the onChange callback so future register/unregister calls
 *      automatically update the store.
 *   2. Performs an initial bulk-sync so the store reflects current state.
 *
 * Idempotent — subsequent calls are no-ops.
 */
export function initRegistryBridge(registry: RegistryManagerCore): void {
  if (_bridgeWired) return;
  _bridgeWired = true;

  const { _onDefChanged } = useRegistryStore.getState();

  // 1. Wire the callback for future mutations
  registry.setOnChange(_onDefChanged);

  // 2. Bulk-sync current contents using registry keys directly
  const entries = new Map(registry.listAllEntriesWithKeys());

  useRegistryStore.setState({ entries, version: 0 });
}

/**
 * Reset bridge state (for testing only).
 * @internal
 */
export function _resetRegistryBridge(): void {
  _bridgeWired = false;
  useRegistryStore.setState({ entries: new Map(), version: 0 });
}
