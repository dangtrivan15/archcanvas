export interface ThemeTokens {
  // UI tokens
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  // Canvas tokens
  nodeBg: string;
  nodeBorder: string;
  nodeShadow: string;
  nodeSelectedBorder: string;
  nodeSelectedRing: string;
  nodeRefBg: string;
  nodeRefBorder: string;
  edgeSync: string;
  edgeAsync: string;
  edgeDefault: string;
  canvasDot: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}
