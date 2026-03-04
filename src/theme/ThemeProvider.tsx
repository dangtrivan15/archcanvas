/**
 * ThemeProvider — reads the active theme from Zustand store and applies
 * CSS custom properties to :root. Also provides a React context for
 * convenient access to the current theme and setTheme action.
 */

import React, { createContext, useContext, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { themes, DEFAULT_THEME_ID } from './themes';
import { THEME_COLOR_TOKENS } from './types';
import type { Theme } from './types';

interface ThemeContextValue {
  /** The currently active theme object */
  theme: Theme;
  /** The active theme ID */
  themeId: string;
  /** Switch to a different theme by ID */
  setTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Apply a theme's CSS custom properties to the document root element.
 * This injects all semantic color tokens as --<token> variables.
 */
function applyThemeToRoot(theme: Theme): void {
  const root = document.documentElement;

  for (const token of THEME_COLOR_TOKENS) {
    root.style.setProperty(`--${token}`, theme.colors[token]);
  }

  // Also set the foreground variable for backward compat with existing CSS
  root.style.setProperty('--foreground', theme.colors.text);

  // Apply/remove .dark class for components that check it
  const isDark = theme.id !== 'light' && theme.id !== 'rose-pine-dawn';
  root.classList.toggle('dark', isDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useUIStore((s) => s.themeId);
  const setThemeAction = useUIStore((s) => s.setTheme);

  const resolvedId = themeId && themes[themeId] ? themeId : DEFAULT_THEME_ID;
  const theme = themes[resolvedId];

  // Apply CSS variables whenever the theme changes
  useEffect(() => {
    applyThemeToRoot(theme);
  }, [theme]);

  const contextValue: ThemeContextValue = {
    theme,
    themeId: resolvedId,
    setTheme: setThemeAction,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme and setTheme action.
 * Must be used within a <ThemeProvider>.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
