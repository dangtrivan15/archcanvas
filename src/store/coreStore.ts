/**
 * Core Zustand store - bridges the core engine to React.
 * Manages graph state, isDirty, fileHandle, and engine instances.
 */

import { create } from 'zustand';
import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import type { AddNodeParams, AddEdgeParams, AddNoteParams, AddCodeRefParams, UpdateNodeParams, SuggestParams } from '@/types/api';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, moveNode as engineMoveNode } from '@/core/graph/graphEngine';
import { countAllNodes } from '@/core/graph/graphQuery';
import { UndoManager } from '@/core/history/undoManager';
import { TextApi } from '@/api/textApi';
import { RenderApi } from '@/api/renderApi';
import { ExportApi } from '@/api/exportApi';
import { openArchcFile, protoToGraphFull, saveArchcFile, saveArchcFileAs } from '@/core/storage/fileIO';
import { decode } from '@/core/storage/codec';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { applyElkLayout } from '@/core/layout/elkLayout';

export interface CoreStoreState {
  // State
  graph: ArchGraph;
  isDirty: boolean;
  fileName: string;
  initialized: boolean;

  // Engine instances
  registry: RegistryManager | null;
  textApi: TextApi | null;
  renderApi: RenderApi | null;
  exportApi: ExportApi | null;
  undoManager: UndoManager | null;

  // Computed counts
  nodeCount: number;
  edgeCount: number;

  // Initialization
  initialize: () => void;

  // File handle (for save-in-place)
  fileHandle: FileSystemFileHandle | null;

  // File operations
  newFile: () => void;
  openFile: () => Promise<boolean>;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  loadFromUrl: (url: string, fileName?: string) => Promise<boolean>;

  // Graph mutations
  addNode: (params: AddNodeParams) => ArchNode | undefined;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, params: UpdateNodeParams) => void;
  addEdge: (params: AddEdgeParams) => ArchEdge | undefined;
  removeEdge: (edgeId: string) => void;
  addNote: (params: AddNoteParams) => Note | undefined;
  removeNote: (nodeId: string, noteId: string) => void;
  addCodeRef: (params: AddCodeRefParams) => void;
  suggest: (params: SuggestParams) => Note | undefined;
  resolveSuggestion: (nodeId: string, noteId: string, action: 'accepted' | 'dismissed') => void;
  moveNode: (nodeId: string, x: number, y: number) => void;

  // Layout
  autoLayout: (direction: 'horizontal' | 'vertical', navigationPath?: string[]) => Promise<void>;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Internal: set the graph (used by other stores)
  _setGraph: (graph: ArchGraph) => void;
}

export const useCoreStore = create<CoreStoreState>((set, get) => ({
  // Initial state
  graph: createEmptyGraph(),
  isDirty: false,
  fileName: 'Untitled Architecture',
  initialized: false,

  // Engine instances (null until initialized)
  registry: null,
  textApi: null,
  renderApi: null,
  exportApi: null,
  undoManager: null,

  // File handle
  fileHandle: null,

  // Computed
  nodeCount: 0,
  edgeCount: 0,

  // Undo/redo state
  canUndo: false,
  canRedo: false,

  /**
   * Initialize all core engines and wire them together.
   */
  initialize: () => {
    const state = get();
    if (state.initialized) {
      return;
    }

    console.log('[CoreStore] Initializing engines...');

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
      graph,
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });

    console.log('[CoreStore] All engines initialized successfully');
  },

  /**
   * Create a new empty file.
   */
  newFile: () => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    const graph = createEmptyGraph();
    textApi.setGraph(graph);
    undoManager.clear();
    undoManager.snapshot('New file', graph);

    set({
      graph,
      isDirty: false,
      fileName: 'Untitled Architecture',
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
  },

  /**
   * Open a .archc file and load its graph into the store.
   */
  openFile: async () => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return false;

    try {
      const result = await openArchcFile();
      if (!result) {
        // User cancelled the file picker
        return false;
      }

      const { graph, fileName, fileHandle, canvasState } = result;

      // Set graph in text API
      textApi.setGraph(graph);

      // Reset undo history for the new file
      undoManager.clear();
      undoManager.snapshot('Open file', graph);

      set({
        graph,
        isDirty: false,
        fileName,
        fileHandle: fileHandle ?? null,
        nodeCount: countAllNodes(graph),
        edgeCount: graph.edges.length,
        canUndo: false,
        canRedo: false,
      });

      // Restore canvas state if present
      if (canvasState) {
        useCanvasStore.getState().setViewport(canvasState.viewport);
        if (canvasState.panelLayout) {
          const uiActions = useUIStore.getState();
          if (canvasState.panelLayout.rightPanelOpen) {
            uiActions.openRightPanel();
          } else {
            uiActions.closeRightPanel();
          }
        }
      }

      console.log(`[CoreStore] Opened file: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`);
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to open file:', err);
      return false;
    }
  },

  /**
   * Save the current graph to the opened file (save in-place).
   * If no file handle exists (new file), falls back to Save As.
   * Includes canvas state (viewport, panel layout) in the saved file.
   */
  saveFile: async () => {
    const { graph, fileHandle } = get();

    // If no file handle, fall back to Save As
    if (!fileHandle) {
      return get().saveFileAs();
    }

    try {
      const canvasState = _getCanvasStateForSave();
      await saveArchcFile(graph, fileHandle, canvasState);
      set({ isDirty: false });
      console.log('[CoreStore] File saved successfully');
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to save file:', err);
      return false;
    }
  },

  /**
   * Save the current graph to a new file location (Save As).
   * Opens a file save picker dialog.
   * Includes canvas state (viewport, panel layout) in the saved file.
   */
  saveFileAs: async () => {
    const { graph, fileName } = get();

    try {
      const canvasState = _getCanvasStateForSave();
      const result = await saveArchcFileAs(graph, fileName, canvasState);
      if (!result) {
        // User cancelled the picker
        return false;
      }

      set({
        isDirty: false,
        fileName: result.fileName,
        fileHandle: result.fileHandle ?? null,
      });

      console.log(`[CoreStore] File saved as: ${result.fileName}`);
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to save file as:', err);
      return false;
    }
  },

  /**
   * Load a .archc file from a URL (for testing and development).
   */
  loadFromUrl: async (url: string, displayName?: string) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return false;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[CoreStore] Failed to fetch file from ${url}: ${response.status}`);
        return false;
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Decode the binary file, including canvas state
      const decoded = await decode(data);
      const { graph, canvasState } = protoToGraphFull(decoded);

      // Derive filename
      const fileName = displayName ?? url.split('/').pop()?.replace(/\.archc$/, '') ?? 'Loaded File';

      // Set graph in text API
      textApi.setGraph(graph);

      // Reset undo history for the new file
      undoManager.clear();
      undoManager.snapshot('Load file', graph);

      set({
        graph,
        isDirty: false,
        fileName,
        fileHandle: null,
        nodeCount: countAllNodes(graph),
        edgeCount: graph.edges.length,
        canUndo: false,
        canRedo: false,
      });

      // Restore canvas state if present
      if (canvasState) {
        useCanvasStore.getState().setViewport(canvasState.viewport);
      }

      console.log(`[CoreStore] Loaded file from URL: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`);
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to load file from URL:', err);
      return false;
    }
  },

  /**
   * Add a node to the graph.
   */
  addNode: (params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return undefined;

    const node = textApi.addNode(params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Add node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });

    return node;
  },

  /**
   * Remove a node from the graph.
   */
  removeNode: (nodeId) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    textApi.removeNode(nodeId);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Remove node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Update a node's properties.
   */
  updateNode: (nodeId, params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    textApi.updateNode(nodeId, params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Update node', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Add an edge to the graph.
   */
  addEdge: (params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return undefined;

    const edge = textApi.addEdge(params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Add edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      edgeCount: updatedGraph.edges.length,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });

    return edge;
  },

  /**
   * Remove an edge from the graph.
   */
  removeEdge: (edgeId) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    textApi.removeEdge(edgeId);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Remove edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      edgeCount: updatedGraph.edges.length,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Add a note to a node or edge.
   */
  addNote: (params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return undefined;

    const note = textApi.addNote(params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Add note', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });

    return note;
  },

  /**
   * Remove a note from a node.
   */
  removeNote: (nodeId, noteId) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.removeNote(nodeId, noteId);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Remove note', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Add a code reference to a node.
   */
  addCodeRef: (params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    textApi.addCodeRef(params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Add code reference', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Create a pending AI suggestion note on a node.
   */
  suggest: (params) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return undefined;

    const note = textApi.suggest(params);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('AI suggestion', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });

    return note;
  },

  /**
   * Accept or dismiss an AI suggestion note.
   */
  resolveSuggestion: (nodeId, noteId, action) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    textApi.resolveSuggestion(nodeId, noteId, action);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot(`${action === 'accepted' ? 'Accept' : 'Dismiss'} suggestion`, updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Move a node to a new position.
   */
  moveNode: (nodeId, x, y) => {
    const { textApi, graph } = get();
    if (!textApi) return;

    // Don't snapshot on move (too frequent), just update position
    const updatedGraph = engineMoveNode(graph, nodeId, x, y);
    textApi.setGraph(updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
    });
  },

  /**
   * Auto-layout nodes using the ELK layered algorithm.
   */
  autoLayout: async (direction, navigationPath = []) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    try {
      const updatedGraph = await applyElkLayout(graph, direction, navigationPath);
      textApi.setGraph(updatedGraph);
      undoManager.snapshot('Auto-layout', updatedGraph);

      set({
        graph: updatedGraph,
        isDirty: true,
        canUndo: undoManager.canUndo,
        canRedo: undoManager.canRedo,
      });

      console.log('[CoreStore] Auto-layout applied:', direction);
    } catch (error) {
      console.error('[CoreStore] Auto-layout failed:', error);
    }
  },

  /**
   * Undo the last action.
   */
  undo: () => {
    const { undoManager, textApi } = get();
    if (!undoManager || !textApi) return;

    const previousGraph = undoManager.undo();
    if (previousGraph) {
      textApi.setGraph(previousGraph);
      set({
        graph: previousGraph,
        isDirty: true,
        nodeCount: countAllNodes(previousGraph),
        edgeCount: previousGraph.edges.length,
        canUndo: undoManager.canUndo,
        canRedo: undoManager.canRedo,
      });
    }
  },

  /**
   * Redo the last undone action.
   */
  redo: () => {
    const { undoManager, textApi } = get();
    if (!undoManager || !textApi) return;

    const nextGraph = undoManager.redo();
    if (nextGraph) {
      textApi.setGraph(nextGraph);
      set({
        graph: nextGraph,
        isDirty: true,
        nodeCount: countAllNodes(nextGraph),
        edgeCount: nextGraph.edges.length,
        canUndo: undoManager.canUndo,
        canRedo: undoManager.canRedo,
      });
    }
  },

  /**
   * Internal: directly set the graph state.
   */
  _setGraph: (graph) => {
    const { textApi } = get();
    if (textApi) {
      textApi.setGraph(graph);
    }
    set({
      graph,
      nodeCount: countAllNodes(graph),
      edgeCount: graph.edges.length,
    });
  },
}));

/**
 * Gather canvas state from external stores for saving.
 */
function _getCanvasStateForSave() {
  const canvasStoreState = useCanvasStore.getState();
  const uiStoreState = useUIStore.getState();

  return {
    viewport: canvasStoreState.viewport,
    selectedNodeIds: canvasStoreState.selectedNodeId ? [canvasStoreState.selectedNodeId] : [],
    navigationPath: [] as string[],
    panelLayout: {
      rightPanelOpen: uiStoreState.rightPanelOpen ?? false,
      rightPanelTab: (uiStoreState.rightPanelTab as string) ?? '',
      rightPanelWidth: 320,
    },
  };
}
