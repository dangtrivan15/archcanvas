import { describe, it, expect } from 'vitest';
import { mapCanvasNodes, mapCanvasEdges, mapRemovedNodes, mapRemovedEdges } from '@/components/canvas/mapCanvasData';
import { diffCanvas } from '@/core/diff/engine';
import type { Canvas } from '@/types';

function makeCanvas(partial: Partial<Canvas> = {}): Canvas {
  return {
    project: { name: 'Test' },
    nodes: [],
    edges: [],
    ...partial,
  } as Canvas;
}

describe('mapCanvasEdges', () => {
  it('sets isSelected=true for edges whose key is in selectedEdgeKeys', () => {
    const canvas = makeCanvas({
      nodes: [
        { id: 'a', type: 'compute/service' },
        { id: 'b', type: 'compute/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' } },
      ],
    } as any);

    const selected = new Set(['a→b']);
    const result = mapCanvasEdges({ canvas, selectedEdgeKeys: selected });

    expect(result).toHaveLength(1);
    expect(result[0].data?.isSelected).toBe(true);
  });

  it('sets isSelected=false for edges not in selectedEdgeKeys', () => {
    const canvas = makeCanvas({
      nodes: [
        { id: 'a', type: 'compute/service' },
        { id: 'b', type: 'compute/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' } },
      ],
    } as any);

    const selected = new Set<string>();
    const result = mapCanvasEdges({ canvas, selectedEdgeKeys: selected });

    expect(result).toHaveLength(1);
    expect(result[0].data?.isSelected).toBe(false);
  });

  it('handles multiple edges with mixed selection', () => {
    const canvas = makeCanvas({
      edges: [
        { from: { node: 'a' }, to: { node: 'b' } },
        { from: { node: 'b' }, to: { node: 'c' } },
        { from: { node: 'c' }, to: { node: 'a' } },
      ],
    } as any);

    const selected = new Set(['a→b', 'c→a']);
    const result = mapCanvasEdges({ canvas, selectedEdgeKeys: selected });

    expect(result).toHaveLength(3);
    expect(result[0].data?.isSelected).toBe(true); // a→b
    expect(result[1].data?.isSelected).toBe(false); // b→c
    expect(result[2].data?.isSelected).toBe(true); // c→a
  });

  it('returns empty array for undefined canvas', () => {
    const result = mapCanvasEdges({ canvas: undefined, selectedEdgeKeys: new Set() });
    expect(result).toEqual([]);
  });
});

describe('mapCanvasNodes', () => {
  it('sets isSelected=true for nodes in selectedNodeIds', () => {
    const canvas = makeCanvas({
      nodes: [
        { id: 'a', type: 'compute/service' },
        { id: 'b', type: 'compute/service' },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(['a']),
      canvasesRef: undefined,
    });

    expect(result).toHaveLength(2);
    const nodeA = result.find((n) => n.id === 'a');
    const nodeB = result.find((n) => n.id === 'b');
    expect(nodeA?.data.isSelected).toBe(true);
    expect(nodeB?.data.isSelected).toBe(false);
  });

  it('sets isSelected=false when selectedNodeIds is empty', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'a', type: 'compute/service' }],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.isSelected).toBe(false);
  });
});

describe('mapRemovedNodes', () => {
  it('returns empty array when diff is undefined', () => {
    const result = mapRemovedNodes({ diff: undefined, baseCanvas: undefined, resolve: () => undefined });
    expect(result).toEqual([]);
  });

  it('creates ghost nodes for removed items', () => {
    const baseCanvas = makeCanvas({
      nodes: [
        { id: 'old-node', type: 'compute/service', position: { x: 100, y: 200 } },
        { id: 'kept-node', type: 'storage/database' },
      ],
    } as any);

    const currentCanvas = makeCanvas({
      nodes: [{ id: 'kept-node', type: 'storage/database' }],
    } as any);

    const diff = diffCanvas(baseCanvas, currentCanvas, 'test');

    const result = mapRemovedNodes({ diff, baseCanvas, resolve: () => undefined });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('old-node');
    expect(result[0].data.diffStatus).toBe('removed');
    expect(result[0].position).toEqual({ x: 100, y: 200 });
    expect(result[0].selectable).toBe(false);
    expect(result[0].draggable).toBe(false);
    expect(result[0].connectable).toBe(false);
  });

  it('does not include non-removed nodes', () => {
    const baseCanvas = makeCanvas({
      nodes: [
        { id: 'n1', type: 'compute/service' },
        { id: 'n2', type: 'storage/database' },
      ],
    } as any);

    // n1 modified (type changed), n2 still present
    const currentCanvas = makeCanvas({
      nodes: [
        { id: 'n1', type: 'compute/function' },
        { id: 'n2', type: 'storage/database' },
      ],
    } as any);

    const diff = diffCanvas(baseCanvas, currentCanvas, 'test');

    const result = mapRemovedNodes({ diff, baseCanvas, resolve: () => undefined });
    expect(result).toHaveLength(0);
  });
});

describe('mapRemovedEdges', () => {
  it('returns empty array when diff is undefined', () => {
    const result = mapRemovedEdges({ diff: undefined, baseCanvas: undefined });
    expect(result).toEqual([]);
  });

  it('creates ghost edges for removed edges', () => {
    const baseCanvas = makeCanvas({
      nodes: [
        { id: 'a', type: 'compute/service' },
        { id: 'b', type: 'compute/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' }, protocol: 'HTTP' },
      ],
    } as any);

    const currentCanvas = makeCanvas({
      nodes: [
        { id: 'a', type: 'compute/service' },
        { id: 'b', type: 'compute/service' },
      ],
      edges: [],
    } as any);

    const diff = diffCanvas(baseCanvas, currentCanvas, 'test');

    const result = mapRemovedEdges({ diff, baseCanvas });
    expect(result).toHaveLength(1);
    expect(result[0].data?.diffStatus).toBe('removed');
    expect(result[0].source).toBe('a');
    expect(result[0].target).toBe('b');
    expect(result[0].selectable).toBe(false);
  });

  it('does not include non-removed edges', () => {
    const baseCanvas = makeCanvas({
      edges: [{ from: { node: 'a' }, to: { node: 'b' } }],
    } as any);

    // Same edge, but protocol changed (modified, not removed)
    const currentCanvas = makeCanvas({
      edges: [{ from: { node: 'a' }, to: { node: 'b' }, protocol: 'gRPC' }],
    } as any);

    const diff = diffCanvas(baseCanvas, currentCanvas, 'test');

    const result = mapRemovedEdges({ diff, baseCanvas });
    expect(result).toHaveLength(0);
  });
});
