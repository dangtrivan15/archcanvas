/**
 * Unit tests for shape-aware content insets.
 *
 * Verifies that each SVG shape type has appropriate content insets so that
 * text and UI elements don't clip against the shape boundary.
 */
import { describe, it, expect } from 'vitest';
import { getShapeInsets, type ShapeInsets } from '@/components/nodes/shapes/shapeInsets';
import type { ShapeName } from '@/components/nodes/shapes/shapeRegistry';

// Helper: verify all insets are positive numbers
function expectPositiveInsets(insets: ShapeInsets) {
  expect(insets.top).toBeGreaterThan(0);
  expect(insets.right).toBeGreaterThan(0);
  expect(insets.bottom).toBeGreaterThan(0);
  expect(insets.left).toBeGreaterThan(0);
}

// Helper: verify content area is still usable (not zero or negative width/height)
function expectUsableContentArea(insets: ShapeInsets, width: number, height: number) {
  const contentWidth = width - insets.left - insets.right;
  const contentHeight = height - insets.top - insets.bottom;
  expect(contentWidth).toBeGreaterThan(20); // at least 20px wide
  expect(contentHeight).toBeGreaterThan(20); // at least 20px tall
}

describe('getShapeInsets', () => {
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

  it.each(shapes)('%s returns positive insets', (shape) => {
    const insets = getShapeInsets(shape, 220, 100);
    expectPositiveInsets(insets);
  });

  it.each(shapes)('%s leaves usable content area', (shape) => {
    const w = shape === 'cloud' ? 260 : 220;
    const insets = getShapeInsets(shape, w, 120);
    expectUsableContentArea(insets, w, 120);
  });
});

describe('rectangle insets', () => {
  it('uses uniform base padding', () => {
    const insets = getShapeInsets('rectangle', 200, 100);
    expect(insets.top).toBe(8);
    expect(insets.right).toBe(8);
    expect(insets.bottom).toBe(8);
    expect(insets.left).toBe(8);
  });
});

describe('cylinder insets', () => {
  it('has extra top/bottom padding for elliptical caps', () => {
    const insets = getShapeInsets('cylinder', 220, 120);
    const ry = Math.min(16, 120 * 0.12); // 14.4
    // Top and bottom should account for the cap radius
    expect(insets.top).toBeGreaterThan(8);
    expect(insets.bottom).toBeGreaterThan(8);
    expect(insets.top).toBeCloseTo(ry + 4, 1);
    expect(insets.bottom).toBeCloseTo(ry + 4, 1);
  });

  it('caps ry at 16 for tall nodes', () => {
    const insets = getShapeInsets('cylinder', 220, 300);
    // ry = min(16, 300*0.12=36) → 16
    expect(insets.top).toBe(16 + 4); // 20
    expect(insets.bottom).toBe(16 + 4);
  });

  it('content starts below top cap and ends above bottom cap', () => {
    const h = 120;
    const ry = Math.min(16, h * 0.12);
    const insets = getShapeInsets('cylinder', 220, h);
    // foreignObject y should be at or below the cap
    expect(insets.top).toBeGreaterThanOrEqual(ry);
    expect(insets.bottom).toBeGreaterThanOrEqual(ry);
  });

  it('has normal horizontal padding (no caps on sides)', () => {
    const insets = getShapeInsets('cylinder', 220, 120);
    expect(insets.left).toBe(8);
    expect(insets.right).toBe(8);
  });
});

describe('hexagon insets', () => {
  it('has extra horizontal padding for angled sides', () => {
    const insets = getShapeInsets('hexagon', 240, 100);
    const geometricInset = Math.min(240 * 0.2, 30); // 30
    expect(insets.left).toBeGreaterThan(8);
    expect(insets.right).toBeGreaterThan(8);
    expect(insets.left).toBeCloseTo(geometricInset + 4, 1);
    expect(insets.right).toBeCloseTo(geometricInset + 4, 1);
  });

  it('content stays within angled sides', () => {
    const w = 240;
    const inset = Math.min(w * 0.2, 30);
    const insets = getShapeInsets('hexagon', w, 100);
    // At the middle height, hexagon extends from x=0 to x=w,
    // but at top/bottom, it's inset. Content should avoid the edges.
    expect(insets.left).toBeGreaterThanOrEqual(inset);
    expect(insets.right).toBeGreaterThanOrEqual(inset);
  });

  it('has standard vertical padding', () => {
    const insets = getShapeInsets('hexagon', 240, 100);
    expect(insets.top).toBe(8);
    expect(insets.bottom).toBe(8);
  });
});

describe('parallelogram insets', () => {
  it('has extra horizontal padding for slant', () => {
    const insets = getShapeInsets('parallelogram', 240, 100);
    expect(insets.left).toBeGreaterThan(8);
    expect(insets.right).toBeGreaterThan(8);
  });

  it('horizontal padding accommodates the skew', () => {
    const w = 240;
    const skew = Math.min(w * 0.15, 24); // 24
    const insets = getShapeInsets('parallelogram', w, 100);
    // Insets should account for at least half the skew on each side
    expect(insets.left).toBeGreaterThanOrEqual(skew / 2);
    expect(insets.right).toBeGreaterThanOrEqual(skew / 2);
  });

  it('has standard vertical padding', () => {
    const insets = getShapeInsets('parallelogram', 240, 100);
    expect(insets.top).toBe(8);
    expect(insets.bottom).toBe(8);
  });
});

describe('cloud insets', () => {
  it('has generous insets for curved edges', () => {
    const insets = getShapeInsets('cloud', 260, 120);
    // Cloud needs more padding than any other shape
    expect(insets.top).toBeGreaterThan(16);
    expect(insets.bottom).toBeGreaterThan(16);
    expect(insets.left).toBeGreaterThan(20);
    expect(insets.right).toBeGreaterThan(20);
  });

  it('content is inset enough to stay within curved boundary', () => {
    const w = 260;
    const h = 120;
    const insets = getShapeInsets('cloud', w, h);
    // Cloud visible bounds are roughly 20-80% of width
    expect(insets.left).toBeGreaterThanOrEqual(w * 0.15);
    expect(insets.right).toBeGreaterThanOrEqual(w * 0.15);
    expect(insets.top).toBeGreaterThanOrEqual(h * 0.15);
    expect(insets.bottom).toBeGreaterThanOrEqual(h * 0.15);
  });

  it('still leaves usable content area for cloud shape', () => {
    const w = 260;
    const h = 120;
    const insets = getShapeInsets('cloud', w, h);
    const contentW = w - insets.left - insets.right;
    const contentH = h - insets.top - insets.bottom;
    expect(contentW).toBeGreaterThan(80);
    expect(contentH).toBeGreaterThan(30);
  });
});

describe('stadium insets', () => {
  it('has extra horizontal padding for rounded ends', () => {
    const insets = getShapeInsets('stadium', 240, 80);
    expect(insets.left).toBeGreaterThan(8);
    expect(insets.right).toBeGreaterThan(8);
  });

  it('horizontal padding relates to height (radius = h/2)', () => {
    const h = 80;
    const insets = getShapeInsets('stadium', 240, h);
    // Stadium radius is h/2 = 40, padding should account for some portion
    expect(insets.left).toBeGreaterThanOrEqual((h / 2) * 0.3);
    expect(insets.right).toBeGreaterThanOrEqual((h / 2) * 0.3);
  });

  it('has standard vertical padding', () => {
    const insets = getShapeInsets('stadium', 240, 80);
    expect(insets.top).toBe(8);
    expect(insets.bottom).toBe(8);
  });
});

describe('document insets', () => {
  it('has extra bottom padding for wavy edge', () => {
    const insets = getShapeInsets('document', 220, 100);
    expect(insets.bottom).toBeGreaterThan(8);
  });

  it('bottom padding matches the wave height', () => {
    const h = 100;
    const wave = Math.min(h * 0.12, 16); // 12
    const insets = getShapeInsets('document', 220, h);
    expect(insets.bottom).toBeCloseTo(wave + 4, 1);
  });

  it('has standard top/horizontal padding', () => {
    const insets = getShapeInsets('document', 220, 100);
    expect(insets.top).toBe(8);
    expect(insets.left).toBe(8);
    expect(insets.right).toBe(8);
  });
});

describe('badge insets', () => {
  it('has extra bottom padding for pointed bottom', () => {
    const insets = getShapeInsets('badge', 200, 100);
    expect(insets.bottom).toBeGreaterThan(8);
  });

  it('bottom padding accounts for point height', () => {
    const h = 100;
    const pointH = Math.min(h * 0.2, 20); // 20
    const insets = getShapeInsets('badge', 200, h);
    expect(insets.bottom).toBeCloseTo(pointH + 4, 1);
  });
});

describe('insets scale with dimensions', () => {
  it('cylinder insets increase with height', () => {
    const small = getShapeInsets('cylinder', 220, 80);
    const large = getShapeInsets('cylinder', 220, 200);
    // ry scales with height up to cap of 16
    expect(large.top).toBeGreaterThanOrEqual(small.top);
  });

  it('hexagon insets increase with width', () => {
    const narrow = getShapeInsets('hexagon', 120, 100);
    const wide = getShapeInsets('hexagon', 300, 100);
    // inset = min(w*0.2, 30), so wider = more inset up to cap
    expect(wide.left).toBeGreaterThanOrEqual(narrow.left);
  });

  it('stadium insets increase with height (radius = h/2)', () => {
    const short = getShapeInsets('stadium', 240, 60);
    const tall = getShapeInsets('stadium', 240, 120);
    expect(tall.left).toBeGreaterThanOrEqual(short.left);
  });
});
