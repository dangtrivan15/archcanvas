import { create } from 'zustand';
import type { Canvas } from '@/types';
import type { CanvasDiff, DiffOptions, DiffStatus, ProjectDiff } from '@/core/diff/types';
import { diffProject } from '@/core/diff/engine';
import { parseCanvas } from '@/storage/yamlCodec';
import { useFileStore } from './fileStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffFilter {
  showAdded: boolean;
  showRemoved: boolean;
  showModified: boolean;
}

interface DiffStoreState {
  /** Whether diff overlay is active */
  enabled: boolean;
  /** The base ref being compared (e.g. "HEAD", "main", or a manual label) */
  baseRef: string;
  /** Per-canvas diffs */
  canvasDiffs: Map<string, CanvasDiff>;
  /** Project-level diff summary */
  projectDiff: ProjectDiff | null;
  /** Filter which diff categories to show */
  filter: DiffFilter;
  /** Loading state */
  loading: boolean;
  /** Error message if diff computation failed */
  error: string | null;
  /** Base canvas data used for diffing (stored for tooltip lookups) */
  baseCanvases: Map<string, Canvas>;

  // Actions
  toggle: () => void;
  enable: () => void;
  disable: () => void;
  setFilter: (filter: Partial<DiffFilter>) => void;
  /** Compute diff from raw YAML strings keyed by canvas ID */
  computeFromYaml: (baseYamls: Map<string, string>, ref?: string) => void;
  /** Compute diff from parsed Canvas objects */
  computeFromCanvases: (baseCanvases: Map<string, Canvas>, ref?: string) => void;
  /** Clear all diff data */
  clear: () => void;

  // Selectors (getters)
  getCanvasDiff: (canvasId: string) => CanvasDiff | undefined;
  getNodeStatus: (canvasId: string, nodeId: string) => DiffStatus | undefined;
  getEdgeStatus: (canvasId: string, fromNode: string, toNode: string, fromPort?: string, toPort?: string) => DiffStatus | undefined;
  isVisible: (status: DiffStatus) => boolean;
}

const DEFAULT_FILTER: DiffFilter = {
  showAdded: true,
  showRemoved: true,
  showModified: true,
};

const DEFAULT_OPTIONS: DiffOptions = {
  includePosition: false,
};

export const useDiffStore = create<DiffStoreState>((set, get) => ({
  enabled: false,
  baseRef: 'HEAD',
  canvasDiffs: new Map(),
  projectDiff: null,
  filter: { ...DEFAULT_FILTER },
  loading: false,
  error: null,
  baseCanvases: new Map(),

  toggle: () => {
    const { enabled } = get();
    if (enabled) {
      get().disable();
    } else {
      get().enable();
    }
  },

  enable: () => {
    set({ enabled: true });
  },

  disable: () => {
    set({
      enabled: false,
      canvasDiffs: new Map(),
      projectDiff: null,
      error: null,
      baseCanvases: new Map(),
    });
  },

  setFilter: (partial) => {
    set({ filter: { ...get().filter, ...partial } });
  },

  computeFromYaml: (baseYamls, ref = 'HEAD') => {
    set({ loading: true, error: null });

    try {
      const baseCanvases = new Map<string, Canvas>();
      for (const [canvasId, yaml] of baseYamls) {
        try {
          const parsed = parseCanvas(yaml);
          baseCanvases.set(canvasId, parsed.data);
        } catch {
          // If a base YAML is malformed, treat it as empty canvas
          baseCanvases.set(canvasId, { nodes: [], edges: [], entities: [] });
        }
      }
      get().computeFromCanvases(baseCanvases, ref);
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  computeFromCanvases: (baseCanvases, ref = 'HEAD') => {
    set({ loading: true, error: null });

    try {
      // Gather current canvases from fileStore
      const project = useFileStore.getState().project;
      if (!project) {
        set({ loading: false, error: 'No project loaded' });
        return;
      }

      const currentCanvases = new Map<string, Canvas>();
      for (const [id, loaded] of project.canvases) {
        currentCanvases.set(id, loaded.data);
      }

      // Compute project-level diff
      const projectDiff = diffProject(baseCanvases, currentCanvases, DEFAULT_OPTIONS);

      set({
        enabled: true,
        baseRef: ref,
        canvasDiffs: projectDiff.canvases,
        projectDiff,
        baseCanvases,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  clear: () => {
    set({
      enabled: false,
      canvasDiffs: new Map(),
      projectDiff: null,
      error: null,
      baseCanvases: new Map(),
      baseRef: 'HEAD',
    });
  },

  getCanvasDiff: (canvasId) => {
    return get().canvasDiffs.get(canvasId);
  },

  getNodeStatus: (canvasId, nodeId) => {
    const diff = get().canvasDiffs.get(canvasId);
    return diff?.nodes.get(nodeId)?.status;
  },

  getEdgeStatus: (canvasId, fromNode, toNode, fromPort = '', toPort = '') => {
    const diff = get().canvasDiffs.get(canvasId);
    if (!diff) return undefined;
    const key = `${fromNode}:${fromPort}→${toNode}:${toPort}`;
    return diff.edges.get(key)?.status;
  },

  isVisible: (status) => {
    const { filter, enabled } = get();
    if (!enabled) return false;
    switch (status) {
      case 'added': return filter.showAdded;
      case 'removed': return filter.showRemoved;
      case 'modified': return filter.showModified;
      default: return false;
    }
  },
}));

// Expose for E2E tests
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__archcanvas_diffStore__ = useDiffStore;
}
