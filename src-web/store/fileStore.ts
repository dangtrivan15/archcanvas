import { create } from 'zustand';
import type { FileSystem } from '../platform/fileSystem';
import type { FilePicker } from '../platform/filePicker';
import { createFilePicker } from '../platform/filePicker';
import type { Canvas } from '../types';
import {
  loadProject as loadProjectFile,
  saveCanvas as saveCanvasToFile,
  ROOT_CANVAS_KEY,
  type LoadedCanvas,
  type ResolvedProject,
} from '../storage/fileResolver';
import { setLastActiveProject } from '../core/lastActiveProject';
import { parseCanvas, serializeCanvas } from '../storage/yamlCodec';
import { useHistoryStore } from './historyStore';

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
  projectPath?: string;
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
  /** Absolute filesystem path to the project root. Null until set (Web users must set manually). */
  projectPath: string | null;

  // Existing methods
  openProject: (fs: FileSystem) => Promise<void>;
  initializeEmptyProject: (name?: string) => void;
  saveCanvas: (fs: FileSystem, canvasId: string) => Promise<void>;
  saveAll: (fs: FileSystem) => Promise<void>;
  markDirty: (canvasId: string) => void;
  markClean: (canvasId: string) => void;
  updateCanvasData: (canvasId: string, data: Canvas) => void;
  getCanvas: (canvasId: string) => LoadedCanvas | undefined;
  getRootCanvas: () => LoadedCanvas | undefined;
  /** Set the project's absolute filesystem path (for AI CWD and system prompt). */
  setProjectPath: (path: string) => void;

  /** Register a new canvas (subsystem) in the project's canvas map. */
  registerCanvas: (
    canvasId: string,
    filePath: string,
    data: Canvas,
  ) => { ok: true } | { ok: false; error: { code: 'CANVAS_ALREADY_EXISTS'; canvasId: string } };

  // New persistence methods (UI-only — CLI never calls these)
  open: () => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  openNewWithTemplate: (templateId: string) => Promise<void>;
  save: () => Promise<void>;
  isDirty: () => boolean;
  completeOnboarding: (type: 'blank' | 'ai' | 'template', survey?: SurveyData, template?: import('../core/templates/schema').ArchTemplate) => Promise<void>;
  loadProject: (fs: FileSystem) => Promise<void>;
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
  projectPath: null,

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
      // Auto-set projectPath from fs if available (Node/Tauri).
      // If null (Web/InMemory), do NOT overwrite — preserve any manually-set path.
      const fsPath = fs.getPath();
      if (fsPath) {
        set({ projectPath: fsPath });
      }

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

      // 4. Check if canvas is empty (no nodes, edges, or entities)
      const { data } = parseCanvas(content);
      if (!data.nodes?.length && !data.edges?.length && !data.entities?.length) {
        set({ fs, status: 'needs_onboarding', error: null });
        return;
      }

      // 5. Load and display
      await get().loadProject(fs);
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

    // Record the current history version as the save point so that
    // undo back to this state correctly clears the dirty flag.
    useHistoryStore.getState().markSavePoint(canvasId);
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

  markClean: (canvasId) => {
    const next = new Set(get().dirtyCanvases);
    next.delete(canvasId);
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

  setProjectPath: (path: string) => {
    set({ projectPath: path });
  },

  registerCanvas: (canvasId, filePath, data) => {
    const { project } = get();
    if (!project || project.canvases.has(canvasId)) {
      return { ok: false, error: { code: 'CANVAS_ALREADY_EXISTS' as const, canvasId } };
    }

    const entry = { filePath, data, doc: undefined };
    const nextCanvases = new Map(project.canvases);
    nextCanvases.set(canvasId, entry);

    const nextDirty = new Set(get().dirtyCanvases);
    nextDirty.add(canvasId);

    set({
      project: { ...project, canvases: nextCanvases },
      dirtyCanvases: nextDirty,
    });

    return { ok: true };
  },

  // -----------------------------------------------------------------------
  // Persistence UI methods (C7)
  // -----------------------------------------------------------------------

  open: async () => {
    // One project per tab/window: if a project is already loaded, open a new tab/window
    if (get().fs !== null && typeof window !== 'undefined') {
      if ('__TAURI_INTERNALS__' in window) {
        // Desktop: create a new Tauri window
        try {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          new WebviewWindow(`project-${Date.now()}`, {
            url: '/?action=open',
            title: 'ArchCanvas',
            width: 1280,
            height: 800,
          });
        } catch (err) {
          console.error('[fileStore] Failed to create Tauri window:', err);
        }
      } else if (typeof window.open === 'function') {
        // Web: open a new browser tab
        window.open(`${window.location.origin}${window.location.pathname}?action=open`, '_blank');
      }
      return;
    }

    const picker = getFilePicker();
    const fs = await picker.pickDirectory();
    if (!fs) return; // user cancelled

    await get().openProject(fs);

    // Update recents only on successful load (not needs_onboarding)
    if (get().status === 'loaded') {
      const projectName = get().project?.root.data.project?.name ?? 'Unknown';
      const path = fs.getPath() ?? fs.getName();
      set({
        recentProjects: addToRecent(get().recentProjects, projectName, path),
      });

      // Persist directory handle in IndexedDB for web Open Recent
      if ('getRootHandle' in fs) {
        import('../platform/handleStore')
          .then(({ storeHandle }) =>
            storeHandle(path, (fs as { getRootHandle(): FileSystemDirectoryHandle }).getRootHandle()),
          )
          .catch(() => {}); // IndexedDB unavailable — ignore
      }
    }
  },

  openRecent: async (path: string) => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    const hasProject = get().fs !== null;

    // --- Tauri path ---
    if (isTauri) {
      if (hasProject) {
        // Project loaded — open in new window
        try {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          new WebviewWindow(`project-${Date.now()}`, {
            url: `/?openPath=${encodeURIComponent(path)}`,
            title: 'ArchCanvas',
            width: 1280,
            height: 800,
          });
        } catch (err) {
          console.error('[fileStore] Failed to create Tauri window:', err);
        }
      } else {
        // No project — load in-place
        try {
          const { TauriFileSystem } = await import('../platform/tauriFileSystem');
          const fs = new TauriFileSystem(path);
          await get().openProject(fs);
        } catch (err) {
          set({ error: `Failed to open project: ${err instanceof Error ? err.message : String(err)}` });
        }
      }
      return;
    }

    // --- Web path ---
    try {
      const { getHandle } = await import('../platform/handleStore');
      const handle = await getHandle(path);
      if (!handle) {
        // Handle expired or deleted — remove from recents
        const recents = get().recentProjects.filter((r) => r.path !== path);
        persistRecentProjects(recents);
        set({ recentProjects: recents, error: 'Project no longer accessible. Removed from recents.' });
        return;
      }
      // Request permission (requires user gesture from the menu click)
      const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        set({ error: 'Permission denied. Please try again.' });
        return;
      }
      if (hasProject) {
        // Project loaded — open in new tab
        window.open(
          `${window.location.origin}${window.location.pathname}?recent=${encodeURIComponent(path)}`,
          '_blank',
        );
      } else {
        // No project — load in-place
        const { WebFileSystem } = await import('../platform/webFileSystem');
        const fs = new WebFileSystem(handle);
        await get().openProject(fs);
      }
    } catch {
      set({ error: 'Failed to open recent project.' });
    }
  },

  save: async () => {
    const { fs } = get();
    if (!fs) return; // No FileSystem — project guard ensures this is unreachable
    await get().saveAll(fs);

    // Recompute diff overlay if active — the saved canvas data may differ from baseline
    const { enabled, baseCanvases } = (await import('./diffStore')).useDiffStore.getState();
    if (enabled && baseCanvases.size > 0) {
      (await import('./diffStore')).useDiffStore.getState().computeFromCanvases(baseCanvases);
    }
  },

  openNewWithTemplate: async (templateId: string) => {
    const picker = getFilePicker();
    const fs = await picker.pickDirectory();
    if (!fs) return; // user cancelled

    // Set fs in store so completeOnboarding can use it
    set({ fs, status: 'needs_onboarding' });

    const { getTemplateById } = await import('../core/templates/loader');
    const template = getTemplateById(templateId);
    if (template) {
      await get().completeOnboarding('template', undefined, template);
    } else {
      set({
        status: 'error',
        error: `Template "${templateId}" not found.`,
      });
    }
  },

  isDirty: () => {
    return get().dirtyCanvases.size > 0;
  },

  loadProject: async (fs) => {
    try {
      const project = await loadProjectFile(fs);
      set({ project, fs, status: 'loaded', dirtyCanvases: new Set() });
      // Persist the project path so the desktop app can auto-reopen it on restart.
      // fs.getPath() returns null on Web/InMemory, making this a desktop-only no-op.
      setLastActiveProject(fs.getPath());
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  completeOnboarding: async (type, survey, template) => {
    const { fs } = get();
    if (!fs) return;

    const name = fs.getName();

    // 1. Scaffold .archcanvas/
    if (!(await fs.exists('.archcanvas'))) {
      await fs.mkdir('.archcanvas');
    }

    // 2. Write main.yaml
    if (type === 'template' && template) {
      // Template path: write the template's canvas data as main.yaml
      const { applyTemplate } = await import('../core/templates/apply');
      await applyTemplate(fs, template);
    } else {
      const description = type === 'ai' && survey ? survey.description : '';
      const mainYaml = serializeCanvas({
        project: { name, description, version: '1.0.0' },
        nodes: [],
        edges: [],
        entities: [],
      });
      await fs.writeFile('.archcanvas/main.yaml', mainYaml);
    }

    // 3. Load the project (bypass onboarding checks — user already chose)
    await get().loadProject(fs);

    // 4. Update recents (only if loaded successfully)
    if (get().status === 'loaded') {
      const path = fs.getPath() ?? fs.getName();
      set({ recentProjects: addToRecent(get().recentProjects, name, path) });
    }

    // 5. AI path: set projectPath from survey, open chat + send init prompt
    if (get().status === 'loaded' && type === 'ai' && survey) {
      if (survey.projectPath) get().setProjectPath(survey.projectPath);

      const { useUiStore } = await import('./uiStore');
      useUiStore.getState().toggleChat();
      // Wait for next tick so assembleContext() reads valid project state
      setTimeout(async () => {
        const { assembleInitPrompt } = await import('../core/ai/initPrompt');
        const { useChatStore } = await import('./chatStore');
        const prompt = assembleInitPrompt(name, survey);
        useChatStore.getState().sendMessage(prompt);

        // Auto-layout when AI finishes creating nodes
        let wasStreaming = false;
        const unsub = useChatStore.subscribe((state) => {
          if (wasStreaming && !state.isStreaming) {
            unsub();
            window.dispatchEvent(
              new CustomEvent('archcanvas:auto-layout'),
            );
          }
          wasStreaming = state.isStreaming;
        });
      }, 0);
    }
  },
}));

exposeStore(useFileStore);
