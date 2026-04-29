import { create } from 'zustand';
import {
  browseRegistry,
  fetchNamespaces,
  fetchNodeDefDetail,
} from '@/core/registry/remoteRegistry';
import type { RemoteNodeDefSummary, RemoteNodeDefDetail } from '@/core/registry/remoteRegistry';

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

  setQuery: (query: string) => void;
  setNamespace: (namespace: string | null) => void;
  selectNodeDef: (key: string | null) => void;
  loadNamespaces: () => Promise<void>;
  _search: (query: string, namespace: string | null) => Promise<void>;
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let abortController: AbortController | undefined;

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
    if (!key) {
      set({ selectedKey: null, selectedDetail: null });
      return;
    }
    set({ selectedKey: key, selectedDetail: null, detailLoading: true });
    const [namespace, name] = key.split('/');
    fetchNodeDefDetail(namespace, name)
      .then((detail) => set({ selectedDetail: detail, detailLoading: false }))
      .catch((err) => {
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      set({ namespacesLoading: false });
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
