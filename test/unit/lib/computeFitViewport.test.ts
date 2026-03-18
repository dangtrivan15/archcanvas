import { describe, it, expect } from 'vitest';
import { computeFitViewport } from '@/lib/computeFitViewport';

describe('computeFitViewport', () => {
  it('returns identity viewport for single node centered in viewport', () => {
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
      maxZoom: 1, // clamp to 1 so small content doesn't zoom in
    });
    expect(result.zoom).toBeGreaterThan(0);
    expect(result.zoom).toBeLessThanOrEqual(1);
    expect(result.offsetX).toBeGreaterThan(0); // centered
    expect(result.offsetY).toBeGreaterThan(0); // centered
  });

  it('computes correct zoom for content larger than viewport', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 1600, y: 1200, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    // Content is 1700×1250, viewport is 800×600 → zoom < 1
    expect(result.zoom).toBeLessThan(1);
  });

  it('clamps zoom to maxZoom', () => {
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 10, height: 10 }],
      viewportWidth: 800,
      viewportHeight: 600,
      maxZoom: 2,
    });
    expect(result.zoom).toBeLessThanOrEqual(2);
  });

  it('clamps zoom to minZoom', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100000, y: 100000, width: 100, height: 100 },
      ],
      viewportWidth: 100,
      viewportHeight: 100,
      minZoom: 0.1,
    });
    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('applies padding factor', () => {
    // Use content large enough that zoom stays below maxZoom so padding is visible
    const withPadding = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 500, y: 400, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0.2,
    });
    const withoutPadding = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 500, y: 400, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0,
    });
    expect(withPadding.zoom).toBeLessThan(withoutPadding.zoom);
  });

  it('returns per-node screen positions', () => {
    const result = computeFitViewport({
      nodes: [
        { x: 0, y: 0, width: 100, height: 50 },
        { x: 200, y: 100, width: 100, height: 50 },
      ],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.nodeScreenRects).toHaveLength(2);
    for (const rect of result.nodeScreenRects) {
      expect(rect).toHaveProperty('x');
      expect(rect).toHaveProperty('y');
      expect(rect).toHaveProperty('width');
      expect(rect).toHaveProperty('height');
    }
  });

  it('returns empty results for no nodes', () => {
    const result = computeFitViewport({
      nodes: [],
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(result.zoom).toBe(1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
    expect(result.nodeScreenRects).toHaveLength(0);
  });

  it('centers content in viewport', () => {
    // Single node 100x50 in an 800x600 viewport — should be centered
    const result = computeFitViewport({
      nodes: [{ x: 0, y: 0, width: 100, height: 50 }],
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 0,
      maxZoom: 1, // clamp so node doesn't scale up
    });
    const rect = result.nodeScreenRects[0];
    // Horizontal center: (800 - 100) / 2 = 350
    expect(rect.x).toBeCloseTo(350, 0);
    // Vertical center: (600 - 50) / 2 = 275
    expect(rect.y).toBeCloseTo(275, 0);
  });
});
