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
import { openArchcFile, protoToGraphFull, saveArchcFile, saveArchcFileAs, deriveSummaryFileName, saveSummaryMarkdown } from '@/core/storage/fileIO';
import { decode, CodecError, IntegrityError } from '@/core/storage/codec';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useAIStore } from '@/store/aiStore';
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

  // File header timestamp (preserved across re-saves)
  fileCreatedAtMs: number | null;

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
  updateNote: (nodeId: string, noteId: string, content: string) => void;
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

  // File header timestamp
  fileCreatedAtMs: null,

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

    // Clear AI conversations
    useAIStore.getState().clearConversations();

    set({
      graph,
      isDirty: false,
      fileName: 'Untitled Architecture',
      fileHandle: null,
      fileCreatedAtMs: null,
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

      const { graph, fileName, fileHandle, canvasState, aiState, createdAtMs } = result;

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
        fileCreatedAtMs: createdAtMs ?? null,
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

      // Restore AI conversations if present
      if (aiState && aiState.conversations.length > 0) {
        useAIStore.getState().setConversations(aiState.conversations);
      } else {
        useAIStore.getState().clearConversations();
      }

      console.log(`[CoreStore] Opened file: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`);
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to open file:', err);

      // Show user-friendly error dialog
      const { openErrorDialog } = useUIStore.getState();
      if (err instanceof IntegrityError) {
        openErrorDialog({
          title: 'File Corrupted',
          message: 'The file appears to be corrupted. The integrity checksum does not match, which means the file data may have been modified or damaged.',
        });
      } else if (err instanceof CodecError) {
        openErrorDialog({
          title: 'Invalid File Format',
          message: err.message || 'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        openErrorDialog({
          title: 'Failed to Open File',
          message: err instanceof Error ? err.message : 'An unexpected error occurred while opening the file.',
        });
      }

      return false;
    }
  },

  /**
   * Save the current graph to the opened file (save in-place).
   * If no file handle exists (new file), falls back to Save As.
   * Includes canvas state (viewport, panel layout) in the saved file.
   */
  saveFile: async () => {
    const { graph, fileHandle, fileCreatedAtMs, fileName, exportApi } = get();

    // If no file handle, fall back to Save As
    if (!fileHandle) {
      return get().saveFileAs();
    }

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = _getAIStateForSave();
      await saveArchcFile(graph, fileHandle, canvasState, aiState, fileCreatedAtMs ?? undefined);
      // After first save, store createdAtMs if not already set
      if (!fileCreatedAtMs) {
        set({ isDirty: false, fileCreatedAtMs: Date.now() });
      } else {
        set({ isDirty: false });
      }

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(fileName);
          saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[CoreStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

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
    const { graph, fileName, fileCreatedAtMs, exportApi } = get();

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = _getAIStateForSave();
      const result = await saveArchcFileAs(graph, fileName, canvasState, aiState, fileCreatedAtMs ?? undefined);
      if (!result) {
        // User cancelled the picker
        return false;
      }

      // After first save, store createdAtMs if not already set
      const newCreatedAtMs = fileCreatedAtMs ?? Date.now();
      set({
        isDirty: false,
        fileName: result.fileName,
        fileHandle: result.fileHandle ?? null,
        fileCreatedAtMs: newCreatedAtMs,
      });

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(result.fileName);
          saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[CoreStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

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

      // Decode the binary file, including canvas state, AI state, and header timestamps
      const decoded = await decode(data);
      const { graph, canvasState, aiState, createdAtMs } = protoToGraphFull(decoded);

      // Derive filename (keep .archc extension for display)
      const fileName = displayName ?? url.split('/').pop() ?? 'Loaded File';

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
        fileCreatedAtMs: createdAtMs ?? null,
        nodeCount: countAllNodes(graph),
        edgeCount: graph.edges.length,
        canUndo: false,
        canRedo: false,
      });

      // Restore canvas state if present
      if (canvasState) {
        useCanvasStore.getState().setViewport(canvasState.viewport);
      }

      // Restore AI conversations if present
      if (aiState && aiState.conversations.length > 0) {
        useAIStore.getState().setConversations(aiState.conversations);
      } else {
        useAIStore.getState().clearConversations();
      }

      console.log(`[CoreStore] Loaded file from URL: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`);
      return true;
    } catch (err) {
      console.error('[CoreStore] Failed to load file from URL:', err);

      // Show user-friendly error dialog
      const { openErrorDialog } = useUIStore.getState();
      if (err instanceof IntegrityError) {
        openErrorDialog({
          title: 'File Corrupted',
          message: 'The file appears to be corrupted. The integrity checksum does not match, which means the file data may have been modified or damaged.',
        });
      } else if (err instanceof CodecError) {
        openErrorDialog({
          title: 'Invalid File Format',
          message: err.message || 'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        openErrorDialog({
          title: 'Failed to Open File',
          message: err instanceof Error ? err.message : 'An unexpected error occurred while opening the file.',
        });
      }

      return false;
    }
  },

  /**
   * Add a node to the graph.
   * Automatically pre-fills default arg values from the nodedef when no explicit args are provided.
   */
  addNode: (params) => {
    const { textApi, undoManager, graph, registry } = get();
    if (!textApi || !undoManager) return undefined;

    // Pre-fill default values from nodedef for args not explicitly provided
    if (registry) {
      const nodeDef = registry.resolve(params.type);
      if (nodeDef && nodeDef.spec.args.length > 0) {
        const defaults: Record<string, string | number | boolean> = {};
        for (const argDef of nodeDef.spec.args) {
          if (argDef.default !== undefined) {
            defaults[argDef.name] = argDef.default;
          }
        }
        // Merge: explicit args override defaults
        params = { ...params, args: { ...defaults, ...params.args } };
      }
    }

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
   * Update a note's content.
   */
  updateNote: (nodeId, noteId, content) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.updateNote(nodeId, noteId, content);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Edit note', updatedGraph);

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
   * Uses spacing configuration from canvasStore.
   */
  autoLayout: async (direction, navigationPath = []) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager) return;

    try {
      // Get layout spacing from canvas store
      const { layoutSpacing } = useCanvasStore.getState();
      const spacing = {
        nodeSpacing: layoutSpacing.nodeSpacing,
        layerSpacing: layoutSpacing.layerSpacing,
      };

      const updatedGraph = await applyElkLayout(graph, direction, navigationPath, spacing);
      textApi.setGraph(updatedGraph);
      undoManager.snapshot('Auto-layout', updatedGraph);

      set({
        graph: updatedGraph,
        isDirty: true,
        canUndo: undoManager.canUndo,
        canRedo: undoManager.canRedo,
      });

      console.log('[CoreStore] Auto-layout applied:', direction, 'spacing:', spacing);
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

function _getAIStateForSave() {
  const aiStoreState = useAIStore.getState();
  const conversations = aiStoreState.conversations;
  if (conversations.length === 0) return undefined;
  return { conversations };
}
