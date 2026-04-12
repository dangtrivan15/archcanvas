import { create } from 'zustand';
import { findPalette } from '@/core/theme/palettes';
import { applyTheme, resolveMode, subscribeToSystemMode } from '@/core/theme/applyTheme';

type Mode = 'light' | 'dark' | 'system';
export type StatusBarDensity = 'compact' | 'comfortable' | 'expanded';

const STORAGE_KEY = 'archcanvas:theme';

/** Clamp uiScale to valid range [80, 150]. */
function clampScale(value: number): number {
  return Math.min(150, Math.max(80, value));
}

interface ThemeState {
  palette: string;
  mode: Mode;
  uiScale: number;
  statusBarDensity: StatusBarDensity;
  setPalette: (palette: string) => void;
  setMode: (mode: Mode) => void;
  setUiScale: (uiScale: number) => void;
  setStatusBarDensity: (density: StatusBarDensity) => void;
  getResolvedMode: () => 'light' | 'dark';
}

function loadPersistedState(): { palette: string; mode: Mode; uiScale: number; statusBarDensity: StatusBarDensity } {
  const defaults = { palette: 'rose-pine' as string, mode: 'light' as Mode, uiScale: 100, statusBarDensity: 'comfortable' as StatusBarDensity };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);

    // Legacy migration: textSize → uiScale
    let uiScale = defaults.uiScale;
    if (typeof parsed.uiScale === 'number') {
      uiScale = clampScale(parsed.uiScale);
    } else if (typeof parsed.textSize === 'string') {
      // All legacy textSize values migrate to 100 (new default)
      uiScale = 100;
    }

    return {
      palette: typeof parsed.palette === 'string' ? parsed.palette : defaults.palette,
      mode: ['light', 'dark', 'system'].includes(parsed.mode) ? parsed.mode : defaults.mode,
      uiScale,
      statusBarDensity: ['compact', 'comfortable', 'expanded'].includes(parsed.statusBarDensity) ? parsed.statusBarDensity : defaults.statusBarDensity,
    };
  } catch {
    return defaults;
  }
}

function persistTheme(state: { palette: string; mode: Mode; uiScale: number; statusBarDensity: StatusBarDensity }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: state.palette,
      mode: state.mode,
      uiScale: state.uiScale,
      statusBarDensity: state.statusBarDensity,
    }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function applyThemeFromStore(state: { palette: string; mode: Mode; uiScale: number }) {
  const palette = findPalette(state.palette);
  const resolved = resolveMode(state.mode);
  applyTheme(palette, resolved, state.uiScale);
}

const initial = loadPersistedState();

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...initial,

  setPalette: (palette) => {
    set({ palette });
    const s = get();
    persistTheme(s);
    applyThemeFromStore(s);
  },

  setMode: (mode) => {
    set({ mode });
    const s = get();
    persistTheme(s);
    applyThemeFromStore(s);
  },

  setUiScale: (uiScale) => {
    set({ uiScale: clampScale(uiScale) });
    const s = get();
    persistTheme(s);
    applyThemeFromStore(s);
  },

  setStatusBarDensity: (statusBarDensity) => {
    set({ statusBarDensity });
    const s = get();
    persistTheme(s);
    // No applyTheme call — density is component-level, not theme-level
  },

  getResolvedMode: () => resolveMode(get().mode),
}));

// Apply theme on module load (side effect)
applyThemeFromStore(useThemeStore.getState());

// System mode listener lifecycle
let systemUnsub: (() => void) | null = null;

function updateSystemListener() {
  // Clean up previous
  systemUnsub?.();
  systemUnsub = null;

  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    systemUnsub = subscribeToSystemMode(() => {
      applyThemeFromStore(useThemeStore.getState());
    });
  }
}

updateSystemListener();
useThemeStore.subscribe((state, prev) => {
  if (state.mode !== prev.mode) {
    updateSystemListener();
  }
});
