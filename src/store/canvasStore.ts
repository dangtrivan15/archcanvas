import { create } from 'zustand';
import type { EdgeEndpoint } from '@/types';
import type { EngineResult } from '@/core/graph/types';
import { useGraphStore } from './graphStore';
import { useHistoryStore } from './historyStore';
import { useNavigationStore } from './navigationStore';

interface CanvasStoreState {
  selectedNodeIds: Set<string>;
  selectedEdgeKeys: Set<string>; // "from→to" format
  draftEdge: { from: EdgeEndpoint } | null;

  selectNodes(ids: string[]): void;
  selectEdge(from: string, to: string): void;
  clearSelection(): void;
  startDraftEdge(from: EdgeEndpoint): void;
  completeDraftEdge(to: EdgeEndpoint, fromOverride?: EdgeEndpoint): EngineResult;
  cancelDraftEdge(): void;
  deleteSelection(): EngineResult | null;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  selectedNodeIds: new Set(),
  selectedEdgeKeys: new Set(),
  draftEdge: null,

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

  completeDraftEdge(to, fromOverride) {
    const { draftEdge } = get();
    const fromEndpoint = fromOverride ?? draftEdge?.from ?? { node: '' };
    // Always clear draftEdge regardless of outcome
    set({ draftEdge: null });
    const canvasId = useNavigationStore.getState().currentCanvasId;
    return useGraphStore.getState().addEdge(canvasId, { from: fromEndpoint, to });
  },

  cancelDraftEdge() {
    set({ draftEdge: null });
  },

  deleteSelection() {
    const { selectedNodeIds, selectedEdgeKeys } = get();
    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();
    const canvasId = useNavigationStore.getState().currentCanvasId;
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
}));
