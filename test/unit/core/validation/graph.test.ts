import { describe, it, expect } from 'vitest';
import { buildAdjacency, findCycles, isOrphan } from '@/core/validation/graph';
import { makeEdge } from '../../../core/graph/helpers';

describe('buildAdjacency', () => {
  it('builds out/in edges for in-scope nodes', () => {
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [makeEdge({ from: { node: 'a' }, to: { node: 'b' } }), makeEdge({ from: { node: 'b' }, to: { node: 'c' } })];
    const adjacency = buildAdjacency(edges, nodeIds);
    expect(adjacency.get('a')).toEqual({ out: ['b'], in: [] });
    expect(adjacency.get('b')).toEqual({ out: ['c'], in: ['a'] });
    expect(adjacency.get('c')).toEqual({ out: [], in: ['b'] });
  });

  it('skips edges with a cross-scope endpoint (id starting with @)', () => {
    const nodeIds = new Set(['a']);
    const edges = [makeEdge({ from: { node: 'a' }, to: { node: '@svc-a/inner' } })];
    const adjacency = buildAdjacency(edges, nodeIds);
    expect(adjacency.get('a')).toEqual({ out: [], in: [] });
  });

  it('drops endpoints not present in nodeIds', () => {
    const nodeIds = new Set(['a']);
    const edges = [makeEdge({ from: { node: 'a' }, to: { node: 'ghost' } })];
    const adjacency = buildAdjacency(edges, nodeIds);
    expect(adjacency.get('a')).toEqual({ out: [], in: [] });
  });
});

describe('findCycles', () => {
  it('finds a 3-node cycle', () => {
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [
      makeEdge({ from: { node: 'a' }, to: { node: 'b' } }),
      makeEdge({ from: { node: 'b' }, to: { node: 'c' } }),
      makeEdge({ from: { node: 'c' }, to: { node: 'a' } }),
    ];
    const adjacency = buildAdjacency(edges, nodeIds);
    const cycles = findCycles(adjacency);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(3);
    expect(new Set(cycles[0])).toEqual(new Set(['a', 'b', 'c']));
  });

  it('returns [] for a DAG', () => {
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [
      makeEdge({ from: { node: 'a' }, to: { node: 'b' } }),
      makeEdge({ from: { node: 'b' }, to: { node: 'c' } }),
    ];
    const adjacency = buildAdjacency(edges, nodeIds);
    expect(findCycles(adjacency)).toEqual([]);
  });

  it('dedupes rotations of the same cycle', () => {
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [
      makeEdge({ from: { node: 'a' }, to: { node: 'b' } }),
      makeEdge({ from: { node: 'b' }, to: { node: 'c' } }),
      makeEdge({ from: { node: 'c' }, to: { node: 'a' } }),
    ];
    const adjacency = buildAdjacency(edges, nodeIds);
    // Starting DFS from any of the three nodes should still yield exactly one cycle.
    expect(findCycles(adjacency)).toHaveLength(1);
  });
});

describe('isOrphan', () => {
  it('is true when a node has no out or in edges', () => {
    const adjacency = new Map([['a', { out: [], in: [] }]]);
    expect(isOrphan('a', adjacency)).toBe(true);
  });

  it('is false when a node has an edge', () => {
    const adjacency = new Map([['a', { out: ['b'], in: [] }]]);
    expect(isOrphan('a', adjacency)).toBe(false);
  });

  it('is true for a node absent from the adjacency map', () => {
    const adjacency = new Map<string, { out: string[]; in: string[] }>();
    expect(isOrphan('missing', adjacency)).toBe(true);
  });
});
