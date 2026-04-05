import { describe, it, expect } from 'vitest';
import { mapCanvasNodes, mapCanvasEdges } from '@/components/canvas/mapCanvasData';
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
