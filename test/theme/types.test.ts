import { describe, it, expect } from 'vitest';
import type { ThemeTokens } from '@/core/theme/types';
import { palettes } from '@/core/theme/palettes';

const REQUIRED_KEYS: (keyof ThemeTokens)[] = [
  'background', 'foreground', 'card', 'cardForeground',
  'popover', 'popoverForeground', 'muted', 'mutedForeground',
  'border', 'input', 'ring',
  'primary', 'primaryForeground',
  'secondary', 'secondaryForeground',
  'accent', 'accentForeground',
  'destructive', 'destructiveForeground',
  'warning', 'warningForeground', 'warningBorder',
  'nodeBg', 'nodeBorder', 'nodeShadow',
  'nodeSelectedBorder', 'nodeSelectedRing',
  'nodeRefBg', 'nodeRefBorder',
  'edgeSync', 'edgeAsync', 'edgeDefault', 'canvasDot',
];

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

function validateTokens(tokens: ThemeTokens, label: string) {
  for (const key of REQUIRED_KEYS) {
    it(`${label} has token "${key}"`, () => {
      expect(tokens[key]).toBeDefined();
    });
    it(`${label} "${key}" is valid hex`, () => {
      expect(tokens[key]).toMatch(HEX_RE);
    });
  }
}

describe('theme palettes', () => {
  expect(palettes.length).toBeGreaterThanOrEqual(3);

  for (const palette of palettes) {
    describe(palette.name, () => {
      it('has required fields', () => {
        expect(palette.id).toBeTruthy();
        expect(palette.name).toBeTruthy();
        expect(palette.light).toBeDefined();
        expect(palette.dark).toBeDefined();
      });
      describe('light', () => validateTokens(palette.light, `${palette.name} light`));
      describe('dark', () => validateTokens(palette.dark, `${palette.name} dark`));
    });
  }
});
