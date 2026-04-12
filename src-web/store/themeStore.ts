import { create } from 'zustand';
import { findPalette } from '@/core/theme/palettes';
import { applyTheme, resolveMode, subscribeToSystemMode } from '@/core/theme/applyTheme';

type Mode = 'light' | 'dark' | 'system';
type TextSize = 'small' | 'medium' | 'large';
export type StatusBarDensity = 'compact' | 'comfortable' | 'expanded';

const STORAGE_KEY = 'archcanvas:theme';

interface ThemeState {
  palette: string;
  mode: Mode;
  textSize: TextSize;
  statusBarDensity: StatusBarDensity;
  setPalette: (palette: string) => void;
  setMode: (mode: Mode) => void;
  setTextSize: (textSize: TextSize) => void;
  setStatusBarDensity: (density: StatusBarDensity) => void;
  getResolvedMode: () => 'light' | 'dark';
}

function loadPersistedState(): { palette: string; mode: Mode; textSize: TextSize; statusBarDensity: StatusBarDensity } {
  const defaults = { palette: 'rose-pine' as string, mode: 'light' as Mode, textSize: 'medium' as TextSize, statusBarDensity: 'comfortable' as StatusBarDensity };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      palette: typeof parsed.palette === 'string' ? parsed.palette : defaults.palette,
      mode: ['light', 'dark', 'system'].includes(parsed.mode) ? parsed.mode : defaults.mode,
      textSize: ['small', 'medium', 'large'].includes(parsed.textSize) ? parsed.textSize : defaults.textSize,
      statusBarDensity: ['compact', 'comfortable', 'expanded'].includes(parsed.statusBarDensity) ? parsed.statusBarDensity : defaults.statusBarDensity,
    };
  } catch {
    return defaults;
  }
}

function persistTheme(state: { palette: string; mode: Mode; textSize: TextSize; statusBarDensity: StatusBarDensity }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: state.palette,
      mode: state.mode,
      textSize: state.textSize,
      statusBarDensity: state.statusBarDensity,
    }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function applyThemeFromStore(state: { palette: string; mode: Mode; textSize: TextSize }) {
  const palette = findPalette(state.palette);
  const resolved = resolveMode(state.mode);
  applyTheme(palette, resolved, state.textSize);
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

  setTextSize: (textSize) => {
    set({ textSize });
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
