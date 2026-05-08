import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/core/registry/remoteRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/registry/remoteRegistry')>();
  return {
    ...actual,
    fetchRegistryStats: vi.fn(),
  };
});

// Also mock things needed by initialize:
vi.mock('@/core/registry', () => ({
  loadBuiltins: vi.fn().mockReturnValue(new Map()),
  loadProjectLocal: vi.fn().mockResolvedValue({ nodeDefs: new Map(), remoteInstalledNodeDefs: new Map(), remoteOfficialNodeDefs: new Map(), errors: [] }),
  createRegistry: vi.fn().mockReturnValue({ registry: { list: () => [], resolve: () => undefined, search: () => [], listByNamespace: () => [], warnings: [] }, warnings: [] }),
}));
vi.mock('@/core/registry/lockfile', () => ({
  loadLockfile: vi.fn().mockResolvedValue(null),
  saveLockfile: vi.fn().mockResolvedValue(undefined),
  generateLockfile: vi.fn().mockReturnValue({ entries: {} }),
}));
vi.mock('@/core/registry/officialSync', () => ({
  syncOfficialNodeDefs: vi.fn().mockResolvedValue(false),
}));

import { useRegistryStore } from '@/store/registryStore';
import { fetchRegistryStats } from '@/core/registry/remoteRegistry';

describe('registryStore remoteStatus', () => {
  beforeEach(() => {
    useRegistryStore.setState({
      remoteStatus: 'unknown',
      communityTotalCount: 0,
    });
    vi.clearAllMocks();
  });

  it('fetchRemoteRegistryStatus sets online and communityTotalCount on success', async () => {
    vi.mocked(fetchRegistryStats).mockResolvedValue({ totalNodeDefs: 42, totalNamespaces: 5, totalDownloads: 1000 });
    await useRegistryStore.getState().fetchRemoteRegistryStatus();
    const state = useRegistryStore.getState();
    expect(state.remoteStatus).toBe('online');
    expect(state.communityTotalCount).toBe(42);
  });

  it('fetchRemoteRegistryStatus sets offline on network error', async () => {
    vi.mocked(fetchRegistryStats).mockRejectedValue(new Error('Network error'));
    await useRegistryStore.getState().fetchRemoteRegistryStatus();
    expect(useRegistryStore.getState().remoteStatus).toBe('offline');
  });

  it('disposeRemoteStatus stops polling interval', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchRegistryStats).mockResolvedValue({ totalNodeDefs: 10, totalNamespaces: 2, totalDownloads: 100 });

    // Start the polling interval
    useRegistryStore.getState().initialize();
    await vi.runAllMicrotasksAsync();

    const callCountAfterInit = vi.mocked(fetchRegistryStats).mock.calls.length;

    // Dispose the polling interval
    useRegistryStore.getState().disposeRemoteStatus();

    // Advance timers by 6 minutes — no additional calls should occur
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);

    expect(vi.mocked(fetchRegistryStats).mock.calls.length).toBe(callCountAfterInit);

    vi.useRealTimers();
  });

  it('disposeRemoteStatus does not throw when no interval exists', () => {
    expect(() => useRegistryStore.getState().disposeRemoteStatus()).not.toThrow();
  });
});
