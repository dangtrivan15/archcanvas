import { describe, it, expect } from 'vitest';
import { computeZoomToRect } from '@/lib/computeZoomToRect';

describe('computeZoomToRect', () => {
  it('centers a rect in the viewport', () => {
    const result = computeZoomToRect(
      { x: 100, y: 100, width: 200, height: 100 },
      800, 600,
    );
    expect(result.zoom).toBe(4);
    expect(result.x).toBe(-400);
    expect(result.y).toBe(-300);
  });

  it('handles landscape rect in portrait viewport', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 400, height: 100 },
      400, 600,
    );
    expect(result.zoom).toBe(1);
  });

  it('handles portrait rect in landscape viewport', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 100, height: 400 },
      800, 400,
    );
    expect(result.zoom).toBe(1);
  });

  it('applies padding factor', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 200, height: 100 },
      800, 600,
      0.1,
    );
    expect(result.zoom).toBe(4 * 0.9);
  });

  it('defaults padding to 0 (edge-to-edge)', () => {
    const result = computeZoomToRect(
      { x: 0, y: 0, width: 800, height: 600 },
      800, 600,
    );
    expect(result.zoom).toBe(1);
  });
});
