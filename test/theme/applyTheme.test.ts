import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTheme, camelToKebab, resolveMode, subscribeToSystemMode } from '@/core/theme/applyTheme';
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

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
  });

  it('sets --color-background on html', () => {
    applyTheme(archcanvas, 'dark', 'medium');
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe(archcanvas.dark.background);
  });

  it('sets --color-node-bg on html', () => {
    applyTheme(archcanvas, 'light', 'medium');
    expect(document.documentElement.style.getPropertyValue('--color-node-bg')).toBe(archcanvas.light.nodeBg);
  });

  it('sets font-size for small', () => {
    applyTheme(archcanvas, 'dark', 'small');
    expect(document.documentElement.style.fontSize).toBe('13px');
  });

  it('sets font-size for medium', () => {
    applyTheme(archcanvas, 'dark', 'medium');
    expect(document.documentElement.style.fontSize).toBe('15px');
  });

  it('sets font-size for large', () => {
    applyTheme(archcanvas, 'dark', 'large');
    expect(document.documentElement.style.fontSize).toBe('17px');
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
