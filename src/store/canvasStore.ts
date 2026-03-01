/**
 * Canvas store - React Flow viewport and selection state.
 */

import { create } from 'zustand';

export interface CanvasStoreState {
  // Selected node/edge
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Actions
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null }),
}));
