import { create } from 'zustand';
import type { ClipboardPayload } from '@/core/graph/clipboard';
import { serializeSelection, preparePaste } from '@/core/graph/clipboard';
import { useFileStore } from './fileStore';
import { useCanvasStore } from './canvasStore';
import { useGraphStore } from './graphStore';
import { useHistoryStore } from './historyStore';
import { useNavigationStore } from './navigationStore';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ClipboardStoreState {
  /** The internal clipboard buffer. `null` when empty. */
  buffer: ClipboardPayload | null;

  /**
   * Cascade counter — incremented on each paste so successive pastes
   * fan out diagonally instead of stacking.
   */
  pasteCount: number;

  /** Copy the current selection into the buffer. */
  copy(): void;

  /** Paste the buffer into the current canvas. */
  paste(): void;

  /** Cut — copy then delete the selection (single undo entry). */
  cut(): void;

  /** Duplicate — copy + immediate paste (single undo entry). */
  duplicate(): void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useClipboardStore = create<ClipboardStoreState>((set, get) => ({
  buffer: null,
  pasteCount: 0,

  // ── Copy ────────────────────────────────────────────────────────────────
  copy() {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) return;

    const { selectedNodeIds } = useCanvasStore.getState();
    if (selectedNodeIds.size === 0) return;

    const payload = serializeSelection(canvas.data, selectedNodeIds);
    if (payload.nodes.length === 0) return; // only RefNodes selected

    set({ buffer: payload, pasteCount: 0 });
  },

  // ── Paste ───────────────────────────────────────────────────────────────
  paste() {
    const { buffer, pasteCount } = get();
    if (!buffer || buffer.nodes.length === 0) return;

    const canvasId = useNavigationStore.getState().currentCanvasId;
    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();

    const { nodes, edges } = preparePaste(buffer, pasteCount);

    // Batch all additions into a single undo entry
    hs.beginBatch();

    for (const node of nodes) {
      gs.addNode(canvasId, node);
    }
    for (const edge of edges) {
      gs.addEdge(canvasId, edge);
    }

    hs.commitBatch();

    // Select the newly pasted nodes
    useCanvasStore.getState().selectNodes(nodes.map((n) => n.id));

    // Advance cascade counter
    set({ pasteCount: pasteCount + 1 });
  },

  // ── Cut ─────────────────────────────────────────────────────────────────
  cut() {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) return;

    const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
    if (selectedNodeIds.size === 0 && selectedEdgeKeys.size === 0) return;

    // Serialize *before* deleting
    const payload = serializeSelection(canvas.data, selectedNodeIds);

    if (payload.nodes.length > 0) {
      set({ buffer: payload, pasteCount: 0 });
    }

    // Delete selection (uses its own batch internally)
    useCanvasStore.getState().deleteSelection(canvasId);
  },

  // ── Duplicate ───────────────────────────────────────────────────────────
  duplicate() {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) return;

    const { selectedNodeIds } = useCanvasStore.getState();
    if (selectedNodeIds.size === 0) return;

    const payload = serializeSelection(canvas.data, selectedNodeIds);
    if (payload.nodes.length === 0) return;

    const gs = useGraphStore.getState();
    const hs = useHistoryStore.getState();

    // Use pasteCount=1 so the first duplicate is already offset
    const { nodes, edges } = preparePaste(payload, 1);

    hs.beginBatch();

    for (const node of nodes) {
      gs.addNode(canvasId, node);
    }
    for (const edge of edges) {
      gs.addEdge(canvasId, edge);
    }

    hs.commitBatch();

    // Select the newly duplicated nodes
    useCanvasStore.getState().selectNodes(nodes.map((n) => n.id));
  },
}));
