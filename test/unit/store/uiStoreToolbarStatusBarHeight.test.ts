/**
 * Tests for UI store toolbar and status bar height management.
 * Feature #319: UI store manages toolbar and status bar heights with min/max constraints.
 * Feature #323: Toolbar default height scales relative to viewport height.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore, TOOLBAR_MIN_HEIGHT, TOOLBAR_MAX_HEIGHT, STATUS_BAR_DEFAULT_HEIGHT, STATUS_BAR_MIN_HEIGHT, STATUS_BAR_MAX_HEIGHT, computeDefaultToolbarHeight, TOOLBAR_DEFAULT_FLOOR, TOOLBAR_DEFAULT_CEILING, TOOLBAR_VIEWPORT_RATIO, computeDefaultStatusBarHeight, STATUS_BAR_VIEWPORT_RATIO, STATUS_BAR_DEFAULT_FLOOR, STATUS_BAR_DEFAULT_CEILING } from '@/store/uiStore';

describe('UI Store - Toolbar and Status Bar Height Management', () => {
  beforeEach(() => {
    // Reset store to defaults
    useUIStore.setState({
      toolbarHeight: computeDefaultToolbarHeight(),
      toolbarHeightCustomized: false,
      statusBarHeight: computeDefaultStatusBarHeight(),
      statusBarHeightCustomized: false,
    });
  });

  describe('computeDefaultToolbarHeight', () => {
    it('returns floor (40px) for small viewport (800px)', () => {
      // 800 * 0.035 = 28, clamped to floor 40
      expect(computeDefaultToolbarHeight(800)).toBe(40);
    });

    it('returns ~42px for medium viewport (1200px)', () => {
      // 1200 * 0.035 = 42
      expect(computeDefaultToolbarHeight(1200)).toBe(42);
    });

    it('returns ~56px for large viewport (1600px)', () => {
      // 1600 * 0.035 = 56
      expect(computeDefaultToolbarHeight(1600)).toBe(56);
    });

    it('returns ceiling (64px) for very large viewport (2160px)', () => {
      // 2160 * 0.035 = 75.6, clamped to ceiling 64
      expect(computeDefaultToolbarHeight(2160)).toBe(64);
    });

    it('returns floor for very small viewport (400px)', () => {
      // 400 * 0.035 = 14, clamped to floor 40
      expect(computeDefaultToolbarHeight(400)).toBe(40);
    });

    it('uses floor constant of 40px', () => {
      expect(TOOLBAR_DEFAULT_FLOOR).toBe(40);
    });

    it('uses ceiling constant of 64px', () => {
      expect(TOOLBAR_DEFAULT_CEILING).toBe(64);
    });

    it('uses ratio of 0.035 (3.5%)', () => {
      expect(TOOLBAR_VIEWPORT_RATIO).toBe(0.035);
    });
  });

  describe('Constants', () => {
    it('exports correct toolbar height min/max constants', () => {
      expect(TOOLBAR_MIN_HEIGHT).toBe(36);
      expect(TOOLBAR_MAX_HEIGHT).toBe(80);
    });

    it('exports correct status bar height constants', () => {
      expect(STATUS_BAR_DEFAULT_HEIGHT).toBe(24);
      expect(STATUS_BAR_MIN_HEIGHT).toBe(20);
      expect(STATUS_BAR_MAX_HEIGHT).toBe(48);
    });
  });

  describe('Default values', () => {
    it('toolbarHeight defaults to viewport-relative value', () => {
      const expected = computeDefaultToolbarHeight();
      expect(useUIStore.getState().toolbarHeight).toBe(expected);
    });

    it('toolbarHeightCustomized defaults to false', () => {
      expect(useUIStore.getState().toolbarHeightCustomized).toBe(false);
    });

    it('statusBarHeight defaults to viewport-relative value', () => {
      const expected = computeDefaultStatusBarHeight();
      expect(useUIStore.getState().statusBarHeight).toBe(expected);
    });

    it('statusBarHeightCustomized defaults to false', () => {
      expect(useUIStore.getState().statusBarHeightCustomized).toBe(false);
    });
  });

  describe('setToolbarHeight', () => {
    it('updates toolbar height to a valid value', () => {
      useUIStore.getState().setToolbarHeight(60);
      expect(useUIStore.getState().toolbarHeight).toBe(60);
    });

    it('marks toolbarHeightCustomized as true', () => {
      useUIStore.getState().setToolbarHeight(60);
      expect(useUIStore.getState().toolbarHeightCustomized).toBe(true);
    });

    it('clamps to minimum (36px) when value is too low', () => {
      useUIStore.getState().setToolbarHeight(10);
      expect(useUIStore.getState().toolbarHeight).toBe(36);
    });

    it('clamps to maximum (80px) when value is too high', () => {
      useUIStore.getState().setToolbarHeight(200);
      expect(useUIStore.getState().toolbarHeight).toBe(80);
    });

    it('accepts exact minimum value (36)', () => {
      useUIStore.getState().setToolbarHeight(36);
      expect(useUIStore.getState().toolbarHeight).toBe(36);
    });

    it('accepts exact maximum value (80)', () => {
      useUIStore.getState().setToolbarHeight(80);
      expect(useUIStore.getState().toolbarHeight).toBe(80);
    });

    it('clamps negative values to minimum', () => {
      useUIStore.getState().setToolbarHeight(-10);
      expect(useUIStore.getState().toolbarHeight).toBe(36);
    });

    it('clamps zero to minimum', () => {
      useUIStore.getState().setToolbarHeight(0);
      expect(useUIStore.getState().toolbarHeight).toBe(36);
    });
  });

  describe('updateToolbarHeightFromViewport', () => {
    it('updates toolbar height when not customized', () => {
      useUIStore.getState().updateToolbarHeightFromViewport(1600);
      expect(useUIStore.getState().toolbarHeight).toBe(56);
    });

    it('does NOT update toolbar height when customized', () => {
      useUIStore.getState().setToolbarHeight(60); // marks as customized
      useUIStore.getState().updateToolbarHeightFromViewport(1600);
      expect(useUIStore.getState().toolbarHeight).toBe(60); // stays at custom value
    });

    it('applies floor for small viewport', () => {
      useUIStore.getState().updateToolbarHeightFromViewport(800);
      expect(useUIStore.getState().toolbarHeight).toBe(40);
    });

    it('applies ceiling for large viewport', () => {
      useUIStore.getState().updateToolbarHeightFromViewport(2160);
      expect(useUIStore.getState().toolbarHeight).toBe(64);
    });
  });

  describe('setStatusBarHeight', () => {
    it('updates status bar height to a valid value', () => {
      useUIStore.getState().setStatusBarHeight(30);
      expect(useUIStore.getState().statusBarHeight).toBe(30);
    });

    it('clamps to minimum (20px) when value is too low', () => {
      useUIStore.getState().setStatusBarHeight(10);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('clamps to maximum (48px) when value is too high', () => {
      useUIStore.getState().setStatusBarHeight(100);
      expect(useUIStore.getState().statusBarHeight).toBe(48);
    });

    it('accepts exact minimum value (20)', () => {
      useUIStore.getState().setStatusBarHeight(20);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('accepts exact maximum value (48)', () => {
      useUIStore.getState().setStatusBarHeight(48);
      expect(useUIStore.getState().statusBarHeight).toBe(48);
    });

    it('clamps negative values to minimum', () => {
      useUIStore.getState().setStatusBarHeight(-5);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('clamps zero to minimum', () => {
      useUIStore.getState().setStatusBarHeight(0);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('marks statusBarHeightCustomized as true', () => {
      useUIStore.getState().setStatusBarHeight(30);
      expect(useUIStore.getState().statusBarHeightCustomized).toBe(true);
    });
  });

  describe('computeDefaultStatusBarHeight', () => {
    it('returns floor (20px) for small viewport (800px)', () => {
      // 800 * 0.02 = 16, clamped to floor 20
      expect(computeDefaultStatusBarHeight(800)).toBe(20);
    });

    it('returns ~24px for medium viewport (1200px)', () => {
      // 1200 * 0.02 = 24
      expect(computeDefaultStatusBarHeight(1200)).toBe(24);
    });

    it('returns ~32px for large viewport (1600px)', () => {
      // 1600 * 0.02 = 32
      expect(computeDefaultStatusBarHeight(1600)).toBe(32);
    });

    it('returns ceiling (40px) for very large viewport (2160px)', () => {
      // 2160 * 0.02 = 43.2, clamped to ceiling 40
      expect(computeDefaultStatusBarHeight(2160)).toBe(40);
    });

    it('returns floor for very small viewport (400px)', () => {
      // 400 * 0.02 = 8, clamped to floor 20
      expect(computeDefaultStatusBarHeight(400)).toBe(20);
    });

    it('uses floor constant of 20px', () => {
      expect(STATUS_BAR_DEFAULT_FLOOR).toBe(20);
    });

    it('uses ceiling constant of 40px', () => {
      expect(STATUS_BAR_DEFAULT_CEILING).toBe(40);
    });

    it('uses ratio of 0.02 (2%)', () => {
      expect(STATUS_BAR_VIEWPORT_RATIO).toBe(0.02);
    });
  });

  describe('updateStatusBarHeightFromViewport', () => {
    it('updates status bar height when not customized', () => {
      useUIStore.getState().updateStatusBarHeightFromViewport(1600);
      expect(useUIStore.getState().statusBarHeight).toBe(32);
    });

    it('does NOT update status bar height when customized', () => {
      useUIStore.getState().setStatusBarHeight(30); // marks as customized
      useUIStore.getState().updateStatusBarHeightFromViewport(1600);
      expect(useUIStore.getState().statusBarHeight).toBe(30); // stays at custom value
    });

    it('applies floor for small viewport', () => {
      useUIStore.getState().updateStatusBarHeightFromViewport(800);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('applies ceiling for large viewport', () => {
      useUIStore.getState().updateStatusBarHeightFromViewport(2160);
      expect(useUIStore.getState().statusBarHeight).toBe(40);
    });
  });

  describe('Feature #324 verification steps', () => {
    it('Step 1: On a small window (800px tall), status bar defaults to the minimum floor of 20px', () => {
      expect(computeDefaultStatusBarHeight(800)).toBe(20);
      useUIStore.getState().updateStatusBarHeightFromViewport(800);
      expect(useUIStore.getState().statusBarHeight).toBe(20);
    });

    it('Step 2: On a medium window (1200px tall), status bar defaults to ~24px (2% of 1200)', () => {
      expect(computeDefaultStatusBarHeight(1200)).toBe(24);
      useUIStore.getState().updateStatusBarHeightFromViewport(1200);
      expect(useUIStore.getState().statusBarHeight).toBe(24);
    });

    it('Step 3: On a large display (1600px tall), status bar defaults to ~32px', () => {
      expect(computeDefaultStatusBarHeight(1600)).toBe(32);
      useUIStore.getState().updateStatusBarHeightFromViewport(1600);
      expect(useUIStore.getState().statusBarHeight).toBe(32);
    });

    it('Step 4: On a very large display (2160px tall), status bar defaults to the ceiling of 40px', () => {
      expect(computeDefaultStatusBarHeight(2160)).toBe(40);
      useUIStore.getState().updateStatusBarHeightFromViewport(2160);
      expect(useUIStore.getState().statusBarHeight).toBe(40);
    });

    it('Step 5: Persisted custom height takes priority over viewport-relative default', () => {
      // Simulate user setting a custom height
      useUIStore.getState().setStatusBarHeight(35);
      expect(useUIStore.getState().statusBarHeightCustomized).toBe(true);
      expect(useUIStore.getState().statusBarHeight).toBe(35);

      // Viewport resize should NOT change the custom height
      useUIStore.getState().updateStatusBarHeightFromViewport(800);
      expect(useUIStore.getState().statusBarHeight).toBe(35);

      useUIStore.getState().updateStatusBarHeightFromViewport(2160);
      expect(useUIStore.getState().statusBarHeight).toBe(35);
    });
  });

  describe('Feature #323 verification steps', () => {
    it('Step 1: On a small window (800px tall), toolbar defaults to the minimum floor of 40px', () => {
      expect(computeDefaultToolbarHeight(800)).toBe(40);
      useUIStore.getState().updateToolbarHeightFromViewport(800);
      expect(useUIStore.getState().toolbarHeight).toBe(40);
    });

    it('Step 2: On a medium window (1200px tall), toolbar defaults to ~42px (3.5% of 1200)', () => {
      expect(computeDefaultToolbarHeight(1200)).toBe(42);
      useUIStore.getState().updateToolbarHeightFromViewport(1200);
      expect(useUIStore.getState().toolbarHeight).toBe(42);
    });

    it('Step 3: On a large display (1600px tall), toolbar defaults to ~56px', () => {
      expect(computeDefaultToolbarHeight(1600)).toBe(56);
      useUIStore.getState().updateToolbarHeightFromViewport(1600);
      expect(useUIStore.getState().toolbarHeight).toBe(56);
    });

    it('Step 4: On a very large display (2160px tall), toolbar defaults to the ceiling of 64px', () => {
      expect(computeDefaultToolbarHeight(2160)).toBe(64);
      useUIStore.getState().updateToolbarHeightFromViewport(2160);
      expect(useUIStore.getState().toolbarHeight).toBe(64);
    });

    it('Step 5: Persisted custom height takes priority over viewport-relative default', () => {
      // Simulate user setting a custom height
      useUIStore.getState().setToolbarHeight(55);
      expect(useUIStore.getState().toolbarHeightCustomized).toBe(true);
      expect(useUIStore.getState().toolbarHeight).toBe(55);

      // Viewport resize should NOT change the custom height
      useUIStore.getState().updateToolbarHeightFromViewport(800);
      expect(useUIStore.getState().toolbarHeight).toBe(55);

      useUIStore.getState().updateToolbarHeightFromViewport(2160);
      expect(useUIStore.getState().toolbarHeight).toBe(55);
    });
  });
});
