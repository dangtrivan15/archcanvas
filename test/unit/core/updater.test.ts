import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUpdaterStore } from '@/store/updaterStore';
import { checkForUpdate } from '@/core/updater';

// Mock the Tauri plugins — they're not available in test environment
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

describe('updater', () => {
  beforeEach(() => {
    useUpdaterStore.getState().reset();
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Clean up Tauri detection
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  describe('when not in Tauri environment', () => {
    it('checkForUpdate is a no-op', async () => {
      await checkForUpdate();
      expect(useUpdaterStore.getState().status).toBe('idle');
    });
  });

  describe('when in Tauri environment', () => {
    beforeEach(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    });

    it('sets status to update-available when update exists', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockResolvedValue({
        version: '1.0.0',
        date: '2026-03-24',
        body: 'Release notes',
        downloadAndInstall: vi.fn(),
      } as never);

      await checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('update-available');
      expect(state.version).toBe('1.0.0');
    });

    it('sets status to up-to-date when no update', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockResolvedValue(null as never);

      await checkForUpdate();

      expect(useUpdaterStore.getState().status).toBe('up-to-date');
    });

    it('sets error on check failure', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      await checkForUpdate();

      const state = useUpdaterStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('Network error');
    });
  });
});
