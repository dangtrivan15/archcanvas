import { describe, it, expect } from 'vitest';
import {
  NODE_MIN_WIDTH_XS,
  NODE_MIN_WIDTH_SM,
  NODE_MIN_WIDTH_MD,
  NODE_MIN_WIDTH_LG,
  NODE_MIN_HEIGHT,
} from '@/lib/nodeTokens';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Token-drift guard: ensures the JS constants in nodeTokens.ts stay in sync
 * with the CSS custom properties declared in the index.css @theme block.
 */
describe('nodeTokens — CSS/JS drift guard', () => {
  const cssPath = path.resolve(__dirname, '../../../src-web/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  function extractCSSValue(tokenName: string): number {
    // Escape hyphens for safe regex (tokenName contains leading --)
    const escaped = tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}:\\s*(\\d+)px`);
    const match = css.match(re);
    if (!match) throw new Error(`Token ${tokenName} not found in index.css`);
    return Number(match[1]);
  }

  it('NODE_MIN_WIDTH_XS matches --node-min-width-xs', () => {
    expect(NODE_MIN_WIDTH_XS).toBe(extractCSSValue('--node-min-width-xs'));
  });

  it('NODE_MIN_WIDTH_SM matches --node-min-width-sm', () => {
    expect(NODE_MIN_WIDTH_SM).toBe(extractCSSValue('--node-min-width-sm'));
  });

  it('NODE_MIN_WIDTH_MD matches --node-min-width-md', () => {
    expect(NODE_MIN_WIDTH_MD).toBe(extractCSSValue('--node-min-width-md'));
  });

  it('NODE_MIN_WIDTH_LG matches --node-min-width-lg', () => {
    expect(NODE_MIN_WIDTH_LG).toBe(extractCSSValue('--node-min-width-lg'));
  });

  it('scale is strictly ascending (xs < sm < md < lg)', () => {
    expect(NODE_MIN_WIDTH_XS).toBeLessThan(NODE_MIN_WIDTH_SM);
    expect(NODE_MIN_WIDTH_SM).toBeLessThan(NODE_MIN_WIDTH_MD);
    expect(NODE_MIN_WIDTH_MD).toBeLessThan(NODE_MIN_WIDTH_LG);
  });

  it('NODE_MIN_HEIGHT is a positive number', () => {
    expect(NODE_MIN_HEIGHT).toBeGreaterThan(0);
  });
});
