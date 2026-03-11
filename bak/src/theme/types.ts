/**
 * Theme type definitions for the ArchCanvas theming engine.
 *
 * All semantic color tokens use HSL format strings (e.g. "240 10% 3.9%")
 * which are injected as CSS custom properties and consumed via hsl(var(--token)).
 *
 * The palette covers Rose Pine's full color set plus standard UI tokens.
 */

/** All semantic color tokens that a theme must define */
export interface ThemeColors {
  // ─── Core UI surfaces ───
  /** Page/app background */
  background: string;
  /** Elevated surface (cards, panels, dialogs) */
  surface: string;
  /** Primary text color */
  text: string;
  /** Subtle/secondary text */
  subtle: string;
  /** Muted/disabled text and backgrounds */
  muted: string;
  /** Muted foreground text (labels, captions) */
  'muted-foreground': string;

  // ─── Highlight levels (selection, hover, active) ───
  /** Low-intensity highlight (hover) */
  'highlight-low': string;
  /** Medium-intensity highlight (active/selected) */
  'highlight-med': string;
  /** High-intensity highlight (focused) */
  'highlight-high': string;

  // ─── Semantic action colors ───
  /** Primary brand/action color */
  primary: string;
  /** Secondary action color */
  secondary: string;
  /** Accent color for emphasis */
  accent: string;

  // ─── Borders, overlays, focus rings ───
  /** Border color */
  border: string;
  /** Overlay backdrop color (modals) */
  overlay: string;
  /** Focus ring color */
  ring: string;

  // ─── Rose Pine palette colors ───
  /** Love — red/error/destructive */
  love: string;
  /** Gold — warning/attention */
  gold: string;
  /** Rose — soft pink accent */
  rose: string;
  /** Pine — green/success */
  pine: string;
  /** Foam — teal/info */
  foam: string;
  /** Iris — purple/link */
  iris: string;
}

/** A complete theme definition */
export interface Theme {
  /** Unique identifier (e.g. 'light', 'dark', 'rose-pine') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** All color token values in HSL format */
  colors: ThemeColors;
}

/** All available color token keys */
export type ThemeColorToken = keyof ThemeColors;

/** List of all semantic color tokens for iteration */
export const THEME_COLOR_TOKENS: ThemeColorToken[] = [
  'background',
  'surface',
  'text',
  'subtle',
  'muted',
  'muted-foreground',
  'highlight-low',
  'highlight-med',
  'highlight-high',
  'primary',
  'secondary',
  'accent',
  'border',
  'overlay',
  'ring',
  'love',
  'gold',
  'rose',
  'pine',
  'foam',
  'iris',
];
