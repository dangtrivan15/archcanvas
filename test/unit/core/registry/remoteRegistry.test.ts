import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchRegistry,
  fetchNodeDefYaml,
  publishNodeDef,
  PublishError,
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
