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
    vi.useFakeTimers();
    mockTauriRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    useFileStore.setState({ projectPath: null });
  });

  it('persists the current projectPath before calling tauriRelaunch', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    useFileStore.setState({ projectPath: '/home/user/my-project' });

    const promise = relaunch();
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(mockPersist).toHaveBeenCalledWith('/home/user/my-project');
    expect(mockTauriRelaunch).toHaveBeenCalled();

    // Persist must be called BEFORE tauriRelaunch
    const persistOrder = mockPersist.mock.invocationCallOrder[0];
    const relaunchOrder = mockTauriRelaunch.mock.invocationCallOrder[0];
    expect(persistOrder).toBeLessThan(relaunchOrder);
  });

  it('does not call tauriRelaunch until the 200ms flush delay elapses', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    useFileStore.setState({ projectPath: '/home/user/my-project' });

    const promise = relaunch();

    // Persist is called immediately (synchronous)
    expect(mockPersist).toHaveBeenCalledWith('/home/user/my-project');

    // tauriRelaunch should NOT have been called yet — delay hasn't elapsed
    expect(mockTauriRelaunch).not.toHaveBeenCalled();

    // Advance past the 200ms flush delay
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    // Now tauriRelaunch should have been called
    expect(mockTauriRelaunch).toHaveBeenCalled();
  });

  it('calls persistProjectForRestore with null when no project is open', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    useFileStore.setState({ projectPath: null });

    const promise = relaunch();
    await vi.advanceTimersByTimeAsync(200);
    await promise;

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
