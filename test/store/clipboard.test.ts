import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useCanvasStore } from '@/store/canvasStore';
import { useClipboardStore } from '@/store/clipboardStore';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useHistoryStore } from '@/store/historyStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

const ROOT = ROOT_CANVAS_KEY;

/** Set up a minimal project with nodes and edges for clipboard testing */
function setupProject(
  nodes: Array<{ id: string; type?: string; displayName?: string; position?: { x: number; y: number } }>,
  edges: Array<{ from: { node: string; port?: string }; to: { node: string; port?: string }; label?: string }> = [],
) {
  useFileStore.getState().initializeEmptyProject();

  const gs = useGraphStore.getState();
  for (const n of nodes) {
    gs.addNode(ROOT, {
      id: n.id,
      type: n.type ?? 'compute/service',
      displayName: n.displayName,
      position: n.position,
    });
  }
  for (const e of edges) {
    gs.addEdge(ROOT, { from: e.from, to: e.to, label: e.label });
  }

  // Clear history so tests start clean
  useHistoryStore.getState().clear();
}

function getCanvasNodes() {
  const canvas = useFileStore.getState().getCanvas(ROOT);
  return canvas?.data.nodes ?? [];
}

function getCanvasEdges() {
  const canvas = useFileStore.getState().getCanvas(ROOT);
  return canvas?.data.edges ?? [];
}

beforeEach(() => {
  // Reset all stores
  useCanvasStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeKeys: new Set(),
    draftEdge: null,
    highlightedEdgeIds: [],
  });
  useClipboardStore.getState().clear();
  useHistoryStore.getState().clear();
});

// =====================================================================
// copySelection
// =====================================================================

describe('copySelection', () => {
  it('copies selected nodes to clipboard', () => {
    setupProject([
      { id: 'n1', displayName: 'A' },
      { id: 'n2', displayName: 'B' },
    ]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);

    const payload = useClipboardStore.getState().payload;
    expect(payload).not.toBeNull();
    expect(payload!.nodes).toHaveLength(1);
    expect(payload!.nodes[0].id).toBe('n1');
    expect(payload!.sourceCanvasId).toBe(ROOT);
  });

  it('does nothing with empty selection', () => {
    setupProject([{ id: 'n1' }]);
    useCanvasStore.getState().copySelection(ROOT);

    expect(useClipboardStore.getState().payload).toBeNull();
  });

  it('includes internal edges in clipboard', () => {
    setupProject(
      [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
      [
        { from: { node: 'n1' }, to: { node: 'n2' } },
        { from: { node: 'n2' }, to: { node: 'n3' } },
      ],
    );

    useCanvasStore.getState().selectNodes(['n1', 'n2']);
    useCanvasStore.getState().copySelection(ROOT);

    const payload = useClipboardStore.getState().payload;
    expect(payload!.edges).toHaveLength(1);
    expect(payload!.edges[0].from.node).toBe('n1');
    expect(payload!.edges[0].to.node).toBe('n2');
  });

  it('does not modify the canvas', () => {
    setupProject([{ id: 'n1' }, { id: 'n2' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);

    expect(getCanvasNodes()).toHaveLength(2);
  });
});

// =====================================================================
// cutSelection
// =====================================================================

describe('cutSelection', () => {
  it('copies to clipboard and removes from canvas', () => {
    setupProject([
      { id: 'n1', displayName: 'A' },
      { id: 'n2', displayName: 'B' },
    ]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().cutSelection(ROOT);

    // Clipboard has the cut node
    const payload = useClipboardStore.getState().payload;
    expect(payload).not.toBeNull();
    expect(payload!.nodes).toHaveLength(1);
    expect(payload!.nodes[0].id).toBe('n1');

    // Canvas only has n2 remaining
    expect(getCanvasNodes()).toHaveLength(1);
    expect(getCanvasNodes()[0].id).toBe('n2');
  });

  it('clears selection after cut', () => {
    setupProject([{ id: 'n1' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().cutSelection(ROOT);

    expect(useCanvasStore.getState().selectedNodeIds.size).toBe(0);
  });
});

// =====================================================================
// pasteFromClipboard
// =====================================================================

describe('pasteFromClipboard', () => {
  it('returns null when clipboard is empty', () => {
    setupProject([{ id: 'n1' }]);
    const result = useCanvasStore.getState().pasteFromClipboard(ROOT);
    expect(result).toBeNull();
  });

  it('adds new nodes with fresh IDs', () => {
    setupProject([{ id: 'n1', displayName: 'A', position: { x: 100, y: 200 } }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    const nodes = getCanvasNodes();
    expect(nodes).toHaveLength(2);

    const newNode = nodes.find((n) => n.id !== 'n1')!;
    expect(newNode).toBeDefined();
    expect(newNode.id).toMatch(/^node-/);
    expect(newNode.id).not.toBe('n1');
  });

  it('offsets pasted positions', () => {
    setupProject([{ id: 'n1', position: { x: 100, y: 200 } }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    const nodes = getCanvasNodes();
    const newNode = nodes.find((n) => n.id !== 'n1')!;
    expect(newNode.position).toEqual({ x: 130, y: 230 });
  });

  it('selects the pasted nodes', () => {
    setupProject([{ id: 'n1' }, { id: 'n2' }]);

    useCanvasStore.getState().selectNodes(['n1', 'n2']);
    useCanvasStore.getState().copySelection(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    const selected = useCanvasStore.getState().selectedNodeIds;
    expect(selected.size).toBe(2);

    // Selected IDs should be new (not n1, n2)
    expect(selected.has('n1')).toBe(false);
    expect(selected.has('n2')).toBe(false);
  });

  it('recreates internal edges with remapped IDs', () => {
    setupProject(
      [{ id: 'n1' }, { id: 'n2' }],
      [{ from: { node: 'n1' }, to: { node: 'n2' } }],
    );

    useCanvasStore.getState().selectNodes(['n1', 'n2']);
    useCanvasStore.getState().copySelection(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    const edges = getCanvasEdges();
    expect(edges).toHaveLength(2); // original + pasted

    // The new edge should reference the new node IDs
    const newNodes = getCanvasNodes().filter((n) => n.id !== 'n1' && n.id !== 'n2');
    const newEdge = edges.find(
      (e) => e.from.node !== 'n1' && e.to.node !== 'n2',
    );
    expect(newEdge).toBeDefined();
    expect(newNodes.some((n) => n.id === newEdge!.from.node)).toBe(true);
    expect(newNodes.some((n) => n.id === newEdge!.to.node)).toBe(true);
  });

  it('paste is undoable as a single step', () => {
    setupProject([{ id: 'n1' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    expect(getCanvasNodes()).toHaveLength(2);

    useHistoryStore.getState().undo();
    expect(getCanvasNodes()).toHaveLength(1);
    expect(getCanvasNodes()[0].id).toBe('n1');
  });

  it('can paste multiple times', () => {
    setupProject([{ id: 'n1' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().copySelection(ROOT);

    useCanvasStore.getState().pasteFromClipboard(ROOT);
    useCanvasStore.getState().pasteFromClipboard(ROOT);

    expect(getCanvasNodes()).toHaveLength(3);
    // All IDs should be unique
    const ids = getCanvasNodes().map((n) => n.id);
    expect(new Set(ids).size).toBe(3);
  });
});

// =====================================================================
// duplicateSelection
// =====================================================================

describe('duplicateSelection', () => {
  it('returns null with empty selection', () => {
    setupProject([{ id: 'n1' }]);
    const result = useCanvasStore.getState().duplicateSelection(ROOT);
    expect(result).toBeNull();
  });

  it('creates a copy with new IDs', () => {
    setupProject([
      { id: 'n1', displayName: 'A', position: { x: 100, y: 200 } },
    ]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().duplicateSelection(ROOT);

    const nodes = getCanvasNodes();
    expect(nodes).toHaveLength(2);

    const newNode = nodes.find((n) => n.id !== 'n1')!;
    expect(newNode.id).toMatch(/^node-/);
    expect(newNode.position).toEqual({ x: 130, y: 230 });
  });

  it('selects the duplicated nodes', () => {
    setupProject([{ id: 'n1' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().duplicateSelection(ROOT);

    const selected = useCanvasStore.getState().selectedNodeIds;
    expect(selected.size).toBe(1);
    expect(selected.has('n1')).toBe(false);
  });

  it('does not use the clipboard', () => {
    setupProject([{ id: 'n1' }]);

    useCanvasStore.getState().selectNodes(['n1']);
    useCanvasStore.getState().duplicateSelection(ROOT);

    // Clipboard should remain empty
    expect(useClipboardStore.getState().payload).toBeNull();
  });

  it('duplicates nodes with internal edges', () => {
    setupProject(
      [{ id: 'n1' }, { id: 'n2' }],
      [{ from: { node: 'n1' }, to: { node: 'n2' } }],
    );

    useCanvasStore.getState().selectNodes(['n1', 'n2']);
    useCanvasStore.getState().duplicateSelection(ROOT);

    expect(getCanvasNodes()).toHaveLength(4);
    expect(getCanvasEdges()).toHaveLength(2);
  });

  it('is undoable as a single step', () => {
    setupProject([{ id: 'n1' }, { id: 'n2' }]);

    useCanvasStore.getState().selectNodes(['n1', 'n2']);
    useCanvasStore.getState().duplicateSelection(ROOT);

    expect(getCanvasNodes()).toHaveLength(4);

    useHistoryStore.getState().undo();
    expect(getCanvasNodes()).toHaveLength(2);
  });
});
