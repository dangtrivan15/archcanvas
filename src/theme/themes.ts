/**
 * Built-in theme definitions for ArchCanvas.
 *
 * Each theme provides HSL color values (without the hsl() wrapper)
 * for all semantic tokens defined in ThemeColors.
 *
 * Includes: Light, Dark, Rosé Pine, Rosé Pine Moon, Rosé Pine Dawn
 */

import type { Theme } from './types';

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

/** Rosé Pine — main variant (dark with warm undertones) */
export const rosePineTheme: Theme = {
  id: 'rose-pine',
  name: 'Rosé Pine',
  colors: {
    background: '249 22% 12%',
    surface: '247 23% 15%',
    text: '245 50% 91%',
    subtle: '249 12% 47%',
    muted: '249 15% 28%',
    'muted-foreground': '249 12% 47%',
    'highlight-low': '244 18% 15%',
    'highlight-med': '249 15% 20%',
    'highlight-high': '248 14% 25%',
    primary: '267 57% 78%',
    secondary: '249 15% 28%',
    accent: '343 76% 68%',
    border: '249 15% 28%',
    overlay: '248 25% 18%',
    ring: '267 57% 78%',
    love: '343 76% 68%',
    gold: '35 88% 72%',
    rose: '2 55% 83%',
    pine: '197 49% 38%',
    foam: '189 43% 73%',
    iris: '267 57% 78%',
  },
};

/** Rosé Pine Moon — medium-dark variant */
export const rosePineMoonTheme: Theme = {
  id: 'rose-pine-moon',
  name: 'Rosé Pine Moon',
  colors: {
    background: '246 24% 17%',
    surface: '248 22% 20%',
    text: '245 50% 91%',
    subtle: '249 12% 52%',
    muted: '247 16% 30%',
    'muted-foreground': '249 12% 52%',
    'highlight-low': '244 19% 20%',
    'highlight-med': '248 16% 24%',
    'highlight-high': '247 15% 29%',
    primary: '267 57% 78%',
    secondary: '247 16% 30%',
    accent: '343 76% 68%',
    border: '247 16% 30%',
    overlay: '248 25% 22%',
    ring: '267 57% 78%',
    love: '343 76% 68%',
    gold: '35 88% 72%',
    rose: '2 55% 83%',
    pine: '197 49% 38%',
    foam: '189 43% 73%',
    iris: '267 57% 78%',
  },
};

/** Rosé Pine Dawn — light variant with warm tones */
export const rosePineDawnTheme: Theme = {
  id: 'rose-pine-dawn',
  name: 'Rosé Pine Dawn',
  colors: {
    background: '32 57% 95%',
    surface: '35 52% 92%',
    text: '248 19% 40%',
    subtle: '249 12% 52%',
    muted: '33 43% 88%',
    'muted-foreground': '249 12% 52%',
    'highlight-low': '25 35% 93%',
    'highlight-med': '30 40% 88%',
    'highlight-high': '28 36% 83%',
    primary: '268 62% 60%',
    secondary: '33 43% 88%',
    accent: '343 63% 53%',
    border: '33 43% 82%',
    overlay: '33 48% 90%',
    ring: '268 62% 60%',
    love: '343 63% 53%',
    gold: '35 81% 55%',
    rose: '3 59% 67%',
    pine: '197 53% 34%',
    foam: '189 30% 48%',
    iris: '268 62% 60%',
  },
};

/** All built-in themes indexed by ID */
export const themes: Record<string, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  'rose-pine': rosePineTheme,
  'rose-pine-moon': rosePineMoonTheme,
  'rose-pine-dawn': rosePineDawnTheme,
};

/** Ordered list of theme IDs for UI iteration */
export const themeIds = ['light', 'dark', 'rose-pine', 'rose-pine-moon', 'rose-pine-dawn'] as const;

/** Default theme ID */
export const DEFAULT_THEME_ID = 'dark';
