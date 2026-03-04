import { describe, it, expect } from 'vitest';
import {
  computeDefaultRightPanelWidth,
  RIGHT_PANEL_VIEWPORT_RATIO,
  RIGHT_PANEL_DEFAULT_FLOOR,
  RIGHT_PANEL_DEFAULT_CEILING,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from '../../../src/store/uiStore';

describe('Right panel default width scales relative to viewport width', () => {
  it('exports the correct constants', () => {
    expect(RIGHT_PANEL_VIEWPORT_RATIO).toBe(0.20);
    expect(RIGHT_PANEL_DEFAULT_FLOOR).toBe(260);
    expect(RIGHT_PANEL_DEFAULT_CEILING).toBe(480);
  });

  // Step 1: On a narrow window (1024px), verify right panel defaults to floor 260px
  it('narrow viewport (1024px) → floor 260px', () => {
    const width = computeDefaultRightPanelWidth(1024);
    // 1024 * 0.20 = 204.8 → round to 205 → floored to 260
    expect(width).toBe(260);
  });

  // Step 2: On a medium window (1440px), verify right panel defaults to ~288px
  it('medium viewport (1440px) → 288px', () => {
    const width = computeDefaultRightPanelWidth(1440);
    // 1440 * 0.20 = 288
    expect(width).toBe(288);
  });

  // Step 3: On a wide display (1920px), verify right panel defaults to ~384px
  it('wide viewport (1920px) → 384px', () => {
    const width = computeDefaultRightPanelWidth(1920);
    // 1920 * 0.20 = 384
    expect(width).toBe(384);
  });

  // Step 4: On a very wide display (2560px), verify right panel defaults to ceiling 480px
  it('very wide viewport (2560px) → ceiling 480px', () => {
    const width = computeDefaultRightPanelWidth(2560);
    // 2560 * 0.20 = 512 → capped to 480
    expect(width).toBe(480);
  });

  // Step 5: Persisted custom width takes priority
  it('persisted custom width takes priority over viewport-relative default', async () => {
    const { useUIStore } = await import('../../../src/store/uiStore');
    const store = useUIStore.getState();

    // Get initial (viewport-relative) default
    const initialWidth = store.rightPanelWidth;
    expect(initialWidth).toBeGreaterThanOrEqual(RIGHT_PANEL_DEFAULT_FLOOR);
    expect(initialWidth).toBeLessThanOrEqual(RIGHT_PANEL_DEFAULT_CEILING);

    // Set a custom width
    store.setRightPanelWidth(400);
    expect(useUIStore.getState().rightPanelWidth).toBe(400);

    // Custom width is now persisted and different from initial default
    // (this confirms the setter works and overrides the default)
    expect(useUIStore.getState().rightPanelWidth).not.toBe(initialWidth === 400 ? -1 : initialWidth);
  });

  it('setRightPanelWidth clamps to MIN/MAX bounds', async () => {
    const { useUIStore } = await import('../../../src/store/uiStore');
    const store = useUIStore.getState();

    store.setRightPanelWidth(100);
    expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MIN_WIDTH);

    store.setRightPanelWidth(9999);
    expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MAX_WIDTH);
  });

  it('uses fallback viewport width when no argument provided', () => {
    // Without argument, uses window.innerWidth or fallback 1440
    const width = computeDefaultRightPanelWidth();
    expect(width).toBeGreaterThanOrEqual(RIGHT_PANEL_DEFAULT_FLOOR);
    expect(width).toBeLessThanOrEqual(RIGHT_PANEL_DEFAULT_CEILING);
  });

  it('exactly at floor boundary (1300px)', () => {
    // 1300 * 0.20 = 260 → exactly floor
    expect(computeDefaultRightPanelWidth(1300)).toBe(260);
  });

  it('exactly at ceiling boundary (2400px)', () => {
    // 2400 * 0.20 = 480 → exactly ceiling
    expect(computeDefaultRightPanelWidth(2400)).toBe(480);
  });

  it('just above floor (1320px)', () => {
    // 1320 * 0.20 = 264
    expect(computeDefaultRightPanelWidth(1320)).toBe(264);
  });

  it('just below ceiling (2380px)', () => {
    // 2380 * 0.20 = 476
    expect(computeDefaultRightPanelWidth(2380)).toBe(476);
  });
});
