import { create } from 'zustand';
import {
  browseRegistry,
  fetchNamespaces,
  fetchNodeDefDetail,
  fetchNodeDefVersions,
} from '@/core/registry/remoteRegistry';
import type { RemoteNodeDefSummary, RemoteNodeDefDetail, RemoteVersionSummary } from '@/core/registry/remoteRegistry';

interface CommunityBrowserState {
  query: string;
  namespace: string | null;
  results: RemoteNodeDefSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedKey: string | null;
  selectedDetail: RemoteNodeDefDetail | null;
  detailLoading: boolean;
  namespaces: Array<{ namespace: string; count: number }>;
  namespacesLoading: boolean;
  versionHistory: RemoteVersionSummary[] | null;
  versionHistoryLoading: boolean;
  versionHistoryError: string | null;

  setQuery: (query: string) => void;
  setNamespace: (namespace: string | null) => void;
  selectNodeDef: (key: string | null) => void;
  loadNamespaces: () => Promise<void>;
  loadVersionHistory: (namespace: string, name: string) => Promise<void>;
  _search: (query: string, namespace: string | null) => Promise<void>;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;
let detailAbortController: AbortController | undefined;
let versionsAbortController: AbortController | undefined;

export const useCommunityBrowserStore = create<CommunityBrowserState>((set, get) => ({
  query: '',
  namespace: null,
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

  setQuery: (query: string) => {
    set({ query });
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      get()._search(query, get().namespace);
    }, 300);
  },

  setNamespace: (namespace: string | null) => {
    set({ namespace });
    get()._search(get().query, namespace);
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

  _search: async (query: string, namespace: string | null) => {
    // Cancel in-flight request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    set({ loading: true, error: null });
    try {
      const result = await browseRegistry({ q: query || undefined, namespace: namespace ?? undefined }, signal);
      set({ results: result.items, total: result.total, loading: false });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));
