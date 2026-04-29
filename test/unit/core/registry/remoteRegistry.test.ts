import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchRegistry,
  fetchNodeDefYaml,
  publishNodeDef,
  PublishError,
  REGISTRY_BASE_URL,
  checkUpdatesRemote,
} from '@/core/registry/remoteRegistry';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// searchRegistry
// ---------------------------------------------------------------------------

describe('searchRegistry', () => {
  it('calls /api/v1/nodedefs?q=... and returns items array', async () => {
    const mockData = {
      items: [
        { namespace: 'community', name: 'kubernetes-deployment', latestVer: '1.0.0', displayName: 'K8s Deployment', tags: [], downloadCount: 0 },
      ],
      total: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const results = await searchRegistry('kubernetes');
    expect(results).toHaveLength(1);
    expect(results[0].namespace).toBe('community');
    expect(results[0].name).toBe('kubernetes-deployment');
    expect(results[0].latestVer).toBe('1.0.0');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs?q=kubernetes`,
      expect.objectContaining({ signal: undefined }),
    );
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
      json: async () => ({ items: [], total: 0 }),
    }));

    const controller = new AbortController();
    await searchRegistry('test', controller.signal);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('throws when response shape is unexpected (missing items field)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }));

    await expect(searchRegistry('test')).rejects.toThrow('unexpected response shape');
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

// ---------------------------------------------------------------------------
// publishNodeDef
// ---------------------------------------------------------------------------

const mockPayload = {
  namespace: 'alice',
  name: 'my-widget',
  displayName: 'My Widget',
  description: 'A test widget',
  tags: ['infra', 'test'],
  version: '1.2.3',
  blob: { kind: 'NodeDef', apiVersion: 'v1', metadata: {} } as Record<string, unknown>,
};

describe('publishNodeDef', () => {
  it('posts to /api/v1/nodedefs (no path params) with the correct body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await publishNodeDef(mockPayload, 'my-token');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(mockPayload),
      }),
    );
  });

  it('resolves without throwing on 2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await expect(publishNodeDef(mockPayload, 'token')).resolves.toBeUndefined();
  });

  it('throws PublishError with status 401 on unauthorized response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    }));

    await expect(publishNodeDef(mockPayload, 'bad-token')).rejects.toMatchObject({
      name: 'PublishError',
      statusCode: 401,
    });
  });

  it('uses body.message over body.error in error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'publish_failed', message: 'Namespace is owned by another user' }),
    }));

    const err = await publishNodeDef(mockPayload, 'token').catch((e) => e) as PublishError;
    expect(err).toBeInstanceOf(PublishError);
    expect(err.message).toBe('Namespace is owned by another user');
    expect(err.statusCode).toBe(403);
  });

  it('falls back to body.error when message is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_body' }),
    }));

    const err = await publishNodeDef(mockPayload, 'token').catch((e) => e) as PublishError;
    expect(err).toBeInstanceOf(PublishError);
    expect(err.message).toBe('invalid_body');
  });

  it('uses a generic message when response body cannot be parsed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    }));

    const err = await publishNodeDef(mockPayload, 'token').catch((e) => e) as PublishError;
    expect(err).toBeInstanceOf(PublishError);
    expect(err.message).toContain('500');
    expect(err.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// checkUpdatesRemote
// ---------------------------------------------------------------------------

describe('checkUpdatesRemote', () => {
  it('posts to /api/v1/nodedefs/check-updates and returns updates array', async () => {
    const mockResponse = {
      updates: [
        { namespace: 'community', name: 'kubernetes-deployment', latestVersion: '2.1.0' },
        { namespace: 'alice', name: 'my-service', latestVersion: '1.0.0' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const entries = [
      { namespace: 'community', name: 'kubernetes-deployment' },
      { namespace: 'alice', name: 'my-service' },
    ];
    const results = await checkUpdatesRemote(entries);

    expect(results).toHaveLength(2);
    expect(results[0].latestVersion).toBe('2.1.0');
    expect(results[1].latestVersion).toBe('1.0.0');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/nodedefs/check-updates`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ entries }),
      }),
    );
  });

  it('throws on non-OK HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    await expect(checkUpdatesRemote([{ namespace: 'ns', name: 'n' }])).rejects.toThrow('check-updates failed: 503');
  });

  it('passes AbortSignal to fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updates: [] }),
    }));

    const controller = new AbortController();
    await checkUpdatesRemote([{ namespace: 'ns', name: 'n' }], controller.signal);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('throws on unexpected response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wrongField: [] }),
    }));

    await expect(checkUpdatesRemote([{ namespace: 'ns', name: 'n' }])).rejects.toThrow('unexpected shape');
  });
});
