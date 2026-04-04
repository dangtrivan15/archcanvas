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
// Seed data — a small graph: A → B → C
// ---------------------------------------------------------------------------

const seedNodes = [
  { id: 'node-a', type: 'compute/service', displayName: 'Service A', position: { x: 0, y: 0 } },
  { id: 'node-b', type: 'compute/service', displayName: 'Service B', position: { x: 200, y: 0 } },
  { id: 'node-c', type: 'compute/service', displayName: 'Service C', position: { x: 400, y: 0 } },
];
const seedEdges = [
  { from: { node: 'node-a' }, to: { node: 'node-b' } },
  { from: { node: 'node-b' }, to: { node: 'node-c' } },
];

function makeMainYaml() {
  return serializeCanvas({
    project: { name: 'IntegrationTest' },
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
  useNavigationStore.setState({
    currentCanvasId: ROOT_CANVAS_KEY,
  });

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

function getCanvasNodeIds(): string[] {
  const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
  return (canvas.data.nodes ?? []).map((n) => n.id);
}

function getCanvasEdgeCount(): number {
  const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
  return (canvas.data.edges ?? []).length;
}

// ---------------------------------------------------------------------------
// Integration test: full copy → paste → undo → redo → cut → duplicate workflow
// ---------------------------------------------------------------------------

describe('clipboard integration: copy → paste → undo → redo → cut → duplicate', () => {
  beforeEach(async () => {
    await setupStores();
  });

  it('full workflow: copy, paste, undo, redo, cut, paste, duplicate', () => {
    // --- Step 1: Copy A and B (with edge between them) ---
    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
    useClipboardStore.getState().copy();

    const { buffer } = useClipboardStore.getState();
    expect(buffer).not.toBeNull();
    expect(buffer!.nodes).toHaveLength(2);
    expect(buffer!.edges).toHaveLength(1);

    // Canvas is unmodified
    expect(getCanvasNodeIds()).toEqual(['node-a', 'node-b', 'node-c']);
    expect(getCanvasEdgeCount()).toBe(2);

    // --- Step 2: Paste → adds 2 nodes + 1 edge ---
    useHistoryStore.getState().clear();
    useClipboardStore.getState().paste();

    const idsAfterPaste = getCanvasNodeIds();
    expect(idsAfterPaste.length).toBe(5); // 3 original + 2 pasted
    expect(getCanvasEdgeCount()).toBe(3); // 2 original + 1 pasted

    // Pasted nodes are selected
    const { selectedNodeIds: afterPasteSelection } = useCanvasStore.getState();
    expect(afterPasteSelection.size).toBe(2);

    // Pasted node IDs are new
    const pastedIds = [...afterPasteSelection];
    expect(pastedIds.every((id) => id.startsWith('node-'))).toBe(true);
    expect(pastedIds.every((id) => !['node-a', 'node-b', 'node-c'].includes(id))).toBe(true);

    // --- Step 3: Undo the paste ---
    useHistoryStore.getState().undo();

    expect(getCanvasNodeIds().length).toBe(3);
    expect(getCanvasEdgeCount()).toBe(2);

    // --- Step 4: Redo the paste ---
    useHistoryStore.getState().redo();

    expect(getCanvasNodeIds().length).toBe(5);
    expect(getCanvasEdgeCount()).toBe(3);

    // --- Step 5: Cut node-c (unselect pasted, select c) ---
    useCanvasStore.getState().selectNodes(['node-c']);
    useClipboardStore.getState().cut();

    // node-c removed, its edge (b→c) also removed
    expect(getCanvasNodeIds()).not.toContain('node-c');
    // 4 nodes remain (a, b, pasted-a', pasted-b')
    expect(getCanvasNodeIds().length).toBe(4);

    // Buffer now has node-c
    const cutBuffer = useClipboardStore.getState().buffer;
    expect(cutBuffer).not.toBeNull();
    expect(cutBuffer!.nodes).toHaveLength(1);
    expect(cutBuffer!.nodes[0].displayName).toBe('Service C');

    // --- Step 6: Paste cut node-c ---
    useClipboardStore.getState().paste();

    // 5 nodes now (a, b, pasted-a', pasted-b', pasted-c')
    expect(getCanvasNodeIds().length).toBe(5);

    // Pasted node should have new ID
    const { selectedNodeIds: afterCutPaste } = useCanvasStore.getState();
    expect(afterCutPaste.size).toBe(1);
    const pastedCId = [...afterCutPaste][0];
    expect(pastedCId).not.toBe('node-c');

    // --- Step 7: Select two nodes and duplicate ---
    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
    useClipboardStore.getState().duplicate();

    // 7 nodes now (5 + 2 duplicated)
    expect(getCanvasNodeIds().length).toBe(7);

    // Duplicated nodes are selected
    const { selectedNodeIds: afterDup } = useCanvasStore.getState();
    expect(afterDup.size).toBe(2);
    // Selected IDs are all new
    for (const id of afterDup) {
      expect(id).not.toBe('node-a');
      expect(id).not.toBe('node-b');
    }
  });

  it('cascade offset: multiple pastes fan out diagonally', () => {
    useCanvasStore.getState().selectNodes(['node-a']);
    useClipboardStore.getState().copy();

    // First paste (pasteCount=0 → offset 0,0)
    useClipboardStore.getState().paste();
    const canvas1 = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const paste1 = canvas1.data.nodes!.find((n) => ![...'abc'].map(c => `node-${c}`).includes(n.id));
    expect(paste1?.position).toEqual({ x: 0, y: 0 }); // 0 + 0 offset

    // Second paste (pasteCount=1 → offset 30,30)
    useClipboardStore.getState().paste();
    const canvas2 = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const allIds = canvas2.data.nodes!.map((n) => n.id);
    // Find the newest node (not in original 3 or first paste)
    const originalAndFirst = new Set(['node-a', 'node-b', 'node-c', paste1!.id]);
    const paste2Id = allIds.find((id) => !originalAndFirst.has(id));
    const paste2 = canvas2.data.nodes!.find((n) => n.id === paste2Id);
    expect(paste2?.position).toEqual({ x: 30, y: 30 }); // 0 + 30 offset
  });

  it('RefNode exclusion: copy ignores RefNodes', () => {
    // Add a RefNode to the canvas
    useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
      id: 'ref-sub',
      ref: 'subsystem.yaml',
    });

    // Select all including the RefNode
    useCanvasStore.getState().selectNodes(['node-a', 'ref-sub']);
    useClipboardStore.getState().copy();

    const { buffer } = useClipboardStore.getState();
    expect(buffer!.nodes).toHaveLength(1);
    expect(buffer!.nodes[0].id).toBe('node-a');
  });
});
