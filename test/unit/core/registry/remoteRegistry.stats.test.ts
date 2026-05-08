import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRegistryStats, REGISTRY_BASE_URL } from '@/core/registry/remoteRegistry';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchRegistryStats', () => {
  it('calls correct URL and returns typed RegistryStats', async () => {
    const mockData = { totalNodeDefs: 42, totalNamespaces: 5, totalDownloads: 1000 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const result = await fetchRegistryStats();
    expect(result).toEqual(mockData);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/stats`,
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));
    await expect(fetchRegistryStats()).rejects.toThrow('Failed to fetch registry stats: 503');
  });

  it('throws on malformed response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totalNodeDefs: 'bad', totalNamespaces: 5, totalDownloads: 100 }),
    }));
    await expect(fetchRegistryStats()).rejects.toThrow('unexpected response shape');
  });

  it('forwards AbortSignal to fetch', async () => {
    const mockData = { totalNodeDefs: 10, totalNamespaces: 2, totalDownloads: 50 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));
    const controller = new AbortController();
    await fetchRegistryStats(controller.signal);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
