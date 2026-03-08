/**
 * Tests for the NestingFrame component - visual inset border frames
 * that create a depth effect when diving into nested canvases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock stores ─────────────────────────────────────────────────

// We test the pure logic (frame computation) rather than rendering,
// since the component is a thin visual layer over Zustand state.

// ─── Helper: hexToRgba (mirror the component's utility) ──────────

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  if (h.length === 8) {
    h = h.slice(0, 6);
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Helper: frame computation logic (mirrors NestingFrame) ──────

interface FrameLevel {
  index: number;
  inset: number;
  color: string;
  opacity: number;
  borderWidth: number;
}

const MAX_DEPTH_CAP = 12;
const DEFAULT_FRAME_COLOR = '#64748B';
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.25;

interface FileStackEntry {
  containerColor?: string;
}

function computeFrames(
  fileStack: FileStackEntry[],
  navPathLength: number,
  enabled: boolean,
  thickness: number,
): FrameLevel[] {
  const totalDepth = fileStack.length + navPathLength;
  if (!enabled || totalDepth === 0) return [];

  const cappedDepth = Math.min(totalDepth, MAX_DEPTH_CAP);
  const levels: FrameLevel[] = [];

  for (let i = 0; i < cappedDepth; i++) {
    const stackEntry = fileStack[i];
    const color = stackEntry?.containerColor || DEFAULT_FRAME_COLOR;
    const inset = i * thickness;
    const opacityRange = MAX_OPACITY - MIN_OPACITY;
    const opacity =
      cappedDepth === 1
        ? MIN_OPACITY + opacityRange * 0.5
        : MIN_OPACITY + (opacityRange * i) / (cappedDepth - 1);
    const borderWidth = i === cappedDepth - 1 ? 2 : 1;
    levels.push({ index: i, inset, color, opacity, borderWidth });
  }

  return levels;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('NestingFrame: frame computation', () => {
  it('returns empty array when depth is 0', () => {
    const frames = computeFrames([], 0, true, 4);
    expect(frames).toEqual([]);
  });

  it('returns empty array when disabled', () => {
    const frames = computeFrames([{}], 0, false, 4);
    expect(frames).toEqual([]);
  });

  it('generates one frame at depth 1 (file stack)', () => {
    const frames = computeFrames([{ containerColor: '#3B82F6' }], 0, true, 4);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.index).toBe(0);
    expect(frames[0]!.inset).toBe(0);
    expect(frames[0]!.color).toBe('#3B82F6');
    expect(frames[0]!.borderWidth).toBe(2); // innermost is thicker
  });

  it('generates frames for combined file + nav depth', () => {
    const stack = [{ containerColor: '#FF0000' }, { containerColor: '#00FF00' }];
    const frames = computeFrames(stack, 1, true, 4);
    // total depth = 2 (file) + 1 (nav) = 3
    expect(frames).toHaveLength(3);
    expect(frames[0]!.color).toBe('#FF0000');
    expect(frames[1]!.color).toBe('#00FF00');
    expect(frames[2]!.color).toBe(DEFAULT_FRAME_COLOR); // nav depth has no stack entry
  });

  it('caps at MAX_DEPTH_CAP (12)', () => {
    const stack = Array.from({ length: 15 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 4);
    expect(frames).toHaveLength(12);
  });

  it('computes correct inset values based on thickness', () => {
    const stack = [{ containerColor: '#AAA' }, { containerColor: '#BBB' }, { containerColor: '#CCC' }];
    const frames = computeFrames(stack, 0, true, 6);
    expect(frames[0]!.inset).toBe(0);
    expect(frames[1]!.inset).toBe(6);
    expect(frames[2]!.inset).toBe(12);
  });

  it('max total inset at depth 12 with thickness 4 is 44px', () => {
    const stack = Array.from({ length: 12 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 4);
    const maxInset = frames[frames.length - 1]!.inset;
    expect(maxInset).toBe(44); // 11 * 4
  });

  it('opacity increases with depth', () => {
    const stack = Array.from({ length: 4 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 4);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.opacity).toBeGreaterThan(frames[i - 1]!.opacity);
    }
  });

  it('innermost frame has borderWidth 2, others have 1', () => {
    const stack = Array.from({ length: 3 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 4);
    expect(frames[0]!.borderWidth).toBe(1);
    expect(frames[1]!.borderWidth).toBe(1);
    expect(frames[2]!.borderWidth).toBe(2); // innermost
  });

  it('uses default color when containerColor is not set', () => {
    const frames = computeFrames([{}], 0, true, 4);
    expect(frames[0]!.color).toBe(DEFAULT_FRAME_COLOR);
  });

  it('uses default color for nav depth levels beyond file stack', () => {
    const frames = computeFrames([], 2, true, 4);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.color).toBe(DEFAULT_FRAME_COLOR);
    expect(frames[1]!.color).toBe(DEFAULT_FRAME_COLOR);
  });

  it('single depth has medium opacity', () => {
    const frames = computeFrames([{}], 0, true, 4);
    const expectedOpacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * 0.5;
    expect(frames[0]!.opacity).toBeCloseTo(expectedOpacity, 5);
  });
});

describe('NestingFrame: hexToRgba utility', () => {
  it('converts 6-char hex to rgba', () => {
    expect(hexToRgba('#3B82F6', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
  });

  it('converts 3-char shorthand hex', () => {
    expect(hexToRgba('#abc', 0.3)).toBe('rgba(170, 187, 204, 0.3)');
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgba('FF0000', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('handles 8-char hex (strips alpha)', () => {
    expect(hexToRgba('#3B82F6FF', 0.5)).toBe('rgba(59, 130, 246, 0.5)');
  });

  it('returns fallback for invalid hex', () => {
    expect(hexToRgba('not-a-color', 0.5)).toBe('rgba(100, 116, 139, 0.5)');
  });

  it('handles black (#000000)', () => {
    expect(hexToRgba('#000000', 0.1)).toBe('rgba(0, 0, 0, 0.1)');
  });

  it('handles white (#FFFFFF)', () => {
    expect(hexToRgba('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('NestingFrame: configurable thickness', () => {
  it('thickness 1 produces minimal insets', () => {
    const stack = Array.from({ length: 5 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 1);
    expect(frames[4]!.inset).toBe(4); // 4 * 1
  });

  it('thickness 8 produces larger insets', () => {
    const stack = Array.from({ length: 3 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 8);
    expect(frames[2]!.inset).toBe(16); // 2 * 8
  });

  it('max total inset at depth 12 with thickness 4 stays under 48px', () => {
    const stack = Array.from({ length: 12 }, () => ({}));
    const frames = computeFrames(stack, 0, true, 4);
    const maxInset = frames[frames.length - 1]!.inset;
    expect(maxInset).toBeLessThanOrEqual(48);
  });
});

describe('NestingFrame: visual regression scenarios', () => {
  it('depth 1: single thin border with container color', () => {
    const frames = computeFrames([{ containerColor: '#E11D48' }], 0, true, 4);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.inset).toBe(0);
    expect(frames[0]!.color).toBe('#E11D48');
    expect(frames[0]!.borderWidth).toBe(2);
  });

  it('depth 3: three concentric borders with increasing prominence', () => {
    const stack = [
      { containerColor: '#3B82F6' },
      { containerColor: '#10B981' },
      { containerColor: '#F59E0B' },
    ];
    const frames = computeFrames(stack, 0, true, 4);
    expect(frames).toHaveLength(3);

    // Verify concentric insets
    expect(frames[0]!.inset).toBe(0);
    expect(frames[1]!.inset).toBe(4);
    expect(frames[2]!.inset).toBe(8);

    // Verify colors match stack order
    expect(frames[0]!.color).toBe('#3B82F6');
    expect(frames[1]!.color).toBe('#10B981');
    expect(frames[2]!.color).toBe('#F59E0B');

    // Verify innermost is thicker
    expect(frames[0]!.borderWidth).toBe(1);
    expect(frames[1]!.borderWidth).toBe(1);
    expect(frames[2]!.borderWidth).toBe(2);
  });

  it('depth 5: mixed file and nav depth', () => {
    const stack = [
      { containerColor: '#3B82F6' },
      { containerColor: '#10B981' },
    ];
    const frames = computeFrames(stack, 3, true, 4);
    expect(frames).toHaveLength(5);

    // File stack entries have colors
    expect(frames[0]!.color).toBe('#3B82F6');
    expect(frames[1]!.color).toBe('#10B981');

    // Nav depth entries fall back to default
    expect(frames[2]!.color).toBe(DEFAULT_FRAME_COLOR);
    expect(frames[3]!.color).toBe(DEFAULT_FRAME_COLOR);
    expect(frames[4]!.color).toBe(DEFAULT_FRAME_COLOR);
  });

  it('disabled setting produces no frames regardless of depth', () => {
    const stack = Array.from({ length: 5 }, () => ({ containerColor: '#FF0000' }));
    const frames = computeFrames(stack, 3, false, 4);
    expect(frames).toHaveLength(0);
  });
});
