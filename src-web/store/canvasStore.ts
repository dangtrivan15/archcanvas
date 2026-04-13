import { create } from 'zustand';
import type { EdgeEndpoint } from '@/types';
import type { EngineResult } from '@/core/graph/types';
import { serializeSelection, deserializeForPaste } from '@/core/graph/clipboard';
import { useGraphStore } from './graphStore';
import { useHistoryStore } from './historyStore';
import { useFileStore } from './fileStore';
import { useClipboardStore } from './clipboardStore';

export type ZoomTier = 'far' | 'medium' | 'close';

/** Convert a raw zoom level to one of the three display density tiers. */
export function zoomToTier(zoom: number): ZoomTier {
  if (zoom < 0.4) return 'far';
  if (zoom <= 0.75) return 'medium';
  return 'close';
}

interface CanvasStoreState {
  selectedNodeIds: Set<string>;
  selectedEdgeKeys: Set<string>; // "from→to" format
  draftEdge: { from: EdgeEndpoint } | null;
  highlightedEdgeIds: string[];
  zoomTier: ZoomTier;
  /** Transient error surfaced by auto-layout; cleared on next successful run. */
  layoutError: string | null;

  selectNodes(ids: string[]): void;
  selectEdge(from: string, to: string): void;
  clearSelection(): void;
  startDraftEdge(from: EdgeEndpoint): void;
  completeDraftEdge(canvasId: string, to: EdgeEndpoint, fromOverride?: EdgeEndpoint): EngineResult;
  cancelDraftEdge(): void;
  deleteSelection(canvasId: string): EngineResult | null;
  copySelection(canvasId: string): void;
  cutSelection(canvasId: string): void;
  pasteFromClipboard(canvasId: string): EngineResult | null;
  duplicateSelection(canvasId: string): EngineResult | null;
  highlightEdges(edgeIds: string[]): void;
  clearHighlight(): void;
  setZoomTier(tier: ZoomTier): void;
  setLayoutError(error: string | null): void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  selectedNodeIds: new Set(),
  selectedEdgeKeys: new Set(),
  draftEdge: null,
  highlightedEdgeIds: [],
  zoomTier: 'close' as ZoomTier,
  layoutError: null,

  selectNodes(ids) {
    set({ selectedNodeIds: new Set(ids), selectedEdgeKeys: new Set() });
  },

  selectEdge(from, to) {
    set({ selectedEdgeKeys: new Set([`${from}→${to}`]), selectedNodeIds: new Set() });
  },

  clearSelection() {
    set({ selectedNodeIds: new Set(), selectedEdgeKeys: new Set() });
  },

  startDraftEdge(from) {
    set({ draftEdge: { from } });
  },

  completeDraftEdge(canvasId, to, fromOverride) {
    const { draftEdge } = get();
    const fromEndpoint = fromOverride ?? draftEdge?.from ?? { node: '' };
    // Always clear draftEdge regardless of outcome
    set({ draftEdge: null });
    return useGraphStore.getState().addEdge(canvasId, { from: fromEndpoint, to });
  },

  cancelDraftEdge() {
    set({ draftEdge: null });
  },

  deleteSelection(canvasId) {
    const { selectedNodeIds, selectedEdgeKeys } = get();
    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();
    let firstFailure: EngineResult | null = null;

    // Batch all deletions so they produce a single undo entry
    hs.beginBatch();

    for (const nodeId of selectedNodeIds) {
      const result = gs.removeNode(canvasId, nodeId);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    for (const edgeKey of selectedEdgeKeys) {
      const [from, to] = edgeKey.split('→');
      const result = gs.removeEdge(canvasId, from, to);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    hs.commitBatch();

    set({ selectedNodeIds: new Set(), selectedEdgeKeys: new Set() });
    return firstFailure;
  },

  copySelection(canvasId) {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.size === 0) return;

    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) return;

    const payload = serializeSelection(canvas.data, selectedNodeIds, canvasId);
    if (payload) {
      useClipboardStore.getState().setPayload(payload);
    }
  },

  cutSelection(canvasId) {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.size === 0) return;

    // Copy first, then delete
    get().copySelection(canvasId);
    get().deleteSelection(canvasId);
  },

  pasteFromClipboard(canvasId) {
    const payload = useClipboardStore.getState().payload;
    if (!payload) return null;

    const { nodes, edges } = deserializeForPaste(payload);
    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();
    let firstFailure: EngineResult | null = null;

    hs.beginBatch();

    for (const node of nodes) {
      const result = gs.addNode(canvasId, node);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    for (const edge of edges) {
      const result = gs.addEdge(canvasId, edge);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    hs.commitBatch();

    // Select the newly pasted nodes
    set({
      selectedNodeIds: new Set(nodes.map((n) => n.id)),
      selectedEdgeKeys: new Set(),
    });

    return firstFailure;
  },

  duplicateSelection(canvasId) {
    const { selectedNodeIds } = get();
    if (selectedNodeIds.size === 0) return null;

    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) return null;

    const payload = serializeSelection(canvas.data, selectedNodeIds, canvasId);
    if (!payload) return null;

    const { nodes, edges } = deserializeForPaste(payload);
    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();
    let firstFailure: EngineResult | null = null;

    hs.beginBatch();

    for (const node of nodes) {
      const result = gs.addNode(canvasId, node);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    for (const edge of edges) {
      const result = gs.addEdge(canvasId, edge);
      if (!result.ok && firstFailure === null) {
        firstFailure = result;
      }
    }

    hs.commitBatch();

    // Select the newly duplicated nodes
    set({
      selectedNodeIds: new Set(nodes.map((n) => n.id)),
      selectedEdgeKeys: new Set(),
    });

    return firstFailure;
  },

  highlightEdges(edgeIds) {
    set({ highlightedEdgeIds: edgeIds });
  },

  clearHighlight() {
    set({ highlightedEdgeIds: [] });
  },

  setZoomTier(tier) {
    if (get().zoomTier !== tier) {
      set({ zoomTier: tier });
    }
  },

  setLayoutError(error) {
    set({ layoutError: error });
  },
}));
