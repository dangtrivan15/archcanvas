import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import {
  loadProject,
  saveCanvas as saveCanvasToFile,
  type LoadedCanvas,
  type ResolvedProject,
} from '../storage/fileResolver';

interface FileStoreState {
  project: ResolvedProject | null;
  dirtyCanvases: Set<string>;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;

  openProject: (fs: FileSystem) => Promise<void>;
  saveCanvas: (fs: FileSystem, canvasId: string) => Promise<void>;
  saveAll: (fs: FileSystem) => Promise<void>;
  markDirty: (canvasId: string) => void;
  getCanvas: (canvasId: string) => LoadedCanvas | undefined;
  getRootCanvas: () => LoadedCanvas | undefined;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  project: null,
  dirtyCanvases: new Set(),
  status: 'idle',
  error: null,

  openProject: async (fs) => {
    set({ status: 'loading', error: null });
    try {
      const project = await loadProject(fs);
      set({ project, status: 'loaded', dirtyCanvases: new Set() });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  saveCanvas: async (fs, canvasId) => {
    const { project, dirtyCanvases } = get();
    const canvas = project?.canvases.get(canvasId);
    if (!canvas) return;

    await saveCanvasToFile(fs, canvas);
    const next = new Set(dirtyCanvases);
    next.delete(canvasId);
    set({ dirtyCanvases: next });
  },

  saveAll: async (fs) => {
    const { dirtyCanvases } = get();
    for (const canvasId of dirtyCanvases) {
      await get().saveCanvas(fs, canvasId);
    }
  },

  markDirty: (canvasId) => {
    const next = new Set(get().dirtyCanvases);
    next.add(canvasId);
    set({ dirtyCanvases: next });
  },

  getCanvas: (canvasId) => {
    return get().project?.canvases.get(canvasId);
  },

  getRootCanvas: () => {
    return get().project?.root;
  },
}));
