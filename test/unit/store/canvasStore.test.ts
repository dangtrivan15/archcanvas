import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useHistoryStore } from '@/store/historyStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

const seedNodes = [
  { id: 'node-a', type: 'compute/service', displayName: 'Node A' },
  { id: 'node-b', type: 'compute/service', displayName: 'Node B' },
];
const seedEdges = [{ from: { node: 'node-a' }, to: { node: 'node-b' } }];

function makeMainYaml() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvas({
    project: { name: 'CanvasStoreTest' },
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

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();

  return fs;
}

describe('canvasStore', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // --- selectNodes ---

  it('selectNodes sets selectedNodeIds and clears selectedEdgeKeys', () => {
    // First seed some edge selection
    useCanvasStore.setState({ selectedEdgeKeys: new Set(['node-a→node-b']) });

    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);

    const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
    expect(selectedNodeIds).toEqual(new Set(['node-a', 'node-b']));
    expect(selectedEdgeKeys.size).toBe(0);
  });

  it('selectNodes replaces prior node selection', () => {
    useCanvasStore.getState().selectNodes(['node-a']);
    useCanvasStore.getState().selectNodes(['node-b']);

    const { selectedNodeIds } = useCanvasStore.getState();
    expect(selectedNodeIds).toEqual(new Set(['node-b']));
    expect(selectedNodeIds.has('node-a')).toBe(false);
  });

  // --- selectEdge ---

  it('selectEdge sets selectedEdgeKeys and clears selectedNodeIds', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['node-a']) });

    useCanvasStore.getState().selectEdge('node-a', 'node-b');

    const { selectedEdgeKeys, selectedNodeIds } = useCanvasStore.getState();
    expect(selectedEdgeKeys).toEqual(new Set(['node-a→node-b']));
    expect(selectedNodeIds.size).toBe(0);
  });

  // --- clearSelection ---

  it('clearSelection empties both sets', () => {
    useCanvasStore.setState({
      selectedNodeIds: new Set(['node-a']),
      selectedEdgeKeys: new Set(['node-a→node-b']),
    });

    useCanvasStore.getState().clearSelection();

    const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
    expect(selectedNodeIds.size).toBe(0);
    expect(selectedEdgeKeys.size).toBe(0);
  });

  // --- startDraftEdge ---

  it('startDraftEdge sets draftEdge', () => {
    useCanvasStore.getState().startDraftEdge({ node: 'node-a', port: 'out' });

    const { draftEdge } = useCanvasStore.getState();
    expect(draftEdge).toEqual({ from: { node: 'node-a', port: 'out' } });
  });

  // --- completeDraftEdge ---

  it('completeDraftEdge calls graphStore.addEdge and clears draftEdge on success', () => {
    // Add a third node so the edge doesn't already exist
    useGraphStore.getState().addNode(ROOT_CANVAS_KEY, { id: 'node-c', type: 'compute/service' });

    useCanvasStore.getState().startDraftEdge({ node: 'node-a' });
    const result = useCanvasStore.getState().completeDraftEdge({ node: 'node-c' });

    expect(result.ok).toBe(true);

    const { draftEdge } = useCanvasStore.getState();
    expect(draftEdge).toBeNull();

    // Verify the edge was actually added
    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edge = (canvas.data.edges ?? []).find(
      (e) => e.from.node === 'node-a' && e.to.node === 'node-c',
    );
    expect(edge).toBeDefined();
  });

  it('completeDraftEdge clears draftEdge even on failure', () => {
    // node-a → node-b already exists in seed data — this will produce DUPLICATE_EDGE
    useCanvasStore.getState().startDraftEdge({ node: 'node-a' });
    const result = useCanvasStore.getState().completeDraftEdge({ node: 'node-b' });

    expect(result.ok).toBe(false);

    const { draftEdge } = useCanvasStore.getState();
    expect(draftEdge).toBeNull();
  });

  // --- cancelDraftEdge ---

  it('cancelDraftEdge clears draftEdge', () => {
    useCanvasStore.getState().startDraftEdge({ node: 'node-a' });
    useCanvasStore.getState().cancelDraftEdge();

    expect(useCanvasStore.getState().draftEdge).toBeNull();
  });

  // --- deleteSelection ---

  it('deleteSelection removes selected nodes via graphStore', () => {
    useCanvasStore.getState().selectNodes(['node-a']);
    const result = useCanvasStore.getState().deleteSelection();

    expect(result).toBeNull(); // null = all succeeded

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).not.toContain('node-a');
  });

  it('deleteSelection removes selected edges via graphStore', () => {
    useCanvasStore.getState().selectEdge('node-a', 'node-b');
    const result = useCanvasStore.getState().deleteSelection();

    expect(result).toBeNull();

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edges = canvas.data.edges ?? [];
    const still = edges.find((e) => e.from.node === 'node-a' && e.to.node === 'node-b');
    expect(still).toBeUndefined();
  });

  it('deleteSelection clears selection after operation', () => {
    useCanvasStore.getState().selectNodes(['node-a']);
    useCanvasStore.getState().deleteSelection();

    const { selectedNodeIds, selectedEdgeKeys } = useCanvasStore.getState();
    expect(selectedNodeIds.size).toBe(0);
    expect(selectedEdgeKeys.size).toBe(0);
  });

  it('deleteSelection returns null when nothing selected', () => {
    const result = useCanvasStore.getState().deleteSelection();
    expect(result).toBeNull();
  });

  it('deleteSelection returns first failure result when a node does not exist', () => {
    useCanvasStore.setState({ selectedNodeIds: new Set(['ghost-node']), selectedEdgeKeys: new Set() });
    const result = useCanvasStore.getState().deleteSelection();

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    }
  });

  it('deleteSelection of multiple nodes produces a single undo entry', () => {
    useHistoryStore.getState().clear();

    // Select both seed nodes and delete
    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
    useCanvasStore.getState().deleteSelection();

    // Should be exactly 1 history entry, not 2
    expect(useHistoryStore.getState().undoStack).toHaveLength(1);

    // Both nodes should be gone
    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).not.toContain('node-a');
    expect(ids).not.toContain('node-b');
  });

  it('single undo after multi-node delete restores all nodes', () => {
    useHistoryStore.getState().clear();

    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
    useCanvasStore.getState().deleteSelection();

    // One undo should restore both nodes
    useHistoryStore.getState().undo();

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).toContain('node-a');
    expect(ids).toContain('node-b');
  });

  it('redo after batch-undo re-deletes all nodes', () => {
    useHistoryStore.getState().clear();

    useCanvasStore.getState().selectNodes(['node-a', 'node-b']);
    useCanvasStore.getState().deleteSelection();
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).not.toContain('node-a');
    expect(ids).not.toContain('node-b');
  });

  // --- highlightEdges ---

  describe('highlightEdges', () => {
    it('sets highlightedEdgeIds', () => {
      useCanvasStore.getState().highlightEdges(['e1', 'e2']);
      expect(useCanvasStore.getState().highlightedEdgeIds).toEqual(['e1', 'e2']);
    });

    it('clearHighlight resets to empty', () => {
      useCanvasStore.getState().highlightEdges(['e1']);
      useCanvasStore.getState().clearHighlight();
      expect(useCanvasStore.getState().highlightedEdgeIds).toEqual([]);
    });
  });
});
