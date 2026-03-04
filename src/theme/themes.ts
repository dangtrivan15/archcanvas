/**
 * Built-in theme definitions for ArchCanvas.
 *
 * Each theme provides HSL color values (without the hsl() wrapper)
 * for all semantic tokens defined in ThemeColors.
 *
 * Includes: Light, Dark, Rosé Pine, Rosé Pine Moon, Rosé Pine Dawn
 */

import type { Theme } from './types';
import {
  rosePine,
  rosePineMoon,
  rosePineDawn,
  THEME_PRESETS,
} from '../themes/rose-pine';

/** Re-export Rosé Pine themes for backward compatibility */
export const rosePineTheme = rosePine;
export const rosePineMoonTheme = rosePineMoon;
export const rosePineDawnTheme = rosePineDawn;
export { THEME_PRESETS };

/** Light theme — clean whites and grays */
export const lightTheme: Theme = {
  id: 'light',
  name: 'Light',
  colors: {
    background: '0 0% 100%',
    surface: '0 0% 98%',
    text: '240 10% 3.9%',
    subtle: '240 5% 34%',
    muted: '240 4.8% 95.9%',
    'muted-foreground': '240 3.8% 46.1%',
    'highlight-low': '240 5% 96%',
    'highlight-med': '240 5% 90%',
    'highlight-high': '240 5% 84%',
    primary: '240 5.9% 10%',
    secondary: '240 4.8% 95.9%',
    accent: '240 4.8% 95.9%',
    border: '240 5.9% 90%',
    overlay: '240 10% 3.9%',
    ring: '240 5.9% 10%',
    love: '347 77% 50%',
    gold: '35 88% 50%',
    rose: '343 76% 68%',
    pine: '166 54% 40%',
    foam: '189 50% 45%',
    iris: '267 57% 58%',
  },
};

/** Dark theme — dark grays */
export const darkTheme: Theme = {
  id: 'dark',
  name: 'Dark',
  colors: {
    background: '240 10% 3.9%',
    surface: '240 6% 10%',
    text: '0 0% 98%',
    subtle: '240 5% 65%',
    muted: '240 3.7% 15.9%',
    'muted-foreground': '240 5% 64.9%',
    'highlight-low': '240 4% 16%',
    'highlight-med': '240 4% 22%',
    'highlight-high': '240 4% 28%',
    primary: '0 0% 98%',
    secondary: '240 3.7% 15.9%',
    accent: '240 3.7% 15.9%',
    border: '240 3.7% 15.9%',
    overlay: '240 10% 3.9%',
    ring: '240 4.9% 83.9%',
    love: '347 77% 50%',
    gold: '35 88% 55%',
    rose: '343 76% 68%',
    pine: '166 54% 46%',
    foam: '189 50% 55%',
    iris: '267 57% 63%',
  },
};

/**
 * Nord — Arctic, north-bluish palette
 * Based on https://www.nordtheme.com/docs/colors-and-palettes
 *
 * Polar Night: #2E3440 #3B4252 #434C5E #4C566A
 * Snow Storm:  #D8DEE9 #E5E9F0 #ECEFF4
 * Frost:       #8FBCBB #88C0D0 #81A1C1 #5E81AC
 * Aurora:      #BF616A #D08770 #EBCB8B #A3BE8C #B48EAD
 */
export const nordTheme: Theme = {
  id: 'nord',
  name: 'Nord',
  colors: {
    background: '220 16% 22%',    // #2E3440 — Polar Night 0
    surface: '222 16% 28%',       // #3B4252 — Polar Night 1
    text: '219 28% 88%',          // #D8DEE9 — Snow Storm 0
    subtle: '220 16% 36%',        // #4C566A — Polar Night 3
    muted: '220 17% 32%',         // #434C5E — Polar Night 2
    'muted-foreground': '219 14% 61%', // mid between Polar Night 3 and Snow Storm
    'highlight-low': '220 16% 26%',
    'highlight-med': '222 16% 30%',
    'highlight-high': '220 17% 34%',
    primary: '213 32% 52%',       // #5E81AC — Frost 3
    secondary: '220 17% 32%',     // #434C5E
    accent: '193 43% 67%',        // #88C0D0 — Frost 1
    border: '220 17% 32%',        // #434C5E
    overlay: '220 16% 18%',       // darker than background
    ring: '213 32% 52%',          // #5E81AC — Frost 3
    love: '354 42% 56%',          // #BF616A — Aurora red
    gold: '40 71% 73%',           // #EBCB8B — Aurora yellow
    rose: '14 51% 63%',           // #D08770 — Aurora orange
    pine: '92 28% 65%',           // #A3BE8C — Aurora green
    foam: '179 25% 65%',          // #8FBCBB — Frost 0
    iris: '311 20% 63%',          // #B48EAD — Aurora purple
  },
};

/**
 * Catppuccin Mocha — soothing pastel dark theme
 * Based on https://github.com/catppuccin/catppuccin
 *
 * Base:    #1E1E2E  Mantle: #181825  Crust: #11111B
 * Surface: #313244 #45475A #585B70
 * Overlay: #6C7086 #7F849C #9399B2
 * Text:    #CDD6F4  Subtext: #BAC2DE #A6ADC8
 * Rosewater: #F5E0DC  Flamingo: #F2CDCD
 * Pink: #F5C2E7  Mauve: #CBA6F7  Red: #F38BA8
 * Maroon: #EBA0AC  Peach: #FAB387  Yellow: #F9E2AF
 * Green: #A6E3A1  Teal: #94E2D5  Sky: #89DCFE
 * Sapphire: #74C7EC  Blue: #89B4FA  Lavender: #B4BEFE
 */
export const catppuccinMochaTheme: Theme = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  colors: {
    background: '240 21% 15%',    // #1E1E2E — Base
    surface: '240 17% 23%',       // #313244 — Surface 0
    text: '226 64% 88%',          // #CDD6F4 — Text
    subtle: '228 24% 42%',        // #6C7086 — Overlay 0
    muted: '233 12% 39%',         // #585B70 — Surface 2
    'muted-foreground': '228 24% 50%', // between Overlay 0 and 1
    'highlight-low': '240 17% 20%',
    'highlight-med': '240 17% 25%',
    'highlight-high': '233 12% 33%',
    primary: '217 92% 76%',       // #89B4FA — Blue
    secondary: '240 17% 23%',     // #313244 — Surface 0
    accent: '267 84% 81%',        // #CBA6F7 — Mauve
    border: '233 12% 39%',        // #585B70 — Surface 2
    overlay: '240 23% 9%',        // #11111B — Crust
    ring: '217 92% 76%',          // #89B4FA — Blue
    love: '343 81% 75%',          // #F38BA8 — Red
    gold: '41 86% 83%',           // #F9E2AF — Yellow
    rose: '10 56% 91%',           // #F5E0DC — Rosewater
    pine: '115 54% 76%',          // #A6E3A1 — Green
    foam: '170 57% 73%',          // #94E2D5 — Teal
    iris: '267 84% 81%',          // #CBA6F7 — Mauve
  },
};

/** All built-in themes indexed by ID */
export const themes: Record<string, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  ...THEME_PRESETS,
  nord: nordTheme,
  'catppuccin-mocha': catppuccinMochaTheme,
};

/** Ordered list of theme IDs for UI iteration */
export const themeIds = [
  'light',
  'dark',
  'nord',
  'catppuccin-mocha',
  'rose-pine',
  'rose-pine-moon',
  'rose-pine-dawn',
] as const;

/** Default theme ID */
export const DEFAULT_THEME_ID = 'dark';
