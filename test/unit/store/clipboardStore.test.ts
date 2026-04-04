import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useClipboardStore } from '@/store/clipboardStore';
import { useHistoryStore } from '@/store/historyStore';
import { useNavigationStore } from '@/store/navigationStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const seedNodes = [
  { id: 'node-a', type: 'compute/service', displayName: 'Node A', position: { x: 100, y: 100 } },
  { id: 'node-b', type: 'compute/service', displayName: 'Node B', position: { x: 300, y: 300 } },
  { id: 'node-c', type: 'compute/service', displayName: 'Node C', position: { x: 500, y: 100 } },
];
const seedEdges = [
  { from: { node: 'node-a' }, to: { node: 'node-b' } },
  { from: { node: 'node-b' }, to: { node: 'node-c' } },
];

function makeMainYaml() {
  return serializeCanvas({
    project: { name: 'ClipboardStoreTest' },
    nodes: seedNodes,
    edges: seedEdges,
  } as any);
}

async function setupStores() {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });

  useCanvasStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeKeys: new Set(),
    draftEdge: null,
  });

  useClipboardStore.setState({
    buffer: null,
    pasteCount: 0,
  });

  useHistoryStore.getState().clear();

  // Ensure navigation points to root
  useNavigationStore.setState({
    currentCanvasId: ROOT_CANVAS_KEY,
  });

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();

  return fs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCanvasNodeIds(): string[] {
  const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
  return (canvas.data.nodes ?? []).map((n) => n.id);
}

function getCanvasEdgeKeys(): string[] {
  const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
  return (canvas.data.edges ?? []).map((e) => `${e.from.node}→${e.to.node}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('clipboardStore', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // ─── copy ──────────────────────────────────────────────────────────────

  describe('copy', () => {
    it('copies selected InlineNodes into buffer', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      const { buffer } = useClipboardStore.getState();
      expect(buffer).not.toBeNull();
      expect(buffer!.nodes).toHaveLength(1);
      expect(buffer!.nodes[0].id).toBe('node-a');
    });

    it('does not modify the canvas (non-destructive)', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      expect(getCanvasNodeIds()).toContain('node-a');
    });

    it('includes edges between selected nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
      useClipboardStore.getState().copy();

      const { buffer } = useClipboardStore.getState();
      expect(buffer!.edges).toHaveLength(1);
      expect(buffer!.edges[0].from.node).toBe('node-a');
      expect(buffer!.edges[0].to.node).toBe('node-b');
    });

    it('resets pasteCount to 0 on copy', () => {
      useClipboardStore.setState({ pasteCount: 5 });
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      expect(useClipboardStore.getState().pasteCount).toBe(0);
    });

    it('does nothing when no nodes are selected', () => {
      useClipboardStore.getState().copy();
      expect(useClipboardStore.getState().buffer).toBeNull();
    });
  });

  // ─── paste ────────���────────────────────────────────────────────────────

  describe('paste', () => {
    it('adds new nodes to the canvas', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();
      useClipboardStore.getState().paste();

      const ids = getCanvasNodeIds();
      // Original still present + one new pasted node
      expect(ids).toContain('node-a');
      expect(ids.length).toBe(4); // 3 seed + 1 pasted
    });

    it('generates new IDs for pasted nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();
      useClipboardStore.getState().paste();

      const ids = getCanvasNodeIds();
      const pastedIds = ids.filter((id) => id !== 'node-a' && id !== 'node-b' && id !== 'node-c');
      expect(pastedIds).toHaveLength(1);
      expect(pastedIds[0]).toMatch(/^node-[a-f0-9]{8}$/);
    });

    it('pastes edges between selected nodes with remapped IDs', () => {
      useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
      useClipboardStore.getState().copy();
      useClipboardStore.getState().paste();

      const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
      // 2 seed edges + 1 pasted edge
      expect(canvas.data.edges!.length).toBe(3);
    });

    it('selects pasted nodes after paste', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();
      useClipboardStore.getState().paste();

      const { selectedNodeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.size).toBe(1);
      // The selected node should be the new one, not node-a
      expect(selectedNodeIds.has('node-a')).toBe(false);
    });

    it('increments pasteCount on each paste', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      expect(useClipboardStore.getState().pasteCount).toBe(0);

      useClipboardStore.getState().paste();
      expect(useClipboardStore.getState().pasteCount).toBe(1);

      useClipboardStore.getState().paste();
      expect(useClipboardStore.getState().pasteCount).toBe(2);
    });

    it('produces a single undo entry for paste', () => {
      useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
      useClipboardStore.getState().copy();

      useHistoryStore.getState().clear();
      useClipboardStore.getState().paste();

      // Should be exactly 1 history entry (batched)
      expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    });

    it('does nothing when buffer is empty', () => {
      const nodesBefore = getCanvasNodeIds().length;
      useClipboardStore.getState().paste();
      expect(getCanvasNodeIds().length).toBe(nodesBefore);
    });
  });

  // ���── cut ─────���─────────────────────────────────────────────────────────

  describe('cut', () => {
    it('copies selection to buffer and removes nodes from canvas', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().cut();

      // Buffer should have the node
      const { buffer } = useClipboardStore.getState();
      expect(buffer).not.toBeNull();
      expect(buffer!.nodes).toHaveLength(1);
      expect(buffer!.nodes[0].id).toBe('node-a');

      // Node should be removed from canvas
      expect(getCanvasNodeIds()).not.toContain('node-a');
    });

    it('resets pasteCount to 0', () => {
      useClipboardStore.setState({ pasteCount: 5 });
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().cut();

      expect(useClipboardStore.getState().pasteCount).toBe(0);
    });

    it('removes associated edges when cutting nodes', () => {
      useCanvasStore.getState().selectNodes(['node-b']);
      useClipboardStore.getState().cut();

      // node-b was connected to both a→b and b→c
      const edges = getCanvasEdgeKeys();
      expect(edges).not.toContain('node-a→node-b');
      expect(edges).not.toContain('node-b→node-c');
    });

    it('does nothing when nothing is selected', () => {
      const nodesBefore = getCanvasNodeIds().length;
      useClipboardStore.getState().cut();

      expect(getCanvasNodeIds().length).toBe(nodesBefore);
      expect(useClipboardStore.getState().buffer).toBeNull();
    });
  });

  // ─── duplicate ─────────────────────────��───────────────────────────────

  describe('duplicate', () => {
    it('creates new copies of selected nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().duplicate();

      const ids = getCanvasNodeIds();
      expect(ids.length).toBe(4); // 3 seed + 1 duplicate
    });

    it('keeps original nodes in the canvas', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().duplicate();

      expect(getCanvasNodeIds()).toContain('node-a');
    });

    it('selects the duplicated nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().duplicate();

      const { selectedNodeIds } = useCanvasStore.getState();
      expect(selectedNodeIds.size).toBe(1);
      expect(selectedNodeIds.has('node-a')).toBe(false);
    });

    it('produces a single undo entry', () => {
      useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
      useHistoryStore.getState().clear();

      useClipboardStore.getState().duplicate();

      expect(useHistoryStore.getState().undoStack).toHaveLength(1);
    });

    it('duplicates edges between selected nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
      useClipboardStore.getState().duplicate();

      const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
      // 2 seed edges + 1 duplicated edge (a→b copied with new IDs)
      expect(canvas.data.edges!.length).toBe(3);
    });

    it('does nothing when no nodes are selected', () => {
      const nodesBefore = getCanvasNodeIds().length;
      useClipboardStore.getState().duplicate();
      expect(getCanvasNodeIds().length).toBe(nodesBefore);
    });
  });

  // ─── undo/redo interaction ─────────────────────────────────────────────

  describe('undo/redo', () => {
    it('undo after paste removes pasted nodes', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      useHistoryStore.getState().clear();
      useClipboardStore.getState().paste();

      // Undo the paste
      useHistoryStore.getState().undo();

      const ids = getCanvasNodeIds();
      expect(ids.length).toBe(3); // back to original 3
    });

    it('redo after undo re-applies the paste', () => {
      useCanvasStore.getState().selectNodes(['node-a']);
      useClipboardStore.getState().copy();

      useHistoryStore.getState().clear();
      useClipboardStore.getState().paste();

      useHistoryStore.getState().undo();
      useHistoryStore.getState().redo();

      const ids = getCanvasNodeIds();
      expect(ids.length).toBe(4); // 3 seed + 1 pasted
    });
  });
});
