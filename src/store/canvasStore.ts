/**
 * Canvas store - React Flow viewport and selection state.
 */

import { create } from 'zustand';
import type { CanvasViewport } from '@/types/graph';

export interface CanvasStoreState {
  // Selected node/edge
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Viewport
  viewport: CanvasViewport;

  // Fit view request counter (Canvas watches for changes)
  fitViewCounter: number;

  // Actions
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  setViewport: (viewport: CanvasViewport) => void;
  requestFitView: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  fitViewCounter: 0,

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null }),

  setViewport: (viewport) =>
    set({ viewport }),

  requestFitView: () =>
    set((s) => ({ fitViewCounter: s.fitViewCounter + 1 })),
}));
