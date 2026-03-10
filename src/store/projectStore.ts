/**
 * Project store — manages the state of a folder-based architecture project.
 *
 * Stores the project descriptor, directory handles, and a cache of loaded .archc
 * file data. Supports the .archcanvas/ folder convention where all .archc files
 * live inside a .archcanvas/ subdirectory of the user's project folder.
 *
 * State:
 * - `manifest`: The project descriptor (null when no project is open)
 * - `directoryHandle`: The FileSystemDirectoryHandle for the user-selected folder
 * - `archcanvasHandle`: The .archcanvas/ subdirectory handle (for file operations)
 * - `loadedFiles`: Cache of decoded file data keyed by relative path
 * - `isProjectOpen`: Derived boolean for quick checks
 *
 * Actions:
 * - `openProjectFolder()`: Show directory picker, scan folder, load descriptor
 * - `closeProject()`: Clear all project state
 * - `loadFile(path)`: Read and decode a specific .archc file from the project
 * - `getLoadedFile(path)`: Get a cached file entry
 */

import { create } from 'zustand';
import type { ProjectDescriptor, ProjectFile } from '@/types/project';
import { ARCHCANVAS_MAIN_FILE } from '@/types/project';
import type { ArchGraph } from '@/types/graph';
import {
  scanProjectFolder,
  readProjectFile,
  writeArchcToFolder,
  initArchcanvasDir,
} from '@/core/project/scanner';
import { decodeArchcData, graphToProto } from '@/core/storage/fileIO';
import { encode } from '@/core/storage/codec';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { useUIStore } from './uiStore';
import type { EmptyProjectDialogInfo } from './uiStore';
import { useAnalysisStore } from './analysisStore';
import { useGraphStore } from './graphStore';
import { useFileStore } from './fileStore';
import { useEngineStore } from './engineStore';

/**
 * A cached entry for a loaded .archc file within the project.
 */
export interface LoadedFileEntry {
  /** Relative path within the project folder. */
  path: string;
  /** The decoded architecture graph. */
  graph: ArchGraph;
  /** When this entry was loaded (ms since epoch). */
  loadedAtMs: number;
}

export interface ProjectStoreState {
  /** The current project descriptor (null if no project is open). */
  manifest: ProjectDescriptor | null;
  /** Directory handle for the user-selected project folder. */
  directoryHandle: FileSystemDirectoryHandle | null;
  /**
   * The .archcanvas/ subdirectory handle for file operations.
   * All .archc reads/writes go through this handle when available.
   * Falls back to directoryHandle for legacy flat layouts.
   */
  archcanvasHandle: FileSystemDirectoryHandle | null;
  /** Whether the descriptor was derived from an existing .archcanvas/ dir. */
  manifestExisted: boolean;
  /** Cache of loaded .archc file data, keyed by relative path. */
  loadedFiles: Map<string, LoadedFileEntry>;

  /** Whether the project folder is empty (no .archc files and no .archcanvas/ dir). */
  isEmpty: boolean;

  // ── Derived ──
  /** Whether a project is currently open. */
  isProjectOpen: boolean;

  // ── Actions ──
  /** Open a project folder via the directory picker. */
  openProjectFolder: () => Promise<void>;
  /** Close the current project and clear all state. */
  closeProject: () => void;
  /** Load a specific .archc file from the project by its relative path. */
  loadFile: (relativePath: string) => Promise<LoadedFileEntry>;
  /** Get a cached loaded file entry (returns undefined if not loaded). */
  getLoadedFile: (relativePath: string) => LoadedFileEntry | undefined;
  /**
   * Save an ArchGraph as a new .archc file in the .archcanvas/ folder.
   * The filename is derived from the container node's ULID: {nodeId}.archc.
   * Returns the filename (e.g., "01JABCDEF.archc").
   */
  saveTemplateAsFile: (
    graph: ArchGraph,
    displayName: string,
    nodeId: string,
  ) => Promise<string>;
  /**
   * Create a blank .archc file in the .archcanvas/ directory, set it as root, and load it.
   * Creates the .archcanvas/ directory if it doesn't exist.
   * Used by the empty project dialog "Start Blank" option.
   */
  createBlankArchcFile: () => Promise<void>;
  /**
   * Run the built-in AI agentic loop (API key path) on the current project folder.
   * Uses the Anthropic SDK directly with initWithAI to iteratively build the graph.
   * Shows progress dialog during execution. Saves result to .archcanvas/main.archc.
   */
  runBuiltInAI: () => Promise<void>;
  /**
   * Run the codebase analysis pipeline on the current project folder.
   * Shows progress dialog, invokes the browser pipeline, and loads the result.
   */
  runAnalysisPipeline: () => Promise<void>;
  /**
   * Load main.archc from the .archcanvas/ directory (or root for legacy),
   * decode it, and apply it as the active canvas in coreStore.
   * Handles corrupted/empty files with error toast and offers to recreate.
   */
  loadMainArchc: () => Promise<void>;
  /**
   * Save the current root graph back to .archcanvas/main.archc.
   * Serializes the graph to protobuf binary with magic bytes and checksum,
   * writes the file via the stored directory handle, and clears isDirty.
   * Returns true on success, false on failure.
   */
  saveMainArchc: () => Promise<boolean>;
  /**
   * Save the current graph to a child .archc file in .archcanvas/.
   * Used when the user is inside a nested canvas (dive-in) and saves.
   * The filePath is the bare filename (e.g., '01JABCDEF.archc') from refSource.
   * Returns true on success, false on failure.
   */
  saveChildArchc: (filePath: string) => Promise<boolean>;
}

/**
 * Get the effective directory handle for file operations.
 * Prefers .archcanvas/ handle, falls back to root directory handle.
 */
function getFilesDirHandle(state: ProjectStoreState): FileSystemDirectoryHandle | null {
  return state.archcanvasHandle ?? state.directoryHandle;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  manifest: null,
  directoryHandle: null,
  archcanvasHandle: null,
  manifestExisted: false,
  loadedFiles: new Map(),
  isEmpty: false,
  isProjectOpen: false,

  openProjectFolder: async () => {
    // Use the File System Access API's directory picker
    if (!('showDirectoryPicker' in window)) {
      throw new Error(
        'Your browser does not support the File System Access API. ' +
          'Please use Chrome or Edge to open project folders.',
      );
    }

    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      throw err;
    }

    // Scan the folder for .archcanvas/ dir and .archc files
    const result = await scanProjectFolder(dirHandle);

    // Set project state (even for empty projects, so the store has the dir handle)
    set({
      manifest: result.manifest,
      directoryHandle: result.directoryHandle,
      archcanvasHandle: result.archcanvasHandle,
      manifestExisted: result.manifestExisted,
      loadedFiles: new Map(),
      isProjectOpen: true,
      isEmpty: result.isEmpty,
    });

    // Auto-register MCP config in .mcp.json (fire-and-forget, non-blocking)
    import('@/mcp/mcpJsonBrowser').then(({ autoRegisterMcpConfig }) => {
      autoRegisterMcpConfig(dirHandle).then((mcpResult) => {
        if (mcpResult?.written) {
          useUIStore.getState().showToast(
            mcpResult.created
              ? 'MCP config written to .mcp.json'
              : 'MCP config added to .mcp.json',
          );
        }
      });
    }).catch((err) => {
      console.warn('[MCP] Failed to auto-register MCP config:', err);
    });

    // If the project is empty, show the onboarding choice dialog
    if (result.isEmpty) {
      const { openEmptyProjectDialog } = useUIStore.getState();
      openEmptyProjectDialog(
        buildEmptyProjectDialogInfo(
          result.manifest.name,
          result.hasSourceFiles,
          get,
        ),
      );
    } else if (result.manifest.rootFile) {
      // Auto-load the root file (main.archc) into the canvas
      await get().loadMainArchc();
    }
  },

  closeProject: () => {
    set({
      manifest: null,
      directoryHandle: null,
      archcanvasHandle: null,
      manifestExisted: false,
      loadedFiles: new Map(),
      isEmpty: false,
      isProjectOpen: false,
    });
  },

  loadFile: async (relativePath: string) => {
    const state = get();
    const filesDirHandle = getFilesDirHandle(state);
    const { loadedFiles } = state;
    if (!filesDirHandle) {
      throw new Error('No project folder is open');
    }

    // Check cache first
    const cached = loadedFiles.get(relativePath);
    if (cached) return cached;

    // Read and decode the file from .archcanvas/ (or root for legacy)
    let data: Uint8Array;
    try {
      data = await readProjectFile(filesDirHandle, relativePath);
    } catch (err) {
      // File System Access API throws NotFoundError when file doesn't exist
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new Error(`Referenced file not found: ${relativePath}`);
      }
      throw err;
    }
    const { graph } = await decodeArchcData(data);

    const entry: LoadedFileEntry = {
      path: relativePath,
      graph,
      loadedAtMs: Date.now(),
    };

    // Update cache immutably
    const newCache = new Map(loadedFiles);
    newCache.set(relativePath, entry);
    set({ loadedFiles: newCache });

    return entry;
  },

  getLoadedFile: (relativePath: string) => {
    return get().loadedFiles.get(relativePath);
  },

  saveTemplateAsFile: async (graph: ArchGraph, displayName: string, nodeId: string) => {
    const state = get();
    const { directoryHandle, manifest } = state;
    if (!directoryHandle || !manifest) {
      throw new Error('No project folder is open');
    }

    // Ensure .archcanvas/ directory exists
    let archcanvasHandle = state.archcanvasHandle;
    if (!archcanvasHandle) {
      archcanvasHandle = await initArchcanvasDir(directoryHandle);
      set({ archcanvasHandle });
    }

    // Use the container node's ULID as the filename
    const fileName = `${nodeId}.archc`;

    // Encode graph to .archc binary
    const protoFile = graphToProto(graph);
    const binaryData = await encode(protoFile);

    // Write file to .archcanvas/ directory
    await writeArchcToFolder(archcanvasHandle, fileName, binaryData);

    // Update in-memory descriptor to include the new file
    const fileEntry: ProjectFile = {
      path: fileName,
      displayName,
    };

    // Check if already in descriptor
    const alreadyInDescriptor = manifest.files.some((f) => f.path === fileName);
    if (!alreadyInDescriptor) {
      const updatedManifest: ProjectDescriptor = {
        ...manifest,
        files: [...manifest.files, fileEntry],
      };
      set({ manifest: updatedManifest });
    }

    // Cache the loaded graph
    const entry: LoadedFileEntry = {
      path: fileName,
      graph,
      loadedAtMs: Date.now(),
    };
    const newCache = new Map(get().loadedFiles);
    newCache.set(fileName, entry);
    set({ loadedFiles: newCache });

    return fileName;
  },

  createBlankArchcFile: async () => {
    const { directoryHandle, manifest } = get();
    if (!directoryHandle || !manifest) {
      throw new Error('No project folder is open');
    }

    const projectName = manifest.name || 'Untitled Architecture';
    const fileName = ARCHCANVAS_MAIN_FILE; // 'main.archc'

    // Ensure .archcanvas/ directory exists (creates it if needed)
    const archcanvasHandle = await initArchcanvasDir(directoryHandle);

    // Create an empty graph with the project name
    const graph = createEmptyGraph(projectName);

    // Encode to .archc binary
    const protoFile = graphToProto(graph);
    const binaryData = await encode(protoFile);

    // Write file to .archcanvas/ directory
    await writeArchcToFolder(archcanvasHandle, fileName, binaryData);

    // Update in-memory descriptor with the new root file
    const updatedManifest: ProjectDescriptor = {
      ...manifest,
      rootFile: fileName,
      files: [{ path: fileName, displayName: projectName }],
    };

    // Cache the loaded graph
    const entry: LoadedFileEntry = {
      path: fileName,
      graph,
      loadedAtMs: Date.now(),
    };
    const newCache = new Map(get().loadedFiles);
    newCache.set(fileName, entry);

    set({
      manifest: updatedManifest,
      archcanvasHandle,
      loadedFiles: newCache,
      isEmpty: false,
    });

    // Load the graph into the store so the canvas shows it
    const { textApi } = useEngineStore.getState();
    if (textApi) {
      textApi.setGraph(graph);
      useGraphStore.getState()._setGraph(graph);
    }

    useUIStore.getState().showToast(`Created new architecture in ${projectName}`);
  },

  loadMainArchc: async () => {
    const state = get();
    const { manifest } = state;
    const filesDirHandle = getFilesDirHandle(state);

    if (!filesDirHandle || !manifest || !manifest.rootFile) {
      return;
    }

    const rootFile = manifest.rootFile;

    try {
      // Read the binary data from the directory handle
      const data = await readProjectFile(filesDirHandle, rootFile);

      // Decode the .archc file (magic bytes, protobuf payload)
      const { graph, canvasState, aiState, createdAtMs } = await decodeArchcData(data);

      // Cache the loaded file
      const entry: LoadedFileEntry = {
        path: rootFile,
        graph,
        loadedAtMs: Date.now(),
      };
      const newCache = new Map(get().loadedFiles);
      newCache.set(rootFile, entry);
      set({ loadedFiles: newCache });

      // Apply to stores: set as active canvas + initialize undo history
      useFileStore.getState()._applyDecodedFile(
        graph,
        manifest.name || rootFile,
        null,
        canvasState,
        aiState,
        createdAtMs,
      );
    } catch (err) {
      console.error(`[ProjectStore] Failed to load ${rootFile}:`, err);

      // Dynamically import error types to check instance
      const { CodecError, IntegrityError } = await import('@/core/storage/codec');

      const isCorrupted = err instanceof CodecError || err instanceof IntegrityError;
      const errorDetail = isCorrupted
        ? 'file is corrupted or invalid'
        : err instanceof Error
          ? err.message
          : String(err);

      useUIStore.getState().showToast(
        `Failed to load ${rootFile}: ${errorDetail}. You can recreate it with "Start Blank".`,
      );

      // Offer to recreate via the empty project dialog
      const { openEmptyProjectDialog } = useUIStore.getState();
      openEmptyProjectDialog(
        buildEmptyProjectDialogInfo(manifest.name, false, get),
      );
    }
  },

  saveMainArchc: async () => {
    const state = get();
    const { manifest } = state;
    const filesDirHandle = getFilesDirHandle(state);

    if (!filesDirHandle || !manifest || !manifest.rootFile) {
      console.error('[ProjectStore] Cannot save: no project or root file configured');
      useUIStore.getState().showToast('Cannot save: no project is open.');
      return false;
    }

    const rootFile = manifest.rootFile;

    try {
      // Get the current graph from graphStore and file metadata from fileStore
      const graph = useGraphStore.getState().graph;
      const fileCreatedAtMs = useFileStore.getState().fileCreatedAtMs;

      // Capture graph reference to detect concurrent modifications
      const graphAtSaveStart = graph;

      // Collect canvas state for persistence (AI store removed — aiState is undefined)
      const canvasStoreModule = await import('@/store/canvasStore');
      const uiState = useUIStore.getState();

      const canvasStoreState = canvasStoreModule.useCanvasStore.getState();
      const canvasState = {
        viewport: canvasStoreState.viewport,
        selectedNodeIds: canvasStoreState.selectedNodeId
          ? [canvasStoreState.selectedNodeId]
          : [],
        navigationPath: [] as string[],
        panelLayout: {
          rightPanelOpen: uiState.rightPanelOpen ?? false,
          rightPanelTab: (uiState.rightPanelTab as string) ?? '',
          rightPanelWidth: uiState.rightPanelWidth ?? 320,
        },
      };

      // Serialize the graph to protobuf binary with magic bytes and checksum
      const protoFile = graphToProto(
        graph,
        canvasState,
        undefined,
        undefined,
        fileCreatedAtMs ?? undefined,
      );
      const binaryData = await encode(protoFile);

      // Write to .archcanvas/main.archc (or root dir for legacy)
      await writeArchcToFolder(filesDirHandle, rootFile, binaryData);

      // Update the cache with the saved graph
      const entry: LoadedFileEntry = {
        path: rootFile,
        graph,
        loadedAtMs: Date.now(),
      };
      const newCache = new Map(get().loadedFiles);
      newCache.set(rootFile, entry);
      set({ loadedFiles: newCache });

      // Clear isDirty only if the graph hasn't changed during the async save
      const graphChangedDuringSave = useGraphStore.getState().graph !== graphAtSaveStart;
      useGraphStore.setState({ isDirty: graphChangedDuringSave });
      if (!fileCreatedAtMs) {
        useFileStore.setState({ fileCreatedAtMs: Date.now() });
      }

      console.log(`[ProjectStore] Saved ${rootFile} successfully`);
      useUIStore.getState().showToast('Project saved');
      return true;
    } catch (err) {
      console.error(`[ProjectStore] Failed to save ${rootFile}:`, err);

      const errorMsg =
        err instanceof Error ? err.message : 'An unexpected error occurred';

      // Provide specific messages for common errors
      let userMessage: string;
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      ) {
        userMessage = `Permission denied: cannot write to ${rootFile}. Please re-open the project folder to grant write access.`;
      } else if (
        err instanceof DOMException &&
        err.name === 'QuotaExceededError'
      ) {
        userMessage = `Disk full: cannot save ${rootFile}. Free up disk space and try again.`;
      } else {
        userMessage = `Could not save project: ${errorMsg}`;
      }

      useUIStore.getState().showToast(userMessage);
      return false;
    }
  },

  saveChildArchc: async (filePath: string) => {
    const state = get();
    const filesDirHandle = getFilesDirHandle(state);

    if (!filesDirHandle) {
      console.error('[ProjectStore] Cannot save child: no project folder open');
      useUIStore.getState().showToast('Cannot save: no project is open.');
      return false;
    }

    try {
      // Get the current graph from graphStore (this is the child's graph)
      const graph = useGraphStore.getState().graph;
      const fileCreatedAtMs = useFileStore.getState().fileCreatedAtMs;

      // Capture graph reference to detect concurrent modifications
      const graphAtSaveStart = graph;

      // Serialize the graph to protobuf binary with magic bytes and checksum
      // Child files don't persist canvas state or AI state — just the graph
      const protoFile = graphToProto(
        graph,
        undefined, // no canvas state for child files
        undefined,
        undefined, // no AI state for child files
        fileCreatedAtMs ?? undefined,
      );
      const binaryData = await encode(protoFile);

      // Write to .archcanvas/{filePath}
      await writeArchcToFolder(filesDirHandle, filePath, binaryData);

      // Update the cache with the saved graph
      const entry: LoadedFileEntry = {
        path: filePath,
        graph,
        loadedAtMs: Date.now(),
      };
      const newCache = new Map(get().loadedFiles);
      newCache.set(filePath, entry);
      set({ loadedFiles: newCache });

      // Clear isDirty only if the graph hasn't changed during the async save
      const graphChangedDuringSave = useGraphStore.getState().graph !== graphAtSaveStart;
      useGraphStore.setState({ isDirty: graphChangedDuringSave });

      console.log(`[ProjectStore] Saved child file ${filePath} successfully`);
      useUIStore.getState().showToast('File saved');
      return true;
    } catch (err) {
      console.error(`[ProjectStore] Failed to save child ${filePath}:`, err);

      const errorMsg =
        err instanceof Error ? err.message : 'An unexpected error occurred';

      let userMessage: string;
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      ) {
        userMessage = `Permission denied: cannot write to ${filePath}. Please re-open the project folder to grant write access.`;
      } else if (
        err instanceof DOMException &&
        err.name === 'QuotaExceededError'
      ) {
        userMessage = `Disk full: cannot save ${filePath}. Free up disk space and try again.`;
      } else {
        userMessage = `Could not save file: ${errorMsg}`;
      }

      useUIStore.getState().showToast(userMessage);
      return false;
    }
  },

  runBuiltInAI: async () => {
    useUIStore.getState().showToast('AI analysis is not available. The Anthropic SDK has been removed.');
  },

  runAnalysisPipeline: async () => {
    const { directoryHandle, manifest } = get();
    if (!directoryHandle || !manifest) {
      useUIStore.getState().showToast('No project folder is open.');
      return;
    }

    // Open the progress dialog and get an AbortController
    const abortController = useAnalysisStore.getState().openDialog();

    try {
      // Dynamically import pipeline to avoid circular deps
      const { analyzeCodebaseBrowser } = await import('@/analyze/browserPipeline');

      const { textApi, registry } = useEngineStore.getState();

      if (!textApi || !registry) {
        throw new Error('Core engines not initialized. Please wait for the app to fully load.');
      }

      // AI sender removed (Anthropic SDK has been removed)
      const aiSender = undefined;

      // Create a fresh TextApi with empty graph for the pipeline to populate
      const { TextApi } = await import('@/api/textApi');
      const freshGraph = createEmptyGraph(manifest.name || 'Architecture');
      const pipelineTextApi = new TextApi(freshGraph, registry);

      // Run the browser pipeline
      const result = await analyzeCodebaseBrowser(directoryHandle, {
        textApi: pipelineTextApi,
        registry,
        aiSender,
        architectureName: manifest.name || directoryHandle.name,
        onProgress: (event) => {
          useAnalysisStore.getState().setProgress(event);
        },
        signal: abortController.signal,
      });

      // Ensure .archcanvas/ directory exists
      const archcanvasHandle = await initArchcanvasDir(directoryHandle);
      const fileName = ARCHCANVAS_MAIN_FILE;

      // Update in-memory descriptor with the generated file
      const updatedManifest: ProjectDescriptor = {
        ...manifest,
        rootFile: fileName,
        files: [{ path: fileName, displayName: result.graph.name || manifest.name }],
      };

      // Cache the loaded graph
      const entry: LoadedFileEntry = {
        path: fileName,
        graph: result.graph,
        loadedAtMs: Date.now(),
      };
      const newCache = new Map(get().loadedFiles);
      newCache.set(fileName, entry);

      set({
        manifest: updatedManifest,
        archcanvasHandle,
        loadedFiles: newCache,
        isEmpty: false,
      });

      // Load the generated graph into the canvas
      textApi.setGraph(result.graph);
      useGraphStore.getState()._setGraph(result.graph);

      // Mark analysis as complete
      useAnalysisStore.getState().markComplete();

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.warn('[Analysis] Warnings:', result.warnings);
      }
    } catch (err) {
      // Don't show error if user cancelled
      if (err instanceof Error && err.message === 'Pipeline aborted') {
        return;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      useAnalysisStore.getState().setError(errorMsg);
      console.error('[Analysis] Pipeline failed:', err);
    }
  },
}));

// ── Helper: build EmptyProjectDialogInfo ──────────────────────────────────

/**
 * Build the EmptyProjectDialogInfo with all callbacks wired to the correct
 * project store actions and UI store transitions.
 */
function buildEmptyProjectDialogInfo(
  folderName: string,
  hasSourceFiles: boolean,
  get: () => ProjectStoreState,
): EmptyProjectDialogInfo {
  return {
    folderName,
    hasSourceFiles,
    onUseAI: () => {
      useUIStore.getState().closeEmptyProjectDialog();
      useUIStore.getState().openRightPanel('terminal');
    },
    onQuickScan: () => {
      useUIStore.getState().closeEmptyProjectDialog();
      get().runAnalysisPipeline();
    },
  };
}
