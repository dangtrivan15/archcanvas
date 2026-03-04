/**
 * Tests for Feature #327: Viewport-relative defaults recalculate on window resize
 * when no custom value is set.
 *
 * Verifies that:
 * 1. When no custom value is set, resizing the viewport recalculates default sizes
 * 2. Once user manually adjusts a size, that value is locked (customized flag)
 * 3. resetBarSizes clears all custom values and reverts to viewport-relative defaults
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useUIStore,
  computeDefaultLeftPanelWidth,
  computeDefaultRightPanelWidth,
  computeDefaultToolbarHeight,
  computeDefaultStatusBarHeight,
} from '@/store/uiStore';

// Reset store state before each test
beforeEach(() => {
  useUIStore.setState({
    leftPanelWidth: computeDefaultLeftPanelWidth(1440),
    leftPanelWidthCustomized: false,
    rightPanelWidth: computeDefaultRightPanelWidth(1440),
    rightPanelWidthCustomized: false,
    toolbarHeight: computeDefaultToolbarHeight(900),
    toolbarHeightCustomized: false,
    statusBarHeight: computeDefaultStatusBarHeight(900),
    statusBarHeightCustomized: false,
  });
});

describe('Feature #327: Viewport-relative defaults recalculate on window resize', () => {
  // Step 1: Open app in 1440px wide window — sidebar defaults to ~216px
  it('Step 1: sidebar defaults to ~216px at 1440px viewport', () => {
    const state = useUIStore.getState();
    expect(state.leftPanelWidth).toBe(216);
    expect(state.leftPanelWidthCustomized).toBe(false);
  });

  // Step 2: Resize browser to 1920px — sidebar default updates to ~288px
  it('Step 2: updateLeftPanelWidthFromViewport updates to ~288px when no custom value set', () => {
    const store = useUIStore.getState();
    store.updateLeftPanelWidthFromViewport(1920);

    const state = useUIStore.getState();
    expect(state.leftPanelWidth).toBe(288);
    expect(state.leftPanelWidthCustomized).toBe(false);
  });

  // Step 3: Manually drag sidebar to 250px — locks the custom value
  it('Step 3: setLeftPanelWidth locks the custom value (sets customized flag)', () => {
    const store = useUIStore.getState();
    store.setLeftPanelWidth(250);

    const state = useUIStore.getState();
    expect(state.leftPanelWidth).toBe(250);
    expect(state.leftPanelWidthCustomized).toBe(true);
  });

  // Step 4: Resize browser — sidebar stays at 250px (custom value persisted)
  it('Step 4: updateLeftPanelWidthFromViewport is no-op when custom value set', () => {
    const store = useUIStore.getState();
    // Set custom width first
    store.setLeftPanelWidth(250);
    expect(useUIStore.getState().leftPanelWidthCustomized).toBe(true);

    // Resize viewport — should NOT change the width
    store.updateLeftPanelWidthFromViewport(1920);
    expect(useUIStore.getState().leftPanelWidth).toBe(250);
  });

  // Step 5: Reset bar sizes — custom value cleared, reverts to viewport-relative default
  it('Step 5: resetBarSizes clears custom value and reverts to viewport-relative default', () => {
    const store = useUIStore.getState();
    // Set custom width
    store.setLeftPanelWidth(250);
    expect(useUIStore.getState().leftPanelWidthCustomized).toBe(true);

    // Reset
    useUIStore.getState().resetBarSizes();

    const state = useUIStore.getState();
    expect(state.leftPanelWidthCustomized).toBe(false);
    // After reset, width is recalculated based on current viewport (test env fallback)
    expect(state.leftPanelWidth).toBeGreaterThanOrEqual(180);
    expect(state.leftPanelWidth).toBeLessThanOrEqual(360);
  });

  // After reset, resizing viewport should recalculate again
  it('After reset, viewport resize recalculates defaults again', () => {
    const store = useUIStore.getState();
    // Set custom, then reset
    store.setLeftPanelWidth(250);
    useUIStore.getState().resetBarSizes();
    expect(useUIStore.getState().leftPanelWidthCustomized).toBe(false);

    // Viewport resize should update
    useUIStore.getState().updateLeftPanelWidthFromViewport(1920);
    expect(useUIStore.getState().leftPanelWidth).toBe(288);
  });
});

describe('Right panel width: viewport-relative recalculation', () => {
  it('defaults to viewport-relative width at 1440px', () => {
    const expected = computeDefaultRightPanelWidth(1440);
    expect(useUIStore.getState().rightPanelWidth).toBe(expected);
    expect(useUIStore.getState().rightPanelWidthCustomized).toBe(false);
  });

  it('updateRightPanelWidthFromViewport updates when not customized', () => {
    useUIStore.getState().updateRightPanelWidthFromViewport(1920);
    // 1920 * 0.20 = 384
    expect(useUIStore.getState().rightPanelWidth).toBe(384);
    expect(useUIStore.getState().rightPanelWidthCustomized).toBe(false);
  });

  it('setRightPanelWidth locks custom value', () => {
    useUIStore.getState().setRightPanelWidth(350);
    expect(useUIStore.getState().rightPanelWidth).toBe(350);
    expect(useUIStore.getState().rightPanelWidthCustomized).toBe(true);
  });

  it('updateRightPanelWidthFromViewport is no-op when customized', () => {
    useUIStore.getState().setRightPanelWidth(350);
    useUIStore.getState().updateRightPanelWidthFromViewport(1920);
    expect(useUIStore.getState().rightPanelWidth).toBe(350);
  });

  it('resetBarSizes clears right panel custom value', () => {
    useUIStore.getState().setRightPanelWidth(350);
    useUIStore.getState().resetBarSizes();
    expect(useUIStore.getState().rightPanelWidthCustomized).toBe(false);
  });
});

describe('Toolbar height: viewport-relative recalculation', () => {
  it('updateToolbarHeightFromViewport updates when not customized', () => {
    useUIStore.getState().updateToolbarHeightFromViewport(1200);
    // 1200 * 0.035 = 42
    expect(useUIStore.getState().toolbarHeight).toBe(42);
    expect(useUIStore.getState().toolbarHeightCustomized).toBe(false);
  });

  it('setToolbarHeight locks custom value', () => {
    useUIStore.getState().setToolbarHeight(50);
    expect(useUIStore.getState().toolbarHeightCustomized).toBe(true);
  });

  it('updateToolbarHeightFromViewport is no-op when customized', () => {
    useUIStore.getState().setToolbarHeight(50);
    useUIStore.getState().updateToolbarHeightFromViewport(1200);
    expect(useUIStore.getState().toolbarHeight).toBe(50);
  });

  it('resetBarSizes clears toolbar custom value', () => {
    useUIStore.getState().setToolbarHeight(50);
    useUIStore.getState().resetBarSizes();
    expect(useUIStore.getState().toolbarHeightCustomized).toBe(false);
  });
});

describe('Status bar height: viewport-relative recalculation', () => {
  it('updateStatusBarHeightFromViewport updates when not customized', () => {
    useUIStore.getState().updateStatusBarHeightFromViewport(1200);
    // 1200 * 0.02 = 24
    expect(useUIStore.getState().statusBarHeight).toBe(24);
    expect(useUIStore.getState().statusBarHeightCustomized).toBe(false);
  });

  it('setStatusBarHeight locks custom value', () => {
    useUIStore.getState().setStatusBarHeight(30);
    expect(useUIStore.getState().statusBarHeightCustomized).toBe(true);
  });

  it('updateStatusBarHeightFromViewport is no-op when customized', () => {
    useUIStore.getState().setStatusBarHeight(30);
    useUIStore.getState().updateStatusBarHeightFromViewport(1200);
    expect(useUIStore.getState().statusBarHeight).toBe(30);
  });

  it('resetBarSizes clears status bar custom value', () => {
    useUIStore.getState().setStatusBarHeight(30);
    useUIStore.getState().resetBarSizes();
    expect(useUIStore.getState().statusBarHeightCustomized).toBe(false);
  });
});

describe('resetBarSizes resets all dimensions at once', () => {
  it('clears all four customized flags simultaneously', () => {
    const store = useUIStore.getState();
    store.setLeftPanelWidth(250);
    store.setRightPanelWidth(350);
    store.setToolbarHeight(60);
    store.setStatusBarHeight(35);

    const before = useUIStore.getState();
    expect(before.leftPanelWidthCustomized).toBe(true);
    expect(before.rightPanelWidthCustomized).toBe(true);
    expect(before.toolbarHeightCustomized).toBe(true);
    expect(before.statusBarHeightCustomized).toBe(true);

    useUIStore.getState().resetBarSizes();

    const after = useUIStore.getState();
    expect(after.leftPanelWidthCustomized).toBe(false);
    expect(after.rightPanelWidthCustomized).toBe(false);
    expect(after.toolbarHeightCustomized).toBe(false);
    expect(after.statusBarHeightCustomized).toBe(false);
  });

  it('recalculates all dimensions to viewport-relative defaults', () => {
    const store = useUIStore.getState();
    store.setLeftPanelWidth(250);
    store.setRightPanelWidth(350);
    store.setToolbarHeight(60);
    store.setStatusBarHeight(35);

    useUIStore.getState().resetBarSizes();

    const after = useUIStore.getState();
    // Values should be within their respective floor/ceiling ranges
    expect(after.leftPanelWidth).toBeGreaterThanOrEqual(180);
    expect(after.leftPanelWidth).toBeLessThanOrEqual(360);
    expect(after.rightPanelWidth).toBeGreaterThanOrEqual(260);
    expect(after.rightPanelWidth).toBeLessThanOrEqual(480);
    expect(after.toolbarHeight).toBeGreaterThanOrEqual(40);
    expect(after.toolbarHeight).toBeLessThanOrEqual(64);
    expect(after.statusBarHeight).toBeGreaterThanOrEqual(20);
    expect(after.statusBarHeight).toBeLessThanOrEqual(40);
  });
});
