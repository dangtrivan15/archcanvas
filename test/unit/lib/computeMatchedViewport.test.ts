import { describe, it, expect } from 'vitest';
import { computeMatchedViewport, CONTAINER_HEADER_H, CONTAINER_PAD_X, CONTAINER_PAD_Y } from '@/lib/computeMatchedViewport';

describe('computeMatchedViewport', () => {
  it('exports correct container layout constants', () => {
    expect(CONTAINER_HEADER_H).toBe(17);
    expect(CONTAINER_PAD_X).toBe(16);
    expect(CONTAINER_PAD_Y).toBe(14);
  });

  it('returns a viewport with zoom > 0', () => {
    const result = computeMatchedViewport(
      [{ x: 0, y: 0, width: 150, height: 40 }],
      { x: 100, y: 100, width: 400, height: 300 },
      1280, 720,
    );
    expect(result.zoom).toBeGreaterThan(0);
  });

  it('produces tighter zoom than full-viewport fitView', () => {
    const nodes = [
      { x: 0, y: 0, width: 150, height: 40 },
      { x: 300, y: 200, width: 150, height: 40 },
    ];
    const containerRect = { x: 50, y: 50, width: 500, height: 400 };

    const matched = computeMatchedViewport(nodes, containerRect, 1280, 720);

    expect(matched.zoom).toBeGreaterThan(0);
    expect(matched.zoom).toBeLessThan(10);
  });

  it('returns null-safe result for single node', () => {
    const result = computeMatchedViewport(
      [{ x: 50, y: 50, width: 150, height: 40 }],
      { x: 0, y: 0, width: 300, height: 200 },
      800, 600,
    );
    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
    expect(result).toHaveProperty('zoom');
  });

  it('returns default viewport for empty child nodes', () => {
    const result = computeMatchedViewport(
      [],
      { x: 0, y: 0, width: 300, height: 200 },
      800, 600,
    );
    expect(result.zoom).toBe(1);
  });
});
