import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const STORAGE_KEY = 'archcanvas:panel-layout';

/** Simple in-memory localStorage mock */
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

import type { PanelImperativeHandle } from 'react-resizable-panels';

/** Wrap a mock PanelImperativeHandle in a RefObject. */
function mockPanelRef(collapsed = false): { current: PanelImperativeHandle } {
  let _collapsed = collapsed;
  return {
    current: {
      collapse: () => { _collapsed = true; },
      expand: () => { _collapsed = false; },
      getSize: () => ({ asPercentage: _collapsed ? 0 : 20, inPixels: _collapsed ? 0 : 300 }),
      isCollapsed: () => _collapsed,
      resize: () => {},
    },
  };
}

let mockStorage: Storage;

describe('uiStore — panel layout persistence', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', mockStorage);
  });

  describe('defaults', () => {
    it('defaults to leftCollapsed=false, rightCollapsed=false, showStatusBar=true when localStorage is empty', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().leftPanelCollapsed).toBe(false);
      expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
      expect(useUiStore.getState().showStatusBar).toBe(true);
    });

    it('restores persisted panel layout from localStorage', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        leftCollapsed: true,
        rightCollapsed: true,
        showStatusBar: false,
      }));
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().leftPanelCollapsed).toBe(true);
      expect(useUiStore.getState().rightPanelCollapsed).toBe(true);
      expect(useUiStore.getState().showStatusBar).toBe(false);
    });

    it('falls back to defaults for corrupt/invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().leftPanelCollapsed).toBe(false);
      expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
      expect(useUiStore.getState().showStatusBar).toBe(true);
    });

    it('falls back to defaults when localStorage throws', async () => {
      const badStorage = createMockStorage();
      badStorage.getItem = () => { throw new Error('quota exceeded'); };
      vi.stubGlobal('localStorage', badStorage);
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().leftPanelCollapsed).toBe(false);
      expect(useUiStore.getState().showStatusBar).toBe(true);
    });

    it('falls back to defaults for partial / missing fields', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftCollapsed: true }));
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().leftPanelCollapsed).toBe(true);
      expect(useUiStore.getState().rightPanelCollapsed).toBe(false); // default
      expect(useUiStore.getState().showStatusBar).toBe(true); // default
    });
  });

  describe('persistence on toggle', () => {
    it('toggleStatusBar persists new value', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');

      useUiStore.getState().toggleStatusBar();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.showStatusBar).toBe(false);

      useUiStore.getState().toggleStatusBar();
      const stored2 = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored2.showStatusBar).toBe(true);
    });

    it('toggleLeftPanel persists new collapsed state', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      const ref = mockPanelRef(false);
      useUiStore.getState().setLeftPanelRef(ref);

      useUiStore.getState().toggleLeftPanel();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.leftCollapsed).toBe(true);
    });

    it('toggleRightPanel persists new collapsed state', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      const ref = mockPanelRef(false);
      useUiStore.getState().setRightPanelRef(ref);

      useUiStore.getState().toggleRightPanel();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.rightCollapsed).toBe(true);
    });
  });
});
