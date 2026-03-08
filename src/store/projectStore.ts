/**
 * Project store — manages the state of a folder-based architecture project.
 *
 * Stores the project manifest, the base directory handle, and a cache
 * of loaded .archc file data. This enables the nested canvas feature to
 * know which files exist and how they link together.
 *
 * State:
 * - `manifest`: The parsed .archproject.json manifest (null when no project is open)
 * - `directoryHandle`: The FileSystemDirectoryHandle for the project folder
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
import type { ArchGraph } from '@/types/graph';
import {
  scanProjectFolder,
  readProjectFile,
  writeArchcToFolder,
  writeManifestToFolder,
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
  /** Directory handle for the project folder. */
  directoryHandle: FileSystemDirectoryHandle | null;
  /** Whether the manifest was loaded from an existing .archproject.json file. */
  manifestExisted: boolean;
  /** Cache of loaded .archc file data, keyed by relative path. */
  loadedFiles: Map<string, LoadedFileEntry>;

  /** Whether the project folder is empty (no .archc files and no manifest). */
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
   * Save an ArchGraph as a new .archc file in the project folder and update the manifest.
   * Returns the relative file path (e.g., "my-stack.archc").
   */
  saveTemplateAsFile: (
    graph: ArchGraph,
    displayName: string,
  ) => Promise<string>;
  /**
   * Create a blank .archc file in the project folder, set it as root, and load it.
   * Used by the empty project dialog "Start Blank" option.
   */
  createBlankArchcFile: () => Promise<void>;
  /**
   * Run the codebase analysis pipeline on the current project folder.
   * Shows progress dialog, invokes the browser pipeline, and loads the result.
   */
  runAnalysisPipeline: () => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  manifest: null,
  directoryHandle: null,
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

    // Scan the folder for .archc files and manifest
    const result = await scanProjectFolder(dirHandle);

    // Set project state (even for empty projects, so the store has the dir handle)
    set({
      manifest: result.manifest,
      directoryHandle: result.directoryHandle,
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
    }
  },

  closeProject: () => {
    set({
      manifest: null,
      directoryHandle: null,
      manifestExisted: false,
      loadedFiles: new Map(),
      isEmpty: false,
      isProjectOpen: false,
    });
  },

  loadFile: async (relativePath: string) => {
    const { directoryHandle, loadedFiles } = get();
    if (!directoryHandle) {
      throw new Error('No project folder is open');
    }

    // Check cache first
    const cached = loadedFiles.get(relativePath);
    if (cached) return cached;

    // Read and decode the file
    const data = await readProjectFile(directoryHandle, relativePath);
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

  saveTemplateAsFile: async (graph: ArchGraph, displayName: string) => {
    const { directoryHandle, manifest } = get();
    if (!directoryHandle || !manifest) {
      throw new Error('No project folder is open');
    }

    // Sanitize filename: lowercase, replace spaces/special chars with hyphens
    const baseName = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const fileName = `${baseName}.archc`;

    // Encode graph to .archc binary
    const protoFile = graphToProto(graph);
    const binaryData = await encode(protoFile);

    // Write file to project folder
    await writeArchcToFolder(directoryHandle, fileName, binaryData);

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

    // Write updated manifest
    if (!alreadyInManifest) {
      await writeManifestToFolder(directoryHandle, updatedManifest);
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
    const fileName = 'architecture.archc';

    // Create an empty graph with the project name
    const graph = createEmptyGraph(projectName);

    // Encode to .archc binary
    const protoFile = graphToProto(graph);
    const binaryData = await encode(protoFile);

    // Write file to project folder
    await writeArchcToFolder(directoryHandle, fileName, binaryData);

    // Update manifest with the new root file
    const updatedManifest: ProjectManifest = {
      ...manifest,
      rootFile: fileName,
      files: [{ path: fileName, displayName: projectName }],
    };

    await writeManifestToFolder(directoryHandle, updatedManifest);

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

      // Update manifest with the generated file
      const fileName = 'architecture.archc';
      const updatedManifest: ProjectManifest = {
        ...manifest,
        rootFile: fileName,
        files: [{ path: fileName, displayName: result.graph.name || manifest.name }],
      };

      await writeManifestToFolder(directoryHandle, updatedManifest);

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
