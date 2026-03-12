import { describe, it, expect } from 'vitest';
import { enablePatches, applyPatches } from 'immer';
import {
  addNode,
  removeNode,
  updateNode,
  updateNodePosition,
  addEdge,
  removeEdge,
  updateEdge,
  addEntity,
  removeEntity,
  updateEntity,
} from '@/core/graph/engine';

enablePatches();
import {
  makeCanvas,
  makeNode,
  makeRefNode,
  makeEdge,
  makeEntity,
  serviceNodeDef,
  registryWith,
} from './helpers';

// =====================================================================
// Node Operations
// =====================================================================

describe('addNode', () => {
  it('adds an inline node successfully', () => {
    const canvas = makeCanvas();
    const node = makeNode({ id: 'svc-1' });
    const result = addNode(canvas, node);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes).toHaveLength(1);
    expect(result.data.nodes![0]).toEqual(node);
    expect(result.warnings).toEqual([]);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('collects warnings when registry is provided and node has issues', () => {
    const canvas = makeCanvas();
    const registry = registryWith(['compute/service', serviceNodeDef]);
    // Missing required arg 'runtime'
    const node = makeNode({ id: 'svc-1', args: {} });
    const result = addNode(canvas, node, registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes).toHaveLength(1);
    expect(result.warnings).toContainEqual({
      code: 'INVALID_ARG',
      nodeId: 'svc-1',
      arg: 'runtime',
      reason: 'required argument missing',
    });
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('adds a ref node without validation', () => {
    const canvas = makeCanvas();
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const node = makeRefNode({ id: 'ref-1' });
    const result = addNode(canvas, node, registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns DUPLICATE_NODE_ID error for duplicate id', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'svc-1' })] });
    const node = makeNode({ id: 'svc-1' });
    const result = addNode(canvas, node);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'DUPLICATE_NODE_ID', nodeId: 'svc-1' });
  });

  it('initializes nodes array when canvas has none', () => {
    const canvas = makeCanvas({ nodes: undefined });
    const node = makeNode({ id: 'svc-1' });
    const result = addNode(canvas, node);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes).toHaveLength(1);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });
});

describe('removeNode', () => {
  it('removes a node successfully', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })] });
    const result = removeNode(canvas, 'a');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes).toHaveLength(1);
    expect(result.data.nodes![0].id).toBe('b');
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('cascade removes edges referencing the node', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' }), makeNode({ id: 'c' })],
      edges: [
        makeEdge({ from: { node: 'a' }, to: { node: 'b' } }),
        makeEdge({ from: { node: 'b' }, to: { node: 'c' } }),
        makeEdge({ from: { node: 'a' }, to: { node: 'c' } }),
      ],
    });

    const result = removeNode(canvas, 'a');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only b→c should survive
    expect(result.data.edges).toHaveLength(1);
    expect(result.data.edges![0].from.node).toBe('b');
    expect(result.data.edges![0].to.node).toBe('c');
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns NODE_NOT_FOUND for non-existent node', () => {
    const canvas = makeCanvas();
    const result = removeNode(canvas, 'nonexistent');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'NODE_NOT_FOUND', nodeId: 'nonexistent' });
  });
});

describe('updateNode', () => {
  it('updates inline node fields', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const result = updateNode(canvas, 'a', {
      displayName: 'My Service',
      description: 'Updated desc',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const node = result.data.nodes![0] as { displayName?: string; description?: string };
    expect(node.displayName).toBe('My Service');
    expect(node.description).toBe('Updated desc');
    expect(result.warnings).toEqual([]);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('collects warnings when updating args with registry', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a', args: { runtime: 'node' } })],
    });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    // Update args to have invalid enum value
    const result = updateNode(canvas, 'a', { args: { runtime: 'python' } }, registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toContainEqual({
      code: 'INVALID_ARG',
      nodeId: 'a',
      arg: 'runtime',
      reason: 'invalid enum value, expected one of [node, go, rust]',
    });
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns INVALID_REF_NODE_UPDATE for ref nodes', () => {
    const canvas = makeCanvas({ nodes: [makeRefNode({ id: 'ref-1' })] });
    const result = updateNode(canvas, 'ref-1', { displayName: 'nope' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'INVALID_REF_NODE_UPDATE' });
  });

  it('returns NODE_NOT_FOUND for non-existent node', () => {
    const canvas = makeCanvas();
    const result = updateNode(canvas, 'nonexistent', { displayName: 'x' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'NODE_NOT_FOUND', nodeId: 'nonexistent' });
  });
});

describe('updateNodePosition', () => {
  it('updates position on inline node', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const position = { x: 100, y: 200 };
    const result = updateNodePosition(canvas, 'a', position);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes![0].position).toEqual(position);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('updates position on ref node', () => {
    const canvas = makeCanvas({ nodes: [makeRefNode({ id: 'ref-1' })] });
    const position = { x: 50, y: 75, width: 200, height: 100 };
    const result = updateNodePosition(canvas, 'ref-1', position);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes![0].position).toEqual(position);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns NODE_NOT_FOUND for non-existent node', () => {
    const canvas = makeCanvas();
    const result = updateNodePosition(canvas, 'nonexistent', { x: 0, y: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'NODE_NOT_FOUND', nodeId: 'nonexistent' });
  });
});

// =====================================================================
// Edge Operations
// =====================================================================

describe('addEdge', () => {
  it('adds an edge successfully', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('collects warnings when registry is provided', () => {
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    // Use inbound port in from position — should warn
    const edge = makeEdge({
      from: { node: 'a', port: 'http-in' },
      to: { node: 'b' },
    });
    const result = addEdge(canvas, edge, registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toContainEqual({
      code: 'INVALID_PORT_DIRECTION',
      nodeId: 'a',
      port: 'http-in',
      expected: 'outbound',
    });
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns EDGE_ENDPOINT_NOT_FOUND for missing from node', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'b' })] });
    const edge = makeEdge({ from: { node: 'missing' }, to: { node: 'b' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: 'EDGE_ENDPOINT_NOT_FOUND',
      endpoint: 'missing',
      side: 'from',
    });
  });

  it('returns EDGE_ENDPOINT_NOT_FOUND for missing to node', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'missing' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      code: 'EDGE_ENDPOINT_NOT_FOUND',
      endpoint: 'missing',
      side: 'to',
    });
  });

  it('returns SELF_LOOP for self-referencing edge', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'a' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'SELF_LOOP', nodeId: 'a' });
  });

  it('returns DUPLICATE_EDGE for duplicate from+to pair', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'DUPLICATE_EDGE', from: 'a', to: 'b' });
  });

  it('skips endpoint check for @root/ prefixed nodes', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const edge = makeEdge({
      from: { node: 'a' },
      to: { node: '@root/db-postgres' },
    });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(1);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('skips endpoint check for @root/ on from side', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'b' })] });
    const edge = makeEdge({
      from: { node: '@root/api-gateway' },
      to: { node: 'b' },
    });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(1);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('initializes edges array when canvas has none', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: undefined,
    });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(1);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });
});

describe('removeEdge', () => {
  it('removes an edge successfully', () => {
    const canvas = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const result = removeEdge(canvas, 'a', 'b');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(0);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns EDGE_NOT_FOUND for non-existent edge', () => {
    const canvas = makeCanvas();
    const result = removeEdge(canvas, 'x', 'y');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'EDGE_NOT_FOUND', from: 'x', to: 'y' });
  });
});

describe('updateEdge', () => {
  it('updates edge fields', () => {
    const canvas = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const result = updateEdge(canvas, 'a', 'b', {
      protocol: 'gRPC',
      label: 'orders stream',
      entities: ['Order'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edge = result.data.edges![0];
    expect(edge.protocol).toBe('gRPC');
    expect(edge.label).toBe('orders stream');
    expect(edge.entities).toEqual(['Order']);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns EDGE_NOT_FOUND for non-existent edge', () => {
    const canvas = makeCanvas();
    const result = updateEdge(canvas, 'x', 'y', { label: 'test' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'EDGE_NOT_FOUND', from: 'x', to: 'y' });
  });
});

// =====================================================================
// Entity Operations
// =====================================================================

describe('addEntity', () => {
  it('adds an entity successfully', () => {
    const canvas = makeCanvas();
    const entity = makeEntity({ name: 'Order' });
    const result = addEntity(canvas, entity);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entities).toHaveLength(1);
    expect(result.data.entities![0]).toEqual(entity);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns DUPLICATE_ENTITY for duplicate name', () => {
    const canvas = makeCanvas({ entities: [makeEntity({ name: 'Order' })] });
    const result = addEntity(canvas, makeEntity({ name: 'Order' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'DUPLICATE_ENTITY', name: 'Order' });
  });

  it('initializes entities array when canvas has none', () => {
    const canvas = makeCanvas({ entities: undefined });
    const result = addEntity(canvas, makeEntity({ name: 'Order' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entities).toHaveLength(1);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });
});

describe('removeEntity', () => {
  it('removes an entity successfully', () => {
    const canvas = makeCanvas({ entities: [makeEntity({ name: 'Order' })] });
    const result = removeEntity(canvas, 'Order');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.entities).toHaveLength(0);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns ENTITY_NOT_FOUND for non-existent entity', () => {
    const canvas = makeCanvas();
    const result = removeEntity(canvas, 'Nonexistent');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'ENTITY_NOT_FOUND', name: 'Nonexistent' });
  });

  it('returns ENTITY_IN_USE when edges reference the entity', () => {
    const canvas = makeCanvas({
      entities: [makeEntity({ name: 'Order' })],
      edges: [
        makeEdge({ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }),
        makeEdge({ from: { node: 'c' }, to: { node: 'd' }, entities: ['Order', 'User'] }),
      ],
    });
    const result = removeEntity(canvas, 'Order');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ENTITY_IN_USE');
    if (result.error.code !== 'ENTITY_IN_USE') return;
    expect(result.error.name).toBe('Order');
    expect(result.error.referencedBy).toEqual([
      { from: 'a', to: 'b' },
      { from: 'c', to: 'd' },
    ]);
  });
});

describe('updateEntity', () => {
  it('updates entity fields', () => {
    const canvas = makeCanvas({ entities: [makeEntity({ name: 'Order' })] });
    const result = updateEntity(canvas, 'Order', {
      description: 'An order entity',
      codeRefs: ['src/models/order.ts'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entity = result.data.entities![0];
    expect(entity.description).toBe('An order entity');
    expect(entity.codeRefs).toEqual(['src/models/order.ts']);
    expect(result.patches).toBeInstanceOf(Array);
    expect(result.inversePatches).toBeInstanceOf(Array);
    expect(result.patches.length).toBeGreaterThan(0);
  });

  it('returns ENTITY_NOT_FOUND for non-existent entity', () => {
    const canvas = makeCanvas();
    const result = updateEntity(canvas, 'Nonexistent', { description: 'x' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ code: 'ENTITY_NOT_FOUND', name: 'Nonexistent' });
  });
});

// =====================================================================
// Patch Round-Trip Tests
// =====================================================================

describe('patch round-trips', () => {
  it('applying inversePatches to addNode result restores original canvas', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'existing' })] });
    const node = makeNode({ id: 'new-node' });
    const result = addNode(canvas, node);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const restored = applyPatches(result.data, result.inversePatches);
    expect(restored.nodes).toHaveLength(canvas.nodes!.length);
    expect(restored.nodes!.map((n) => n.id)).toEqual(canvas.nodes!.map((n) => n.id));
  });

  it('applying inversePatches to addEdge result restores original canvas', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: [],
    });
    const edge = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const result = addEdge(canvas, edge);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const restored = applyPatches(result.data, result.inversePatches);
    expect(restored.edges).toHaveLength(0);
  });

  it('applying inversePatches to addEntity result restores original canvas', () => {
    const canvas = makeCanvas({ entities: [makeEntity({ name: 'Existing' })] });
    const entity = makeEntity({ name: 'NewEntity' });
    const result = addEntity(canvas, entity);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const restored = applyPatches(result.data, result.inversePatches);
    expect(restored.entities).toHaveLength(1);
    expect(restored.entities![0].name).toBe('Existing');
  });
});

// =====================================================================
// Immer Immutability
// =====================================================================

describe('immutability', () => {
  it('does not mutate the original canvas on addNode', () => {
    const canvas = makeCanvas();
    const original = { ...canvas, nodes: [...(canvas.nodes ?? [])] };
    const result = addNode(canvas, makeNode({ id: 'new' }));

    expect(result.ok).toBe(true);
    expect(canvas.nodes).toEqual(original.nodes);
  });

  it('returns a new reference from addNode', () => {
    const canvas = makeCanvas();
    const result = addNode(canvas, makeNode({ id: 'new' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toBe(canvas);
  });

  it('does not mutate the original canvas on removeNode', () => {
    const node = makeNode({ id: 'a' });
    const canvas = makeCanvas({ nodes: [node] });
    const nodesBefore = canvas.nodes!.length;
    removeNode(canvas, 'a');

    expect(canvas.nodes).toHaveLength(nodesBefore);
  });

  it('does not mutate the original canvas on addEdge', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
    });
    const edgesBefore = (canvas.edges ?? []).length;
    addEdge(canvas, makeEdge({ from: { node: 'a' }, to: { node: 'b' } }));

    expect(canvas.edges ?? []).toHaveLength(edgesBefore);
  });

  it('does not mutate the original canvas on addEntity', () => {
    const canvas = makeCanvas();
    const entitiesBefore = (canvas.entities ?? []).length;
    addEntity(canvas, makeEntity({ name: 'New' }));

    expect(canvas.entities ?? []).toHaveLength(entitiesBefore);
  });

  it('returned canvas is a new reference from updateNode', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const result = updateNode(canvas, 'a', { displayName: 'Updated' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toBe(canvas);
  });

  it('returned canvas is a new reference from updateEdge', () => {
    const canvas = makeCanvas({
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const result = updateEdge(canvas, 'a', 'b', { label: 'x' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toBe(canvas);
  });
});
