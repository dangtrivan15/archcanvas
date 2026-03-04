/**
 * Tests for src/core/platform/clipboardAdapter.ts
 *
 * Feature #281: ClipboardAdapter for cross-platform clipboard access
 *
 * Verifies that the clipboard adapter correctly wraps navigator.clipboard
 * on web and @capacitor/clipboard on native, with proper fallback behavior.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @capacitor/core for platform detection
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
    getPlatform: vi.fn().mockReturnValue('web'),
  },
}));

// Mock @capacitor/clipboard for native tests
vi.mock('@capacitor/clipboard', () => ({
  Clipboard: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import {
  WebClipboardAdapter,
  NativeClipboardAdapter,
  getClipboardAdapter,
  _resetClipboardAdapter,
} from '@/core/platform/clipboardAdapter';
import type { ClipboardAdapter } from '@/core/platform/clipboardAdapter';

const mockCapacitor = Capacitor as unknown as {
  isNativePlatform: ReturnType<typeof vi.fn>;
  getPlatform: ReturnType<typeof vi.fn>;
};

const mockClipboard = Clipboard as unknown as {
  write: ReturnType<typeof vi.fn>;
};

/** Helper to mock navigator.clipboard (read-only in happy-dom) */
function mockNavigatorClipboard(writeTextFn: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextFn },
    writable: true,
    configurable: true,
  });
}

describe('Feature #281: ClipboardAdapter for cross-platform clipboard access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetClipboardAdapter();
    mockCapacitor.isNativePlatform.mockReturnValue(false);
    mockCapacitor.getPlatform.mockReturnValue('web');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Source structure ─────────────────────────────────────────

  describe('Source structure', () => {
    it('exports WebClipboardAdapter class', () => {
      expect(typeof WebClipboardAdapter).toBe('function');
    });

    it('exports NativeClipboardAdapter class', () => {
      expect(typeof NativeClipboardAdapter).toBe('function');
    });

    it('exports getClipboardAdapter factory function', () => {
      expect(typeof getClipboardAdapter).toBe('function');
    });

    it('exports _resetClipboardAdapter for testing', () => {
      expect(typeof _resetClipboardAdapter).toBe('function');
    });

    it('WebClipboardAdapter has copyText method', () => {
      const adapter = new WebClipboardAdapter();
      expect(typeof adapter.copyText).toBe('function');
    });

    it('NativeClipboardAdapter has copyText method', () => {
      const adapter = new NativeClipboardAdapter();
      expect(typeof adapter.copyText).toBe('function');
    });

    it('WebClipboardAdapter implements ClipboardAdapter interface', () => {
      const adapter: ClipboardAdapter = new WebClipboardAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.copyText).toBe('function');
    });

    it('NativeClipboardAdapter implements ClipboardAdapter interface', () => {
      const adapter: ClipboardAdapter = new NativeClipboardAdapter();
      expect(adapter).toBeDefined();
      expect(typeof adapter.copyText).toBe('function');
    });
  });

  // ─── WebClipboardAdapter ──────────────────────────────────────

  describe('WebClipboardAdapter', () => {
    let adapter: WebClipboardAdapter;

    beforeEach(() => {
      adapter = new WebClipboardAdapter();
    });

    it('calls navigator.clipboard.writeText with the text', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      mockNavigatorClipboard(mockWriteText);

      await adapter.copyText('hello world');
      expect(mockWriteText).toHaveBeenCalledWith('hello world');
    });

    it('copies empty string', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      mockNavigatorClipboard(mockWriteText);

      await adapter.copyText('');
      expect(mockWriteText).toHaveBeenCalledWith('');
    });

    it('copies text with special characters', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      mockNavigatorClipboard(mockWriteText);

      const specialText = 'src/api/auth.ts\n// comment "quoted"';
      await adapter.copyText(specialText);
      expect(mockWriteText).toHaveBeenCalledWith(specialText);
    });

    it('falls back to textarea+execCommand when navigator.clipboard throws', async () => {
      // Make navigator.clipboard.writeText throw
      mockNavigatorClipboard(
        vi.fn().mockRejectedValue(new Error('Not allowed')),
      );

      // Mock DOM methods for the fallback
      const mockTextarea = {
        value: '',
        style: {} as Record<string, string>,
        select: vi.fn(),
      };
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(mockTextarea as unknown as HTMLElement);
      const appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockReturnValue(mockTextarea as unknown as HTMLElement);
      const removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockReturnValue(mockTextarea as unknown as HTMLElement);
      // happy-dom lacks execCommand; define it before spying
      if (!document.execCommand) {
        (document as Record<string, unknown>).execCommand = () => true;
      }
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true);

      await adapter.copyText('fallback text');

      expect(createElementSpy).toHaveBeenCalledWith('textarea');
      expect(mockTextarea.value).toBe('fallback text');
      expect(mockTextarea.select).toHaveBeenCalled();
      expect(execCommandSpy).toHaveBeenCalledWith('copy');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('fallback textarea is positioned off-screen', async () => {
      mockNavigatorClipboard(
        vi.fn().mockRejectedValue(new Error('Not allowed')),
      );

      const mockTextarea = {
        value: '',
        style: {} as Record<string, string>,
        select: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(
        mockTextarea as unknown as HTMLElement,
      );
      vi.spyOn(document.body, 'appendChild').mockReturnValue(
        mockTextarea as unknown as HTMLElement,
      );
      vi.spyOn(document.body, 'removeChild').mockReturnValue(
        mockTextarea as unknown as HTMLElement,
      );
      if (!document.execCommand) {
        (document as Record<string, unknown>).execCommand = () => true;
      }
      vi.spyOn(document, 'execCommand').mockReturnValue(true);

      await adapter.copyText('text');

      expect(mockTextarea.style.position).toBe('fixed');
      expect(mockTextarea.style.opacity).toBe('0');
    });

    it('copyText returns a promise', () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      mockNavigatorClipboard(mockWriteText);

      const result = adapter.copyText('test');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  // ─── NativeClipboardAdapter ───────────────────────────────────

  describe('NativeClipboardAdapter', () => {
    let adapter: NativeClipboardAdapter;

    beforeEach(() => {
      adapter = new NativeClipboardAdapter();
      mockClipboard.write.mockClear();
    });

    it('calls Clipboard.write with { string: text }', async () => {
      await adapter.copyText('native text');
      expect(mockClipboard.write).toHaveBeenCalledWith({
        string: 'native text',
      });
    });

    it('copies empty string on native', async () => {
      await adapter.copyText('');
      expect(mockClipboard.write).toHaveBeenCalledWith({ string: '' });
    });

    it('copies text with special characters on native', async () => {
      const specialText = 'path/to/file.ts\n// "quoted"';
      await adapter.copyText(specialText);
      expect(mockClipboard.write).toHaveBeenCalledWith({
        string: specialText,
      });
    });

    it('propagates errors from Capacitor Clipboard', async () => {
      mockClipboard.write.mockRejectedValueOnce(new Error('Write failed'));
      await expect(adapter.copyText('text')).rejects.toThrow('Write failed');
    });

    it('copyText returns a promise', () => {
      const result = adapter.copyText('test');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  // ─── Factory (getClipboardAdapter) ────────────────────────────

  describe('getClipboardAdapter factory', () => {
    it('returns WebClipboardAdapter on web', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      const adapter = getClipboardAdapter();
      expect(adapter).toBeInstanceOf(WebClipboardAdapter);
    });

    it('returns NativeClipboardAdapter on native', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(true);
      const adapter = getClipboardAdapter();
      expect(adapter).toBeInstanceOf(NativeClipboardAdapter);
    });

    it('caches the adapter instance (singleton)', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      const first = getClipboardAdapter();
      const second = getClipboardAdapter();
      expect(first).toBe(second);
    });

    it('_resetClipboardAdapter clears the cache', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      const first = getClipboardAdapter();
      _resetClipboardAdapter();
      const second = getClipboardAdapter();
      expect(second).toBeInstanceOf(WebClipboardAdapter);
    });

    it('returns different types based on platform', () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      const webAdapter = getClipboardAdapter();
      expect(webAdapter).toBeInstanceOf(WebClipboardAdapter);

      _resetClipboardAdapter();
      mockCapacitor.isNativePlatform.mockReturnValue(true);
      const nativeAdapter = getClipboardAdapter();
      expect(nativeAdapter).toBeInstanceOf(NativeClipboardAdapter);
    });

    it('is synchronous (not async like FileSystemAdapter)', () => {
      const result = getClipboardAdapter();
      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof result.copyText).toBe('function');
    });
  });

  // ─── Integration with NodeDetailPanel ─────────────────────────

  describe('Integration: NodeDetailPanel clipboard usage', () => {
    it('clipboardAdapter module can be imported', async () => {
      const mod = await import('@/core/platform/clipboardAdapter');
      expect(mod.getClipboardAdapter).toBeDefined();
      expect(mod.WebClipboardAdapter).toBeDefined();
      expect(mod.NativeClipboardAdapter).toBeDefined();
    });

    it('getClipboardAdapter().copyText is callable', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      mockNavigatorClipboard(mockWriteText);

      const adapter = getClipboardAdapter();
      await adapter.copyText('src/api/auth.ts');
      expect(mockWriteText).toHaveBeenCalledWith('src/api/auth.ts');
    });
  });
});
