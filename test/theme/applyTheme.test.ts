import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, camelToKebab, resolveMode, subscribeToSystemMode, uiScaleToFontSize } from '@/core/theme/applyTheme';
import { archcanvas } from '@/core/theme/palettes/archcanvas';

// jsdom doesn't provide matchMedia — stub it for all tests
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as MediaQueryList);

vi.stubGlobal('matchMedia', matchMediaMock);

describe('camelToKebab', () => {
  it('converts simple camelCase', () => {
    expect(camelToKebab('cardForeground')).toBe('card-foreground');
  });
  it('converts multi-segment', () => {
    expect(camelToKebab('nodeSelectedBorder')).toBe('node-selected-border');
  });
  it('handles single word', () => {
    expect(camelToKebab('background')).toBe('background');
  });
});

describe('resolveMode', () => {
  it('returns light when mode is light', () => {
    expect(resolveMode('light')).toBe('light');
  });
  it('returns dark when mode is dark', () => {
    expect(resolveMode('dark')).toBe('dark');
  });
  it('returns light when system and prefers-color-scheme is light', () => {
    matchMediaMock.mockReturnValue({ matches: false } as unknown as MediaQueryList);
    expect(resolveMode('system')).toBe('light');
  });
  it('returns dark when system and prefers-color-scheme is dark', () => {
    matchMediaMock.mockReturnValue({ matches: true } as unknown as MediaQueryList);
    expect(resolveMode('system')).toBe('dark');
  });
});

describe('uiScaleToFontSize', () => {
  it('converts 100% to 16px', () => {
    expect(uiScaleToFontSize(100)).toBe('16px');
  });
  it('converts 80% to 12.8px', () => {
    expect(uiScaleToFontSize(80)).toBe('12.8px');
  });
  it('converts 150% to 24px', () => {
    expect(uiScaleToFontSize(150)).toBe('24px');
  });
  it('converts 120% to 19.2px', () => {
    expect(uiScaleToFontSize(120)).toBe('19.2px');
  });
  it('clamps below-minimum input to 80% (12.8px)', () => {
    expect(uiScaleToFontSize(50)).toBe('12.8px');
  });
  it('clamps above-maximum input to 150% (24px)', () => {
    expect(uiScaleToFontSize(200)).toBe('24px');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('sets --color-background on html', () => {
    applyTheme(archcanvas, 'dark', 100);
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(archcanvas.dark.background);
  });

  it('sets --color-node-bg on html', () => {
    applyTheme(archcanvas, 'light', 100);
    expect(document.documentElement.style.getPropertyValue('--color-node-bg')).toBe(archcanvas.light.nodeBg);
  });

  it('sets font-size for scale 80', () => {
    applyTheme(archcanvas, 'dark', 80);
    expect(document.documentElement.style.fontSize).toBe('12.8px');
  });

  it('sets font-size for scale 100 (default)', () => {
    applyTheme(archcanvas, 'dark', 100);
    expect(document.documentElement.style.fontSize).toBe('16px');
  });

  it('sets font-size for scale 150', () => {
    applyTheme(archcanvas, 'dark', 150);
    expect(document.documentElement.style.fontSize).toBe('24px');
  });
});

describe('subscribeToSystemMode', () => {
  it('returns unsubscribe function', () => {
    const mockMql = { addEventListener: vi.fn(), removeEventListener: vi.fn(), matches: false } as unknown as MediaQueryList;
    matchMediaMock.mockReturnValue(mockMql);
    const unsub = subscribeToSystemMode(() => {});
    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unsub();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
