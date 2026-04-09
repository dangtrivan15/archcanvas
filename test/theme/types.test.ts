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
  // Namespace tint tokens
  'nsComputeBg', 'nsComputeBorder',
  'nsDataBg', 'nsDataBorder',
  'nsMessagingBg', 'nsMessagingBorder',
  'nsNetworkBg', 'nsNetworkBorder',
  'nsClientBg', 'nsClientBorder',
  'nsIntegrationBg', 'nsIntegrationBorder',
  'nsSecurityBg', 'nsSecurityBorder',
  'nsObservabilityBg', 'nsObservabilityBorder',
  'nsAiBg', 'nsAiBorder',
];

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** The 9 namespace border token keys */
const NS_BORDER_KEYS: (keyof ThemeTokens)[] = [
  'nsComputeBorder', 'nsDataBorder', 'nsMessagingBorder',
  'nsNetworkBorder', 'nsClientBorder', 'nsIntegrationBorder',
  'nsSecurityBorder', 'nsObservabilityBorder', 'nsAiBorder',
];

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

function validateUniqueNamespaceBorders(tokens: ThemeTokens, label: string) {
  it(`${label} has unique namespace border colors`, () => {
    const borders = NS_BORDER_KEYS.map((k) => tokens[k].toLowerCase());
    const unique = new Set(borders);
    const duplicates = borders.filter((b, i) => borders.indexOf(b) !== i);
    expect(duplicates).toEqual([]);
    expect(unique.size).toBe(NS_BORDER_KEYS.length);
  });
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
      describe('light', () => {
        validateTokens(palette.light, `${palette.name} light`);
        validateUniqueNamespaceBorders(palette.light, `${palette.name} light`);
      });
      describe('dark', () => {
        validateTokens(palette.dark, `${palette.name} dark`);
        validateUniqueNamespaceBorders(palette.dark, `${palette.name} dark`);
      });
    });
  }
});
