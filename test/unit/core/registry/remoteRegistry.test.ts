import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchRegistry,
  fetchNodeDefYaml,
  REGISTRY_BASE_URL,
} from '@/core/registry/remoteRegistry';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// searchRegistry
// ---------------------------------------------------------------------------

describe('searchRegistry', () => {
  it('returns RemoteNodeDefSummary[] from array response', async () => {
    const mockData = [
      { namespace: 'community', name: 'kubernetes-deployment', version: '1.0.0', displayName: 'K8s Deployment' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const results = await searchRegistry('kubernetes');
    expect(results).toHaveLength(1);
    expect(results[0].namespace).toBe('community');
    expect(results[0].name).toBe('kubernetes-deployment');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/search?q=kubernetes`,
      expect.objectContaining({}),
    );
  });

  it('normalises { results: [...] } response shape', async () => {
    const mockData = {
      results: [
        { namespace: 'community', name: 'my-node', version: '2.0.0' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const results = await searchRegistry('my-node');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('my-node');
  });

  it('returns empty array for { results: undefined }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ other: 'field' }),
    }));

    const results = await searchRegistry('anything');
    expect(results).toHaveLength(0);
  });

  it('throws on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    await expect(searchRegistry('fail')).rejects.toThrow('Registry search failed: 503');
  });

  it('propagates non-AbortError errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));

    await expect(searchRegistry('fail')).rejects.toThrow('network error');
  });

  it('propagates AbortError from signal', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const controller = new AbortController();
    await expect(searchRegistry('query', controller.signal)).rejects.toThrow('Aborted');
  });

  it('passes signal to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));

    const controller = new AbortController();
    await searchRegistry('test', controller.signal);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

// ---------------------------------------------------------------------------
// fetchNodeDefYaml
// ---------------------------------------------------------------------------

describe('fetchNodeDefYaml', () => {
  it('returns text from mocked fetch', async () => {
    const yamlContent = 'kind: NodeDef\napiVersion: v1';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => yamlContent,
    }));

    const result = await fetchNodeDefYaml('community', 'my-node', '1.0.0');
    expect(result).toBe(yamlContent);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs/community/my-node/1.0.0/yaml`,
      expect.objectContaining({}),
    );
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(fetchNodeDefYaml('ns', 'name', '1.0.0')).rejects.toThrow(
      'Failed to fetch NodeDef YAML: 404',
    );
  });

  it('passes signal to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    }));

    const controller = new AbortController();
    await fetchNodeDefYaml('ns', 'name', '1.0.0', controller.signal);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('encodes path segments with encodeURIComponent', async () => {
    // SemVer build metadata like "1.0.0+build.100" contains "+" which must be encoded
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    }));

    await fetchNodeDefYaml('my ns', 'my+node', '1.0.0+build.100');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs/${encodeURIComponent('my ns')}/${encodeURIComponent('my+node')}/${encodeURIComponent('1.0.0+build.100')}/yaml`,
      expect.objectContaining({}),
    );
  });
});
