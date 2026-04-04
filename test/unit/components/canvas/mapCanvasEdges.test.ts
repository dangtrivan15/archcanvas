import { describe, it, expect } from 'vitest';
import { mapCanvasEdges } from '@/components/canvas/mapCanvasData';
import type { Canvas, Edge } from '@/types';

function makeEdge(from: string, to: string, protocol?: string): Edge {
  return {
    from: { node: from },
    to: { node: to },
    ...(protocol ? { protocol } : {}),
  } as Edge;
}

function makeCanvas(edges: Edge[]): Canvas {
  return { edges, nodes: [] } as unknown as Canvas;
}

describe('mapCanvasEdges', () => {
  it('returns empty array when canvas is undefined', () => {
    const result = mapCanvasEdges({ canvas: undefined, selectedEdgeKeys: new Set() });
    expect(result).toEqual([]);
  });

  it('returns empty array when canvas has no edges', () => {
    const result = mapCanvasEdges({
      canvas: makeCanvas([]),
      selectedEdgeKeys: new Set(),
    });
    expect(result).toEqual([]);
  });

  it('maps edges with correct id, source, target, and type', () => {
    const edges = [makeEdge('a', 'b')];
    const result = mapCanvasEdges({
      canvas: makeCanvas(edges),
      selectedEdgeKeys: new Set(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a-b');
    expect(result[0].source).toBe('a');
    expect(result[0].target).toBe('b');
    expect(result[0].type).toBe('archEdge');
  });

  it('sets isSelected=true when edge key is in selectedEdgeKeys', () => {
    const edges = [makeEdge('a', 'b')];
    const result = mapCanvasEdges({
      canvas: makeCanvas(edges),
      selectedEdgeKeys: new Set(['a→b']),
    });

    expect(result[0].data?.isSelected).toBe(true);
  });

  it('sets isSelected=false when edge key is not in selectedEdgeKeys', () => {
    const edges = [makeEdge('a', 'b')];
    const result = mapCanvasEdges({
      canvas: makeCanvas(edges),
      selectedEdgeKeys: new Set(['x→y']),
    });

    expect(result[0].data?.isSelected).toBe(false);
  });

  it('handles multiple edges with mixed selection', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('c', 'd')];
    const result = mapCanvasEdges({
      canvas: makeCanvas(edges),
      selectedEdgeKeys: new Set(['c→d']),
    });

    expect(result[0].data?.isSelected).toBe(false);
    expect(result[1].data?.isSelected).toBe(true);
  });

  it('maps protocol to correct style category', () => {
    const edges = [
      makeEdge('a', 'b', 'HTTP'),
      makeEdge('c', 'd', 'Kafka'),
      makeEdge('e', 'f'),
    ];
    const result = mapCanvasEdges({
      canvas: makeCanvas(edges),
      selectedEdgeKeys: new Set(),
    });

    expect(result[0].data?.styleCategory).toBe('sync');
    expect(result[1].data?.styleCategory).toBe('async');
    expect(result[2].data?.styleCategory).toBe('default');
  });
});
