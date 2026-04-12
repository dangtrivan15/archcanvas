import type { ThemePalette } from './types';

type Mode = 'light' | 'dark' | 'system';

/**
 * Convert a uiScale percentage (80–150) to a root font-size string.
 * Formula: (scale / 100) × 16px (browser default).
 * 100 → 16px, 80 → 12.8px, 150 → 24px.
 */
export function uiScaleToFontSize(scale: number): string {
  return `${(scale / 100) * 16}px`;
}

/**
 * Convert camelCase token name to kebab-case CSS custom property suffix.
 * e.g. 'cardForeground' → 'card-foreground'
 */
export function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

/**
 * Resolve 'system' mode to 'light' or 'dark' based on prefers-color-scheme.
 */
export function resolveMode(mode: Mode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply palette tokens and UI scale to document.documentElement.
 */
export function applyTheme(palette: ThemePalette, resolvedMode: 'light' | 'dark', uiScale: number): void {
  if (typeof document === 'undefined') return;

  const tokens = resolvedMode === 'dark' ? palette.dark : palette.light;
  const el = document.documentElement;

  for (const [key, value] of Object.entries(tokens)) {
    el.style.setProperty(`--color-${camelToKebab(key)}`, value);
  }

  el.style.fontSize = uiScaleToFontSize(uiScale);
}

/**
 * Subscribe to OS dark/light mode changes. Returns unsubscribe function.
 */
export function subscribeToSystemMode(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
