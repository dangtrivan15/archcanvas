import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { CanvasFile } from '../types';
import {
  loadProject,
  saveCanvas as saveCanvasToFile,
  ROOT_CANVAS_KEY,
  type LoadedCanvas,
  type ResolvedProject,
} from '../storage/fileResolver';

interface FileStoreState {
  project: ResolvedProject | null;
  dirtyCanvases: Set<string>;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;

  openProject: (fs: FileSystem) => Promise<void>;
  initializeEmptyProject: (name?: string) => void;
  saveCanvas: (fs: FileSystem, canvasId: string) => Promise<void>;
  saveAll: (fs: FileSystem) => Promise<void>;
  markDirty: (canvasId: string) => void;
  updateCanvasData: (canvasId: string, data: CanvasFile) => void;
  getCanvas: (canvasId: string) => LoadedCanvas | undefined;
  getRootCanvas: () => LoadedCanvas | undefined;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  project: null,
  dirtyCanvases: new Set(),
  status: 'idle',
  error: null,

  initializeEmptyProject: (name = 'Untitled Project') => {
    const data: CanvasFile = {
      project: { name, description: '' },
      nodes: [],
      entities: [],
      edges: [],
    };
    const root: LoadedCanvas = { filePath: '', data, doc: undefined };
    const canvases = new Map<string, LoadedCanvas>();
    canvases.set(ROOT_CANVAS_KEY, root);
    set({ project: { root, canvases, errors: [] }, status: 'loaded', dirtyCanvases: new Set(), error: null });
  },

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

  updateCanvasData: (canvasId, data) => {
    const { project } = get();
    if (!project) return;

    const canvas = project.canvases.get(canvasId);
    if (!canvas) return;

    // Update the canvas entry: replace data and clear the stale YAML Document AST
    // so that the next save falls back to plain stringify rather than merging
    // into a stale doc (which could corrupt the output).
    const updatedCanvas: LoadedCanvas = { ...canvas, data, doc: undefined };

    // Clone the Map and rebuild the project object so Zustand's shallow
    // equality check detects the change and triggers a re-render.
    const nextCanvases = new Map(project.canvases);
    nextCanvases.set(canvasId, updatedCanvas);

    // Keep project.root in sync when the root canvas is updated.
    const nextRoot = canvasId === ROOT_CANVAS_KEY ? updatedCanvas : project.root;

    const nextDirty = new Set(get().dirtyCanvases);
    nextDirty.add(canvasId);
    set({
      project: { ...project, root: nextRoot, canvases: nextCanvases },
      dirtyCanvases: nextDirty,
    });
  },

  getCanvas: (canvasId) => {
    return get().project?.canvases.get(canvasId);
  },

  getRootCanvas: () => {
    return get().project?.root;
  },
}));
