import { describe, it, expect } from 'vitest';
import { computeAutoSize } from '@/lib/computeAutoSize';
import type { Canvas } from '@/types';

describe('computeAutoSize', () => {
  it('returns minimum size for empty canvas', () => {
    const canvas: Canvas = { nodes: [] };
    const result = computeAutoSize(canvas);
    expect(result).toEqual({ width: 180, height: 120 });
  });

  it('returns minimum size for undefined canvas', () => {
    const result = computeAutoSize(undefined);
    expect(result).toEqual({ width: 180, height: 120 });
  });

  it('returns minimum size for single node at origin', () => {
    const canvas: Canvas = {
      nodes: [{ id: 'a', type: 'service', position: { x: 0, y: 0 } }],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeGreaterThanOrEqual(180);
    expect(result.height).toBeGreaterThanOrEqual(120);
  });

  it('grows with spread-out nodes', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', position: { x: 200, y: 0 } },
        { id: 'c', type: 'service', position: { x: 100, y: 150 } },
      ],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeGreaterThan(200);
    expect(result.height).toBeGreaterThan(150);
  });

  it('clamps to maximum size', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', position: { x: 1000, y: 800 } },
      ],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeLessThanOrEqual(400);
    expect(result.height).toBeLessThanOrEqual(300);
  });

  it('handles nodes without positions', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'service' },
        { id: 'b', type: 'service', position: { x: 50, y: 50 } },
      ],
    };
    const result = computeAutoSize(canvas);
    expect(result.width).toBeGreaterThanOrEqual(180);
    expect(result.height).toBeGreaterThanOrEqual(120);
  });
});
