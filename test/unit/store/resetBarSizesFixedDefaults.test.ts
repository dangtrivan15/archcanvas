/**
 * Feature #322: Settings dialog includes option to reset toolbar and status bar heights to defaults.
 * Tests that resetBarSizesToFixedDefaults sets toolbar=48 and status bar=24 and clears persisted storage.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useUIStore,
  TOOLBAR_DEFAULT_HEIGHT,
  STATUS_BAR_DEFAULT_HEIGHT,
  TOOLBAR_HEIGHT_STORAGE_KEY,
  STATUS_BAR_HEIGHT_STORAGE_KEY,
} from '@/store/uiStore';

function setCustomHeights() {
  const store = useUIStore.getState();
  store.setToolbarHeight(70);
  store.setStatusBarHeight(40);
}

describe('Feature #322 - Reset Bar Sizes to Fixed Defaults', () => {
  beforeEach(() => {
    localStorage.clear();
    setCustomHeights();
  });

  it('resetBarSizesToFixedDefaults sets toolbar height to 48px', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(useUIStore.getState().toolbarHeight).toBe(TOOLBAR_DEFAULT_HEIGHT);
    expect(useUIStore.getState().toolbarHeight).toBe(48);
  });

  it('resetBarSizesToFixedDefaults sets status bar height to 24px', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(useUIStore.getState().statusBarHeight).toBe(STATUS_BAR_DEFAULT_HEIGHT);
    expect(useUIStore.getState().statusBarHeight).toBe(24);
  });

  it('clears toolbarHeightCustomized flag', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(useUIStore.getState().toolbarHeightCustomized).toBe(false);
  });

  it('clears statusBarHeightCustomized flag', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(useUIStore.getState().statusBarHeightCustomized).toBe(false);
  });

  it('clears persisted toolbar height from localStorage', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(localStorage.getItem(TOOLBAR_HEIGHT_STORAGE_KEY)).toBeNull();
  });

  it('clears persisted status bar height from localStorage', () => {
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(localStorage.getItem(STATUS_BAR_HEIGHT_STORAGE_KEY)).toBeNull();
  });

  it('does not affect panel widths', () => {
    const before = {
      leftPanelWidth: useUIStore.getState().leftPanelWidth,
      rightPanelWidth: useUIStore.getState().rightPanelWidth,
    };
    useUIStore.getState().resetBarSizesToFixedDefaults();
    expect(useUIStore.getState().leftPanelWidth).toBe(before.leftPanelWidth);
    expect(useUIStore.getState().rightPanelWidth).toBe(before.rightPanelWidth);
  });

  describe('Feature #322 verification steps', () => {
    it('Step 3: Click Reset Bar Sizes — toolbar resets to 48px and status bar to 24px immediately', () => {
      // Simulate customized heights
      useUIStore.getState().setToolbarHeight(64);
      useUIStore.getState().setStatusBarHeight(36);
      useUIStore.getState().resetBarSizesToFixedDefaults();
      expect(useUIStore.getState().toolbarHeight).toBe(48);
      expect(useUIStore.getState().statusBarHeight).toBe(24);
    });

    it('Step 5: Persisted values in storage are cleared/reset', () => {
      const toolbarKey = `archcanvas:${TOOLBAR_HEIGHT_STORAGE_KEY}`;
      const statusBarKey = `archcanvas:${STATUS_BAR_HEIGHT_STORAGE_KEY}`;
      useUIStore.getState().setToolbarHeight(64);
      useUIStore.getState().setStatusBarHeight(36);
      // Verify values were persisted (async persist uses localStorage directly)
      expect(localStorage.getItem(toolbarKey)).toBe('64');
      expect(localStorage.getItem(statusBarKey)).toBe('36');
      useUIStore.getState().resetBarSizesToFixedDefaults();
      expect(localStorage.getItem(toolbarKey)).toBeNull();
      expect(localStorage.getItem(statusBarKey)).toBeNull();
    });
  });
});
