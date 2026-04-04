import { describe, it, expect } from 'vitest';
import {
  serializeSelection,
  preparePaste,
  computeCascadeOffset,
} from '@/core/graph/clipboard';
import type { ClipboardPayload } from '@/core/graph/clipboard';
import { makeCanvas, makeNode, makeRefNode, makeEdge } from './helpers';

// ---------------------------------------------------------------------------
// serializeSelection
// ---------------------------------------------------------------------------

describe('serializeSelection', () => {
  it('returns empty payload when no nodes are selected', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })] });
    const result = serializeSelection(canvas, new Set());
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('serializes a single InlineNode', () => {
    const node = makeNode({ id: 'svc-a', type: 'compute/service', displayName: 'Service A' });
    const canvas = makeCanvas({ nodes: [node] });
    const result = serializeSelection(canvas, new Set(['svc-a']));

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('svc-a');
    expect(result.nodes[0].displayName).toBe('Service A');
  });

  it('excludes RefNodes from the payload', () => {
    const inline = makeNode({ id: 'svc-a' });
    const ref = makeRefNode({ id: 'ref-1' });
    const canvas = makeCanvas({ nodes: [inline, ref] });
    const result = serializeSelection(canvas, new Set(['svc-a', 'ref-1']));

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('svc-a');
  });

  it('returns empty payload when only RefNodes are selected', () => {
    const ref = makeRefNode({ id: 'ref-1' });
    const canvas = makeCanvas({ nodes: [ref] });
    const result = serializeSelection(canvas, new Set(['ref-1']));

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('includes edges where both endpoints are selected', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const c = makeNode({ id: 'c' });
    const edgeAB = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const edgeBC = makeEdge({ from: { node: 'b' }, to: { node: 'c' } });
    const canvas = makeCanvas({ nodes: [a, b, c], edges: [edgeAB, edgeBC] });

    const result = serializeSelection(canvas, new Set(['a', 'b']));
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from.node).toBe('a');
    expect(result.edges[0].to.node).toBe('b');
  });

  it('excludes edges where one endpoint is not selected', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const edgeAB = makeEdge({ from: { node: 'a' }, to: { node: 'b' } });
    const canvas = makeCanvas({ nodes: [a, b], edges: [edgeAB] });

    const result = serializeSelection(canvas, new Set(['a']));
    expect(result.edges).toHaveLength(0);
  });

  it('strips codeRefs and notes from copied nodes', () => {
    const node = makeNode({
      id: 'svc-a',
      codeRefs: ['src/main.ts:10'],
      notes: [{ author: 'user', content: 'important' }],
    });
    const canvas = makeCanvas({ nodes: [node] });
    const result = serializeSelection(canvas, new Set(['svc-a']));

    expect(result.nodes[0]).not.toHaveProperty('codeRefs');
    expect(result.nodes[0]).not.toHaveProperty('notes');
  });

  it('strips notes from copied edges', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const edge = makeEdge({
      from: { node: 'a' },
      to: { node: 'b' },
      notes: [{ author: 'user', content: 'edge note' }],
    });
    const canvas = makeCanvas({ nodes: [a, b], edges: [edge] });
    const result = serializeSelection(canvas, new Set(['a', 'b']));

    expect(result.edges[0]).not.toHaveProperty('notes');
  });

  it('preserves displayName and args on copied nodes', () => {
    const node = makeNode({
      id: 'svc-a',
      displayName: 'My Service',
      args: { runtime: 'node', replicas: 3 },
    });
    const canvas = makeCanvas({ nodes: [node] });
    const result = serializeSelection(canvas, new Set(['svc-a']));

    expect(result.nodes[0].displayName).toBe('My Service');
    expect(result.nodes[0].args).toEqual({ runtime: 'node', replicas: 3 });
  });

  it('preserves position on copied nodes', () => {
    const node = makeNode({
      id: 'svc-a',
      position: { x: 100, y: 200 },
    });
    const canvas = makeCanvas({ nodes: [node] });
    const result = serializeSelection(canvas, new Set(['svc-a']));

    expect(result.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('handles selection of IDs not present in canvas gracefully', () => {
    const node = makeNode({ id: 'a' });
    const canvas = makeCanvas({ nodes: [node] });
    const result = serializeSelection(canvas, new Set(['a', 'nonexistent']));

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// computeCascadeOffset
// ---------------------------------------------------------------------------

describe('computeCascadeOffset', () => {
  it('returns zero offset for pasteCount 0', () => {
    expect(computeCascadeOffset(0)).toEqual({ dx: 0, dy: 0 });
  });

  it('returns 30px offset for pasteCount 1', () => {
    expect(computeCascadeOffset(1)).toEqual({ dx: 30, dy: 30 });
  });

  it('cascades linearly with pasteCount', () => {
    expect(computeCascadeOffset(3)).toEqual({ dx: 90, dy: 90 });
  });
});

// ---------------------------------------------------------------------------
// preparePaste
// ---------------------------------------------------------------------------

describe('preparePaste', () => {
  // Deterministic ID generator for testing
  let counter: number;
  const testIdGen = () => `node-test-${String(++counter).padStart(3, '0')}`;

  const samplePayload: ClipboardPayload = {
    nodes: [
      { id: 'a', type: 'compute/service', displayName: 'Alpha', position: { x: 100, y: 200 } },
      { id: 'b', type: 'compute/service', displayName: 'Beta', position: { x: 300, y: 400 } },
    ],
    edges: [
      { from: { node: 'a' }, to: { node: 'b' } },
    ],
  };

  beforeEach(() => {
    counter = 0;
  });

  it('returns empty result for empty payload', () => {
    const result = preparePaste({ nodes: [], edges: [] }, 1, testIdGen);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('generates new IDs for all nodes', () => {
    const result = preparePaste(samplePayload, 0, testIdGen);

    expect(result.nodes[0].id).toBe('node-test-001');
    expect(result.nodes[1].id).toBe('node-test-002');
    expect(result.nodes[0].id).not.toBe('a');
    expect(result.nodes[1].id).not.toBe('b');
  });

  it('preserves displayName as-is', () => {
    const result = preparePaste(samplePayload, 0, testIdGen);
    expect(result.nodes[0]).toHaveProperty('displayName', 'Alpha');
    expect(result.nodes[1]).toHaveProperty('displayName', 'Beta');
  });

  it('offsets positions by cascade offset', () => {
    const result = preparePaste(samplePayload, 2, testIdGen);

    // pasteCount=2 → dx=60, dy=60
    expect(result.nodes[0].position).toEqual({ x: 160, y: 260 });
    expect(result.nodes[1].position).toEqual({ x: 360, y: 460 });
  });

  it('defaults missing positions to (0,0) before offset', () => {
    const payload: ClipboardPayload = {
      nodes: [{ id: 'x', type: 'compute/service' }],
      edges: [],
    };
    const result = preparePaste(payload, 1, testIdGen);

    expect(result.nodes[0].position).toEqual({ x: 30, y: 30 });
  });

  it('remaps edge endpoints to new node IDs', () => {
    const result = preparePaste(samplePayload, 0, testIdGen);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from.node).toBe('node-test-001');
    expect(result.edges[0].to.node).toBe('node-test-002');
  });

  it('preserves edge properties (label, protocol, entities)', () => {
    const payload: ClipboardPayload = {
      nodes: [
        { id: 'a', type: 'compute/service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'compute/service', position: { x: 100, y: 0 } },
      ],
      edges: [
        {
          from: { node: 'a', port: 'http-out' },
          to: { node: 'b', port: 'http-in' },
          protocol: 'http',
          label: 'API call',
          entities: ['Order'],
        },
      ],
    };
    const result = preparePaste(payload, 0, testIdGen);

    expect(result.edges[0].protocol).toBe('http');
    expect(result.edges[0].label).toBe('API call');
    expect(result.edges[0].entities).toEqual(['Order']);
    expect(result.edges[0].from.port).toBe('http-out');
    expect(result.edges[0].to.port).toBe('http-in');
  });

  it('drops edges with endpoints not in the payload', () => {
    const payload: ClipboardPayload = {
      nodes: [{ id: 'a', type: 'compute/service', position: { x: 0, y: 0 } }],
      edges: [{ from: { node: 'a' }, to: { node: 'external' } }],
    };
    const result = preparePaste(payload, 0, testIdGen);

    expect(result.edges).toHaveLength(0);
  });

  it('preserves width/height/autoSize in position', () => {
    const payload: ClipboardPayload = {
      nodes: [{
        id: 'a',
        type: 'compute/service',
        position: { x: 10, y: 20, width: 200, height: 100, autoSize: true },
      }],
      edges: [],
    };
    const result = preparePaste(payload, 1, testIdGen);

    expect(result.nodes[0].position).toEqual({
      x: 40,
      y: 50,
      width: 200,
      height: 100,
      autoSize: true,
    });
  });

  it('uses default ID generator (crypto.randomUUID) when none provided', () => {
    const result = preparePaste(samplePayload, 0);

    // IDs should follow the node-{8chars} pattern
    for (const node of result.nodes) {
      expect(node.id).toMatch(/^node-[a-f0-9]{8}$/);
    }
  });
});
