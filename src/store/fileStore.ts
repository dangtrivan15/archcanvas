import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { FilePicker } from '../platform/filePicker';
import { createFilePicker } from '../platform/filePicker';
import type { Canvas } from '../types';
import {
  loadProject,
  saveCanvas as saveCanvasToFile,
  ROOT_CANVAS_KEY,
  type LoadedCanvas,
  type ResolvedProject,
} from '../storage/fileResolver';
import { serializeCanvas } from '../storage/yamlCodec';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentProject {
  name: string;
  path: string;       // fs path (Tauri/Node) or handle name (Web, informational only)
  lastOpened: string;  // ISO timestamp
}

const RECENT_PROJECTS_KEY = 'archcanvas:recentProjects';
const MAX_RECENT_PROJECTS = 5;

// ---------------------------------------------------------------------------
// localStorage helpers (safe for SSR / Node / test environments)
// ---------------------------------------------------------------------------

let _localStorage: Storage | null = null;

/** Allow tests to inject a mock localStorage */
export function setLocalStorage(storage: Storage | null): void {
  _localStorage = storage;
}

function getStorage(): Storage | null {
  if (_localStorage) return _localStorage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function loadRecentProjects(): RecentProject[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentProject[];
  } catch {
    return [];
  }
}

function persistRecentProjects(projects: RecentProject[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Quota exceeded or storage unavailable — silently ignore
  }
}

function addToRecent(
  current: RecentProject[],
  name: string,
  path: string,
): RecentProject[] {
  const entry: RecentProject = {
    name,
    path,
    lastOpened: new Date().toISOString(),
  };
  // Remove existing entry with the same path (dedup)
  const filtered = current.filter((p) => p.path !== path);
  // Add to front, enforce max
  const next = [entry, ...filtered].slice(0, MAX_RECENT_PROJECTS);
  persistRecentProjects(next);
  return next;
}

// ---------------------------------------------------------------------------
// FilePicker injection (configurable for tests)
// ---------------------------------------------------------------------------

let _filePicker: FilePicker | null = null;

/** Inject a custom FilePicker (primarily for testing) */
export function setFilePicker(picker: FilePicker | null): void {
  _filePicker = picker;
}

function getFilePicker(): FilePicker {
  return _filePicker ?? createFilePicker();
}

// ---------------------------------------------------------------------------
// Onboarding survey data (used by completeOnboarding)
// ---------------------------------------------------------------------------

export interface SurveyData {
  description: string;
  techStack: string[];
  explorationDepth: 'full' | 'top-level' | 'custom';
  customDepth?: number;
  focusDirs: string;
}

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

interface FileStoreState {
  project: ResolvedProject | null;
  dirtyCanvases: Set<string>;
  status: 'idle' | 'loading' | 'loaded' | 'needs_onboarding' | 'error';
  error: string | null;
  fs: FileSystem | null;
  recentProjects: RecentProject[];

  // Existing methods
  openProject: (fs: FileSystem) => Promise<void>;
  initializeEmptyProject: (name?: string) => void;
  saveCanvas: (fs: FileSystem, canvasId: string) => Promise<void>;
  saveAll: (fs: FileSystem) => Promise<void>;
  markDirty: (canvasId: string) => void;
  updateCanvasData: (canvasId: string, data: Canvas) => void;
  getCanvas: (canvasId: string) => LoadedCanvas | undefined;
  getRootCanvas: () => LoadedCanvas | undefined;

  // New persistence methods (UI-only — CLI never calls these)
  newProject: () => Promise<void>;
  open: () => Promise<void>;
  save: () => Promise<void>;
  isDirty: () => boolean;
  completeOnboarding: (type: 'blank' | 'ai', survey?: SurveyData) => Promise<void>;
}

// Expose store on window for E2E test access (Playwright can't import bundled modules)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exposeStore = (store: any) => {
  if (typeof window !== 'undefined') {
    (window as any).__archcanvas_fileStore__ = store;
  }
};

export const useFileStore = create<FileStoreState>((set, get) => ({
  project: null,
  dirtyCanvases: new Set(),
  status: 'idle',
  error: null,
  fs: null,
  recentProjects: loadRecentProjects(),

  initializeEmptyProject: (name = 'Untitled Project') => {
    const data: Canvas = {
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
      // 1. Check if .archcanvas/ exists
      const dirExists = await fs.exists('.archcanvas');
      if (!dirExists) {
        set({ fs, status: 'needs_onboarding', error: null });
        return;
      }

      // 2. Check if main.yaml exists
      const fileExists = await fs.exists('.archcanvas/main.yaml');
      if (!fileExists) {
        set({ fs, status: 'needs_onboarding', error: null });
        return;
      }

      // 3. Check if main.yaml has content
      const content = await fs.readFile('.archcanvas/main.yaml');
      if (content.trim() === '') {
        set({ fs, status: 'needs_onboarding', error: null });
        return;
      }

      // 4. Normal load path
      const project = await loadProject(fs);
      set({ project, fs, status: 'loaded', dirtyCanvases: new Set() });
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
    const errors: Array<{ canvasId: string; error: string }> = [];

    for (const canvasId of dirtyCanvases) {
      try {
        await get().saveCanvas(fs, canvasId);
      } catch (err) {
        errors.push({
          canvasId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (errors.length > 0) {
      const summary = errors.map((e) => `${e.canvasId}: ${e.error}`).join('; ');
      set({ error: `Failed to save: ${summary}` });
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

  // -----------------------------------------------------------------------
  // Persistence UI methods (C7)
  // -----------------------------------------------------------------------

  newProject: async () => {
    const picker = getFilePicker();
    const fs = await picker.pickDirectory();
    if (!fs) return; // user cancelled

    await get().openProject(fs);

    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      set({ recentProjects: addToRecent(get().recentProjects, projectName, projectName) });
    }
  },

  open: async () => {
    const picker = getFilePicker();
    const fs = await picker.pickDirectory();
    if (!fs) return; // user cancelled

    await get().openProject(fs);

    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      const path = projectName;
      set({
        recentProjects: addToRecent(get().recentProjects, projectName, path),
      });
    }
  },

  save: async () => {
    const { fs } = get();
    if (!fs) return; // No FileSystem — project guard ensures this is unreachable
    await get().saveAll(fs);
  },

  isDirty: () => {
    return get().dirtyCanvases.size > 0;
  },

  completeOnboarding: async (type, survey) => {
    const { fs } = get();
    if (!fs) return;

    const name = fs.getName();

    // 1. Scaffold .archcanvas/
    if (!(await fs.exists('.archcanvas'))) {
      await fs.mkdir('.archcanvas');
    }

    // 2. Write main.yaml
    const description = type === 'ai' && survey ? survey.description : '';
    const mainYaml = serializeCanvas({
      project: { name, description, version: '1.0.0' },
      nodes: [],
      edges: [],
      entities: [],
    });
    await fs.writeFile('.archcanvas/main.yaml', mainYaml);

    // 3. Load the project
    await get().openProject(fs);

    // 4. Update recents (only if loaded successfully)
    if (get().status === 'loaded') {
      set({ recentProjects: addToRecent(get().recentProjects, name, name) });
    }

    // 5. AI path: open chat + send init prompt
    if (type === 'ai' && survey && get().status === 'loaded') {
      const { useUiStore } = await import('./uiStore');
      useUiStore.getState().toggleChat();
      // Wait for next tick so assembleContext() reads valid project state
      setTimeout(async () => {
        const { assembleInitPrompt } = await import('../core/ai/initPrompt');
        const { useChatStore } = await import('./chatStore');
        const prompt = assembleInitPrompt(name, survey);
        useChatStore.getState().sendMessage(prompt);
      }, 0);
    }
  },
}));

exposeStore(useFileStore);
