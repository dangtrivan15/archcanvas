/**
 * Tests for Terminal Panel Theme Integration (Feature #537)
 *
 * Verifies that the xterm.js terminal is styled consistently with
 * the ArchCanvas theme system, including:
 * - Dark mode xterm theme colors
 * - Light mode xterm theme colors
 * - Theme switching updates xterm
 * - Monospace font consistency
 * - Cursor visibility and styling in both modes
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hslToHex,
  buildXtermTheme,
  TERMINAL_FONT_FAMILY,
} from '@/components/panels/TerminalPanel';
import { themes } from '@/theme/themes';
import type { Theme } from '@/theme/types';

// Read source files for structural verification
const terminalPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/components/panels/TerminalPanel.tsx'),
  'utf-8',
);

const themesSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/theme/themes.ts'),
  'utf-8',
);

const themeProviderSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/theme/ThemeProvider.tsx'),
  'utf-8',
);

// ─── Step 1: Configure xterm.js theme colors matching dark mode palette ───

describe('Step 1: xterm.js dark mode theme colors', () => {
  const darkTheme = themes['dark']!;
  const xtermDark = buildXtermTheme(darkTheme);

  it('should map dark theme background to xterm background', () => {
    const expected = hslToHex(darkTheme.colors.background);
    expect(xtermDark.background).toBe(expected);
  });

  it('should map dark theme text to xterm foreground', () => {
    const expected = hslToHex(darkTheme.colors.text);
    expect(xtermDark.foreground).toBe(expected);
  });

  it('should map dark theme iris to xterm cursor', () => {
    const expected = hslToHex(darkTheme.colors.iris);
    expect(xtermDark.cursor).toBe(expected);
  });

  it('should map dark theme highlight-med to xterm selection background', () => {
    const expected = hslToHex(darkTheme.colors['highlight-med']);
    expect(xtermDark.selectionBackground).toBe(expected);
  });

  it('should map dark theme love to ANSI red', () => {
    const expected = hslToHex(darkTheme.colors.love);
    expect(xtermDark.red).toBe(expected);
  });

  it('should map dark theme pine to ANSI green', () => {
    const expected = hslToHex(darkTheme.colors.pine);
    expect(xtermDark.green).toBe(expected);
  });

  it('should map dark theme gold to ANSI yellow', () => {
    const expected = hslToHex(darkTheme.colors.gold);
    expect(xtermDark.yellow).toBe(expected);
  });

  it('should map dark theme foam to ANSI blue/cyan', () => {
    const expected = hslToHex(darkTheme.colors.foam);
    expect(xtermDark.blue).toBe(expected);
    expect(xtermDark.cyan).toBe(expected);
  });

  it('should map dark theme iris to ANSI magenta', () => {
    const expected = hslToHex(darkTheme.colors.iris);
    expect(xtermDark.magenta).toBe(expected);
  });

  it('should produce valid hex colors for all dark theme xterm values', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    expect(xtermDark.background).toMatch(hexRegex);
    expect(xtermDark.foreground).toMatch(hexRegex);
    expect(xtermDark.cursor).toMatch(hexRegex);
    expect(xtermDark.red).toMatch(hexRegex);
    expect(xtermDark.green).toMatch(hexRegex);
    expect(xtermDark.yellow).toMatch(hexRegex);
    expect(xtermDark.blue).toMatch(hexRegex);
    expect(xtermDark.magenta).toMatch(hexRegex);
    expect(xtermDark.cyan).toMatch(hexRegex);
    expect(xtermDark.white).toMatch(hexRegex);
    expect(xtermDark.black).toMatch(hexRegex);
  });
});

// ─── Step 2: Configure xterm.js theme colors matching light mode palette ───

describe('Step 2: xterm.js light mode theme colors', () => {
  const lightTheme = themes['light']!;
  const xtermLight = buildXtermTheme(lightTheme);

  it('should map light theme background to xterm background', () => {
    const expected = hslToHex(lightTheme.colors.background);
    expect(xtermLight.background).toBe(expected);
  });

  it('should map light theme text to xterm foreground', () => {
    const expected = hslToHex(lightTheme.colors.text);
    expect(xtermLight.foreground).toBe(expected);
  });

  it('should map light theme iris to xterm cursor', () => {
    const expected = hslToHex(lightTheme.colors.iris);
    expect(xtermLight.cursor).toBe(expected);
  });

  it('should produce a light background color (high lightness)', () => {
    // Light theme background should be near-white
    const bg = xtermLight.background!;
    // Parse hex to check brightness
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const brightness = (r + g + b) / 3;
    expect(brightness).toBeGreaterThan(200); // Near-white
  });

  it('should produce a dark foreground color (low lightness)', () => {
    const fg = xtermLight.foreground!;
    const r = parseInt(fg.slice(1, 3), 16);
    const g = parseInt(fg.slice(3, 5), 16);
    const b = parseInt(fg.slice(5, 7), 16);
    const brightness = (r + g + b) / 3;
    expect(brightness).toBeLessThan(50); // Near-black
  });

  it('should produce valid hex colors for all light theme xterm values', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    expect(xtermLight.background).toMatch(hexRegex);
    expect(xtermLight.foreground).toMatch(hexRegex);
    expect(xtermLight.cursor).toMatch(hexRegex);
    expect(xtermLight.red).toMatch(hexRegex);
    expect(xtermLight.green).toMatch(hexRegex);
    expect(xtermLight.yellow).toMatch(hexRegex);
    expect(xtermLight.blue).toMatch(hexRegex);
  });

  it('should have different background than dark theme', () => {
    const darkTheme = themes['dark']!;
    const xtermDark = buildXtermTheme(darkTheme);
    expect(xtermLight.background).not.toBe(xtermDark.background);
  });

  it('should have different foreground than dark theme', () => {
    const darkTheme = themes['dark']!;
    const xtermDark = buildXtermTheme(darkTheme);
    expect(xtermLight.foreground).not.toBe(xtermDark.foreground);
  });

  it('should map light theme semantic colors correctly for all ANSI colors', () => {
    expect(xtermLight.red).toBe(hslToHex(lightTheme.colors.love));
    expect(xtermLight.green).toBe(hslToHex(lightTheme.colors.pine));
    expect(xtermLight.yellow).toBe(hslToHex(lightTheme.colors.gold));
    expect(xtermLight.magenta).toBe(hslToHex(lightTheme.colors.iris));
  });
});

// ─── Step 3: Terminal switches theme when user toggles dark/light mode ───

describe('Step 3: Terminal switches theme on toggle', () => {
  it('should import useTheme from ThemeProvider', () => {
    expect(terminalPanelSource).toContain("import { useTheme }");
    expect(terminalPanelSource).toContain("from '@/theme/ThemeProvider'");
  });

  it('should call useTheme() in the component', () => {
    expect(terminalPanelSource).toContain('useTheme()');
  });

  it('should build xterm theme from current theme with useMemo', () => {
    expect(terminalPanelSource).toContain('useMemo(() => buildXtermTheme(theme)');
  });

  it('should pass xtermTheme to Terminal constructor', () => {
    expect(terminalPanelSource).toContain('theme: xtermTheme');
  });

  it('should update xterm theme in a useEffect when xtermTheme changes', () => {
    // Verify the effect that updates terminal options when theme changes
    expect(terminalPanelSource).toContain('terminal.options.theme = xtermTheme');
    expect(terminalPanelSource).toContain('[xtermTheme]');
  });

  it('should generate unique themes for each built-in theme', () => {
    const themeIds = Object.keys(themes);
    const xtermThemes = themeIds.map((id) => buildXtermTheme(themes[id]!));

    // All themes should produce valid results
    for (const xt of xtermThemes) {
      expect(xt.background).toBeDefined();
      expect(xt.foreground).toBeDefined();
      expect(xt.cursor).toBeDefined();
    }

    // Dark and light should differ
    const darkIdx = themeIds.indexOf('dark');
    const lightIdx = themeIds.indexOf('light');
    expect(xtermThemes[darkIdx]!.background).not.toBe(xtermThemes[lightIdx]!.background);
  });

  it('should build valid themes for Nord', () => {
    const nordTheme = themes['nord']!;
    const xtermNord = buildXtermTheme(nordTheme);
    expect(xtermNord.background).toBe(hslToHex(nordTheme.colors.background));
    expect(xtermNord.foreground).toBe(hslToHex(nordTheme.colors.text));
  });

  it('should build valid themes for Catppuccin Mocha', () => {
    const catppuccin = themes['catppuccin-mocha']!;
    const xtermCat = buildXtermTheme(catppuccin);
    expect(xtermCat.background).toBe(hslToHex(catppuccin.colors.background));
    expect(xtermCat.foreground).toBe(hslToHex(catppuccin.colors.text));
  });

  it('should build valid themes for Rose Pine variants', () => {
    for (const id of ['rose-pine', 'rose-pine-moon', 'rose-pine-dawn'] as const) {
      const theme = themes[id];
      if (theme) {
        const xt = buildXtermTheme(theme);
        expect(xt.background).toBe(hslToHex(theme.colors.background));
        expect(xt.foreground).toBe(hslToHex(theme.colors.text));
      }
    }
  });

  it('should use theme-aware CSS classes for header (bg-surface, not bg-gray)', () => {
    expect(terminalPanelSource).toContain('bg-surface');
    // Find the header div that contains data-testid="terminal-header"
    // and check the className on the same element
    const headerSection = terminalPanelSource.match(
      /className="[^"]*"[^>]*data-testid="terminal-header"/,
    );
    expect(headerSection).toBeTruthy();
    const headerClass = headerSection![0];
    expect(headerClass).toContain('bg-surface');
    expect(headerClass).not.toContain('bg-gray-50');
  });

  it('should use theme-aware CSS classes for terminal container (bg-background)', () => {
    // The terminal container should use bg-background, not bg-gray-900
    expect(terminalPanelSource).toContain('bg-background');
  });

  it('should use theme tokens for text colors (text-muted-foreground, text-text)', () => {
    expect(terminalPanelSource).toContain('text-muted-foreground');
    expect(terminalPanelSource).toContain('text-text');
  });

  it('should use theme tokens for button hover states (hover:bg-highlight-low)', () => {
    expect(terminalPanelSource).toContain('hover:bg-highlight-low');
    expect(terminalPanelSource).not.toContain('hover:bg-gray-200');
    expect(terminalPanelSource).not.toContain('dark:hover:bg-gray-700');
  });
});

// ─── Step 4: Verify font is monospace and consistent with app's code font ───

describe('Step 4: Monospace font consistency', () => {
  it('should export a TERMINAL_FONT_FAMILY constant', () => {
    expect(TERMINAL_FONT_FAMILY).toBeDefined();
    expect(typeof TERMINAL_FONT_FAMILY).toBe('string');
  });

  it('should include standard monospace fonts in the font family', () => {
    expect(TERMINAL_FONT_FAMILY).toContain('Menlo');
    expect(TERMINAL_FONT_FAMILY).toContain('Monaco');
    expect(TERMINAL_FONT_FAMILY).toContain('monospace');
  });

  it('should include modern code fonts like Cascadia Code or Fira Code', () => {
    const hasModernFont =
      TERMINAL_FONT_FAMILY.includes('Cascadia Code') ||
      TERMINAL_FONT_FAMILY.includes('Fira Code');
    expect(hasModernFont).toBe(true);
  });

  it('should use TERMINAL_FONT_FAMILY in xterm Terminal constructor', () => {
    expect(terminalPanelSource).toContain('fontFamily: TERMINAL_FONT_FAMILY');
  });

  it('should set a reasonable font size (12-16px)', () => {
    const fontSizeMatch = terminalPanelSource.match(/fontSize:\s*(\d+)/);
    expect(fontSizeMatch).toBeTruthy();
    const fontSize = parseInt(fontSizeMatch![1]!, 10);
    expect(fontSize).toBeGreaterThanOrEqual(12);
    expect(fontSize).toBeLessThanOrEqual(16);
  });
});

// ─── Step 5: Verify cursor is visible and styled appropriately in both modes ───

describe('Step 5: Cursor visibility and styling', () => {
  it('should set cursorBlink to true', () => {
    expect(terminalPanelSource).toContain('cursorBlink: true');
  });

  it('should set a cursorStyle', () => {
    const hasCursorStyle = terminalPanelSource.includes("cursorStyle:");
    expect(hasCursorStyle).toBe(true);
  });

  it('should map cursor color from theme (iris) in dark mode', () => {
    const darkTheme = themes['dark']!;
    const xtermDark = buildXtermTheme(darkTheme);
    const cursorHex = xtermDark.cursor!;

    // Cursor should be different from background (visible)
    expect(cursorHex).not.toBe(xtermDark.background);
  });

  it('should map cursor color from theme (iris) in light mode', () => {
    const lightTheme = themes['light']!;
    const xtermLight = buildXtermTheme(lightTheme);
    const cursorHex = xtermLight.cursor!;

    // Cursor should be different from background (visible)
    expect(cursorHex).not.toBe(xtermLight.background);
  });

  it('should set cursorAccent color from theme background', () => {
    const darkTheme = themes['dark']!;
    const xtermDark = buildXtermTheme(darkTheme);
    expect(xtermDark.cursorAccent).toBe(hslToHex(darkTheme.colors.background));
  });

  it('should have visible cursor in all built-in themes', () => {
    for (const [id, theme] of Object.entries(themes)) {
      const xt = buildXtermTheme(theme);
      // Cursor must differ from background
      expect(xt.cursor).not.toBe(xt.background);
      // Cursor must be defined
      expect(xt.cursor).toBeDefined();
    }
  });

  it('should have selection background different from terminal background in all themes', () => {
    for (const [id, theme] of Object.entries(themes)) {
      const xt = buildXtermTheme(theme);
      expect(xt.selectionBackground).not.toBe(xt.background);
    }
  });
});

// ─── hslToHex utility function tests ───

describe('hslToHex utility', () => {
  it('should convert black (0 0% 0%) to #000000', () => {
    expect(hslToHex('0 0% 0%')).toBe('#000000');
  });

  it('should convert white (0 0% 100%) to #ffffff', () => {
    expect(hslToHex('0 0% 100%')).toBe('#ffffff');
  });

  it('should convert pure red (0 100% 50%) to #ff0000', () => {
    expect(hslToHex('0 100% 50%')).toBe('#ff0000');
  });

  it('should convert pure green (120 100% 50%) to #00ff00', () => {
    expect(hslToHex('120 100% 50%')).toBe('#00ff00');
  });

  it('should convert pure blue (240 100% 50%) to #0000ff', () => {
    expect(hslToHex('240 100% 50%')).toBe('#0000ff');
  });

  it('should handle gray (0 0% 50%) to #808080', () => {
    expect(hslToHex('0 0% 50%')).toBe('#808080');
  });

  it('should return #000000 for malformed input', () => {
    expect(hslToHex('')).toBe('#000000');
    expect(hslToHex('invalid')).toBe('#000000');
  });

  it('should handle extra whitespace', () => {
    expect(hslToHex('  0   0%   0%  ')).toBe('#000000');
  });
});

// ─── Integration: buildXtermTheme completeness ───

describe('Integration: buildXtermTheme completeness', () => {
  it('should produce all required xterm ITheme fields', () => {
    const darkTheme = themes['dark']!;
    const xt = buildXtermTheme(darkTheme);

    // Core fields
    expect(xt.background).toBeDefined();
    expect(xt.foreground).toBeDefined();
    expect(xt.cursor).toBeDefined();
    expect(xt.cursorAccent).toBeDefined();
    expect(xt.selectionBackground).toBeDefined();

    // ANSI standard colors
    expect(xt.black).toBeDefined();
    expect(xt.red).toBeDefined();
    expect(xt.green).toBeDefined();
    expect(xt.yellow).toBeDefined();
    expect(xt.blue).toBeDefined();
    expect(xt.magenta).toBeDefined();
    expect(xt.cyan).toBeDefined();
    expect(xt.white).toBeDefined();

    // Bright variants
    expect(xt.brightBlack).toBeDefined();
    expect(xt.brightRed).toBeDefined();
    expect(xt.brightGreen).toBeDefined();
    expect(xt.brightYellow).toBeDefined();
    expect(xt.brightBlue).toBeDefined();
    expect(xt.brightMagenta).toBeDefined();
    expect(xt.brightCyan).toBeDefined();
    expect(xt.brightWhite).toBeDefined();
  });

  it('should generate distinct themes for all 7 built-in themes', () => {
    const backgrounds = new Set<string>();
    for (const theme of Object.values(themes)) {
      const xt = buildXtermTheme(theme);
      backgrounds.add(xt.background!);
    }
    // At least dark, light, and some variants should differ
    expect(backgrounds.size).toBeGreaterThanOrEqual(5);
  });

  it('should not contain hardcoded hex colors in the component (uses theme instead)', () => {
    // The xterm theme config should NOT have hardcoded hex colors like #111827
    expect(terminalPanelSource).not.toContain("'#111827'");
    expect(terminalPanelSource).not.toContain("'#e5e7eb'");
    expect(terminalPanelSource).not.toContain("'#60a5fa'");
    expect(terminalPanelSource).not.toContain("'#374151'");
  });
});
