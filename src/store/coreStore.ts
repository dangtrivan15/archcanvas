/**
 * Core store compatibility facade.
 *
 * This module now delegates to the domain stores (engineStore, graphStore,
 * fileStore, historyStore). It provides backward-compatible access so that
 * existing consumers continue to work during the migration.
 *
 * The CoreStoreState interface and useCoreStore hook aggregate state from
 * all domain stores into a single selector-compatible object.
 *
 * @deprecated Import from the specific domain store instead:
 *   - useEngineStore for: initialized, registry, textApi, renderApi, exportApi, undoManager, initialize
 *   - useGraphStore for: graph, isDirty, nodeCount, edgeCount, addNode, removeNode, updateNode, addEdge, updateEdge, removeEdge, addNote, removeNote, updateNote, addCodeRef, updateNodeColor, moveNode, moveNodes, duplicateSelection, addAnnotation, removeAnnotation, clearAnnotations, autoLayout, _setGraph
 *   - useFileStore for: fileName, fileHandle, fileCreatedAtMs, fileLastModifiedMs, fileExternallyModified, isSaving, newFile, openFile, saveFile, saveFileAs, loadFromUrl, loadFromDroppedFile, acknowledgeExternalModification, _applyDecodedFile
 *   - useHistoryStore for: canUndo, canRedo, undo, redo
 */

import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import type {
  AddNodeParams,
  AddEdgeParams,
  AddNoteParams,
  AddCodeRefParams,
  UpdateNodeParams,
} from '@/types/api';
import type { RegistryManager } from '@/core/registry/registryManager';
import type { TextApi } from '@/api/textApi';
import type { RenderApi } from '@/api/renderApi';
import type { ExportApi } from '@/api/exportApi';
import type { UndoManager } from '@/core/history/undoManager';
import { useEngineStore } from './engineStore';
import { useGraphStore } from './graphStore';
import { useFileStore } from './fileStore';
import { useHistoryStore } from './historyStore';
import { initEventSubscriptions } from '@/events/appEvents';

/**
 * @deprecated Use the specific domain store types instead.
 */
export interface CoreStoreState {
  graph: ArchGraph;
  isDirty: boolean;
  fileName: string;
  initialized: boolean;
  registry: RegistryManager | null;
  textApi: TextApi | null;
  renderApi: RenderApi | null;
  exportApi: ExportApi | null;
  undoManager: UndoManager | null;
  nodeCount: number;
  edgeCount: number;
  isSaving: boolean;
  initialize: () => void;
  fileHandle: unknown;
  fileCreatedAtMs: number | null;
  fileLastModifiedMs: number | null;
  fileExternallyModified: boolean;
  acknowledgeExternalModification: () => void;
  newFile: () => void;
  openFile: () => Promise<boolean>;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  loadFromUrl: (url: string, fileName?: string) => Promise<boolean>;
  loadFromDroppedFile: (file: File) => Promise<boolean>;
  addNode: (params: AddNodeParams) => ArchNode | undefined;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, params: UpdateNodeParams) => void;
  addEdge: (params: AddEdgeParams) => ArchEdge | undefined;
  updateEdge: (
    edgeId: string,
    updates: Partial<Pick<ArchEdge, 'type' | 'label' | 'properties'>>,
    snapshotDescription?: string,
  ) => void;
  removeEdge: (edgeId: string) => void;
  addNote: (params: AddNoteParams) => Note | undefined;
  removeNote: (nodeId: string, noteId: string) => void;
  updateNote: (nodeId: string, noteId: string, content: string) => void;
  addCodeRef: (params: AddCodeRefParams) => void;
  updateNodeColor: (nodeId: string, color: string | undefined) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  moveNodes: (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    snapshotDescription?: string,
  ) => void;
  duplicateSelection: (nodeIds: string[]) => string[];
  addAnnotation: (annotation: import('@/types/graph').Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  clearAnnotations: (nodeId?: string) => void;
  autoLayout: (direction: 'horizontal' | 'vertical', navigationPath?: string[]) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  _setGraph: (graph: ArchGraph) => void;
  _applyDecodedFile: (
    graph: ArchGraph,
    fileName: string,
    fileHandle: unknown,
    canvasState?: import('@/types/graph').SavedCanvasState,
    _aiState?: import('@/core/storage/fileIO').AIStateData,
    createdAtMs?: number,
  ) => void;
}

// Event subscriptions are now auto-initialized on appEvents module load.
// initEventSubscriptions() is safe to call multiple times (idempotent).

/**
 * Cached state object — mimics Zustand's persistent state reference.
 *
 * A real Zustand store's getState() always returns the same mutable object,
 * so vi.spyOn(store.getState(), 'fn') works because subsequent getState()
 * calls return the same reference with the spy still attached.
 *
 * We use stable wrapper functions for all actions. The wrappers are set once
 * and never replaced, so a spy on them persists across getState() calls.
 * Data properties (primitives/objects) are updated in-place each call.
 */
let _cachedState: CoreStoreState | null = null;

/** One-time setup of stable action wrappers that delegate to domain stores. */
function _createCachedState(): CoreStoreState {
  return {
    // === Data properties (updated each _getState call) ===
    initialized: false,
    registry: null,
    textApi: null,
    renderApi: null,
    exportApi: null,
    undoManager: null,
    graph: { name: '', description: '', owners: [], nodes: [], edges: [], annotations: [] } as ArchGraph,
    isDirty: false,
    nodeCount: 0,
    edgeCount: 0,
    fileName: 'Untitled',
    fileHandle: null,
    fileCreatedAtMs: null,
    fileLastModifiedMs: null,
    fileExternallyModified: false,
    isSaving: false,
    canUndo: false,
    canRedo: false,

    // === Stable action wrappers (never replaced, so spies persist) ===
    initialize: () => {
      useEngineStore.getState().initialize();
      initEventSubscriptions();
      const freshEngine = useEngineStore.getState();
      if (freshEngine.textApi) {
        const initialGraph = freshEngine.textApi.getGraph();
        useGraphStore.setState({
          graph: initialGraph,
          nodeCount: 0,
          edgeCount: 0,
        });
      }
    },
    addNode: (...args) => useGraphStore.getState().addNode(...args),
    removeNode: (...args) => useGraphStore.getState().removeNode(...args),
    updateNode: (...args) => useGraphStore.getState().updateNode(...args),
    addEdge: (...args) => useGraphStore.getState().addEdge(...args),
    updateEdge: (...args) => useGraphStore.getState().updateEdge(...args),
    removeEdge: (...args) => useGraphStore.getState().removeEdge(...args),
    addNote: (...args) => useGraphStore.getState().addNote(...args),
    removeNote: (...args) => useGraphStore.getState().removeNote(...args),
    updateNote: (...args) => useGraphStore.getState().updateNote(...args),
    addCodeRef: (...args) => useGraphStore.getState().addCodeRef(...args),
    updateNodeColor: (...args) => useGraphStore.getState().updateNodeColor(...args),
    moveNode: (...args) => useGraphStore.getState().moveNode(...args),
    moveNodes: (...args) => useGraphStore.getState().moveNodes(...args),
    duplicateSelection: (...args) => useGraphStore.getState().duplicateSelection(...args),
    addAnnotation: (...args) => useGraphStore.getState().addAnnotation(...args),
    removeAnnotation: (...args) => useGraphStore.getState().removeAnnotation(...args),
    clearAnnotations: (...args) => useGraphStore.getState().clearAnnotations(...args),
    autoLayout: (...args) => useGraphStore.getState().autoLayout(...args),
    _setGraph: (...args) => useGraphStore.getState()._setGraph(...args),
    acknowledgeExternalModification: () => useFileStore.getState().acknowledgeExternalModification(),
    newFile: () => useFileStore.getState().newFile(),
    openFile: () => useFileStore.getState().openFile(),
    saveFile: () => useFileStore.getState().saveFile(),
    saveFileAs: () => useFileStore.getState().saveFileAs(),
    loadFromUrl: (...args) => useFileStore.getState().loadFromUrl(...args),
    loadFromDroppedFile: (...args) => useFileStore.getState().loadFromDroppedFile(...args),
    _applyDecodedFile: (...args) => useFileStore.getState()._applyDecodedFile(...args),
    undo: () => useHistoryStore.getState().undo(),
    redo: () => useHistoryStore.getState().redo(),
  };
}

/**
 * Assemble a CoreStoreState snapshot from all domain stores.
 * Returns the same object reference each time (data properties mutated in-place,
 * action wrappers are stable).
 */
function _getState(): CoreStoreState {
  if (!_cachedState) {
    _cachedState = _createCachedState();
  }

  const engine = useEngineStore.getState();
  const graph = useGraphStore.getState();
  const file = useFileStore.getState();
  const history = useHistoryStore.getState();

  // Update data properties in-place
  _cachedState.initialized = engine.initialized;
  _cachedState.registry = engine.registry;
  _cachedState.textApi = engine.textApi;
  _cachedState.renderApi = engine.renderApi;
  _cachedState.exportApi = engine.exportApi;
  _cachedState.undoManager = engine.undoManager;

  _cachedState.graph = graph.graph;
  _cachedState.isDirty = graph.isDirty;
  _cachedState.nodeCount = graph.nodeCount;
  _cachedState.edgeCount = graph.edgeCount;

  _cachedState.fileName = file.fileName;
  _cachedState.fileHandle = file.fileHandle;
  _cachedState.fileCreatedAtMs = file.fileCreatedAtMs;
  _cachedState.fileLastModifiedMs = file.fileLastModifiedMs;
  _cachedState.fileExternallyModified = file.fileExternallyModified;
  _cachedState.isSaving = file.isSaving;

  _cachedState.canUndo = history.canUndo;
  _cachedState.canRedo = history.canRedo;

  // Action wrappers remain stable — never overwritten
  return _cachedState;
}

/**
 * Compatibility facade for useCoreStore.
 *
 * Supports both:
 * - `useCoreStore.getState()` for imperative access
 * - `useCoreStore(selector)` for React hook usage (selector gets a snapshot)
 * - `useCoreStore.setState(partial)` for imperative state updates
 *
 * @deprecated Import from the specific domain store instead.
 */
export const useCoreStore: {
  /** Get the current aggregated state snapshot. */
  getState: () => CoreStoreState;
  /** Get the initial state (for resetting in tests). */
  getInitialState: () => CoreStoreState;
  /** Set state on the appropriate domain store. */
  setState: (partial: Partial<CoreStoreState>) => void;
  /** React hook: subscribe to state via selector. */
  <T>(selector: (state: CoreStoreState) => T): T;
} = Object.assign(
  // The callable function (React hook simulation)
  function useCoreStoreHook<T>(selector: (state: CoreStoreState) => T): T {
    // For React component usage, we need to subscribe to all underlying stores.
    // Each underlying store is a proper Zustand store, so their individual hooks
    // handle React subscriptions. We call their hooks and merge the results.
    //
    // IMPORTANT: This must call all hooks unconditionally (React rules of hooks).
    const engineState = useEngineStore();
    const graphState = useGraphStore();
    const fileState = useFileStore();
    const historyState = useHistoryStore();

    const merged: CoreStoreState = {
      initialized: engineState.initialized,
      registry: engineState.registry,
      textApi: engineState.textApi,
      renderApi: engineState.renderApi,
      exportApi: engineState.exportApi,
      undoManager: engineState.undoManager,
      initialize: () => {
        engineState.initialize();
        initEventSubscriptions();
        const freshEngine = useEngineStore.getState();
        if (freshEngine.textApi) {
          const initialGraph = freshEngine.textApi.getGraph();
          useGraphStore.setState({
            graph: initialGraph,
            nodeCount: 0,
            edgeCount: 0,
          });
        }
      },

      graph: graphState.graph,
      isDirty: graphState.isDirty,
      nodeCount: graphState.nodeCount,
      edgeCount: graphState.edgeCount,
      addNode: graphState.addNode,
      removeNode: graphState.removeNode,
      updateNode: graphState.updateNode,
      addEdge: graphState.addEdge,
      updateEdge: graphState.updateEdge,
      removeEdge: graphState.removeEdge,
      addNote: graphState.addNote,
      removeNote: graphState.removeNote,
      updateNote: graphState.updateNote,
      addCodeRef: graphState.addCodeRef,
      updateNodeColor: graphState.updateNodeColor,
      moveNode: graphState.moveNode,
      moveNodes: graphState.moveNodes,
      duplicateSelection: graphState.duplicateSelection,
      addAnnotation: graphState.addAnnotation,
      removeAnnotation: graphState.removeAnnotation,
      clearAnnotations: graphState.clearAnnotations,
      autoLayout: graphState.autoLayout,
      _setGraph: graphState._setGraph,

      fileName: fileState.fileName,
      fileHandle: fileState.fileHandle,
      fileCreatedAtMs: fileState.fileCreatedAtMs,
      fileLastModifiedMs: fileState.fileLastModifiedMs,
      fileExternallyModified: fileState.fileExternallyModified,
      isSaving: fileState.isSaving,
      acknowledgeExternalModification: fileState.acknowledgeExternalModification,
      newFile: fileState.newFile,
      openFile: fileState.openFile,
      saveFile: fileState.saveFile,
      saveFileAs: fileState.saveFileAs,
      loadFromUrl: fileState.loadFromUrl,
      loadFromDroppedFile: fileState.loadFromDroppedFile,
      _applyDecodedFile: fileState._applyDecodedFile,

      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
      undo: historyState.undo,
      redo: historyState.redo,
    };

    return selector(merged);
  },
  {
    getState: _getState,
    getInitialState: (): CoreStoreState => {
      // Assemble initial state from all domain stores' initial states
      const engine = useEngineStore.getInitialState();
      const graph = useGraphStore.getInitialState();
      const file = useFileStore.getInitialState();
      const history = useHistoryStore.getInitialState();

      return {
        initialized: engine.initialized,
        registry: engine.registry,
        textApi: engine.textApi,
        renderApi: engine.renderApi,
        exportApi: engine.exportApi,
        undoManager: engine.undoManager,
        initialize: _getState().initialize,

        graph: graph.graph,
        isDirty: graph.isDirty,
        nodeCount: graph.nodeCount,
        edgeCount: graph.edgeCount,
        addNode: graph.addNode,
        removeNode: graph.removeNode,
        updateNode: graph.updateNode,
        addEdge: graph.addEdge,
        updateEdge: graph.updateEdge,
        removeEdge: graph.removeEdge,
        addNote: graph.addNote,
        removeNote: graph.removeNote,
        updateNote: graph.updateNote,
        addCodeRef: graph.addCodeRef,
        updateNodeColor: graph.updateNodeColor,
        moveNode: graph.moveNode,
        moveNodes: graph.moveNodes,
        duplicateSelection: graph.duplicateSelection,
        addAnnotation: graph.addAnnotation,
        removeAnnotation: graph.removeAnnotation,
        clearAnnotations: graph.clearAnnotations,
        autoLayout: graph.autoLayout,
        _setGraph: graph._setGraph,

        fileName: file.fileName,
        fileHandle: file.fileHandle,
        fileCreatedAtMs: file.fileCreatedAtMs,
        fileLastModifiedMs: file.fileLastModifiedMs,
        fileExternallyModified: file.fileExternallyModified,
        isSaving: file.isSaving,
        acknowledgeExternalModification: file.acknowledgeExternalModification,
        newFile: file.newFile,
        openFile: file.openFile,
        saveFile: file.saveFile,
        saveFileAs: file.saveFileAs,
        loadFromUrl: file.loadFromUrl,
        loadFromDroppedFile: file.loadFromDroppedFile,
        _applyDecodedFile: file._applyDecodedFile,

        canUndo: history.canUndo,
        canRedo: history.canRedo,
        undo: history.undo,
        redo: history.redo,
      };
    },
    setState: (partial: Partial<CoreStoreState>) => {
      // Route partial state updates to the correct domain store
      const graphFields: (keyof import('./graphStore').GraphStoreState)[] = [
        'graph', 'isDirty', 'nodeCount', 'edgeCount',
      ];
      const fileFields: (keyof import('./fileStore').FileStoreState)[] = [
        'fileName', 'fileHandle', 'fileCreatedAtMs', 'fileLastModifiedMs',
        'fileExternallyModified', 'isSaving',
      ];
      const historyFields: (keyof import('./historyStore').HistoryStoreState)[] = [
        'canUndo', 'canRedo',
      ];
      const engineFields: (keyof import('./engineStore').EngineStoreState)[] = [
        'initialized', 'registry', 'textApi', 'renderApi', 'exportApi', 'undoManager',
      ];

      const graphPatch: Record<string, unknown> = {};
      const filePatch: Record<string, unknown> = {};
      const historyPatch: Record<string, unknown> = {};
      const enginePatch: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(partial)) {
        if (graphFields.includes(key as any)) graphPatch[key] = value;
        else if (fileFields.includes(key as any)) filePatch[key] = value;
        else if (historyFields.includes(key as any)) historyPatch[key] = value;
        else if (engineFields.includes(key as any)) enginePatch[key] = value;
      }

      if (Object.keys(graphPatch).length > 0) useGraphStore.setState(graphPatch as any);
      if (Object.keys(filePatch).length > 0) useFileStore.setState(filePatch as any);
      if (Object.keys(historyPatch).length > 0) useHistoryStore.setState(historyPatch as any);
      if (Object.keys(enginePatch).length > 0) useEngineStore.setState(enginePatch as any);
    },
  },
);
