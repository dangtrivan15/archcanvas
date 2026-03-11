import { describe, it, expect } from 'vitest';
import {
  hasDefaultPosition,
  needsAutoLayout,
  classifyNodePositions,
} from '@/core/layout/positionDetection';
import type { ArchNode } from '@/types/graph';

/** Helper to create an ArchNode with a given position. */
function makeNode(
  id: string,
  x: number,
  y: number,
  overrides?: Partial<ArchNode>,
): ArchNode {
  return {
    id,
    type: 'compute/server',
    displayName: `Node ${id}`,
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x, y, width: 240, height: 100 },
    children: [],
    ...overrides,
  };
}

describe('hasDefaultPosition', () => {
  it('returns true for a node at (0,0)', () => {
    expect(hasDefaultPosition(makeNode('a', 0, 0))).toBe(true);
  });

  it('returns false for a node with non-zero x', () => {
    expect(hasDefaultPosition(makeNode('a', 100, 0))).toBe(false);
  });

  it('returns false for a node with non-zero y', () => {
    expect(hasDefaultPosition(makeNode('a', 0, 200))).toBe(false);
  });

  it('returns false for a node with both x and y non-zero', () => {
    expect(hasDefaultPosition(makeNode('a', 100, 200))).toBe(false);
  });

  it('returns false for negative coordinates', () => {
    expect(hasDefaultPosition(makeNode('a', -50, -30))).toBe(false);
  });

  it('returns true regardless of width, height, or color', () => {
    const node = makeNode('a', 0, 0);
    node.position.width = 500;
    node.position.height = 300;
    node.position.color = '#ff0000';
    expect(hasDefaultPosition(node)).toBe(true);
  });
});

describe('needsAutoLayout', () => {
  it('returns false for an empty node array', () => {
    expect(needsAutoLayout([])).toBe(false);
  });

  it('returns true when all nodes are at (0,0)', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 0, 0), makeNode('c', 0, 0)];
    expect(needsAutoLayout(nodes)).toBe(true);
  });

  it('returns true for a single node at (0,0)', () => {
    expect(needsAutoLayout([makeNode('a', 0, 0)])).toBe(true);
  });

  it('returns false when nodes have varied positions', () => {
    const nodes = [makeNode('a', 100, 200), makeNode('b', 300, 400)];
    expect(needsAutoLayout(nodes)).toBe(false);
  });

  it('returns false when at least one node has a non-default position', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 150, 250), makeNode('c', 0, 0)];
    expect(needsAutoLayout(nodes)).toBe(false);
  });

  it('returns false when only one node has a non-zero position among many', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 0, 0),
      makeNode('c', 0, 0),
      makeNode('d', 42, 0),
      makeNode('e', 0, 0),
    ];
    expect(needsAutoLayout(nodes)).toBe(false);
  });

  it('handles nodes with very small but non-zero positions', () => {
    const nodes = [makeNode('a', 0.001, 0), makeNode('b', 0, 0)];
    expect(needsAutoLayout(nodes)).toBe(false);
  });

  it('correctly identifies default positions regardless of children positions', () => {
    // Parent at (0,0), but children have positions - parent still at default
    const parent = makeNode('parent', 0, 0, {
      children: [makeNode('child1', 100, 200), makeNode('child2', 300, 400)],
    });
    expect(needsAutoLayout([parent])).toBe(true);
  });
});

describe('classifyNodePositions', () => {
  it('returns empty arrays for empty input', () => {
    const result = classifyNodePositions([]);
    expect(result.positioned).toEqual([]);
    expect(result.unpositioned).toEqual([]);
  });

  it('classifies all nodes at (0,0) as unpositioned', () => {
    const nodes = [makeNode('a', 0, 0), makeNode('b', 0, 0)];
    const result = classifyNodePositions(nodes);
    expect(result.positioned).toHaveLength(0);
    expect(result.unpositioned).toHaveLength(2);
    expect(result.unpositioned.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('classifies all nodes with positions as positioned', () => {
    const nodes = [makeNode('a', 100, 200), makeNode('b', 300, 400)];
    const result = classifyNodePositions(nodes);
    expect(result.positioned).toHaveLength(2);
    expect(result.unpositioned).toHaveLength(0);
  });

  it('separates mixed positioned and unpositioned nodes', () => {
    const nodes = [
      makeNode('a', 0, 0),
      makeNode('b', 150, 250),
      makeNode('c', 0, 0),
      makeNode('d', 300, 400),
    ];
    const result = classifyNodePositions(nodes);
    expect(result.positioned.map((n) => n.id)).toEqual(['b', 'd']);
    expect(result.unpositioned.map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('preserves node references (not copies)', () => {
    const node = makeNode('a', 100, 200);
    const result = classifyNodePositions([node]);
    expect(result.positioned[0]).toBe(node);
  });
});
