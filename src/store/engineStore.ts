/**
 * Engine store - manages core engine instances (registry, APIs, undo manager).
 *
 * This store owns the initialization lifecycle and holds the singleton
 * instances that other stores depend on for graph mutations and rendering.
 */

import { create } from 'zustand';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { UndoManager } from '@/core/history/undoManager';
import { TextApi } from '@/api/textApi';
import { RenderApi } from '@/api/renderApi';
import { ExportApi } from '@/api/exportApi';

export interface EngineStoreState {
  /** Whether core engines (registry, APIs, undo) have been initialized */
  initialized: boolean;

  /** Node type registry (resolves NodeDef YAML definitions) */
  registry: RegistryManager | null;
  /** Text API instance for querying/mutating architecture data */
  textApi: TextApi | null;
  /** Render API instance for graph-to-React-Flow transformation */
  renderApi: RenderApi | null;
  /** Export API instance for markdown/mermaid/PNG/SVG generation */
  exportApi: ExportApi | null;
  /** Undo manager instance for snapshot-based history */
  undoManager: UndoManager | null;

  /** Initialize all core engines and wire them together. */
  initialize: () => void;
}

export const useEngineStore = create<EngineStoreState>((set, get) => ({
  initialized: false,
  registry: null,
  textApi: null,
  renderApi: null,
  exportApi: null,
  undoManager: null,

  initialize: () => {
    const state = get();
    if (state.initialized) return;

    console.log('[EngineStore] Initializing engines...');

    // 1. Initialize Registry
    const registry = new RegistryManager();
    registry.initialize();

    // 2. Create empty graph
    const graph = createEmptyGraph();

    // 3. Initialize APIs
    const textApi = new TextApi(graph, registry);
    const renderApi = new RenderApi(registry);
    const exportApi = new ExportApi();

    // 4. Initialize Undo Manager
    const undoManager = new UndoManager();

    // 5. Take initial snapshot
    undoManager.snapshot('Initial state', graph);

    set({
      initialized: true,
      registry,
      textApi,
      renderApi,
      exportApi,
      undoManager,
    });

    console.log('[EngineStore] All engines initialized successfully');
  },
}));
