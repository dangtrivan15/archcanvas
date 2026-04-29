import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  browseRegistry,
  fetchNamespaces,
  fetchNodeDefDetail,
  REGISTRY_BASE_URL,
} from '@/core/registry/remoteRegistry';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('browseRegistry', () => {
  it('calls /api/v1/nodedefs with no params when opts is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    }));

    await browseRegistry({});

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs`,
      expect.objectContaining({}),
    );
  });

  it('includes namespace param when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    }));

    await browseRegistry({ namespace: 'kubernetes' });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('namespace=kubernetes');
  });

  it('includes q param when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    }));

    await browseRegistry({ q: 'my query' });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('q=my+query');
  });

  it('returns items and total from response', async () => {
    const mockItem = {
      namespace: 'k8s',
      name: 'deployment',
      latestVer: '2.0.0',
      tags: ['k8s'],
      downloadCount: 42,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockItem], total: 1 }),
    }));

    const result = await browseRegistry({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0].latestVer).toBe('2.0.0');
    expect(result.total).toBe(1);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(browseRegistry({})).rejects.toThrow('Registry browse failed: 500');
  });

  it('throws when response is missing latestVer field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ namespace: 'k8s', name: 'deployment', version: '1.0.0' }],
        total: 1,
      }),
    }));

    await expect(browseRegistry({})).rejects.toThrow('unexpected response shape');
  });
});

describe('fetchNamespaces', () => {
  it('returns namespaces array from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        namespaces: [
          { namespace: 'kubernetes', count: 8 },
          { namespace: 'aws', count: 15 },
        ],
      }),
    }));

    const result = await fetchNamespaces();
    expect(result).toHaveLength(2);
    expect(result[0].namespace).toBe('kubernetes');
    expect(result[0].count).toBe(8);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchNamespaces()).rejects.toThrow('Failed to fetch namespaces: 404');
  });
});

describe('fetchNodeDefDetail', () => {
  it('returns parsed detail from response', async () => {
    const mockDetail = {
      nodedef: {
        namespace: 'k8s',
        name: 'deployment',
        latestVer: '1.2.0',
        tags: [],
        downloadCount: 100,
      },
      version: {
        nodedefId: 'uuid-1',
        version: '1.2.0',
        blob: {},
        publishedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDetail,
    }));

    const result = await fetchNodeDefDetail('k8s', 'deployment');
    expect(result.nodedef.latestVer).toBe('1.2.0');
    expect(result.version.version).toBe('1.2.0');
  });

  it('calls the correct URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        nodedef: { namespace: 'k8s', name: 'deployment', latestVer: '1.0.0', tags: [], downloadCount: 0 },
        version: { nodedefId: 'x', version: '1.0.0', blob: {}, publishedAt: '2026-01-01T00:00:00.000Z' },
      }),
    }));

    await fetchNodeDefDetail('k8s', 'deployment');

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${REGISTRY_BASE_URL}/api/v1/nodedefs/k8s/deployment`);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchNodeDefDetail('k8s', 'deployment')).rejects.toThrow('Failed to fetch NodeDef detail: 404');
  });
});
