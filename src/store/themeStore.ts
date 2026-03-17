import { create } from 'zustand';
import { findPalette } from '@/core/theme/palettes';
import { applyTheme, resolveMode, subscribeToSystemMode } from '@/core/theme/applyTheme';

type Mode = 'light' | 'dark' | 'system';
type TextSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'archcanvas:theme';

interface ThemeState {
  palette: string;
  mode: Mode;
  textSize: TextSize;
  setPalette: (palette: string) => void;
  setMode: (mode: Mode) => void;
  setTextSize: (textSize: TextSize) => void;
  getResolvedMode: () => 'light' | 'dark';
}

function loadPersistedState(): { palette: string; mode: Mode; textSize: TextSize } {
  const defaults = { palette: 'archcanvas' as string, mode: 'light' as Mode, textSize: 'medium' as TextSize };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      palette: typeof parsed.palette === 'string' ? parsed.palette : defaults.palette,
      mode: ['light', 'dark', 'system'].includes(parsed.mode) ? parsed.mode : defaults.mode,
      textSize: ['small', 'medium', 'large'].includes(parsed.textSize) ? parsed.textSize : defaults.textSize,
    };
  } catch {
    return defaults;
  }
}

function persistTheme(state: { palette: string; mode: Mode; textSize: TextSize }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      palette: state.palette,
      mode: state.mode,
      textSize: state.textSize,
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
