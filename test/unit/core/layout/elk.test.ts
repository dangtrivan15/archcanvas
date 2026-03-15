import { describe, it, expect } from 'vitest';
import { computeLayout } from '@/core/layout/elk';
import type { Canvas } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCanvas(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }> = [],
): Canvas {
  return {
    nodes: nodeIds.map((id) => ({ id, type: 'service' })),
    edges: edges.map((e) => ({ from: { node: e.from }, to: { node: e.to } })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeLayout', () => {
  it('returns positions for all nodes in a simple graph', async () => {
    const canvas = makeCanvas(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);

    const result = await computeLayout(canvas);

    expect(result.positions.size).toBe(3);
    expect(result.positions.has('a')).toBe(true);
    expect(result.positions.has('b')).toBe(true);
    expect(result.positions.has('c')).toBe(true);
  });

  it('returns valid x/y numbers for each node', async () => {
    const canvas = makeCanvas(['x', 'y'], [{ from: 'x', to: 'y' }]);

    const result = await computeLayout(canvas);

    for (const pos of result.positions.values()) {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('respects horizontal direction option', async () => {
    const canvas = makeCanvas(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);

    const result = await computeLayout(canvas, { direction: 'horizontal' });

    // In a layered horizontal layout, nodes on separate layers have increasing x
    const posA = result.positions.get('a')!;
    const posB = result.positions.get('b')!;
    const posC = result.positions.get('c')!;

    expect(posA.x).toBeLessThan(posB.x);
    expect(posB.x).toBeLessThan(posC.x);
  });

  it('respects vertical direction option', async () => {
    const canvas = makeCanvas(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);

    const result = await computeLayout(canvas, { direction: 'vertical' });

    // In a layered vertical layout, nodes on separate layers have increasing y
    const posA = result.positions.get('a')!;
    const posB = result.positions.get('b')!;
    const posC = result.positions.get('c')!;

    expect(posA.y).toBeLessThan(posB.y);
    expect(posB.y).toBeLessThan(posC.y);
  });

  it('handles empty canvas (no nodes)', async () => {
    const canvas = makeCanvas([]);

    const result = await computeLayout(canvas);

    expect(result.positions.size).toBe(0);
  });

  it('handles canvas with no edges', async () => {
    const canvas = makeCanvas(['a', 'b', 'c']);

    const result = await computeLayout(canvas);

    expect(result.positions.size).toBe(3);
  });

  it('positions do not overlap (bounding boxes are disjoint)', async () => {
    const canvas = makeCanvas(['a', 'b', 'c', 'd'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
    ]);

    const result = await computeLayout(canvas);

    const DEFAULT_W = 200;
    const DEFAULT_H = 100;

    const positions = [...result.positions.entries()].map(([id, pos]) => ({
      id,
      x: pos.x,
      y: pos.y,
      w: DEFAULT_W,
      h: DEFAULT_H,
    }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlapsX && overlapsY, `${a.id} and ${b.id} overlap`).toBe(false);
      }
    }
  });
});
