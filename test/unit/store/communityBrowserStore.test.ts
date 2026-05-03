import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';

vi.mock('@/core/registry/remoteRegistry', () => ({
  browseRegistry: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  fetchNamespaces: vi.fn().mockResolvedValue([]),
  fetchNodeDefDetail: vi.fn().mockResolvedValue({
    nodedef: { namespace: 'k8s', name: 'deployment', latestVer: '1.0.0', tags: [], downloadCount: 0 },
    version: { nodedefId: 'x', version: '1.0.0', blob: {}, publishedAt: '2026-01-01T00:00:00.000Z' },
  }),
  fetchNodeDefVersions: vi.fn().mockResolvedValue([]),
}));

import { browseRegistry, fetchNamespaces, fetchNodeDefDetail, fetchNodeDefVersions } from '@/core/registry/remoteRegistry';

beforeEach(() => {
  vi.clearAllMocks();
  useCommunityBrowserStore.setState({
    query: '',
    namespace: null,
    sort: 'downloads' as const,
    results: [],
    total: 0,
    loading: false,
    error: null,
    selectedKey: null,
    selectedDetail: null,
    detailLoading: false,
    namespaces: [],
    namespacesLoading: false,
    versionHistory: null,
    versionHistoryLoading: false,
    versionHistoryError: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('communityBrowserStore', () => {
  describe('setQuery', () => {
    it('debounces _search by 300ms', async () => {
      vi.useFakeTimers();
      const store = useCommunityBrowserStore.getState();
      store.setQuery('kubernetes');

      // Not called yet
      expect(browseRegistry).not.toHaveBeenCalled();

      // Advance 299ms — still not called
      vi.advanceTimersByTime(299);
      expect(browseRegistry).not.toHaveBeenCalled();

      // Advance to 300ms — should fire
      vi.advanceTimersByTime(1);
      // Allow microtasks to run
      await Promise.resolve();
      expect(browseRegistry).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });

    it('cancels previous debounce timer on rapid calls', async () => {
      vi.useFakeTimers();
      const store = useCommunityBrowserStore.getState();

      store.setQuery('kub');
      vi.advanceTimersByTime(100);
      store.setQuery('kube');
      vi.advanceTimersByTime(100);
      store.setQuery('kubernetes');
      vi.advanceTimersByTime(300);

      await Promise.resolve();
      // Only called once with the last query
      expect(browseRegistry).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });
  });

  describe('setNamespace', () => {
    it('triggers immediate search (no debounce)', async () => {
      const store = useCommunityBrowserStore.getState();
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });
      store.setNamespace('kubernetes');
      await Promise.resolve();
      expect(browseRegistry).toHaveBeenCalledOnce();
      expect(vi.mocked(browseRegistry).mock.calls[0][0]).toMatchObject({ namespace: 'kubernetes' });
    });

    it('sets namespace to null when called with null', async () => {
      useCommunityBrowserStore.setState({ namespace: 'kubernetes' });
      const store = useCommunityBrowserStore.getState();
      store.setNamespace(null);
      expect(useCommunityBrowserStore.getState().namespace).toBeNull();
    });
  });

  describe('selectNodeDef', () => {
    it('clears selection when called with null', () => {
      useCommunityBrowserStore.setState({ selectedKey: 'k8s/deployment', selectedDetail: {} as any });
      useCommunityBrowserStore.getState().selectNodeDef(null);
      const state = useCommunityBrowserStore.getState();
      expect(state.selectedKey).toBeNull();
      expect(state.selectedDetail).toBeNull();
    });

    it('sets selectedKey and triggers detail fetch', async () => {
      const store = useCommunityBrowserStore.getState();
      store.selectNodeDef('k8s/deployment');

      expect(useCommunityBrowserStore.getState().selectedKey).toBe('k8s/deployment');
      expect(useCommunityBrowserStore.getState().detailLoading).toBe(true);

      await vi.waitFor(() => {
        expect(useCommunityBrowserStore.getState().detailLoading).toBe(false);
      });

      expect(fetchNodeDefDetail).toHaveBeenCalledWith('k8s', 'deployment', expect.any(AbortSignal));
    });

    it('triggers version history load alongside detail fetch', async () => {
      useCommunityBrowserStore.getState().selectNodeDef('k8s/deployment');

      await vi.waitFor(() => {
        expect(useCommunityBrowserStore.getState().detailLoading).toBe(false);
      });

      expect(fetchNodeDefVersions).toHaveBeenCalledWith('k8s', 'deployment', expect.any(AbortSignal));
    });

    it('sets error and does not call fetchNodeDefDetail when key has no slash', () => {
      useCommunityBrowserStore.getState().selectNodeDef('k8s');
      const state = useCommunityBrowserStore.getState();
      expect(fetchNodeDefDetail).not.toHaveBeenCalled();
      expect(state.detailLoading).toBe(false);
      expect(state.error).toMatch(/invalid node key/i);
    });

    it('sets error and does not call fetchNodeDefDetail when name part is empty (trailing slash)', () => {
      useCommunityBrowserStore.getState().selectNodeDef('k8s/');
      const state = useCommunityBrowserStore.getState();
      expect(fetchNodeDefDetail).not.toHaveBeenCalled();
      expect(state.detailLoading).toBe(false);
      expect(state.error).toMatch(/invalid node key/i);
    });

    it('sets error and does not call fetchNodeDefDetail when namespace part is empty (leading slash)', () => {
      useCommunityBrowserStore.getState().selectNodeDef('/deployment');
      const state = useCommunityBrowserStore.getState();
      expect(fetchNodeDefDetail).not.toHaveBeenCalled();
      expect(state.detailLoading).toBe(false);
      expect(state.error).toMatch(/invalid node key/i);
    });
  });

  describe('loadVersionHistory', () => {
    it('fetches and stores version history on success', async () => {
      const mockVersions = [
        { version: '1.0.0', publishedAt: '2026-01-01T00:00:00.000Z', downloadCount: 5 },
        { version: '0.9.0', publishedAt: '2025-12-01T00:00:00.000Z', downloadCount: 2 },
      ];
      vi.mocked(fetchNodeDefVersions).mockResolvedValue(mockVersions);

      await useCommunityBrowserStore.getState().loadVersionHistory('k8s', 'deployment');

      const state = useCommunityBrowserStore.getState();
      expect(state.versionHistory).toEqual(mockVersions);
      expect(state.versionHistoryLoading).toBe(false);
      expect(state.versionHistoryError).toBeNull();
      expect(fetchNodeDefVersions).toHaveBeenCalledWith('k8s', 'deployment', expect.any(AbortSignal));
    });

    it('sets versionHistoryError and clears loading when fetch fails', async () => {
      vi.mocked(fetchNodeDefVersions).mockRejectedValue(new Error('versions unavailable'));

      await useCommunityBrowserStore.getState().loadVersionHistory('k8s', 'deployment');

      const state = useCommunityBrowserStore.getState();
      expect(state.versionHistoryLoading).toBe(false);
      expect(state.versionHistoryError).toBe('versions unavailable');
      expect(state.versionHistory).toBeNull();
    });

    it('silently ignores AbortError without updating error or loading state', async () => {
      vi.mocked(fetchNodeDefVersions).mockRejectedValue(
        new DOMException('The operation was aborted.', 'AbortError'),
      );

      await useCommunityBrowserStore.getState().loadVersionHistory('k8s', 'deployment');

      const state = useCommunityBrowserStore.getState();
      // AbortError must not populate versionHistoryError
      expect(state.versionHistoryError).toBeNull();
      // versionHistoryLoading was set true at start; an abort leaves it unchanged (no false)
      expect(state.versionHistoryLoading).toBe(true);
    });
  });

  describe('loadNamespaces', () => {
    it('fetches and sets namespaces', async () => {
      vi.mocked(fetchNamespaces).mockResolvedValue([
        { namespace: 'k8s', count: 5 },
        { namespace: 'aws', count: 3 },
      ]);
      await useCommunityBrowserStore.getState().loadNamespaces();
      const state = useCommunityBrowserStore.getState();
      expect(state.namespaces).toHaveLength(2);
      expect(state.namespacesLoading).toBe(false);
    });

    it('clears loading and sets error when fetch fails', async () => {
      vi.mocked(fetchNamespaces).mockRejectedValue(new Error('registry unavailable'));
      await useCommunityBrowserStore.getState().loadNamespaces();
      const state = useCommunityBrowserStore.getState();
      expect(state.namespacesLoading).toBe(false);
      expect(state.error).toBe('registry unavailable');
    });
  });

  describe('_search', () => {
    it('sets loading true then false after search completes', async () => {
      vi.mocked(browseRegistry).mockResolvedValue({ items: [], total: 0 });
      const searchPromise = useCommunityBrowserStore.getState()._search('', null, 'downloads');
      // synchronously check loading
      expect(useCommunityBrowserStore.getState().loading).toBe(true);
      await searchPromise;
      expect(useCommunityBrowserStore.getState().loading).toBe(false);
    });

    it('sets error when search fails', async () => {
      vi.mocked(browseRegistry).mockRejectedValue(new Error('network error'));
      await useCommunityBrowserStore.getState()._search('', null, 'downloads');
      expect(useCommunityBrowserStore.getState().error).toBe('network error');
      expect(useCommunityBrowserStore.getState().loading).toBe(false);
    });
  });
});
