/**
 * History store - manages undo/redo state.
 *
 * Wraps the UndoManager from engineStore and provides
 * reactive canUndo/canRedo flags for the UI.
 */

import { create } from 'zustand';
import type { ArchGraph } from '@/types/graph';
import { countAllNodes } from '@/core/graph/graphQuery';
import { haptics } from '@/hooks/useHaptics';
import { useEngineStore } from './engineStore';
import { useGraphStore } from './graphStore';

export interface HistoryStoreState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;

  /** Push a snapshot to the undo stack. */
  pushSnapshot: (description: string, graph: ArchGraph) => void;

  /** Undo the last action. Returns the restored graph or undefined. */
  undo: () => void;
  /** Redo the last undone action. Returns the restored graph or undefined. */
  redo: () => void;

  /** Reset the undo history (clear + initial snapshot). */
  reset: (graph: ArchGraph) => void;
  /** Clear the undo history entirely. */
  clear: () => void;
}

export const useHistoryStore = create<HistoryStoreState>((set) => ({
  canUndo: false,
  canRedo: false,

  pushSnapshot: (description, graph) => {
    const { undoManager } = useEngineStore.getState();
    if (!undoManager) return;
    undoManager.snapshot(description, graph);
    set({ canUndo: undoManager.canUndo, canRedo: undoManager.canRedo });
  },

  undo: () => {
    const { undoManager, textApi } = useEngineStore.getState();
    if (!undoManager || !textApi) return;

    const previousGraph = undoManager.undo();
    if (previousGraph) {
      textApi.setGraph(previousGraph);
      useGraphStore.getState()._setGraph(previousGraph);
      useGraphStore.setState({
        isDirty: true,
        nodeCount: countAllNodes(previousGraph),
        edgeCount: previousGraph.edges.length,
      });
      set({ canUndo: undoManager.canUndo, canRedo: undoManager.canRedo });
      haptics.impact('Light');
    }
  },

  redo: () => {
    const { undoManager, textApi } = useEngineStore.getState();
    if (!undoManager || !textApi) return;

    const nextGraph = undoManager.redo();
    if (nextGraph) {
      textApi.setGraph(nextGraph);
      useGraphStore.getState()._setGraph(nextGraph);
      useGraphStore.setState({
        isDirty: true,
        nodeCount: countAllNodes(nextGraph),
        edgeCount: nextGraph.edges.length,
      });
      set({ canUndo: undoManager.canUndo, canRedo: undoManager.canRedo });
      haptics.impact('Light');
    }
  },

  reset: (graph) => {
    const { undoManager } = useEngineStore.getState();
    if (!undoManager) return;
    undoManager.clear();
    undoManager.snapshot('Open file', graph);
    set({ canUndo: false, canRedo: false });
  },

  clear: () => {
    const { undoManager } = useEngineStore.getState();
    if (!undoManager) return;
    undoManager.clear();
    set({ canUndo: false, canRedo: false });
  },
}));
