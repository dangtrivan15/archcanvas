import { describe, it, expect, beforeEach } from 'vitest';
import { applyLayoutSizing } from '@/core/theme/applyTheme';

describe('applyLayoutSizing', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('sets --toolbar-button-size from state', () => {
    applyLayoutSizing({ toolbarButtonSize: 44, nodeTextScale: 1.167 });
    expect(document.documentElement.style.getPropertyValue('--toolbar-button-size')).toBe('44px');
  });

  it('sets --node-text-scale from state', () => {
    applyLayoutSizing({ toolbarButtonSize: 36, nodeTextScale: 0.833 });
    expect(document.documentElement.style.getPropertyValue('--node-text-scale')).toBe('0.833');
  });

  it('applies balanced defaults', () => {
    applyLayoutSizing({ toolbarButtonSize: 36, nodeTextScale: 1 });
    expect(document.documentElement.style.getPropertyValue('--toolbar-button-size')).toBe('36px');
    expect(document.documentElement.style.getPropertyValue('--node-text-scale')).toBe('1');
  });
});
