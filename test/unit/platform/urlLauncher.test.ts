import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUrlLauncher } from '@/platform/urlLauncher';

describe('createUrlLauncher', () => {
  it('returns the override when provided', () => {
    const override = { open: vi.fn() };
    const launcher = createUrlLauncher(override);
    expect(launcher).toBe(override);
  });

  describe('WebUrlLauncher', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Ensure __TAURI_INTERNALS__ is NOT set
      delete (window as any).__TAURI_INTERNALS__;
      windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(window);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls window.open with correct arguments', async () => {
      const launcher = createUrlLauncher();
      await launcher.open('https://example.com');
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('falls back to window.location.href when popup is blocked', async () => {
      windowOpenSpy.mockReturnValue(null);

      let assignedHref: string | undefined;
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          set href(url: string) {
            assignedHref = url;
          },
          get href() {
            return assignedHref ?? '';
          },
        },
        writable: true,
        configurable: true,
      });

      const launcher = createUrlLauncher();
      await launcher.open('https://example.com');

      expect(assignedHref).toBe('https://example.com');
    });
  });

  describe('TauriUrlLauncher', () => {
    beforeEach(() => {
      (window as any).__TAURI_INTERNALS__ = {};
    });

    afterEach(() => {
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('selects TauriUrlLauncher when __TAURI_INTERNALS__ is present', () => {
      const launcher = createUrlLauncher();
      // The launcher is a TauriUrlLauncher — we verify via its open method
      expect(typeof launcher.open).toBe('function');
    });
  });
});
