/**
 * Project store — manages the state of a folder-based architecture project.
 *
 * Stores the project manifest, directory handles, and a cache of loaded .archc
 * file data. Supports the .archcanvas/ folder convention where all .archc files
 * live inside a .archcanvas/ subdirectory of the user's project folder.
 *
 * State:
 * - `manifest`: The project manifest (null when no project is open)
 * - `directoryHandle`: The FileSystemDirectoryHandle for the user-selected folder
 * - `archcanvasHandle`: The .archcanvas/ subdirectory handle (for file operations)
 * - `loadedFiles`: Cache of decoded file data keyed by relative path
 * - `isProjectOpen`: Derived boolean for quick checks
 *
 * Actions:
 * - `openProjectFolder()`: Show directory picker, scan folder, load manifest
 * - `closeProject()`: Clear all project state
 * - `loadFile(path)`: Read and decode a specific .archc file from the project
 * - `getLoadedFile(path)`: Get a cached file entry
 */

import { create } from 'zustand';
import type { ProjectManifest, ProjectFileEntry } from '@/types/project';
import { ARCHCANVAS_MAIN_FILE } from '@/types/project';
import type { ArchGraph } from '@/types/graph';
import {
  scanProjectFolder,
  readProjectFile,
  writeArchcToFolder,
  writeManifestToFolder,
  initArchcanvasDir,
} from '@/core/project/scanner';
import { decodeArchcData, graphToProto } from '@/core/storage/fileIO';
import { encode } from '@/core/storage/codec';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { useUIStore } from './uiStore';
import { useAnalysisStore } from './analysisStore';

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
  /** The current project manifest (null if no project is open). */
  manifest: ProjectManifest | null;
  /** Directory handle for the user-selected project folder. */
  directoryHandle: FileSystemDirectoryHandle | null;
  /**
   * The .archcanvas/ subdirectory handle for file operations.
   * All .archc reads/writes go through this handle when available.
   * Falls back to directoryHandle for legacy flat layouts.
   */
  archcanvasHandle: FileSystemDirectoryHandle | null;
  /** Whether the manifest was loaded from an existing source. */
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

    // Scan the folder for .archcanvas/ dir, .archc files, and manifest
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

    // If the project is empty, show the onboarding choice dialog
    if (result.isEmpty) {
      const { openEmptyProjectDialog } = useUIStore.getState();
      openEmptyProjectDialog({
        folderName: result.manifest.name,
        hasSourceFiles: result.hasSourceFiles,
        onAnalyze: () => {
          useUIStore.getState().closeEmptyProjectDialog();
          get().runAnalysisPipeline();
        },
        onStartBlank: () => {
          useUIStore.getState().closeEmptyProjectDialog();
          get().createBlankArchcFile();
        },
      });
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
    const data = await readProjectFile(filesDirHandle, relativePath);
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

    // Update manifest to include the new file
    const fileEntry: ProjectFileEntry = {
      path: fileName,
      displayName,
    };

    // Check if already in manifest
    const alreadyInManifest = manifest.files.some((f) => f.path === fileName);
    const updatedManifest: typeof manifest = alreadyInManifest
      ? manifest
      : {
          ...manifest,
          files: [...manifest.files, fileEntry],
          links: [
            ...manifest.links,
            {
              from: manifest.rootFile,
              to: fileName,
              label: 'imports',
            },
          ],
        };

    // Write updated manifest to .archcanvas/ (legacy compat: also to root if no archcanvas)
    if (!alreadyInManifest) {
      await writeManifestToFolder(archcanvasHandle, updatedManifest);
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

    // Update manifest with the new root file
    const updatedManifest: ProjectManifest = {
      ...manifest,
      rootFile: fileName,
      files: [{ path: fileName, displayName: projectName }],
    };

    // Write manifest inside .archcanvas/
    await writeManifestToFolder(archcanvasHandle, updatedManifest);

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

    // Load the graph into the core store so the canvas shows it
    const { useCoreStore } = await import('./coreStore');
    const coreStore = useCoreStore.getState();
    if (coreStore.textApi) {
      coreStore.textApi.setGraph(graph);
      coreStore._setGraph(graph);
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

      // Apply to coreStore: set as active canvas + initialize undo history
      const { useCoreStore } = await import('./coreStore');
      const coreStore = useCoreStore.getState();
      coreStore._applyDecodedFile(
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
      openEmptyProjectDialog({
        folderName: manifest.name,
        hasSourceFiles: false,
        onAnalyze: () => {
          useUIStore.getState().closeEmptyProjectDialog();
          get().runAnalysisPipeline();
        },
        onStartBlank: () => {
          useUIStore.getState().closeEmptyProjectDialog();
          get().createBlankArchcFile();
        },
      });
    }
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
      // Dynamically import pipeline and AI client to avoid circular deps
      const { analyzeCodebaseBrowser } = await import('@/analyze/browserPipeline');
      const { sendMessage } = await import('@/ai/client');
      const { getAnthropicApiKey } = await import('@/ai/config');
      const { useCoreStore } = await import('./coreStore');

      const coreStore = useCoreStore.getState();
      const textApi = coreStore.textApi;
      const registry = coreStore.registry;

      if (!textApi || !registry) {
        throw new Error('Core engines not initialized. Please wait for the app to fully load.');
      }

      // Build an AIMessageSender wrapping the browser AI client
      const apiKey = getAnthropicApiKey();
      const aiSender = apiKey
        ? {
            async sendMessage(options: {
              messages: Array<{ role: 'user' | 'assistant'; content: string }>;
              system?: string;
              maxTokens?: number;
              stream?: boolean;
              onChunk?: (text: string) => void;
              signal?: AbortSignal;
            }): Promise<{
              content: string;
              stopReason: string | null;
              usage: { inputTokens: number; outputTokens: number };
            }> {
              return sendMessage({
                messages: options.messages,
                system: options.system,
                maxTokens: options.maxTokens ?? 8192,
                stream: false, // Use non-streaming for analysis (simpler, more reliable)
                signal: options.signal,
              });
            },
          }
        : undefined;

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

      // Update manifest with the generated file
      const updatedManifest: ProjectManifest = {
        ...manifest,
        rootFile: fileName,
        files: [{ path: fileName, displayName: result.graph.name || manifest.name }],
      };

      await writeManifestToFolder(archcanvasHandle, updatedManifest);

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
      coreStore._setGraph(result.graph);

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
