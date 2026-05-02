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

    describe('popup blocked fallback', () => {
      let origLocationDescriptor: PropertyDescriptor | undefined;

      beforeEach(() => {
        origLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
      });

      afterEach(() => {
        if (origLocationDescriptor) {
          Object.defineProperty(window, 'location', origLocationDescriptor);
        }
      });

      it('falls back to window.location.href when popup is blocked', async () => {
        windowOpenSpy.mockReturnValue(null);
        let assignedHref: string | undefined;
        Object.defineProperty(window, 'location', {
          value: {
            ...window.location,
            set href(url: string) { assignedHref = url; },
            get href() { return assignedHref ?? ''; },
          },
          writable: true,
          configurable: true,
        });
        const launcher = createUrlLauncher();
        await launcher.open('https://example.com');
        expect(assignedHref).toBe('https://example.com');
      });
    });
  });

  describe('TauriUrlLauncher', () => {
    beforeEach(() => {
      (window as any).__TAURI_INTERNALS__ = {};
    });

    afterEach(() => {
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('selects TauriUrlLauncher when __TAURI_INTERNALS__ is present', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      // TauriUrlLauncher uses dynamic import('@tauri-apps/plugin-shell') which will
      // reject in test environment — that's fine, we just need to verify window.open
      // was NOT called (we catch the import rejection below)
      const launcher = createUrlLauncher();
      try { await launcher.open('https://example.com'); } catch { /* tauri import fails in test — expected */ }
      expect(windowOpenSpy).not.toHaveBeenCalled();
      windowOpenSpy.mockRestore();
    });
  });
});
