import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchTags,
  REGISTRY_BASE_URL,
} from '@/core/registry/remoteRegistry';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchTags', () => {
  it('calls GET /api/v1/tags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] }),
    }));

    await fetchTags();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${REGISTRY_BASE_URL}/api/v1/tags`,
      { signal: undefined },
    );
  });

  it('returns array of tag+count objects on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: [
          { tag: 'aws', count: 42 },
          { tag: 'kubernetes', count: 31 },
        ],
      }),
    }));

    const result = await fetchTags();
    expect(result).toHaveLength(2);
    expect(result[0].tag).toBe('aws');
    expect(result[0].count).toBe(42);
    expect(typeof result[0].count).toBe('number');
  });

  it('returns empty array when response tags is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] }),
    }));

    const result = await fetchTags();
    expect(result).toHaveLength(0);
  });

  it('throws on non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchTags()).rejects.toThrow('Failed to fetch tags: 404');
  });

  it('throws when response shape is unexpected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wrong: 'shape' }),
    }));

    await expect(fetchTags()).rejects.toThrow('unexpected response shape');
  });
});
