/**
 * Rosé Pine theme presets for ArchCanvas.
 *
 * Exact hex values sourced from the official Rosé Pine palette:
 * https://rosepinetheme.com/palette
 *
 * Rose Pine (default dark), Moon (softer dark), Dawn (light variant).
 *
 * HSL values are computed directly from the canonical hex values.
 * Format: "H S% L%" (no hsl() wrapper) — consumed via hsl(var(--token)).
 */

import type { Theme } from './types';

// ─────────────────────────────────────────────
// Rosé Pine — default dark variant
// ─────────────────────────────────────────────
// base=#191724  surface=#1f1d2e  overlay=#26233a
// muted=#6e6a86  subtle=#908caa  text=#e0def4
// love=#eb6f92  gold=#f6c177  rose=#ebbcba
// pine=#31748f  foam=#9ccfd8  iris=#c4a7e7
// highlight-low=#21202e  highlight-med=#403d52  highlight-high=#524f67

export const rosePine: Theme = {
  id: 'rose-pine',
  name: 'Rosé Pine',
  colors: {
    background: '249 22% 12%', // #191724
    surface: '247 23% 15%', // #1f1d2e
    text: '245 50% 91%', // #e0def4
    subtle: '248 15% 61%', // #908caa
    muted: '248 25% 18%', // overlay-level muted bg (#26233a)
    'muted-foreground': '249 12% 47%', // #6e6a86
    'highlight-low': '244 18% 15%', // #21202e
    'highlight-med': '249 15% 28%', // #403d52
    'highlight-high': '248 13% 36%', // #524f67
    primary: '267 57% 78%', // iris #c4a7e7
    secondary: '249 15% 28%', // highlight-med level
    accent: '343 76% 68%', // love #eb6f92
    border: '249 15% 28%', // highlight-med level
    overlay: '248 25% 18%', // #26233a
    ring: '267 57% 78%', // iris #c4a7e7
    love: '343 76% 68%', // #eb6f92
    gold: '35 88% 72%', // #f6c177
    rose: '2 55% 83%', // #ebbcba
    pine: '197 49% 38%', // #31748f
    foam: '189 44% 73%', // #9ccfd8
    iris: '267 57% 78%', // #c4a7e7
  },
};

// ─────────────────────────────────────────────
// Rosé Pine Moon — softer dark variant
// ─────────────────────────────────────────────
// base=#232136  surface=#2a273f  overlay=#393552
// muted=#6e6a86  subtle=#908caa  text=#e0def4
// love=#eb6f92  gold=#f6c177  rose=#ebbcba
// pine=#3e8fb0  foam=#9ccfd8  iris=#c4a7e7

export const rosePineMoon: Theme = {
  id: 'rose-pine-moon',
  name: 'Rosé Pine Moon',
  colors: {
    background: '246 24% 17%', // #232136
    surface: '248 24% 20%', // #2a273f
    text: '245 50% 91%', // #e0def4
    subtle: '248 15% 61%', // #908caa
    muted: '248 22% 27%', // overlay-level muted bg (#393552)
    'muted-foreground': '249 12% 47%', // #6e6a86
    'highlight-low': '246 22% 22%', // derived: between surface and overlay
    'highlight-med': '248 20% 30%', // derived: between overlay and muted
    'highlight-high': '248 18% 35%', // derived: above overlay
    primary: '267 57% 78%', // iris #c4a7e7
    secondary: '248 22% 27%', // overlay level
    accent: '343 76% 68%', // love #eb6f92
    border: '248 22% 27%', // overlay level
    overlay: '248 22% 27%', // #393552
    ring: '267 57% 78%', // iris #c4a7e7
    love: '343 76% 68%', // #eb6f92
    gold: '35 88% 72%', // #f6c177
    rose: '2 55% 83%', // #ebbcba
    pine: '197 48% 47%', // #3e8fb0
    foam: '189 44% 73%', // #9ccfd8
    iris: '267 57% 78%', // #c4a7e7
  },
};

// ─────────────────────────────────────────────
// Rosé Pine Dawn — light variant
// ─────────────────────────────────────────────
// base=#faf4ed  surface=#fffaf3  overlay=#f2e9e1
// muted=#9893a5  subtle=#797593  text=#575279
// love=#b4637a  gold=#ea9d34  rose=#d7827e
// pine=#286983  foam=#56949f  iris=#907aa9

export const rosePineDawn: Theme = {
  id: 'rose-pine-dawn',
  name: 'Rosé Pine Dawn',
  colors: {
    background: '32 57% 96%', // #faf4ed
    surface: '35 100% 98%', // #fffaf3
    text: '248 19% 40%', // #575279
    subtle: '248 12% 52%', // #797593
    muted: '28 40% 92%', // overlay-level muted bg (#f2e9e1)
    'muted-foreground': '257 9% 61%', // #9893a5
    'highlight-low': '25 35% 93%', // derived: near overlay
    'highlight-med': '30 33% 88%', // derived: between overlay shades
    'highlight-high': '28 30% 83%', // derived: deeper highlight
    primary: '268 22% 57%', // iris #907aa9
    secondary: '28 40% 92%', // overlay level
    accent: '343 35% 55%', // love #b4637a
    border: '28 30% 85%', // between overlay and highlight
    overlay: '28 40% 92%', // #f2e9e1
    ring: '268 22% 57%', // iris #907aa9
    love: '343 35% 55%', // #b4637a
    gold: '35 81% 56%', // #ea9d34
    rose: '3 53% 67%', // #d7827e
    pine: '197 53% 34%', // #286983
    foam: '189 30% 48%', // #56949f
    iris: '268 22% 57%', // #907aa9
  },
};

/** All three Rosé Pine variants as a THEME_PRESETS map keyed by id */
export const THEME_PRESETS: Record<string, Theme> = {
  'rose-pine': rosePine,
  'rose-pine-moon': rosePineMoon,
  'rose-pine-dawn': rosePineDawn,
};
