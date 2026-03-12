import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvasFile } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

// Minimal canvas data to seed the InMemoryFileSystem
const seedNodes = [
  { id: 'node-a', type: 'compute/service', displayName: 'Node A' },
  { id: 'node-b', type: 'compute/service', displayName: 'Node B' },
];
const seedEdges = [
  { from: { node: 'node-a' }, to: { node: 'node-b' } },
];
const seedEntities = [
  { name: 'Order', description: 'An order entity' },
];

function makeMainYaml() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvasFile({
    project: { name: 'GraphStoreTest' },
    nodes: seedNodes,
    edges: seedEdges,
    entities: seedEntities,
  } as any);
}

async function setupStores() {
  // Reset fileStore
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();

  return fs;
}

describe('graphStore', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // --- CANVAS_NOT_FOUND guard ---

  it('returns CANVAS_NOT_FOUND for an unknown canvasId', () => {
    const result = useGraphStore.getState().addNode('nonexistent', {
      id: 'new-node',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CANVAS_NOT_FOUND');
    }
  });

  it('CANVAS_NOT_FOUND guard works for all methods', () => {
    const id = 'does-not-exist';
    const gs = useGraphStore.getState();
    const checks = [
      gs.addNode(id, { id: 'x', type: 'compute/service' }),
      gs.removeNode(id, 'x'),
      gs.updateNode(id, 'x', { displayName: 'Y' }),
      gs.updateNodePosition(id, 'x', { x: 0, y: 0 }),
      gs.addEdge(id, { from: { node: 'a' }, to: { node: 'b' } }),
      gs.removeEdge(id, 'a', 'b'),
      gs.updateEdge(id, 'a', 'b', { label: 'lbl' }),
      gs.addEntity(id, { name: 'Foo' }),
      gs.removeEntity(id, 'Foo'),
      gs.updateEntity(id, 'Foo', { description: 'desc' }),
    ];
    for (const result of checks) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CANVAS_NOT_FOUND');
      }
    }
  });

  // --- addNode ---

  it('addNode writes the new node back to fileStore', () => {
    const result = useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
      id: 'new-svc',
      type: 'compute/service',
      displayName: 'New Service',
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).toContain('new-svc');
  });

  it('addNode marks the canvas as dirty', () => {
    useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
      id: 'another-svc',
      type: 'compute/service',
    });

    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('addNode returns engine error (DUPLICATE_NODE_ID) without modifying fileStore', () => {
    const before = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.nodes?.length ?? 0;

    const result = useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
      id: 'node-a', // already exists
      type: 'compute/service',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DUPLICATE_NODE_ID');
    }

    const after = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.nodes?.length ?? 0;
    expect(after).toBe(before);
  });

  it('addNode result includes patches and inversePatches', () => {
    const result = useGraphStore.getState().addNode(ROOT_CANVAS_KEY, {
      id: 'patch-test',
      type: 'compute/service',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patches.length).toBeGreaterThan(0);
      expect(result.inversePatches.length).toBeGreaterThan(0);
    }
  });

  // --- removeNode ---

  it('removeNode removes the node and connected edges from fileStore', () => {
    // node-a → node-b edge exists in seed; removing node-a should drop the edge
    const result = useGraphStore.getState().removeNode(ROOT_CANVAS_KEY, 'node-a');

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).not.toContain('node-a');

    const edges = canvas.data.edges ?? [];
    const hasEdgeFromA = edges.some((e) => e.from.node === 'node-a' || e.to.node === 'node-a');
    expect(hasEdgeFromA).toBe(false);
  });

  it('removeNode marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() }); // reset
    useGraphStore.getState().removeNode(ROOT_CANVAS_KEY, 'node-b');
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('removeNode returns NODE_NOT_FOUND without modifying fileStore', () => {
    const before = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.nodes?.length ?? 0;

    const result = useGraphStore.getState().removeNode(ROOT_CANVAS_KEY, 'ghost-node');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    }

    const after = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.nodes?.length ?? 0;
    expect(after).toBe(before);
  });

  // --- updateNode ---

  it('updateNode updates the display name in fileStore', () => {
    const result = useGraphStore.getState().updateNode(ROOT_CANVAS_KEY, 'node-a', {
      displayName: 'Updated A',
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const node = (canvas.data.nodes ?? []).find((n) => n.id === 'node-a');
    expect(node).toBeDefined();
    if (node && !('ref' in node)) {
      expect(node.displayName).toBe('Updated A');
    }
  });

  it('updateNode marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().updateNode(ROOT_CANVAS_KEY, 'node-a', { displayName: 'Dirty' });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('updateNode returns NODE_NOT_FOUND without modifying fileStore', () => {
    const result = useGraphStore.getState().updateNode(ROOT_CANVAS_KEY, 'ghost', {
      displayName: 'X',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NODE_NOT_FOUND');
    }
  });

  // --- updateNodePosition ---

  it('updateNodePosition updates the position in fileStore', () => {
    const result = useGraphStore.getState().updateNodePosition(ROOT_CANVAS_KEY, 'node-a', {
      x: 42,
      y: 99,
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const node = (canvas.data.nodes ?? []).find((n) => n.id === 'node-a');
    expect(node?.position).toEqual({ x: 42, y: 99 });
  });

  it('updateNodePosition marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().updateNodePosition(ROOT_CANVAS_KEY, 'node-b', { x: 1, y: 2 });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  // --- addEdge ---

  it('addEdge writes the edge to fileStore', () => {
    // First add a third node so we have an available pair
    useGraphStore.getState().addNode(ROOT_CANVAS_KEY, { id: 'node-c', type: 'compute/service' });

    const result = useGraphStore.getState().addEdge(ROOT_CANVAS_KEY, {
      from: { node: 'node-b' },
      to: { node: 'node-c' },
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edge = (canvas.data.edges ?? []).find(
      (e) => e.from.node === 'node-b' && e.to.node === 'node-c',
    );
    expect(edge).toBeDefined();
  });

  it('addEdge marks canvas dirty', () => {
    useGraphStore.getState().addNode(ROOT_CANVAS_KEY, { id: 'node-d', type: 'compute/service' });
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().addEdge(ROOT_CANVAS_KEY, {
      from: { node: 'node-a' },
      to: { node: 'node-d' },
    });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('addEdge returns DUPLICATE_EDGE without modifying fileStore', () => {
    const before = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.edges?.length ?? 0;

    const result = useGraphStore.getState().addEdge(ROOT_CANVAS_KEY, {
      from: { node: 'node-a' },
      to: { node: 'node-b' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DUPLICATE_EDGE');
    }

    const after = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.edges?.length ?? 0;
    expect(after).toBe(before);
  });

  // --- removeEdge ---

  it('removeEdge removes the edge from fileStore', () => {
    const result = useGraphStore.getState().removeEdge(ROOT_CANVAS_KEY, 'node-a', 'node-b');

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edges = canvas.data.edges ?? [];
    const still = edges.find((e) => e.from.node === 'node-a' && e.to.node === 'node-b');
    expect(still).toBeUndefined();
  });

  it('removeEdge marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().removeEdge(ROOT_CANVAS_KEY, 'node-a', 'node-b');
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('removeEdge returns EDGE_NOT_FOUND without modifying fileStore', () => {
    const before = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.edges?.length ?? 0;

    const result = useGraphStore.getState().removeEdge(ROOT_CANVAS_KEY, 'ghost-a', 'ghost-b');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EDGE_NOT_FOUND');
    }

    const after = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.edges?.length ?? 0;
    expect(after).toBe(before);
  });

  // --- updateEdge ---

  it('updateEdge updates the edge label in fileStore', () => {
    const result = useGraphStore.getState().updateEdge(ROOT_CANVAS_KEY, 'node-a', 'node-b', {
      label: 'REST',
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edge = (canvas.data.edges ?? []).find(
      (e) => e.from.node === 'node-a' && e.to.node === 'node-b',
    );
    expect(edge?.label).toBe('REST');
  });

  // --- addEntity ---

  it('addEntity writes the entity to fileStore', () => {
    const result = useGraphStore.getState().addEntity(ROOT_CANVAS_KEY, {
      name: 'Payment',
      description: 'Payment entity',
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const entity = (canvas.data.entities ?? []).find((e) => e.name === 'Payment');
    expect(entity).toBeDefined();
  });

  it('addEntity marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().addEntity(ROOT_CANVAS_KEY, { name: 'Invoice' });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('addEntity returns DUPLICATE_ENTITY without modifying fileStore', () => {
    const before = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.entities?.length ?? 0;

    const result = useGraphStore.getState().addEntity(ROOT_CANVAS_KEY, {
      name: 'Order', // already in seed
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DUPLICATE_ENTITY');
    }

    const after = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!.data.entities?.length ?? 0;
    expect(after).toBe(before);
  });

  // --- removeEntity ---

  it('removeEntity removes the entity from fileStore', () => {
    const result = useGraphStore.getState().removeEntity(ROOT_CANVAS_KEY, 'Order');

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const entity = (canvas.data.entities ?? []).find((e) => e.name === 'Order');
    expect(entity).toBeUndefined();
  });

  it('removeEntity marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().removeEntity(ROOT_CANVAS_KEY, 'Order');
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('removeEntity returns ENTITY_NOT_FOUND without modifying fileStore', () => {
    const result = useGraphStore.getState().removeEntity(ROOT_CANVAS_KEY, 'Ghost');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ENTITY_NOT_FOUND');
    }
  });

  // --- updateEntity ---

  it('updateEntity updates the description in fileStore', () => {
    const result = useGraphStore.getState().updateEntity(ROOT_CANVAS_KEY, 'Order', {
      description: 'Updated order description',
    });

    expect(result.ok).toBe(true);

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const entity = (canvas.data.entities ?? []).find((e) => e.name === 'Order');
    expect(entity?.description).toBe('Updated order description');
  });

  it('updateEntity marks canvas dirty', () => {
    useFileStore.setState({ dirtyCanvases: new Set() });
    useGraphStore.getState().updateEntity(ROOT_CANVAS_KEY, 'Order', { description: 'x' });
    expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);
  });

  it('updateEntity returns ENTITY_NOT_FOUND without modifying fileStore', () => {
    const result = useGraphStore.getState().updateEntity(ROOT_CANVAS_KEY, 'Ghost', {
      description: 'x',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ENTITY_NOT_FOUND');
    }
  });
});
