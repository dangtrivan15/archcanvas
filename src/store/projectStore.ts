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
import type { ProjectManifest } from '@/types/project';
import type { ArchGraph } from '@/types/graph';
import { scanProjectFolder, readProjectFile } from '@/core/project/scanner';
import { decodeArchcData } from '@/core/storage/fileIO';

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
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  manifest: null,
  directoryHandle: null,
  manifestExisted: false,
  loadedFiles: new Map(),
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

    set({
      manifest: result.manifest,
      directoryHandle: result.directoryHandle,
      manifestExisted: result.manifestExisted,
      loadedFiles: new Map(),
      isProjectOpen: true,
    });
  },

  closeProject: () => {
    set({
      manifest: null,
      directoryHandle: null,
      manifestExisted: false,
      loadedFiles: new Map(),
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
}));
