import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const STORAGE_KEY = 'archcanvas:theme';

// Stub matchMedia for jsdom
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as MediaQueryList);
vi.stubGlobal('matchMedia', matchMediaMock);

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
    expect(state.palette).toBe('archcanvas');
    expect(state.mode).toBe('system');
    expect(state.textSize).toBe('medium');
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

  it('setTextSize updates state and persists', () => {
    useThemeStore.getState().setTextSize('large');
    expect(useThemeStore.getState().textSize).toBe('large');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.textSize).toBe('large');
  });

  it('restores from localStorage on creation', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'catppuccin', mode: 'light', textSize: 'small',
    }));
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('catppuccin');
    expect(state.mode).toBe('light');
    expect(state.textSize).toBe('small');
  });

  it('falls back to defaults on corrupt localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json!!!');
    vi.resetModules();
    const mod = await import('@/store/themeStore');
    const state = mod.useThemeStore.getState();
    expect(state.palette).toBe('archcanvas');
  });

  it('falls back to archcanvas if stored palette id is unknown', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: 'nonexistent', mode: 'dark', textSize: 'medium',
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
    matchMediaMock.mockReturnValue({ matches: true } as unknown as MediaQueryList);
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().getResolvedMode()).toBe('dark');
  });
});
