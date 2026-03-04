/**
 * Tests for Feature #325: Left sidebar default width scales relative to viewport width
 *
 * Verifies that the left sidebar default width is computed as 15% of viewport width,
 * clamped between a floor of 180px and a ceiling of 360px.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDefaultLeftPanelWidth,
  LEFT_PANEL_VIEWPORT_RATIO,
  LEFT_PANEL_DEFAULT_FLOOR,
  LEFT_PANEL_DEFAULT_CEILING,
  LEFT_PANEL_MIN_WIDTH,
} from '@/store/uiStore';

describe('computeDefaultLeftPanelWidth', () => {
  // Step 1: On a narrow window (1024px), verify floor of 180px
  it('returns floor (180px) for narrow viewport (1024px)', () => {
    const width = computeDefaultLeftPanelWidth(1024);
    // 1024 * 0.15 = 153.6 → rounds to 154, floored to 180
    expect(width).toBe(180);
  });

  // Step 2: On a medium window (1440px), verify ~216px
  it('returns ~216px for medium viewport (1440px)', () => {
    const width = computeDefaultLeftPanelWidth(1440);
    // 1440 * 0.15 = 216
    expect(width).toBe(216);
  });

  // Step 3: On a wide display (1920px), verify ~288px
  it('returns ~288px for wide viewport (1920px)', () => {
    const width = computeDefaultLeftPanelWidth(1920);
    // 1920 * 0.15 = 288
    expect(width).toBe(288);
  });

  // Step 4: On a very wide display (2560px), verify ceiling of 360px
  it('returns ceiling (360px) for very wide viewport (2560px)', () => {
    const width = computeDefaultLeftPanelWidth(2560);
    // 2560 * 0.15 = 384, capped to 360
    expect(width).toBe(360);
  });

  it('returns exactly floor for viewport where 15% equals floor', () => {
    // 180 / 0.15 = 1200px
    const width = computeDefaultLeftPanelWidth(1200);
    expect(width).toBe(180);
  });

  it('returns exactly ceiling for viewport where 15% equals ceiling', () => {
    // 360 / 0.15 = 2400px
    const width = computeDefaultLeftPanelWidth(2400);
    expect(width).toBe(360);
  });

  it('floors values below 180px for very narrow viewports', () => {
    const width = computeDefaultLeftPanelWidth(800);
    // 800 * 0.15 = 120 → floored to 180
    expect(width).toBe(180);
  });

  it('caps values above 360px for ultra-wide viewports', () => {
    const width = computeDefaultLeftPanelWidth(3840);
    // 3840 * 0.15 = 576 → capped to 360
    expect(width).toBe(360);
  });

  it('uses fallback viewport width (1440) when no argument provided in test env', () => {
    // In vitest, window.innerWidth may not be set, so it uses the fallback of 1440
    const width = computeDefaultLeftPanelWidth();
    // Should be a valid value within floor/ceiling range
    expect(width).toBeGreaterThanOrEqual(LEFT_PANEL_DEFAULT_FLOOR);
    expect(width).toBeLessThanOrEqual(LEFT_PANEL_DEFAULT_CEILING);
  });

  it('returns a value >= LEFT_PANEL_MIN_WIDTH (180px) for any viewport', () => {
    for (const vw of [320, 640, 1024, 1440, 1920, 2560, 3840]) {
      const width = computeDefaultLeftPanelWidth(vw);
      expect(width).toBeGreaterThanOrEqual(LEFT_PANEL_MIN_WIDTH);
    }
  });

  it('exports correct constants', () => {
    expect(LEFT_PANEL_VIEWPORT_RATIO).toBe(0.15);
    expect(LEFT_PANEL_DEFAULT_FLOOR).toBe(180);
    expect(LEFT_PANEL_DEFAULT_CEILING).toBe(360);
  });
});

describe('Left panel width - persisted custom width priority (Step 5)', () => {
  it('setLeftPanelWidth allows persisting a custom width within bounds', async () => {
    // Dynamic import to get a fresh store
    const { useUIStore } = await import('@/store/uiStore');
    const store = useUIStore.getState();

    // Set a custom width (simulating user drag-resize)
    store.setLeftPanelWidth(300);
    expect(useUIStore.getState().leftPanelWidth).toBe(300);

    // The custom width persists and is NOT overridden by the default
    // (The store keeps whatever value was last set)
    expect(useUIStore.getState().leftPanelWidth).toBe(300);
  });

  it('setLeftPanelWidth clamps to min/max bounds', async () => {
    const { useUIStore, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH } = await import('@/store/uiStore');

    useUIStore.getState().setLeftPanelWidth(100);
    expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MIN_WIDTH);

    useUIStore.getState().setLeftPanelWidth(500);
    expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MAX_WIDTH);
  });
});
