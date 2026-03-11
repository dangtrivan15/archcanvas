/**
 * Unified Navigation Store - manages both fractal zoom (within-file) and
 * cross-file navigation in a single store.
 *
 * ## Design
 *
 * Navigation has two dimensions:
 * 1. **Fractal zoom** (within a file): `path: string[]` of node IDs
 * 2. **Cross-file**: `fileStack: FileStackEntry[]` of saved file states
 *
 * `path` is the primary state for fractal zoom and is always kept in sync
 * with the current file level. When pushing/popping files, the path is
 * saved/restored alongside the file stack entry.
 *
 * ## Breadcrumb
 *
 * The `breadcrumb` property provides a unified view combining both file and
 * node navigation into a flat trail of `BreadcrumbEntry` objects for UI display.
 * It is derived from `fileStack` and `path`.
 *
 * ## Backwards Compatibility
 *
 * This store preserves the original `navigationStore` API:
 * - `path: string[]` = node IDs for current fractal zoom level
 * - `zoomIn(nodeId)` = append to path
 * - `zoomOut()` = remove last from path
 * - `zoomToRoot()` = clear path
 * - `zoomToLevel(path)` = set path directly
 *
 * And the original `nestedCanvasStore` API:
 * - `fileStack` = saved file states
 * - `pushFile(filePath, graph, containerNodeId?, containerColor?)` = save + switch
 * - `popFile()` = restore parent file
 * - `popToRoot()` = restore root file
 * - `getDepth()` = file nesting depth
 * - `getStackEntry(index)` = get file stack entry at index
 * - `activeFilePath` = current file path
 * - `parentEdgeIndicators` = parent edges for portal indicators
 * - `reset()` = clear all state
 *
 * ## Cross-Store Interactions
 *
 * When navigating between files, the store interacts with:
 * - `coreStore._setGraph()` to swap the active architecture graph
 * - `canvasStore.setViewport()` / `requestFitView()` to restore/fit viewport
 */

import { create } from 'zustand';
import type { ArchGraph, ArchEdge, CanvasViewport } from '@/types/graph';
import { useCanvasStore } from './canvasStore';
import { useGraphStore } from './graphStore';

// ─── Types ─────────────────────────────────────────────────────

/**
 * Describes a parent edge that connects to the container node the user dived into.
 * Used to render "portal" indicators at the canvas borders.
 */
export interface ParentEdgeIndicator {
  /** The edge from the parent graph. */
  edge: ArchEdge;
  /** Display name of the node on the other end (in the parent graph). */
  connectedNodeName: string;
  /** ID of the connected node in the parent graph (for centering after pop). */
  connectedNodeId: string;
  /** Whether this edge goes INTO the container ('incoming') or OUT of it ('outgoing'). */
  direction: 'incoming' | 'outgoing';
}

/**
 * A single entry in the file navigation stack.
 *
 * Captures the complete state of one level of file navigation so that
 * the user can return to exactly where they were when they drilled in.
 */
export interface FileStackEntry {
  /** Relative path of the .archc file within the project. */
  filePath: string;
  /** The architecture graph snapshot at this level. */
  graph: ArchGraph;
  /** The fractal zoom navigation path within this file. */
  navigationPath: string[];
  /** The canvas viewport position and zoom at this level. */
  viewport: CanvasViewport;
  /** Color of the container node that was dived into (for nesting frame tint). */
  containerColor?: string;
}

/** A single entry in the unified breadcrumb trail (for UI display). */
export interface BreadcrumbEntry {
  /** Whether this level is a fractal-zoom node or a cross-file jump. */
  type: 'node' | 'file';
  /** Node ID (for 'node' entries) or file path (for 'file' entries). */
  id: string;
  /** Human-readable label for breadcrumb display. */
  displayName: string;
  /** Saved viewport at this level. */
  viewport: ViewportEntry;
  /** Saved graph snapshot (only for 'file' entries). */
  graph?: ArchGraph;
  /** Container node color (for nesting frame tint, 'file' entries only). */
  containerColor?: string;
}

/** Viewport snapshot. */
export interface ViewportEntry {
  x: number;
  y: number;
  zoom: number;
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build parent edge indicators by finding edges in the parent graph
 * that connect to the given container node.
 */
export function buildParentEdgeIndicators(
  parentGraph: ArchGraph,
  containerNodeId: string,
): ParentEdgeIndicator[] {
  const indicators: ParentEdgeIndicator[] = [];

  for (const edge of parentGraph.edges) {
    if (edge.toNode === containerNodeId) {
      const sourceNode = parentGraph.nodes.find((n) => n.id === edge.fromNode);
      indicators.push({
        edge,
        connectedNodeName: sourceNode?.displayName ?? edge.fromNode,
        connectedNodeId: edge.fromNode,
        direction: 'incoming',
      });
    } else if (edge.fromNode === containerNodeId) {
      const targetNode = parentGraph.nodes.find((n) => n.id === edge.toNode);
      indicators.push({
        edge,
        connectedNodeName: targetNode?.displayName ?? edge.toNode,
        connectedNodeId: edge.toNode,
        direction: 'outgoing',
      });
    }
  }

  return indicators;
}

/**
 * Build a unified breadcrumb trail from fileStack and path.
 * Interleaves file entries with their saved node paths, then appends the current path.
 */
function buildBreadcrumb(
  fileStack: FileStackEntry[],
  path: string[],
): BreadcrumbEntry[] {
  const entries: BreadcrumbEntry[] = [];

  for (const stackEntry of fileStack) {
    // Add node entries from the saved navigation path at this level
    for (const nodeId of stackEntry.navigationPath) {
      entries.push({
        type: 'node',
        id: nodeId,
        displayName: nodeId,
        viewport: { ...stackEntry.viewport },
      });
    }

    // Add the file entry itself
    entries.push({
      type: 'file',
      id: stackEntry.filePath,
      displayName: stackEntry.filePath,
      viewport: { ...stackEntry.viewport },
      graph: stackEntry.graph,
      containerColor: stackEntry.containerColor,
    });
  }

  // Add current path nodes
  for (const nodeId of path) {
    entries.push({
      type: 'node',
      id: nodeId,
      displayName: nodeId,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  }

  return entries;
}

// ─── Store State ────────────────────────────────────────────────

export interface NavigationStoreState {
  // ── Core State ──────────────────────────────────────────────

  /** Fractal zoom path within the current file (empty = root level). */
  path: string[];

  /**
   * Stack of saved file states. The bottom of the stack is the root file;
   * each subsequent entry is a deeper level of cross-file navigation.
   * The active (current) file is NOT on the stack — it's in coreStore.
   */
  fileStack: FileStackEntry[];

  /** Parent edge indicators for the current nested level. */
  parentEdgeIndicators: ParentEdgeIndicator[];

  /**
   * The file path of the currently active file, or null if viewing the root file
   * (which uses coreStore's primary graph directly).
   */
  activeFilePath: string | null;

  // ── Fractal Zoom Actions (backwards-compatible) ─────────────

  /** Zoom into a child node (appends to path). */
  zoomIn: (nodeId: string) => void;

  /** Zoom out one level (removes last from path). */
  zoomOut: () => void;

  /** Zoom to root level (clears path). */
  zoomToRoot: () => void;

  /** Set the path directly to a specific level. */
  zoomToLevel: (path: string[]) => void;

  // ── Unified Actions ─────────────────────────────────────────

  /** Dive into a child node (same as zoomIn). */
  diveIntoNode: (nodeId: string) => void;

  /** Dive into a cross-file reference. */
  diveIntoFile: (
    filePath: string,
    graph: ArchGraph,
    containerNodeId?: string,
    containerColor?: string,
  ) => void;

  /** Go up one level (pops a node from path, or a file if path is empty). */
  goUp: () => void;

  /** Go to root (clear all file stack and path). */
  goToRoot: () => void;

  /** Go to a specific depth index. */
  goToDepth: (index: number) => void;

  /** Reset all navigation state. */
  reset: () => void;

  // ── Computed (derived from state) ───────────────────────────

  /** Unified breadcrumb trail combining file and node entries. */
  breadcrumb: BreadcrumbEntry[];

  /** Total depth (fileStack.length + path.length). */
  currentDepth: number;

  /** Node IDs only (alias for path, for renderApi compatibility). */
  currentNodePath: string[];

  /** Whether we're at the root level (no file stack entries and empty path). */
  isAtRoot: boolean;

  /** Number of file entries in the stack. */
  fileDepth: number;

  /** Number of node entries in the current path. */
  nodeDepth: number;

  // ── File Stack Actions (nestedCanvasStore facade) ───────────

  /** Push current file state and switch to a new file's graph. */
  pushFile: (
    filePath: string,
    graph: ArchGraph,
    containerNodeId?: string,
    containerColor?: string,
  ) => void;

  /** Pop the most recent file and restore parent state. */
  popFile: () => FileStackEntry | null;

  /** Pop all files, returning to root. */
  popToRoot: () => FileStackEntry | null;

  /** Get the current file depth (number of file entries). */
  getDepth: () => number;

  /** Get a file stack entry at the given index. */
  getStackEntry: (index: number) => FileStackEntry | undefined;
}

// ─── Derived State Helper ───────────────────────────────────────

/** Compute all derived fields from path and fileStack. */
function computeDerived(path: string[], fileStack: FileStackEntry[]) {
  return {
    breadcrumb: buildBreadcrumb(fileStack, path),
    currentDepth: fileStack.length + path.length,
    currentNodePath: path,
    isAtRoot: fileStack.length === 0 && path.length === 0,
    fileDepth: fileStack.length,
    nodeDepth: path.length,
  };
}

// ─── Store Creation ─────────────────────────────────────────────

export const useNavigationStore = create<NavigationStoreState>((set, get) => ({
  // ── Initial State ─────────────────────────────────────────
  path: [],
  fileStack: [],
  parentEdgeIndicators: [],
  activeFilePath: null,

  // Derived (initial values)
  breadcrumb: [],
  currentDepth: 0,
  currentNodePath: [],
  isAtRoot: true,
  fileDepth: 0,
  nodeDepth: 0,

  // ── Fractal Zoom Actions ──────────────────────────────────

  zoomIn: (nodeId) => set((s) => {
    const newPath = [...s.path, nodeId];
    return { path: newPath, ...computeDerived(newPath, s.fileStack) };
  }),

  zoomOut: () => set((s) => {
    const newPath = s.path.slice(0, -1);
    return { path: newPath, ...computeDerived(newPath, s.fileStack) };
  }),

  zoomToRoot: () => set((s) => {
    return { path: [], ...computeDerived([], s.fileStack) };
  }),

  zoomToLevel: (newPath) => set((s) => {
    return { path: newPath, ...computeDerived(newPath, s.fileStack) };
  }),

  // ── Unified Actions ───────────────────────────────────────

  diveIntoNode: (nodeId) => {
    get().zoomIn(nodeId);
  },

  diveIntoFile: (filePath, graph, containerNodeId, containerColor) => {
    const { path, fileStack, activeFilePath } = get();
    const currentGraph = useGraphStore.getState().graph;
    const { viewport: currentViewport } = useCanvasStore.getState();

    // Capture parent edges connecting to the container node
    const indicators = containerNodeId
      ? buildParentEdgeIndicators(currentGraph, containerNodeId)
      : [];

    // Save current state as a file stack entry
    const entry: FileStackEntry = {
      filePath: activeFilePath ?? '__root__',
      graph: currentGraph,
      navigationPath: [...path],
      viewport: { ...currentViewport },
      containerColor: containerColor ?? undefined,
    };

    const newFileStack = [...fileStack, entry];
    const newPath: string[] = [];

    set({
      path: newPath,
      fileStack: newFileStack,
      activeFilePath: filePath,
      parentEdgeIndicators: indicators,
      ...computeDerived(newPath, newFileStack),
    });

    // Switch coreStore to the new file's graph
    useGraphStore.getState()._setGraph(graph);

    // Fit the view to the new content
    useCanvasStore.getState().requestFitView();
  },

  goUp: () => {
    const { path } = get();

    if (path.length > 0) {
      // Pop a node level
      get().zoomOut();
    } else {
      // Pop a file level
      get().popFile();
    }
  },

  goToRoot: () => {
    const { fileStack } = get();

    if (fileStack.length > 0) {
      // Pop all file levels then clear path
      const rootEntry = get().popToRoot();
      // After popToRoot, path is restored from root entry. Clear it for full root.
      if (rootEntry) {
        set((s) => {
          const newPath: string[] = [];
          return { path: newPath, ...computeDerived(newPath, s.fileStack) };
        });
      }
    } else {
      // Just clear path
      set((s) => {
        return { path: [], ...computeDerived([], s.fileStack) };
      });
    }
  },

  goToDepth: (index) => {
    const { path, fileStack } = get();
    const totalDepth = fileStack.length + path.length;

    if (index < 0 || index >= totalDepth) return;

    if (index >= fileStack.length) {
      // Target is within node path — just truncate path
      const nodeIndex = index - fileStack.length;
      const newPath = path.slice(0, nodeIndex + 1);
      set({ path: newPath, ...computeDerived(newPath, fileStack) });
    }
    // Navigating across file boundaries requires multiple pops — complex,
    // deferred to P05-T2 consumer migration.
  },

  reset: () => {
    set({
      path: [],
      fileStack: [],
      parentEdgeIndicators: [],
      activeFilePath: null,
      ...computeDerived([], []),
    });
  },

  // ── File Stack Facade ─────────────────────────────────────

  pushFile: (filePath, graph, containerNodeId, containerColor) => {
    get().diveIntoFile(filePath, graph, containerNodeId, containerColor);
  },

  popFile: () => {
    const { fileStack } = get();
    if (fileStack.length === 0) return null;

    // Pop the last entry
    const restored = fileStack[fileStack.length - 1]!;
    const newFileStack = fileStack.slice(0, -1);

    const returnEntry: FileStackEntry = {
      filePath: restored.filePath,
      graph: restored.graph,
      navigationPath: restored.navigationPath,
      viewport: { ...restored.viewport },
      containerColor: restored.containerColor,
    };

    // Determine the new active file path
    const newActiveFilePath = restored.filePath === '__root__' ? null : restored.filePath;

    // Update state: restore the saved navigation path
    set({
      path: restored.navigationPath,
      fileStack: newFileStack,
      activeFilePath: newActiveFilePath,
      parentEdgeIndicators: [],
      ...computeDerived(restored.navigationPath, newFileStack),
    });

    // Restore the graph
    useGraphStore.getState()._setGraph(restored.graph);

    // Restore viewport
    useCanvasStore.getState().setViewport(restored.viewport);

    return returnEntry;
  },

  popToRoot: () => {
    const { fileStack } = get();
    if (fileStack.length === 0) return null;

    // The root entry is at the bottom of the stack
    const rootEntry = fileStack[0]!;

    const returnEntry: FileStackEntry = {
      filePath: rootEntry.filePath,
      graph: rootEntry.graph,
      navigationPath: rootEntry.navigationPath,
      viewport: { ...rootEntry.viewport },
      containerColor: rootEntry.containerColor,
    };

    // Update state: restore root path + clear fileStack
    set({
      path: rootEntry.navigationPath,
      fileStack: [],
      activeFilePath: null,
      parentEdgeIndicators: [],
      ...computeDerived(rootEntry.navigationPath, []),
    });

    // Restore root graph
    useGraphStore.getState()._setGraph(rootEntry.graph);

    // Restore root viewport
    useCanvasStore.getState().setViewport(rootEntry.viewport);

    return returnEntry;
  },

  getDepth: () => get().fileStack.length,

  getStackEntry: (index) => get().fileStack[index],
}));
