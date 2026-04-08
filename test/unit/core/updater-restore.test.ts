import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { relaunch } from '@/core/updater';

// Mock the Tauri plugins — they're not available in test environment
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

const mockTauriRelaunch = vi.fn();
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockTauriRelaunch(...args),
}));

// Mock restoreProject so we can verify the call without touching real localStorage
const mockPersist = vi.fn();
vi.mock('@/core/restoreProject', () => ({
  persistProjectForRestore: (...args: unknown[]) => mockPersist(...args),
}));

describe('relaunch – project restore integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTauriRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    useFileStore.setState({ projectPath: null });
  });

  it('persists the current projectPath before calling tauriRelaunch', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    useFileStore.setState({ projectPath: '/home/user/my-project' });

    await relaunch();

    expect(mockPersist).toHaveBeenCalledWith('/home/user/my-project');
    expect(mockTauriRelaunch).toHaveBeenCalled();

    // Persist must be called BEFORE tauriRelaunch
    const persistOrder = mockPersist.mock.invocationCallOrder[0];
    const relaunchOrder = mockTauriRelaunch.mock.invocationCallOrder[0];
    expect(persistOrder).toBeLessThan(relaunchOrder);
  });

  it('calls persistProjectForRestore with null when no project is open', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    useFileStore.setState({ projectPath: null });

    await relaunch();

    expect(mockPersist).toHaveBeenCalledWith(null);
    expect(mockTauriRelaunch).toHaveBeenCalled();
  });

  it('is a no-op outside Tauri environment', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

    await relaunch();

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockTauriRelaunch).not.toHaveBeenCalled();
  });
});
