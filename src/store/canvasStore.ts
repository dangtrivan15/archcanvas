/**
 * Canvas store - React Flow viewport and selection state.
 */

import { create } from 'zustand';
import type { CanvasViewport } from '@/types/graph';

export interface LayoutSpacing {
  nodeSpacing: number;
  layerSpacing: number;
}

export const DEFAULT_LAYOUT_SPACING: LayoutSpacing = {
  nodeSpacing: 60,
  layerSpacing: 100,
};

export interface CanvasStoreState {
  // Selected node/edge
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Viewport
  viewport: CanvasViewport;

  // Fit view request counter (Canvas watches for changes)
  fitViewCounter: number;

  // Layout spacing configuration
  layoutSpacing: LayoutSpacing;

  // Actions
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  setViewport: (viewport: CanvasViewport) => void;
  requestFitView: () => void;
  setLayoutSpacing: (spacing: Partial<LayoutSpacing>) => void;
  resetLayoutSpacing: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  fitViewCounter: 0,
  layoutSpacing: { ...DEFAULT_LAYOUT_SPACING },

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

  setLayoutSpacing: (spacing) =>
    set((s) => ({ layoutSpacing: { ...s.layoutSpacing, ...spacing } })),

  resetLayoutSpacing: () =>
    set({ layoutSpacing: { ...DEFAULT_LAYOUT_SPACING } }),
}));
