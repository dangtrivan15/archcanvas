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

/** Zoom configuration constants */
export const ZOOM_STEP = 0.2;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 2.0;
export const ZOOM_DURATION = 200;

export interface CanvasStoreState {
  // Selected node/edge (single - backward compat, derived from multi-select)
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // Multi-selection arrays
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // Viewport
  viewport: CanvasViewport;

  // Fit view request counter (Canvas watches for changes)
  fitViewCounter: number;

  // Zoom request counters (Canvas watches for changes and uses React Flow API)
  zoomInCounter: number;
  zoomOutCounter: number;
  zoom100Counter: number;

  // Layout spacing configuration
  layoutSpacing: LayoutSpacing;

  // Actions - single selection (replaces entire selection)
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;

  // Actions - multi-selection
  addNodeToSelection: (nodeId: string) => void;
  removeNodeFromSelection: (nodeId: string) => void;
  toggleNodeInSelection: (nodeId: string) => void;
  selectNodes: (nodeIds: string[]) => void;
  addEdgeToSelection: (edgeId: string) => void;
  removeEdgeFromSelection: (edgeId: string) => void;
  selectEdges: (edgeIds: string[]) => void;

  setViewport: (viewport: CanvasViewport) => void;
  requestFitView: () => void;
  requestZoomIn: () => void;
  requestZoomOut: () => void;
  requestZoom100: () => void;
  setLayoutSpacing: (spacing: Partial<LayoutSpacing>) => void;
  resetLayoutSpacing: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  fitViewCounter: 0,
  zoomInCounter: 0,
  zoomOutCounter: 0,
  zoom100Counter: 0,
  layoutSpacing: { ...DEFAULT_LAYOUT_SPACING },

  // Single select: replaces entire selection
  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      selectedNodeIds: nodeId ? [nodeId] : [],
      selectedEdgeIds: [],
    }),

  selectEdge: (edgeId) =>
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      selectedEdgeIds: edgeId ? [edgeId] : [],
      selectedNodeIds: [],
    }),

  clearSelection: () =>
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    }),

  // Multi-selection: add/remove/toggle individual nodes
  addNodeToSelection: (nodeId) =>
    set((s) => {
      if (s.selectedNodeIds.includes(nodeId)) return s;
      const newIds = [...s.selectedNodeIds, nodeId];
      return {
        selectedNodeIds: newIds,
        selectedNodeId: newIds[newIds.length - 1] ?? null,
        selectedEdgeId: null,
        selectedEdgeIds: [],
      };
    }),

  removeNodeFromSelection: (nodeId) =>
    set((s) => {
      const newIds = s.selectedNodeIds.filter((id) => id !== nodeId);
      return {
        selectedNodeIds: newIds,
        selectedNodeId: newIds[newIds.length - 1] ?? null,
      };
    }),

  toggleNodeInSelection: (nodeId) =>
    set((s) => {
      const exists = s.selectedNodeIds.includes(nodeId);
      const newIds = exists
        ? s.selectedNodeIds.filter((id) => id !== nodeId)
        : [...s.selectedNodeIds, nodeId];
      return {
        selectedNodeIds: newIds,
        selectedNodeId: newIds[newIds.length - 1] ?? null,
        selectedEdgeId: null,
        selectedEdgeIds: [],
      };
    }),

  selectNodes: (nodeIds) =>
    set({
      selectedNodeIds: nodeIds,
      selectedNodeId: nodeIds[nodeIds.length - 1] ?? null,
      selectedEdgeId: null,
      selectedEdgeIds: [],
    }),

  addEdgeToSelection: (edgeId) =>
    set((s) => {
      if (s.selectedEdgeIds.includes(edgeId)) return s;
      const newIds = [...s.selectedEdgeIds, edgeId];
      return {
        selectedEdgeIds: newIds,
        selectedEdgeId: newIds[newIds.length - 1] ?? null,
        selectedNodeId: null,
        selectedNodeIds: [],
      };
    }),

  removeEdgeFromSelection: (edgeId) =>
    set((s) => {
      const newIds = s.selectedEdgeIds.filter((id) => id !== edgeId);
      return {
        selectedEdgeIds: newIds,
        selectedEdgeId: newIds[newIds.length - 1] ?? null,
      };
    }),

  selectEdges: (edgeIds) =>
    set({
      selectedEdgeIds: edgeIds,
      selectedEdgeId: edgeIds[edgeIds.length - 1] ?? null,
      selectedNodeId: null,
      selectedNodeIds: [],
    }),

  setViewport: (viewport) =>
    set({ viewport }),

  requestFitView: () =>
    set((s) => ({ fitViewCounter: s.fitViewCounter + 1 })),

  requestZoomIn: () =>
    set((s) => ({ zoomInCounter: s.zoomInCounter + 1 })),

  requestZoomOut: () =>
    set((s) => ({ zoomOutCounter: s.zoomOutCounter + 1 })),

  requestZoom100: () =>
    set((s) => ({ zoom100Counter: s.zoom100Counter + 1 })),

  setLayoutSpacing: (spacing) =>
    set((s) => ({ layoutSpacing: { ...s.layoutSpacing, ...spacing } })),

  resetLayoutSpacing: () =>
    set({ layoutSpacing: { ...DEFAULT_LAYOUT_SPACING } }),
}));
