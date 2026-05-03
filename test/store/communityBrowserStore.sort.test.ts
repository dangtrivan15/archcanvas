import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityBrowserStore } from '@/store/communityBrowserStore';

describe('communityBrowserStore — sort', () => {
  beforeEach(() => {
    useCommunityBrowserStore.setState({
      sort: 'downloads',
      query: '',
      namespace: null,
      results: [],
      total: 0,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('setSort updates sort state', () => {
    vi.stubGlobal('location', { search: '' });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) }));

    useCommunityBrowserStore.getState().setSort('recent');
    expect(useCommunityBrowserStore.getState().sort).toBe('recent');
  });

  it('setSort calls replaceState with ?sort=recent', () => {
    vi.stubGlobal('location', { search: '' });
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) }));

    useCommunityBrowserStore.getState().setSort('recent');
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '?sort=recent');
  });

  it('setSort dispatches _search with new sort value', async () => {
    vi.stubGlobal('location', { search: '' });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) });
    vi.stubGlobal('fetch', fetchMock);

    useCommunityBrowserStore.getState().setSort('name');
    // Wait for the async _search to hit fetch
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('sort=name');
  });

  it('setSort with downloads omits sort from URL', () => {
    vi.stubGlobal('location', { search: '' });
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) }));

    useCommunityBrowserStore.getState().setSort('downloads');
    const [, , search] = replaceStateSpy.mock.calls[0];
    expect(String(search)).not.toContain('sort');
  });

  it('initFromUrl reads sort from URL and calls _search with URL values (not defaults)', async () => {
    vi.stubGlobal('location', { search: '?sort=recent&namespace=aws&q=foo' });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) });
    vi.stubGlobal('fetch', fetchMock);

    useCommunityBrowserStore.getState().initFromUrl();

    const state = useCommunityBrowserStore.getState();
    expect(state.sort).toBe('recent');
    expect(state.namespace).toBe('aws');
    expect(state.query).toBe('foo');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('sort=recent');
    expect(calledUrl).toContain('namespace=aws');
    expect(calledUrl).toContain('q=foo');
  });

  it('initFromUrl with invalid sort defaults to downloads', () => {
    vi.stubGlobal('location', { search: '?sort=bogus' });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) }));

    useCommunityBrowserStore.getState().initFromUrl();
    expect(useCommunityBrowserStore.getState().sort).toBe('downloads');
  });

  it('initFromUrl with no sort param defaults to downloads', () => {
    vi.stubGlobal('location', { search: '' });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0 }) }));

    useCommunityBrowserStore.getState().initFromUrl();
    expect(useCommunityBrowserStore.getState().sort).toBe('downloads');
  });
});
