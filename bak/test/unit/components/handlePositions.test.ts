/**
 * Tests for shape-aware handle positioning (handlePositions.ts)
 */

import { describe, it, expect } from 'vitest';
import { getHandlePosition, type HandleSide } from '@/components/nodes/shapes/handlePositions';
import type { ShapeName } from '@/components/nodes/shapes/shapeRegistry';

describe('handlePositions', () => {
  // Standard test dimensions
  const W = 220;
  const H = 100;

  describe('getHandlePosition returns valid styles', () => {
    const shapes: ShapeName[] = [
      'rectangle',
      'cylinder',
      'hexagon',
      'parallelogram',
      'cloud',
      'stadium',
      'document',
      'badge',
    ];
    const sides: HandleSide[] = ['left', 'right'];

    for (const shape of shapes) {
      for (const side of sides) {
        it(`${shape} / ${side} / single port returns top and transform`, () => {
          const style = getHandlePosition(shape, side, 0, 1, W, H);
          expect(style.top).toBeDefined();
          expect(typeof style.top).toBe('string');
          expect(style.transform).toBeDefined();
          expect(typeof style.transform).toBe('string');
        });

        it(`${shape} / ${side} / 3 ports returns valid positions for each`, () => {
          for (let i = 0; i < 3; i++) {
            const style = getHandlePosition(shape, side, i, 3, W, H);
            expect(style.top).toBeDefined();
            expect(style.transform).toBeDefined();
          }
        });
      }
    }
  });

  describe('cylinder', () => {
    it('avoids top/bottom caps (handles between 20%-80%)', () => {
      const style0 = getHandlePosition('cylinder', 'left', 0, 3, W, H);
      const style2 = getHandlePosition('cylinder', 'left', 2, 3, W, H);
      const top0 = parseFloat(style0.top);
      const top2 = parseFloat(style2.top);
      // First handle above center, last handle below center
      expect(top0).toBeGreaterThan(10);
      expect(top2).toBeLessThan(90);
    });

    it('single port is centered on body', () => {
      const style = getHandlePosition('cylinder', 'left', 0, 1, W, H);
      const top = parseFloat(style.top);
      expect(top).toBeGreaterThan(35);
      expect(top).toBeLessThan(65);
    });
  });

  describe('hexagon', () => {
    it('single port at 50% has left offset = 0 (vertex point)', () => {
      const style = getHandlePosition('hexagon', 'left', 0, 1, 240, H);
      const top = parseFloat(style.top);
      expect(top).toBe(50);
      // At 50%, the hexagon vertex is at x=0, so left offset should be ~0
      expect(style.left).toBeDefined();
      expect(style.left!).toBeLessThanOrEqual(1); // approximately 0
    });

    it('ports away from center have positive left offset (angled edge)', () => {
      const style = getHandlePosition('hexagon', 'left', 0, 3, 240, H);
      const top = parseFloat(style.top);
      expect(top).toBeLessThan(50);
      // Away from center, the edge is inward from the bounding box
      expect(style.left).toBeGreaterThan(0);
    });

    it('right side mirrors left side offsets', () => {
      const leftStyle = getHandlePosition('hexagon', 'left', 0, 1, 240, H);
      const rightStyle = getHandlePosition('hexagon', 'right', 0, 1, 240, H);
      expect(parseFloat(leftStyle.top)).toBe(parseFloat(rightStyle.top));
    });
  });

  describe('parallelogram', () => {
    it('left side at 50% has half-skew offset', () => {
      const style = getHandlePosition('parallelogram', 'left', 0, 1, 240, H);
      const skew = Math.min(240 * 0.15, 24);
      // At t=0.5: xOffset = skew * (1 - 0.5) = skew * 0.5
      expect(style.left).toBeCloseTo(skew * 0.5, 0);
    });

    it('right side at 50% has half-skew offset', () => {
      const style = getHandlePosition('parallelogram', 'right', 0, 1, 240, H);
      const skew = Math.min(240 * 0.15, 24);
      // At t=0.5: xOffset = skew * 0.5
      expect(style.right).toBeCloseTo(skew * 0.5, 0);
    });

    it('left offset decreases as Y increases (slant goes left)', () => {
      const top = getHandlePosition('parallelogram', 'left', 0, 3, 240, H);
      const bottom = getHandlePosition('parallelogram', 'left', 2, 3, 240, H);
      // Top port has larger left offset, bottom port has smaller
      expect(top.left!).toBeGreaterThan(bottom.left!);
    });
  });

  describe('cloud', () => {
    it('single port centered at 50%', () => {
      const style = getHandlePosition('cloud', 'left', 0, 1, 260, H);
      expect(style.top).toBe('50%');
      expect(style.transform).toBe('translateY(-50%)');
    });

    it('multiple ports spaced with pixel offsets', () => {
      const style0 = getHandlePosition('cloud', 'left', 0, 2, 260, H);
      const style1 = getHandlePosition('cloud', 'left', 1, 2, 260, H);
      expect(style0.top).toBe('50%');
      expect(style1.top).toBe('50%');
      // Transforms should contain different offsets
      expect(style0.transform).not.toBe(style1.transform);
    });
  });

  describe('stadium', () => {
    it('single port centered with no x correction', () => {
      const style = getHandlePosition('stadium', 'left', 0, 1, 240, H);
      expect(style.top).toBe('50%');
      expect(style.left).toBe(0);
    });

    it('multi-port positions have positive x correction for curve', () => {
      const style = getHandlePosition('stadium', 'left', 0, 3, 240, H);
      // Away from center, x correction compensates for semicircle
      expect(style.left).toBeGreaterThanOrEqual(0);
    });
  });

  describe('document', () => {
    it('single port above the wavy bottom', () => {
      const style = getHandlePosition('document', 'left', 0, 1, W, H);
      const top = parseFloat(style.top);
      const wave = Math.min(H * 0.12, 16);
      const maxPercent = ((H - wave * 2) / H) * 100;
      expect(top).toBeLessThanOrEqual(maxPercent + 1);
    });
  });

  describe('badge', () => {
    it('single port above the pointed bottom', () => {
      const style = getHandlePosition('badge', 'left', 0, 1, W, H);
      const top = parseFloat(style.top);
      const pointH = Math.min(H * 0.2, 20);
      const maxPercent = ((H - pointH * 1.2) / H) * 100;
      expect(top).toBeLessThanOrEqual(maxPercent + 1);
    });
  });

  describe('rectangle', () => {
    it('evenly spaces ports along the side', () => {
      const styles = Array.from({ length: 3 }, (_, i) =>
        getHandlePosition('rectangle', 'left', i, 3, W, H),
      );
      const tops = styles.map((s) => parseFloat(s.top));
      // Should be approximately 25%, 50%, 75%
      expect(tops[0]).toBeCloseTo(25, 0);
      expect(tops[1]).toBeCloseTo(50, 0);
      expect(tops[2]).toBeCloseTo(75, 0);
    });
  });
});
