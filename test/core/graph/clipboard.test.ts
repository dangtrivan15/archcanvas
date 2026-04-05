import { describe, it, expect } from 'vitest';
import {
  serializeSelection,
  deserializeForPaste,
  generateNodeId,
  type ClipboardPayload,
} from '@/core/graph/clipboard';
import { makeCanvas, makeNode, makeRefNode, makeEdge } from './helpers';

// =====================================================================
// serializeSelection
// =====================================================================

describe('serializeSelection', () => {
  it('returns null for empty selection', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'n1' })],
    });
    const result = serializeSelection(canvas, new Set(), 'root');
    expect(result).toBeNull();
  });

  it('returns null when selected IDs match no nodes', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'n1' })],
    });
    const result = serializeSelection(canvas, new Set(['nonexistent']), 'root');
    expect(result).toBeNull();
  });

  it('serializes selected nodes only', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'n1', displayName: 'A' }),
        makeNode({ id: 'n2', displayName: 'B' }),
        makeNode({ id: 'n3', displayName: 'C' }),
      ],
    });

    const result = serializeSelection(canvas, new Set(['n1', 'n3']), 'root');
    expect(result).not.toBeNull();
    expect(result!.nodes).toHaveLength(2);
    expect(result!.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(result!.sourceCanvasId).toBe('root');
  });

  it('includes only internal edges (both endpoints selected)', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'n1' }),
        makeNode({ id: 'n2' }),
        makeNode({ id: 'n3' }),
      ],
      edges: [
        makeEdge({ from: { node: 'n1' }, to: { node: 'n2' } }),
        makeEdge({ from: { node: 'n1' }, to: { node: 'n3' } }),
        makeEdge({ from: { node: 'n2' }, to: { node: 'n3' } }),
      ],
    });

    // Select n1 and n2 — only the n1→n2 edge should be included
    const result = serializeSelection(canvas, new Set(['n1', 'n2']), 'root');
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0].from.node).toBe('n1');
    expect(result!.edges[0].to.node).toBe('n2');
  });

  it('excludes edges when only one endpoint is selected', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
      edges: [makeEdge({ from: { node: 'n1' }, to: { node: 'n2' } })],
    });

    const result = serializeSelection(canvas, new Set(['n1']), 'root');
    expect(result!.edges).toHaveLength(0);
  });

  it('includes cross-scope edges when ref-node is selected', () => {
    const canvas = makeCanvas({
      nodes: [
        makeRefNode({ id: 'sub1', ref: 'sub1.yaml' }),
        makeNode({ id: 'n1' }),
      ],
      edges: [
        makeEdge({ from: { node: '@sub1/inner' }, to: { node: 'n1' } }),
      ],
    });

    const result = serializeSelection(canvas, new Set(['sub1', 'n1']), 'root');
    expect(result!.edges).toHaveLength(1);
  });

  it('deep-clones nodes — modifying result does not affect source', () => {
    const originalNode = makeNode({ id: 'n1', displayName: 'Original' });
    const canvas = makeCanvas({ nodes: [originalNode] });

    const result = serializeSelection(canvas, new Set(['n1']), 'root');
    (result!.nodes[0] as any).displayName = 'Modified';

    expect(originalNode.displayName).toBe('Original');
  });

  it('serializes RefNode correctly', () => {
    const canvas = makeCanvas({
      nodes: [makeRefNode({ id: 'sub1', ref: 'sub1.yaml' })],
    });

    const result = serializeSelection(canvas, new Set(['sub1']), 'root');
    expect(result!.nodes).toHaveLength(1);
    const node = result!.nodes[0];
    expect('ref' in node).toBe(true);
    if ('ref' in node) {
      expect(node.ref).toBe('sub1.yaml');
    }
  });
});

// =====================================================================
// deserializeForPaste
// =====================================================================

describe('deserializeForPaste', () => {
  it('generates new IDs for all nodes', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
      edges: [],
      sourceCanvasId: 'root',
    };

    const { nodes, idMap } = deserializeForPaste(payload);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).not.toBe('n1');
    expect(nodes[1].id).not.toBe('n2');
    expect(nodes[0].id).toMatch(/^node-[a-f0-9]{8}$/);
    expect(nodes[1].id).toMatch(/^node-[a-f0-9]{8}$/);
    expect(idMap.get('n1')).toBe(nodes[0].id);
    expect(idMap.get('n2')).toBe(nodes[1].id);
  });

  it('offsets positions by default (30, 30)', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1', position: { x: 100, y: 200 } })],
      edges: [],
      sourceCanvasId: 'root',
    };

    const { nodes } = deserializeForPaste(payload);
    expect(nodes[0].position).toEqual({ x: 130, y: 230 });
  });

  it('applies custom position offset', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1', position: { x: 100, y: 200 } })],
      edges: [],
      sourceCanvasId: 'root',
    };

    const { nodes } = deserializeForPaste(payload, {
      positionOffset: { dx: 50, dy: -10 },
    });
    expect(nodes[0].position).toEqual({ x: 150, y: 190 });
  });

  it('handles nodes without position', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' })],
      edges: [],
      sourceCanvasId: 'root',
    };

    // Should not throw
    const { nodes } = deserializeForPaste(payload);
    expect(nodes[0].position).toBeUndefined();
  });

  it('remaps edge endpoints to new IDs', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
      edges: [makeEdge({ from: { node: 'n1' }, to: { node: 'n2' } })],
      sourceCanvasId: 'root',
    };

    const { nodes, edges } = deserializeForPaste(payload);
    expect(edges).toHaveLength(1);
    expect(edges[0].from.node).toBe(nodes[0].id);
    expect(edges[0].to.node).toBe(nodes[1].id);
  });

  it('preserves edge ports during remapping', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
      edges: [
        makeEdge({
          from: { node: 'n1', port: 'http-out' },
          to: { node: 'n2', port: 'http-in' },
        }),
      ],
      sourceCanvasId: 'root',
    };

    const { edges } = deserializeForPaste(payload);
    expect(edges[0].from.port).toBe('http-out');
    expect(edges[0].to.port).toBe('http-in');
  });

  it('remaps cross-scope refs in edges', () => {
    const payload: ClipboardPayload = {
      nodes: [
        makeRefNode({ id: 'sub1', ref: 'sub1.yaml' }),
        makeNode({ id: 'n1' }),
      ],
      edges: [
        makeEdge({ from: { node: '@sub1/inner' }, to: { node: 'n1' } }),
      ],
      sourceCanvasId: 'root',
    };

    const { nodes, edges, idMap } = deserializeForPaste(payload);
    const newSubId = idMap.get('sub1')!;
    expect(edges).toHaveLength(1);
    expect(edges[0].from.node).toBe(`@${newSubId}/inner`);
    expect(edges[0].to.node).toBe(idMap.get('n1'));
  });

  it('drops edges referencing nodes outside the payload', () => {
    // This can happen if edge data gets out of sync
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' })],
      edges: [makeEdge({ from: { node: 'n1' }, to: { node: 'n-external' } })],
      sourceCanvasId: 'root',
    };

    const { edges } = deserializeForPaste(payload);
    expect(edges).toHaveLength(0);
  });

  it('deep-clones — modifying result does not affect payload', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1', displayName: 'Original' })],
      edges: [],
      sourceCanvasId: 'root',
    };

    const { nodes } = deserializeForPaste(payload);
    (nodes[0] as any).displayName = 'Modified';

    expect(payload.nodes[0]).toHaveProperty('displayName', 'Original');
  });

  it('preserves all node properties (args, description, etc.)', () => {
    const payload: ClipboardPayload = {
      nodes: [
        makeNode({
          id: 'n1',
          displayName: 'My Service',
          description: 'A test service',
          args: { runtime: 'node', replicas: 3 },
          position: { x: 10, y: 20, width: 100, height: 50 },
        }),
      ],
      edges: [],
      sourceCanvasId: 'root',
    };

    const { nodes } = deserializeForPaste(payload);
    const node = nodes[0] as any;
    expect(node.displayName).toBe('My Service');
    expect(node.description).toBe('A test service');
    expect(node.args).toEqual({ runtime: 'node', replicas: 3 });
    // Position offset applied
    expect(node.position.x).toBe(40);
    expect(node.position.y).toBe(50);
    expect(node.position.width).toBe(100);
    expect(node.position.height).toBe(50);
  });

  it('preserves edge label and protocol', () => {
    const payload: ClipboardPayload = {
      nodes: [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })],
      edges: [
        makeEdge({
          from: { node: 'n1' },
          to: { node: 'n2' },
          label: 'my label',
          protocol: 'grpc',
        }),
      ],
      sourceCanvasId: 'root',
    };

    const { edges } = deserializeForPaste(payload);
    expect(edges[0].label).toBe('my label');
    expect(edges[0].protocol).toBe('grpc');
  });
});

// =====================================================================
// generateNodeId
// =====================================================================

describe('generateNodeId', () => {
  it('produces IDs matching the project convention', () => {
    const id = generateNodeId();
    expect(id).toMatch(/^node-[a-f0-9]{8}$/);
  });

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateNodeId()));
    expect(ids.size).toBe(100);
  });
});
