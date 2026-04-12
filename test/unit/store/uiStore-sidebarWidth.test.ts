import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const STORAGE_KEY = 'archcanvas:sidebar-width';

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
  let _lastResizeArg: number | string | undefined;
  return {
    current: {
      collapse: () => { _collapsed = true; },
      expand: () => { _collapsed = false; },
      getSize: () => ({ asPercentage: _collapsed ? 0 : 20, inPixels: _collapsed ? 0 : 300 }),
      isCollapsed: () => _collapsed,
      resize: (size: number | string) => { _lastResizeArg = size; },
      get _lastResizeArg() { return _lastResizeArg; },
    } as PanelImperativeHandle & { _lastResizeArg: number | string | undefined },
  };
}

let mockStorage: Storage;

describe('uiStore — sidebar width presets', () => {
  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', mockStorage);
  });

  describe('defaults', () => {
    it('defaults to standard when localStorage is empty', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');
    });

    it('restores persisted preset from localStorage', async () => {
      localStorage.setItem(STORAGE_KEY, 'wide');
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('wide');
    });

    it('falls back to standard for invalid persisted value', async () => {
      localStorage.setItem(STORAGE_KEY, 'extra-wide');
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');
    });

    it('falls back to standard for corrupt localStorage', async () => {
      // Simulate localStorage.getItem throwing
      const badStorage = createMockStorage();
      badStorage.getItem = () => { throw new Error('quota exceeded'); };
      vi.stubGlobal('localStorage', badStorage);
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');
    });
  });

  describe('setSidebarWidthPreset', () => {
    it('updates state and persists to localStorage', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      useUiStore.getState().setSidebarWidthPreset('narrow');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('narrow');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('narrow');
    });

    it('calls resize on the right panel ref', async () => {
      vi.resetModules();
      const { useUiStore, SIDEBAR_WIDTH_PRESETS } = await import('@/store/uiStore');
      const ref = mockPanelRef(false);
      useUiStore.getState().setRightPanelRef(ref);
      useUiStore.getState().setSidebarWidthPreset('wide');
      expect((ref.current as unknown as { _lastResizeArg: string })._lastResizeArg).toBe(SIDEBAR_WIDTH_PRESETS.wide.defaultSize);
    });

    it('expands a collapsed panel before resizing', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      const ref = mockPanelRef(true);
      useUiStore.getState().setRightPanelRef(ref);
      useUiStore.getState().setSidebarWidthPreset('wide');
      expect(ref.current.isCollapsed()).toBe(false);
      expect(useUiStore.getState().rightPanelCollapsed).toBe(false);
    });

    it('is safe to call before panel ref is set', async () => {
      vi.resetModules();
      const { useUiStore, _resetPanelRefs } = await import('@/store/uiStore');
      _resetPanelRefs();
      // Should not throw
      useUiStore.getState().setSidebarWidthPreset('narrow');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('narrow');
    });
  });

  describe('cycleSidebarWidth', () => {
    it('cycles forward: standard → wide → narrow → standard', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');

      useUiStore.getState().cycleSidebarWidth('forward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('wide');

      useUiStore.getState().cycleSidebarWidth('forward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('narrow');

      useUiStore.getState().cycleSidebarWidth('forward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');
    });

    it('cycles backward: standard → narrow → wide → standard', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');

      useUiStore.getState().cycleSidebarWidth('backward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('narrow');

      useUiStore.getState().cycleSidebarWidth('backward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('wide');

      useUiStore.getState().cycleSidebarWidth('backward');
      expect(useUiStore.getState().sidebarWidthPreset).toBe('standard');
    });

    it('defaults to forward direction', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');
      useUiStore.getState().cycleSidebarWidth();
      expect(useUiStore.getState().sidebarWidthPreset).toBe('wide');
    });

    it('persists each cycle step', async () => {
      vi.resetModules();
      const { useUiStore } = await import('@/store/uiStore');

      useUiStore.getState().cycleSidebarWidth('forward');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('wide');

      useUiStore.getState().cycleSidebarWidth('forward');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('narrow');
    });
  });

  describe('SIDEBAR_WIDTH_PRESETS', () => {
    it('exports the preset configuration', async () => {
      vi.resetModules();
      const { SIDEBAR_WIDTH_PRESETS } = await import('@/store/uiStore');
      expect(SIDEBAR_WIDTH_PRESETS.narrow.defaultSize).toBe('18%');
      expect(SIDEBAR_WIDTH_PRESETS.standard.defaultSize).toBe('26%');
      expect(SIDEBAR_WIDTH_PRESETS.wide.defaultSize).toBe('35%');
      expect(SIDEBAR_WIDTH_PRESETS.narrow.minSize).toBe('160px');
      expect(SIDEBAR_WIDTH_PRESETS.standard.minSize).toBe('220px');
      expect(SIDEBAR_WIDTH_PRESETS.wide.minSize).toBe('300px');
    });
  });
});
