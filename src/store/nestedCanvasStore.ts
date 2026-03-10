/**
 * Nested canvas store - manages the cross-file navigation stack.
 *
 * When the user drills into a container node that references another .archc file,
 * the current file's state is pushed onto the stack, and the new file's graph
 * becomes the active graph. Popping restores the previous file's state including
 * its navigation path (fractal zoom level) and viewport position.
 *
 * This is the core state machine for the Muse-style nested canvas experience:
 * - `pushFile()` saves current state and switches to a new file's graph
 * - `popFile()` restores the previous file's graph, navigation path, and viewport
 * - `getDepth()` returns how many levels deep (0 = root file)
 *
 * Integrates with:
 * - `coreStore` for swapping the active graph
 * - `navigationStore` for saving/restoring fractal zoom paths within each file
 * - `canvasStore` for saving/restoring viewport position at each level
 */

import { create } from 'zustand';
import type { ArchGraph, ArchEdge, CanvasViewport } from '@/types/graph';
import { useNavigationStore } from './navigationStore';
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

// ─── Store ─────────────────────────────────────────────────────

export interface NestedCanvasStoreState {
  /**
   * Stack of saved file states. The bottom of the stack is the root file;
   * each subsequent entry is a deeper level of cross-file navigation.
   * The active (current) file is NOT on the stack — it's in coreStore/navigationStore.
   */
  fileStack: FileStackEntry[];

  /**
   * The file path of the currently active file, or null if viewing the root file
   * (which uses coreStore's primary graph directly).
   */
  activeFilePath: string | null;

  /**
   * Push the current file state onto the stack and switch to a new file's graph.
   *
   * Saves the current graph, navigation path, and viewport as a FileStackEntry,
   * then applies the new file's graph to coreStore and resets navigation to root.
   * Also captures parent edges connecting to the container node for border indicators.
   *
   * @param filePath - Relative path of the new .archc file to navigate into
   * @param graph - The decoded graph of the new file
   * @param containerNodeId - ID of the container node being dived into (for edge capture)
   */
  pushFile: (filePath: string, graph: ArchGraph, containerNodeId?: string, containerColor?: string) => void;

  /**
   * Pop the most recent file from the stack and restore its state.
   *
   * Restores the previous file's graph to coreStore, navigation path, and viewport.
   * Returns the restored entry, or null if already at root level.
   */
  popFile: () => FileStackEntry | null;

  /**
   * Get the current depth of cross-file navigation.
   * 0 = root file (no files on stack), 1 = one level deep, etc.
   */
  getDepth: () => number;

  /**
   * Get the current file path at a given stack index.
   * Index 0 is the first file pushed (deepest in history).
   */
  getStackEntry: (index: number) => FileStackEntry | undefined;

  /**
   * Reset the entire file stack and return to root level.
   * Restores the original root file's graph, navigation path, and viewport.
   */
  popToRoot: () => FileStackEntry | null;

  /**
   * Parent edge indicators for the current nested level.
   * When the user is inside a nested canvas, these represent the parent's
   * edges that connect to the container node, rendered as clickable border indicators.
   */
  parentEdgeIndicators: ParentEdgeIndicator[];

  /**
   * Clear all nested navigation state (used when opening a new file or project).
   */
  reset: () => void;
}

/**
 * Build parent edge indicators by finding edges in the parent graph
 * that connect to the given container node.
 */
function buildParentEdgeIndicators(
  parentGraph: ArchGraph,
  containerNodeId: string,
): ParentEdgeIndicator[] {
  const indicators: ParentEdgeIndicator[] = [];

  for (const edge of parentGraph.edges) {
    if (edge.toNode === containerNodeId) {
      // Edge goes INTO the container node
      const sourceNode = parentGraph.nodes.find((n) => n.id === edge.fromNode);
      indicators.push({
        edge,
        connectedNodeName: sourceNode?.displayName ?? edge.fromNode,
        connectedNodeId: edge.fromNode,
        direction: 'incoming',
      });
    } else if (edge.fromNode === containerNodeId) {
      // Edge goes OUT of the container node
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

export const useNestedCanvasStore = create<NestedCanvasStoreState>((set, get) => ({
  fileStack: [],
  activeFilePath: null,
  parentEdgeIndicators: [],

  pushFile: (filePath, graph, containerNodeId, containerColor) => {
    const { graph: currentGraph } = useGraphStore.getState();
    const { path: currentNavPath } = useNavigationStore.getState();
    const { viewport: currentViewport } = useCanvasStore.getState();

    // Capture parent edges connecting to the container node
    const indicators = containerNodeId
      ? buildParentEdgeIndicators(currentGraph, containerNodeId)
      : [];

    // Save current state onto the stack
    const entry: FileStackEntry = {
      filePath: get().activeFilePath ?? '__root__',
      graph: currentGraph,
      navigationPath: [...currentNavPath],
      viewport: { ...currentViewport },
      containerColor: containerColor ?? undefined,
    };

    set((s) => ({
      fileStack: [...s.fileStack, entry],
      activeFilePath: filePath,
      parentEdgeIndicators: indicators,
    }));

    // Switch coreStore to the new file's graph
    useGraphStore.getState()._setGraph(graph);

    // Reset navigation to root of the new file
    useNavigationStore.getState().zoomToRoot();

    // Fit the view to the new content
    useCanvasStore.getState().requestFitView();
  },

  popFile: () => {
    const { fileStack } = get();
    if (fileStack.length === 0) return null;

    // Pop the last entry
    const restored = fileStack[fileStack.length - 1]!;
    const newStack = fileStack.slice(0, -1);

    // When popping back, rebuild indicators from the grandparent level if applicable
    // (i.e., if we're still nested after this pop, show the parent-of-parent's edges)
    // For simplicity, clear indicators when returning to a level
    set({
      fileStack: newStack,
      activeFilePath: restored.filePath === '__root__' ? null : restored.filePath,
      parentEdgeIndicators: [],
    });

    // Restore the graph
    useGraphStore.getState()._setGraph(restored.graph);

    // Restore navigation path within that file
    useNavigationStore.getState().zoomToLevel(restored.navigationPath);

    // Restore viewport
    useCanvasStore.getState().setViewport(restored.viewport);

    return restored;
  },

  getDepth: () => get().fileStack.length,

  getStackEntry: (index) => get().fileStack[index],

  popToRoot: () => {
    const { fileStack } = get();
    if (fileStack.length === 0) return null;

    // The root entry is at the bottom of the stack
    const rootEntry = fileStack[0]!;

    set({
      fileStack: [],
      activeFilePath: null,
      parentEdgeIndicators: [],
    });

    // Restore root graph
    useGraphStore.getState()._setGraph(rootEntry.graph);

    // Restore root navigation path
    useNavigationStore.getState().zoomToLevel(rootEntry.navigationPath);

    // Restore root viewport
    useCanvasStore.getState().setViewport(rootEntry.viewport);

    return rootEntry;
  },

  reset: () => {
    set({
      fileStack: [],
      activeFilePath: null,
      parentEdgeIndicators: [],
    });
  },
}));
