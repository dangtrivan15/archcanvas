import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkNodeDefUpdates } from '@/core/registry/updateChecker';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkNodeDefUpdates', () => {
  it('returns a map of entries where latestVersion differs from locked version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updates: [
          { namespace: 'community', name: 'kubernetes-deployment', latestVersion: '2.0.0' },
          { namespace: 'alice', name: 'my-service', latestVersion: '1.1.0' },
        ],
      }),
    }));

    const locked = new Map([
      ['community/kubernetes-deployment', '1.0.0'],
      ['alice/my-service', '1.1.0'], // same version — should be excluded
    ]);

    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(1);
    expect(updates.get('community/kubernetes-deployment')).toBe('2.0.0');
    expect(updates.has('alice/my-service')).toBe(false);
  });

  it('returns empty map on network error (silent failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const locked = new Map([['community/my-node', '1.0.0']]);
    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(0);
  });

  it('returns empty map on non-OK HTTP response (silent failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }));

    const locked = new Map([['community/my-node', '1.0.0']]);
    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(0);
  });

  it('returns empty map on unexpected response shape (silent failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ wrongField: [] }),
    }));

    const locked = new Map([['community/my-node', '1.0.0']]);
    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(0);
  });

  it('returns empty map immediately for empty input without making a network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const updates = await checkNodeDefUpdates(new Map());

    expect(updates.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('excludes entries where latestVersion equals the locked version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updates: [
          { namespace: 'ns', name: 'same-version', latestVersion: '1.0.0' },
          { namespace: 'ns', name: 'different-version', latestVersion: '2.0.0' },
        ],
      }),
    }));

    const locked = new Map([
      ['ns/same-version', '1.0.0'],
      ['ns/different-version', '1.5.0'],
    ]);

    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(1);
    expect(updates.get('ns/different-version')).toBe('2.0.0');
    expect(updates.has('ns/same-version')).toBe(false);
  });

  it('returns empty map when AbortSignal is aborted (cancellation treated as silent failure)', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const locked = new Map([['community/my-node', '1.0.0']]);
    const controller = new AbortController();
    const updates = await checkNodeDefUpdates(locked, controller.signal);

    expect(updates.size).toBe(0);
  });

  it('ignores server entries that are not in lockedVersions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updates: [
          { namespace: 'known', name: 'node', latestVersion: '2.0.0' },
          { namespace: 'unknown', name: 'ghost', latestVersion: '5.0.0' }, // not in lockedVersions
        ],
      }),
    }));

    const locked = new Map([['known/node', '1.0.0']]);
    const updates = await checkNodeDefUpdates(locked);

    expect(updates.size).toBe(1);
    expect(updates.get('known/node')).toBe('2.0.0');
    expect(updates.has('unknown/ghost')).toBe(false);
  });
});
