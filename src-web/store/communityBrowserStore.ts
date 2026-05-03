import { create } from 'zustand';
import {
  browseRegistry,
  fetchNamespaces,
  fetchTags,
  fetchNodeDefDetail,
  fetchNodeDefVersions,
} from '@/core/registry/remoteRegistry';
import type { RemoteNodeDefSummary, RemoteNodeDefDetail, RemoteVersionSummary, SortOption } from '@/core/registry/remoteRegistry';

interface CommunityBrowserState {
  query: string;
  namespace: string | null;
  sort: SortOption;
  results: RemoteNodeDefSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedKey: string | null;
  selectedDetail: RemoteNodeDefDetail | null;
  detailLoading: boolean;
  namespaces: Array<{ namespace: string; count: number }>;
  namespacesLoading: boolean;
  tag: string | null;
  tags: Array<{ tag: string; count: number }>;
  tagsLoading: boolean;
  versionHistory: RemoteVersionSummary[] | null;
  versionHistoryLoading: boolean;
  versionHistoryError: string | null;

  setQuery: (query: string) => void;
  setNamespace: (namespace: string | null) => void;
  setSort: (sort: SortOption) => void;
  setTag: (tag: string | null) => void;
  initFromUrl: () => void;
  selectNodeDef: (key: string | null) => void;
  loadNamespaces: () => Promise<void>;
  loadTags: () => Promise<void>;
  loadVersionHistory: (namespace: string, name: string) => Promise<void>;
}

const DEFAULT_SORT = 'downloads' as const satisfies SortOption;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;
let detailAbortController: AbortController | undefined;
let versionsAbortController: AbortController | undefined;

/** Synchronously updates the browser URL without a navigation event. */
function _syncUrl(query: string, namespace: string | null, sort: SortOption, tag: string | null): void {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (namespace) params.set('namespace', namespace);
  if (sort !== DEFAULT_SORT) params.set('sort', sort); // omit default to keep URLs clean
  if (tag) params.set('tag', tag);
  const search = params.toString();
  history.replaceState(null, '', search ? '?' + search : window.location.pathname);
}

/** Parses and validates the sort param from a raw URL search string. */
function parseSortParam(raw: string | null): SortOption {
  if (raw === 'recent' || raw === 'name') return raw;
  return DEFAULT_SORT; // default and fallback for any invalid value
}

export const useCommunityBrowserStore = create<CommunityBrowserState>((set, get) => {
  const _search = async (query: string, namespace: string | null, sort: SortOption, tag: string | null): Promise<void> => {
    // Cancel in-flight request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    set({ loading: true, error: null });
    try {
      const result = await browseRegistry(
        { q: query || undefined, namespace: namespace ?? undefined, tag: tag ?? undefined, sort: sort !== DEFAULT_SORT ? sort : undefined },
        signal,
      );
      set({ results: result.items, total: result.total, loading: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return {
    query: '',
    namespace: null,
    sort: DEFAULT_SORT,
    results: [],
    total: 0,
    loading: false,
    error: null,
    selectedKey: null,
    selectedDetail: null,
    detailLoading: false,
    namespaces: [],
    namespacesLoading: false,
    tag: null,
    tags: [],
    tagsLoading: false,
    versionHistory: null,
    versionHistoryLoading: false,
    versionHistoryError: null,

    setQuery: (query: string) => {
      set({ query });
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        const { namespace, sort, tag } = get();
        _syncUrl(query, namespace, sort, tag);
        _search(query, namespace, sort, tag);
      }, 300);
    },

    setNamespace: (namespace: string | null) => {
      set({ namespace });
      const { query, sort, tag } = get();
      _syncUrl(query, namespace, sort, tag);
      _search(query, namespace, sort, tag);
    },

    setSort: (sort: SortOption) => {
      set({ sort });
      const { query, namespace, tag } = get();
      _syncUrl(query, namespace, sort, tag);
      _search(query, namespace, sort, tag);
    },

    setTag: (tag: string | null) => {
      set({ tag });
      const { query, namespace, sort } = get();
      _syncUrl(query, namespace, sort, tag);
      _search(query, namespace, sort, tag);
    },

    initFromUrl: () => {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q') ?? '';
      const namespace = params.get('namespace') ?? null;
      const sort = parseSortParam(params.get('sort'));
      const tag = params.get('tag') ?? null;
      set({ query, namespace, sort, tag });
      _search(query, namespace, sort, tag);
    },

    selectNodeDef: (key: string | null) => {
      // Cancel any in-flight detail request
      if (detailAbortController) {
        detailAbortController.abort();
      }
      if (versionsAbortController) {
        versionsAbortController.abort();
        versionsAbortController = undefined;
      }
      if (!key) {
        detailAbortController = undefined;
        set({ selectedKey: null, selectedDetail: null, detailLoading: false, versionHistory: null, versionHistoryLoading: false, versionHistoryError: null });
        return;
      }
      detailAbortController = new AbortController();
      const signal = detailAbortController.signal;
      set({ selectedKey: key, selectedDetail: null, detailLoading: true });
      const [namespace, name] = key.split('/');
      if (!namespace || !name) {
        detailAbortController = undefined;
        set({ detailLoading: false, error: `Invalid node key: "${key}" — expected "namespace/name" format`, versionHistory: null, versionHistoryLoading: false, versionHistoryError: null });
        return;
      }
      get().loadVersionHistory(namespace, name); // fire-and-forget
      fetchNodeDefDetail(namespace, name, signal)
        .then((detail) => set({ selectedDetail: detail, detailLoading: false }))
        .catch((err) => {
          // A new selectNodeDef call aborted this request — a replacement fetch is already in flight
          if (err instanceof DOMException && err.name === 'AbortError') return;
          set({ detailLoading: false, error: err instanceof Error ? err.message : String(err) });
        });
    },

    loadNamespaces: async () => {
      set({ namespacesLoading: true });
      try {
        const namespaces = await fetchNamespaces();
        set({ namespaces, namespacesLoading: false });
      } catch (err) {
        set({
          namespacesLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },

    loadTags: async () => {
      set({ tagsLoading: true });
      try {
        const tags = await fetchTags();
        set({ tags, tagsLoading: false });
      } catch {
        // Silent degradation: do NOT set shared `error` state.
        // TagFilter renders null when tags.length === 0, so a missing
        // /api/v1/tags endpoint simply hides the filter with no user-visible error.
        set({ tagsLoading: false });
      }
    },

    loadVersionHistory: async (namespace, name) => {
      if (versionsAbortController) versionsAbortController.abort();
      versionsAbortController = new AbortController();
      const signal = versionsAbortController.signal;
      set({ versionHistoryLoading: true, versionHistory: null, versionHistoryError: null });
      try {
        const versions = await fetchNodeDefVersions(namespace, name, signal);
        set({ versionHistory: versions, versionHistoryLoading: false });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        set({
          versionHistoryLoading: false,
          versionHistoryError: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
});
