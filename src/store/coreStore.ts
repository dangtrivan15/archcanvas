/**
 * Core Zustand store - bridges the core engine to React.
 * Manages graph state, isDirty, fileHandle, and engine instances.
 */

import { create } from 'zustand';
import type { ArchGraph, ArchNode, ArchEdge, Note, PropertyMap } from '@/types/graph';
import type {
  AddNodeParams,
  AddEdgeParams,
  AddNoteParams,
  AddCodeRefParams,
  UpdateNodeParams,
  SuggestParams,
} from '@/types/api';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph, moveNode as engineMoveNode } from '@/core/graph/graphEngine';
import { countAllNodes } from '@/core/graph/graphQuery';
import { UndoManager } from '@/core/history/undoManager';
import { TextApi } from '@/api/textApi';
import { RenderApi } from '@/api/renderApi';
import { ExportApi } from '@/api/exportApi';
import {
  pickArchcFile,
  decodeArchcData,
  saveArchcFile,
  saveArchcFileAs,
  deriveSummaryFileName,
  saveSummaryMarkdown,
  graphToProto,
} from '@/core/storage/fileIO';
import { enqueueSave } from '@/core/sync/syncQueue';
import { encode, CodecError, IntegrityError } from '@/core/storage/codec';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useAIStore } from '@/store/aiStore';
import { haptics } from '@/hooks/useHaptics';
import { applyElkLayout } from '@/core/layout/elkLayout';

/**
 * Core store state - the central Zustand store bridging the core engine to React.
 *
 * Manages:
 * - **Graph state**: Current architecture graph, dirty flag, file metadata
 * - **Engine instances**: Registry, TextApi, RenderApi, ExportApi, UndoManager
 * - **File operations**: New, Open, Save, Save As, Load from URL/dropped file
 * - **Graph mutations**: CRUD on nodes, edges, notes, code refs, annotations
 * - **Undo/redo**: Snapshot-based history via UndoManager
 * - **Auto-layout**: ELK-based automatic node positioning
 */
export interface CoreStoreState {
  /** The current architecture graph (nodes, edges, annotations) */
  graph: ArchGraph;
  /** Whether the graph has unsaved changes since last save/open */
  isDirty: boolean;
  /** Display name of the current file (shown in title bar) */
  fileName: string;
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

  /** Total node count including nested children (derived, updated on mutations) */
  nodeCount: number;
  /** Total edge count (derived, updated on mutations) */
  edgeCount: number;

  /** Guard flag preventing concurrent saves from double-click or rapid Ctrl+S */
  isSaving: boolean;

  // Initialization
  initialize: () => void;

  // File handle (for save-in-place)
  // On web: FileSystemFileHandle; on native iOS: string path
  fileHandle: unknown;

  // File header timestamp (preserved across re-saves)
  fileCreatedAtMs: number | null;

  // Last-modified timestamp of the opened file (for external change detection)
  fileLastModifiedMs: number | null;

  // File operations
  newFile: () => void;
  openFile: () => Promise<boolean>;
  saveFile: () => Promise<boolean>;
  saveFileAs: () => Promise<boolean>;
  loadFromUrl: (url: string, fileName?: string) => Promise<boolean>;
  loadFromDroppedFile: (file: File) => Promise<boolean>;

  // Graph mutations
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
  suggest: (params: SuggestParams) => Note | undefined;
  resolveSuggestion: (nodeId: string, noteId: string, action: 'accepted' | 'dismissed') => void;
  updateNodeColor: (nodeId: string, color: string | undefined) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  moveNodes: (
    moves: Array<{ nodeId: string; x: number; y: number }>,
    snapshotDescription?: string,
  ) => void;
  duplicateSelection: (nodeIds: string[]) => string[];

  // Annotations
  addAnnotation: (annotation: import('@/types/graph').Annotation) => void;
  removeAnnotation: (annotationId: string) => void;
  clearAnnotations: (nodeId?: string) => void;

  // Layout
  autoLayout: (direction: 'horizontal' | 'vertical', navigationPath?: string[]) => Promise<void>;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Internal: set the graph (used by other stores)
  _setGraph: (graph: ArchGraph) => void;

  // Internal: apply decoded file data to the store
  _applyDecodedFile: (
    graph: ArchGraph,
    fileName: string,
    fileHandle: unknown,
    canvasState?: import('@/types/graph').SavedCanvasState,
    aiState?: import('@/core/storage/fileIO').AIStateData,
    createdAtMs?: number,
  ) => void;
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

  // Last-modified timestamp (for polling external changes)
  fileLastModifiedMs: null,

  // Computed
  nodeCount: 0,
  edgeCount: 0,

  // Save guard
  isSaving: false,

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
      fileLastModifiedMs: null,
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
  },

  /**
   * Internal helper: apply decoded file data to the store.
   * Shared by openFile and loadFromUrl.
   */
  _applyDecodedFile: (
    graph: import('@/types/graph').ArchGraph,
    fileName: string,
    fileHandle: unknown,
    canvasState?: import('@/types/graph').SavedCanvasState,
    aiState?: import('@/core/storage/fileIO').AIStateData,
    createdAtMs?: number,
  ) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.setGraph(graph);
    undoManager.clear();
    undoManager.snapshot('Open file', graph);

    set({
      graph,
      isDirty: false,
      fileName,
      fileHandle,
      fileCreatedAtMs: createdAtMs ?? null,
      fileLastModifiedMs: null,
      nodeCount: countAllNodes(graph),
      edgeCount: graph.edges.length,
      canUndo: false,
      canRedo: false,
    });

    // Capture the file's lastModified timestamp for external change polling.
    // This uses getFile() which is lightweight and only reads metadata.
    if (fileHandle && typeof (fileHandle as FileSystemFileHandle).getFile === 'function') {
      (fileHandle as FileSystemFileHandle)
        .getFile()
        .then((file) => {
          set({ fileLastModifiedMs: file.lastModified });
          console.log(`[CoreStore] Captured file lastModified: ${file.lastModified}`);
        })
        .catch((err) => {
          console.warn('[CoreStore] Could not read file lastModified:', err);
        });
    }

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

    if (aiState && aiState.conversations.length > 0) {
      useAIStore.getState().setConversations(aiState.conversations);
    } else {
      useAIStore.getState().clearConversations();
    }

    // Request fit view so the canvas adjusts to show all nodes
    useCanvasStore.getState().requestFitView();

    console.log(
      `[CoreStore] Opened file: ${fileName} (${countAllNodes(graph)} nodes, ${graph.edges.length} edges)`,
    );
  },

  /**
   * Open a .archc file and load its graph into the store.
   * If checksum mismatch is detected (IntegrityError), shows a warning dialog
   * that lets the user choose to proceed anyway or cancel.
   */
  openFile: async () => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return false;

    try {
      // Step 1: Pick the file (user selects from file picker)
      const picked = await pickArchcFile();
      if (!picked) return false; // User cancelled

      // Show loading indicator while decoding
      const { setFileOperationLoading, clearFileOperationLoading } = useUIStore.getState();
      setFileOperationLoading('Opening file...');

      try {
        // Step 2: Decode the file data
        const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(picked.data);

        // Step 3: Apply to store
        get()._applyDecodedFile(
          graph,
          picked.fileName,
          picked.fileHandle ?? null,
          canvasState,
          aiState,
          createdAtMs,
        );
        clearFileOperationLoading();
        return true;
      } catch (decodeErr) {
        clearFileOperationLoading();
        if (decodeErr instanceof IntegrityError) {
          // Show warning dialog with option to proceed or cancel
          console.warn('[CoreStore] File integrity check failed:', decodeErr.message);
          const { openIntegrityWarningDialog } = useUIStore.getState();
          openIntegrityWarningDialog({
            message:
              "The file's integrity checksum does not match its contents. " +
              'The file may have been corrupted or modified outside of ArchCanvas. ' +
              'Opening it anyway may result in unexpected behavior.',
            onProceed: async () => {
              try {
                setFileOperationLoading('Opening file...');
                // Retry decoding with checksum verification skipped
                const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(
                  picked.data,
                  { skipChecksumVerification: true },
                );
                get()._applyDecodedFile(
                  graph,
                  picked.fileName,
                  picked.fileHandle ?? null,
                  canvasState,
                  aiState,
                  createdAtMs,
                );
                clearFileOperationLoading();
                console.log(`[CoreStore] Opened file with skipped checksum: ${picked.fileName}`);
              } catch (retryErr) {
                clearFileOperationLoading();
                console.error(
                  '[CoreStore] Failed to open file even with skipped checksum:',
                  retryErr,
                );
                const { openErrorDialog } = useUIStore.getState();
                openErrorDialog({
                  title: 'Failed to Open File',
                  message:
                    retryErr instanceof Error
                      ? retryErr.message
                      : 'Failed to decode the file contents.',
                });
              }
            },
          });
          return false;
        }
        // Re-throw non-integrity errors
        throw decodeErr;
      }
    } catch (err) {
      // Clear loading on error
      useUIStore.getState().clearFileOperationLoading();
      console.error('[CoreStore] Failed to open file:', err);

      // Show user-friendly error dialog
      const { openErrorDialog } = useUIStore.getState();
      if (err instanceof CodecError) {
        openErrorDialog({
          title: 'Invalid File Format',
          message:
            err.message ||
            'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        openErrorDialog({
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the file.',
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
    // Guard against concurrent saves (double-click, rapid Ctrl+S)
    if (get().isSaving) {
      console.log('[CoreStore] Save already in progress, ignoring duplicate request');
      return false;
    }

    // If a project is open with a root file, delegate to project-level save.
    // This writes to .archcanvas/main.archc via the directory handle.
    // If the user is inside a nested canvas (dive-in), save the child file instead.
    // Uses lazy getter to avoid circular dependency (projectStore imports coreStore).
    const projectStore = _getProjectStore();
    if (projectStore) {
      const projectState = projectStore.getState();
      if (projectState.isProjectOpen && projectState.manifest?.rootFile) {
        set({ isSaving: true });
        const { setFileOperationLoading, clearFileOperationLoading } =
          useUIStore.getState();

        // Check if we're inside a nested canvas (child file)
        const { useNestedCanvasStore } = await import('./nestedCanvasStore');
        const activeFilePath = useNestedCanvasStore.getState().activeFilePath;

        const loadingMsg = activeFilePath ? 'Saving file...' : 'Saving project...';
        setFileOperationLoading(loadingMsg);
        try {
          const result = activeFilePath
            ? await projectState.saveChildArchc(activeFilePath)
            : await projectState.saveMainArchc();
          clearFileOperationLoading();
          set({ isSaving: false });
          return result;
        } catch (err) {
          clearFileOperationLoading();
          set({ isSaving: false });
          return false;
        }
      }
    }

    const { graph, fileHandle, fileCreatedAtMs, fileName, exportApi } = get();
    // Capture graph reference to detect concurrent modifications (e.g., undo during save)
    const graphAtSaveStart = graph;

    // If no file handle, fall back to Save As
    if (!fileHandle) {
      return get().saveFileAs();
    }

    set({ isSaving: true });
    const { setFileOperationLoading, clearFileOperationLoading } = useUIStore.getState();
    setFileOperationLoading('Saving file...');

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = _getAIStateForSave();

      // If offline, queue the save for background sync instead of writing directly
      if (!navigator.onLine) {
        try {
          const protoFile = graphToProto(
            graph,
            canvasState,
            undefined,
            aiState,
            fileCreatedAtMs ?? undefined,
          );
          const binaryData = await encode(protoFile);
          await enqueueSave(fileName, binaryData);
          clearFileOperationLoading();
          set({ isSaving: false });
          useUIStore.getState().showToast('Offline — save queued for sync');
          console.log('[CoreStore] Save queued for background sync (offline)');
          return true;
        } catch (queueErr) {
          console.error('[CoreStore] Failed to queue offline save:', queueErr);
          // Fall through to try normal save anyway
        }
      }

      await saveArchcFile(graph, fileHandle, canvasState, aiState, fileCreatedAtMs ?? undefined);

      // Refresh lastModified timestamp after save so polling doesn't false-alarm
      if (fileHandle && typeof (fileHandle as FileSystemFileHandle).getFile === 'function') {
        try {
          const savedFile = await (fileHandle as FileSystemFileHandle).getFile();
          set({ fileLastModifiedMs: savedFile.lastModified });
        } catch {
          // Non-critical: polling will catch up on next cycle
        }
      }

      // Only clear isDirty if the graph hasn't been modified during the async save
      // (e.g., by undo/redo or other mutations). If the graph changed, keep isDirty true
      // so the user knows in-memory state differs from the saved file.
      const graphChangedDuringSave = get().graph !== graphAtSaveStart;
      if (!fileCreatedAtMs) {
        set({ isDirty: graphChangedDuringSave, fileCreatedAtMs: Date.now() });
      } else {
        set({ isDirty: graphChangedDuringSave });
      }

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(fileName);
          await saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[CoreStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

      clearFileOperationLoading();
      set({ isSaving: false });

      // Show toast — if no file handle, the file was downloaded via browser fallback
      if (!get().fileHandle) {
        useUIStore.getState().showToast("File downloaded to your browser's download folder");
      } else {
        useUIStore.getState().showToast('File saved');
      }

      console.log('[CoreStore] File saved successfully');
      return true;
    } catch (err) {
      clearFileOperationLoading();
      set({ isSaving: false });
      console.error('[CoreStore] Failed to save file:', err);
      const { openErrorDialog } = useUIStore.getState();
      openErrorDialog({
        title: 'Save Failed',
        message:
          err instanceof Error
            ? `Could not save the file: ${err.message}`
            : 'An unexpected error occurred while saving the file. Please try again.',
      });
      return false;
    }
  },

  /**
   * Save the current graph to a new file location (Save As).
   * Opens a file save picker dialog.
   * Includes canvas state (viewport, panel layout) in the saved file.
   */
  saveFileAs: async () => {
    // Guard against concurrent saves (double-click, rapid Ctrl+S)
    if (get().isSaving) {
      console.log('[CoreStore] Save already in progress, ignoring duplicate request');
      return false;
    }

    const { graph, fileName, fileCreatedAtMs, exportApi } = get();
    // Capture graph reference to detect concurrent modifications (e.g., undo during save)
    const graphAtSaveStart = graph;

    set({ isSaving: true });

    try {
      const canvasState = _getCanvasStateForSave();
      const aiState = _getAIStateForSave();
      const result = await saveArchcFileAs(
        graph,
        fileName,
        canvasState,
        aiState,
        fileCreatedAtMs ?? undefined,
      );
      if (!result) {
        // User cancelled the picker
        set({ isSaving: false });
        return false;
      }

      // Show loading after user selects save location
      const { setFileOperationLoading, clearFileOperationLoading } = useUIStore.getState();
      setFileOperationLoading('Saving file...');

      // Only clear isDirty if the graph hasn't been modified during the async save
      // (e.g., by undo/redo or other mutations). If the graph changed, keep isDirty true.
      const graphChangedDuringSave = get().graph !== graphAtSaveStart;
      const newCreatedAtMs = fileCreatedAtMs ?? Date.now();

      // Read lastModified from the new file handle for polling
      let newLastModifiedMs: number | null = null;
      const newHandle = result.fileHandle as FileSystemFileHandle | undefined;
      if (newHandle && typeof newHandle.getFile === 'function') {
        try {
          const savedFile = await newHandle.getFile();
          newLastModifiedMs = savedFile.lastModified;
        } catch {
          // Non-critical
        }
      }

      set({
        isDirty: graphChangedDuringSave,
        fileName: result.fileName,
        fileHandle: result.fileHandle ?? null,
        fileCreatedAtMs: newCreatedAtMs,
        fileLastModifiedMs: newLastModifiedMs,
      });

      // Auto-generate .summary.md sidecar file
      if (exportApi) {
        try {
          const summaryContent = exportApi.generateSummaryWithMermaid(graph);
          const summaryFileName = deriveSummaryFileName(result.fileName);
          await saveSummaryMarkdown(summaryContent, summaryFileName);
        } catch (summaryErr) {
          console.warn('[CoreStore] Failed to generate summary sidecar:', summaryErr);
        }
      }

      clearFileOperationLoading();
      set({ isSaving: false });

      // Show toast — if no file handle returned, it was a browser download fallback
      if (!result.fileHandle) {
        useUIStore
          .getState()
          .showToast(`"${result.fileName}" downloaded to your browser's download folder`);
      } else {
        useUIStore.getState().showToast(`Saved as "${result.fileName}"`);
      }

      console.log(`[CoreStore] File saved as: ${result.fileName}`);
      return true;
    } catch (err) {
      set({ isSaving: false });
      useUIStore.getState().clearFileOperationLoading();
      console.error('[CoreStore] Failed to save file as:', err);
      const { openErrorDialog } = useUIStore.getState();
      openErrorDialog({
        title: 'Save Failed',
        message:
          err instanceof Error
            ? `Could not save the file: ${err.message}`
            : 'An unexpected error occurred while saving the file. Please try again.',
      });
      return false;
    }
  },

  /**
   * Load a .archc file from a URL (for testing and development).
   * If checksum mismatch is detected, shows a warning dialog with proceed/cancel options.
   */
  loadFromUrl: async (url: string, displayName?: string) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return false;

    const { setFileOperationLoading, clearFileOperationLoading } = useUIStore.getState();
    setFileOperationLoading('Loading file...');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        clearFileOperationLoading();
        console.error(`[CoreStore] Failed to fetch file from ${url}: ${response.status}`);
        return false;
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);
      const fileName = displayName ?? url.split('/').pop() ?? 'Loaded File';

      try {
        const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);
        get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
        clearFileOperationLoading();
        return true;
      } catch (decodeErr) {
        clearFileOperationLoading();
        if (decodeErr instanceof IntegrityError) {
          // Show warning dialog with option to proceed or cancel
          console.warn('[CoreStore] File integrity check failed:', decodeErr.message);
          const { openIntegrityWarningDialog } = useUIStore.getState();
          openIntegrityWarningDialog({
            message:
              "The file's integrity checksum does not match its contents. " +
              'The file may have been corrupted or modified outside of ArchCanvas. ' +
              'Opening it anyway may result in unexpected behavior.',
            onProceed: async () => {
              try {
                setFileOperationLoading('Loading file...');
                const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data, {
                  skipChecksumVerification: true,
                });
                get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
                clearFileOperationLoading();
                console.log(`[CoreStore] Loaded file from URL with skipped checksum: ${fileName}`);
              } catch (retryErr) {
                clearFileOperationLoading();
                console.error(
                  '[CoreStore] Failed to load file even with skipped checksum:',
                  retryErr,
                );
                const { openErrorDialog } = useUIStore.getState();
                openErrorDialog({
                  title: 'Failed to Open File',
                  message:
                    retryErr instanceof Error
                      ? retryErr.message
                      : 'Failed to decode the file contents.',
                });
              }
            },
          });
          return false;
        }
        throw decodeErr;
      }
    } catch (err) {
      clearFileOperationLoading();
      console.error('[CoreStore] Failed to load file from URL:', err);

      const { openErrorDialog } = useUIStore.getState();
      if (err instanceof CodecError) {
        openErrorDialog({
          title: 'Invalid File Format',
          message:
            err.message ||
            'The file could not be opened because it is not a valid ArchCanvas file or uses an unsupported format.',
        });
      } else {
        openErrorDialog({
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the file.',
        });
      }

      return false;
    }
  },

  /**
   * Load a .archc file from a dropped File object (drag & drop from Files app or desktop).
   * Validates file extension and decodes the binary data.
   */
  loadFromDroppedFile: async (file: File) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return false;

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.archc')) {
      const { openErrorDialog } = useUIStore.getState();
      openErrorDialog({
        title: 'Unsupported File Type',
        message: `"${file.name}" is not an ArchCanvas file. Only .archc files can be opened.`,
      });
      return false;
    }

    const { setFileOperationLoading, clearFileOperationLoading } = useUIStore.getState();
    setFileOperationLoading('Opening dropped file...');

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const fileName = file.name.replace(/\.archc$/i, '');

      try {
        const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);
        get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
        clearFileOperationLoading();
        console.log(`[CoreStore] Loaded dropped file: ${fileName}`);
        return true;
      } catch (decodeErr) {
        clearFileOperationLoading();
        if (decodeErr instanceof IntegrityError) {
          console.warn('[CoreStore] Dropped file integrity check failed:', decodeErr.message);
          const { openIntegrityWarningDialog } = useUIStore.getState();
          openIntegrityWarningDialog({
            message:
              "The dropped file's integrity checksum does not match its contents. " +
              'The file may have been corrupted or modified outside of ArchCanvas. ' +
              'Opening it anyway may result in unexpected behavior.',
            onProceed: async () => {
              try {
                setFileOperationLoading('Opening dropped file...');
                const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data, {
                  skipChecksumVerification: true,
                });
                get()._applyDecodedFile(graph, fileName, null, canvasState, aiState, createdAtMs);
                clearFileOperationLoading();
                console.log(`[CoreStore] Loaded dropped file with skipped checksum: ${fileName}`);
              } catch (retryErr) {
                clearFileOperationLoading();
                console.error(
                  '[CoreStore] Failed to load dropped file even with skipped checksum:',
                  retryErr,
                );
                const { openErrorDialog } = useUIStore.getState();
                openErrorDialog({
                  title: 'Failed to Open File',
                  message:
                    retryErr instanceof Error
                      ? retryErr.message
                      : 'Failed to decode the dropped file.',
                });
              }
            },
          });
          return false;
        }
        throw decodeErr;
      }
    } catch (err) {
      clearFileOperationLoading();
      console.error('[CoreStore] Failed to load dropped file:', err);

      const { openErrorDialog } = useUIStore.getState();
      if (err instanceof CodecError) {
        openErrorDialog({
          title: 'Invalid File Format',
          message:
            err.message ||
            'The dropped file could not be opened because it is not a valid ArchCanvas file.',
        });
      } else {
        openErrorDialog({
          title: 'Failed to Open File',
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while opening the dropped file.',
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
    const { textApi, undoManager, registry } = get();
    if (!textApi || !undoManager) return undefined;

    // Pre-fill default values from nodedef for args not explicitly provided
    if (registry) {
      const nodeDef = registry.resolve(params.type);
      if (nodeDef && nodeDef.spec.args.length > 0) {
        const defaults: PropertyMap = {};
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
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
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
   * Update an edge's type, label, or properties.
   */
  updateEdge: (edgeId, updates, snapshotDescription) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.updateEdge(edgeId, updates);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot(snapshotDescription || 'Update edge', updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Remove an edge from the graph.
   */
  removeEdge: (edgeId) => {
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
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
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.resolveSuggestion(nodeId, noteId, action);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot(
      `${action === 'accepted' ? 'Accept' : 'Dismiss'} suggestion`,
      updatedGraph,
    );

    set({
      graph: updatedGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Update a node's custom color (stored in position.color).
   * Pass undefined to clear the custom color (reverts to type default).
   */
  updateNodeColor: (nodeId, color) => {
    const { textApi, undoManager } = get();
    if (!textApi || !undoManager) return;

    textApi.updateNodeColor(nodeId, color);
    const updatedGraph = textApi.getGraph();
    undoManager.snapshot('Update node color', updatedGraph);

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
   * Move multiple nodes at once with a single undo snapshot.
   * Used for keyboard bulk movement (Alt+Arrow).
   * Coordinates are clamped to prevent negative values.
   */
  moveNodes: (moves, snapshotDescription) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager || moves.length === 0) return;

    let currentGraph = graph;
    for (const { nodeId, x, y } of moves) {
      // Clamp to prevent negative coordinates
      const clampedX = Math.max(0, x);
      const clampedY = Math.max(0, y);
      currentGraph = engineMoveNode(currentGraph, nodeId, clampedX, clampedY);
    }
    textApi.setGraph(currentGraph);

    const desc = snapshotDescription || `Move ${moves.length} node(s)`;
    undoManager.snapshot(desc, currentGraph);

    set({
      graph: currentGraph,
      isDirty: true,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });
  },

  /**
   * Duplicate selected node(s). Returns array of newly created node IDs.
   * - Single node: deep clone with new ID, offset +50px, ' (copy)' suffix
   * - Multi-node: preserve relative positions, duplicate internal edges
   */
  duplicateSelection: (nodeIds) => {
    const { textApi, undoManager, graph } = get();
    if (!textApi || !undoManager || nodeIds.length === 0) return [];

    const OFFSET = 50;
    const nodeIdSet = new Set(nodeIds);

    // Find all source nodes (recursive search)
    function findNode(nodes: ArchNode[], id: string): ArchNode | undefined {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    }

    const sourceNodes: ArchNode[] = [];
    for (const id of nodeIds) {
      const node = findNode(graph.nodes, id);
      if (node) sourceNodes.push(node);
    }
    if (sourceNodes.length === 0) return [];

    // Map old IDs to new IDs for edge rewiring
    const idMap = new Map<string, string>();
    const newNodeIds: string[] = [];

    // Create duplicates
    for (const node of sourceNodes) {
      const newNode = textApi.addNode({
        type: node.type,
        displayName: `${node.displayName} (copy)`,
        position: {
          x: node.position.x + OFFSET,
          y: node.position.y + OFFSET,
        },
        args: { ...node.args },
      });
      if (newNode) {
        idMap.set(node.id, newNode.id);
        newNodeIds.push(newNode.id);
      }
    }

    // Duplicate internal edges (edges where both endpoints are in the selection)
    if (nodeIds.length > 1) {
      for (const edge of graph.edges) {
        if (nodeIdSet.has(edge.fromNode) && nodeIdSet.has(edge.toNode)) {
          const newFromId = idMap.get(edge.fromNode);
          const newToId = idMap.get(edge.toNode);
          if (newFromId && newToId) {
            textApi.addEdge({
              fromNode: newFromId,
              toNode: newToId,
              type: edge.type,
              label: edge.label,
            });
          }
        }
      }
    }

    const updatedGraph = textApi.getGraph();
    const count = newNodeIds.length;
    undoManager.snapshot(`Duplicate ${count} node${count === 1 ? '' : 's'}`, updatedGraph);

    set({
      graph: updatedGraph,
      isDirty: true,
      nodeCount: countAllNodes(updatedGraph),
      edgeCount: updatedGraph.edges.length,
      canUndo: undoManager.canUndo,
      canRedo: undoManager.canRedo,
    });

    return newNodeIds;
  },

  // ─── Annotation Mutations ────────────────────────────────────

  addAnnotation: (annotation) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: [...(graph.annotations ?? []), annotation],
    };
    set({ graph: updatedGraph, isDirty: true });
  },

  removeAnnotation: (annotationId) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: (graph.annotations ?? []).filter((a) => a.id !== annotationId),
    };
    set({ graph: updatedGraph, isDirty: true });
  },

  clearAnnotations: (nodeId?: string) => {
    const { graph } = get();
    const updatedGraph: ArchGraph = {
      ...graph,
      annotations: nodeId ? (graph.annotations ?? []).filter((a) => a.nodeId !== nodeId) : [],
    };
    set({ graph: updatedGraph, isDirty: true });
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
      haptics.impact('Light');
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
      haptics.impact('Light');
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
      rightPanelWidth: uiStoreState.rightPanelWidth ?? 320,
    },
  };
}

function _getAIStateForSave() {
  const aiStoreState = useAIStore.getState();
  const conversations = aiStoreState.conversations;
  if (conversations.length === 0) return undefined;
  return { conversations };
}

/**
 * Lazy getter for the project store to avoid circular dependency.
 * projectStore imports coreStore, so we can't import projectStore statically.
 * Instead we resolve it lazily on first use (after both modules have initialized).
 */
let _projectStoreRef: typeof import('./projectStore') | null = null;
let _projectStoreResolved = false;

function _getProjectStore() {
  if (!_projectStoreResolved) {
    try {
      // Use require-like dynamic resolution via import cache.
      // By the time saveFile is called, projectStore module is already loaded.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      _projectStoreRef = require('./projectStore');
    } catch {
      _projectStoreRef = null;
    }
    _projectStoreResolved = true;
  }
  return _projectStoreRef ? _projectStoreRef.useProjectStore : null;
}
