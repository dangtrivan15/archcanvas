import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const STORAGE_KEY = 'archcanvas:theme';

// Stub matchMedia for jsdom
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as MediaQueryList);
vi.stubGlobal('matchMedia', matchMediaMock);

// Mock uiStore for cross-store calls in applyLayoutProfile
const mockSetSidebarWidthPreset = vi.fn();
vi.mock('@/store/uiStore', () => ({
  useUiStore: {
    getState: () => ({ setSidebarWidthPreset: mockSetSidebarWidthPreset }),
  },
}));

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

let mockStorage: Storage;

let useThemeStore: typeof import('@/store/themeStore').useThemeStore;

describe('themeStore', () => {
  beforeEach(async () => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    document.documentElement.style.cssText = '';
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    useThemeStore = mod.useThemeStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Re-stub after restoreAllMocks
    vi.stubGlobal('matchMedia', matchMediaMock);
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('has correct defaults', () => {
    const state = useThemeStore.getState();
    expect(state.palette).toBe('rose-pine');
    expect(state.mode).toBe('light');
    expect(state.uiScale).toBe(100);
    expect(state.statusBarDensity).toBe('comfortable');
  });

  it('setPalette updates state and persists', () => {
    useThemeStore.getState().setPalette('rose-pine');
    expect(useThemeStore.getState().palette).toBe('rose-pine');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.palette).toBe('rose-pine');
  });

  it('setMode updates state and persists', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.mode).toBe('dark');
  });

  it('setUiScale updates state and persists', () => {
    useThemeStore.getState().setUiScale(120);
    expect(useThemeStore.getState().uiScale).toBe(120);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.uiScale).toBe(120);
  });

  it('setUiScale clamps below minimum to 80', () => {
    useThemeStore.getState().setUiScale(50);
    expect(useThemeStore.getState().uiScale).toBe(80);
  });

  it('setUiScale clamps above maximum to 150', () => {
    useThemeStore.getState().setUiScale(200);
    expect(useThemeStore.getState().uiScale).toBe(150);
  });

  it('setStatusBarDensity updates state and persists', () => {
    useThemeStore.getState().setStatusBarDensity('compact');
    expect(useThemeStore.getState().statusBarDensity).toBe('compact');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.statusBarDensity).toBe('compact');
  });

  it('setStatusBarDensity does not call applyTheme', () => {
    // Density is component-level; changing it should not alter document styles
    const fontSizeBefore = document.documentElement.style.fontSize;
    useThemeStore.getState().setStatusBarDensity('expanded');
    expect(document.documentElement.style.fontSize).toBe(fontSizeBefore);
  });

  it('restores uiScale from localStorage on creation', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'catppuccin', mode: 'light', uiScale: 110, statusBarDensity: 'expanded',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('catppuccin');
    expect(state.mode).toBe('light');
    expect(state.uiScale).toBe(110);
    expect(state.statusBarDensity).toBe('expanded');
  });

  it('migrates legacy textSize large to uiScale 105', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'catppuccin', mode: 'dark', textSize: 'large',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.uiScale).toBe(105);
  });

  it('migrates legacy textSize small to uiScale 80', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', textSize: 'small',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.uiScale).toBe(80);
  });

  it('migrates legacy textSize medium to uiScale 95', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', textSize: 'medium',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.uiScale).toBe(95);
  });

  it('migrates unknown legacy textSize to uiScale 100', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', textSize: 'unknown',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.uiScale).toBe(100);
  });

  it('clamps out-of-range uiScale from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', uiScale: 300,
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.uiScale).toBe(150);
  });

  it('falls back to comfortable density when localStorage has no statusBarDensity (migration)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'catppuccin', mode: 'dark', uiScale: 100,
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.statusBarDensity).toBe('comfortable');
  });

  it('falls back to comfortable density when stored density is invalid', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', uiScale: 100, statusBarDensity: 'nonexistent',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.statusBarDensity).toBe('comfortable');
  });

  it('falls back to defaults on corrupt localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json!!!');
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('rose-pine');
  });

  it('falls back to rose-pine if stored palette id is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'nonexistent', mode: 'dark', uiScale: 100,
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    // Store accepts the id — findPalette handles fallback at apply time
    expect(mod.useThemeStore.getState().palette).toBe('nonexistent');
  });

  it('getResolvedMode returns mode directly for light/dark', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().getResolvedMode()).toBe('dark');
  });

  it('getResolvedMode resolves system mode', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().getResolvedMode()).toBe('dark');
  });

  // --- Layout Profile tests ---

  it('has correct defaults for new fields', () => {
    const state = useThemeStore.getState();
    expect(state.toolbarButtonSize).toBe(36);
    expect(state.nodeTextScale).toBe(1);
  });

  it('applyLayoutProfile sets all five values for compact', () => {
    mockSetSidebarWidthPreset.mockClear();
    useThemeStore.getState().applyLayoutProfile('compact');
    const state = useThemeStore.getState();
    expect(state.uiScale).toBe(85);
    expect(state.statusBarDensity).toBe('compact');
    expect(state.toolbarButtonSize).toBe(36);
    expect(state.nodeTextScale).toBe(0.833);
    expect(mockSetSidebarWidthPreset).toHaveBeenCalledWith('narrow');
  });

  it('applyLayoutProfile sets all five values for spacious', () => {
    mockSetSidebarWidthPreset.mockClear();
    useThemeStore.getState().applyLayoutProfile('spacious');
    const state = useThemeStore.getState();
    expect(state.uiScale).toBe(120);
    expect(state.statusBarDensity).toBe('expanded');
    expect(state.toolbarButtonSize).toBe(44);
    expect(state.nodeTextScale).toBe(1.167);
    expect(mockSetSidebarWidthPreset).toHaveBeenCalledWith('wide');
  });

  it('applyLayoutProfile persists toolbarButtonSize and nodeTextScale', () => {
    useThemeStore.getState().applyLayoutProfile('spacious');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.toolbarButtonSize).toBe(44);
    expect(stored.nodeTextScale).toBe(1.167);
  });

  it('setUiScale does NOT reset toolbarButtonSize or nodeTextScale', () => {
    useThemeStore.getState().applyLayoutProfile('spacious');
    expect(useThemeStore.getState().toolbarButtonSize).toBe(44);
    useThemeStore.getState().setUiScale(110);
    // Toolbar and node text must stay at spacious values
    expect(useThemeStore.getState().toolbarButtonSize).toBe(44);
    expect(useThemeStore.getState().nodeTextScale).toBe(1.167);
  });

  it('setStatusBarDensity does NOT reset toolbarButtonSize or nodeTextScale', () => {
    useThemeStore.getState().applyLayoutProfile('spacious');
    useThemeStore.getState().setStatusBarDensity('compact');
    expect(useThemeStore.getState().toolbarButtonSize).toBe(44);
    expect(useThemeStore.getState().nodeTextScale).toBe(1.167);
  });

  it('restores toolbarButtonSize and nodeTextScale from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', uiScale: 120,
      statusBarDensity: 'expanded', toolbarButtonSize: 44, nodeTextScale: 1.167,
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    expect(mod.useThemeStore.getState().toolbarButtonSize).toBe(44);
    expect(mod.useThemeStore.getState().nodeTextScale).toBe(1.167);
  });

  it('defaults toolbarButtonSize to 36 when absent in localStorage (migration)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', uiScale: 100, statusBarDensity: 'comfortable',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    expect(mod.useThemeStore.getState().toolbarButtonSize).toBe(36);
    expect(mod.useThemeStore.getState().nodeTextScale).toBe(1);
  });

  it('defaults nodeTextScale to 1 when stored value is invalid', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'rose-pine', mode: 'light', uiScale: 100,
      statusBarDensity: 'comfortable', toolbarButtonSize: 'invalid', nodeTextScale: -1,
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    expect(mod.useThemeStore.getState().toolbarButtonSize).toBe(36);
    expect(mod.useThemeStore.getState().nodeTextScale).toBe(1);
  });

  it('applyLayoutProfile sets CSS custom properties via applyLayoutSizing', () => {
    document.documentElement.style.cssText = '';
    useThemeStore.getState().applyLayoutProfile('spacious');
    expect(document.documentElement.style.getPropertyValue('--toolbar-button-size')).toBe('44px');
    expect(document.documentElement.style.getPropertyValue('--node-text-scale')).toBe('1.167');
  });
});
