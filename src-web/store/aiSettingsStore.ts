// Multi-provider AI settings store — per-provider model/host selection and
// validation state, plus which provider is currently selected.
//
// API keys are NOT part of this store's state: they're secrets and must
// never end up serialized into `.archcanvas/settings.yaml` (see spec
// Decision 5). They're read/written separately via
// `core/ai/providers/keyStorage.ts`'s `getProviderApiKey`/`setProviderApiKey`,
// backed by `localStorage` under `archcanvas:key:<providerId>`.
//
// Provider code (chatCompletionsProvider.ts, openai.ts, ollama.ts,
// gemini.ts) reads `useAiSettingsStore.getState().byProvider[id]` LIVE on
// every call — never caches it at construction — because providerRegistry
// constructs each provider exactly once (see providerRegistry.tsx), so a
// value captured at construction time would go stale the moment a user
// edits the model dropdown or Ollama host without re-running Test
// connection.
//
// --- validate(id) provider resolution (judgment call, Group C task 10) ---
// `validate(id)` needs a `ChatProvider` instance to call `listModels()` on,
// but this store can't import the provider classes directly: openai.ts/
// ollama.ts/gemini.ts already import *this* module (for the live
// apiKey/model/baseUrl read described above), so importing them back here
// would be circular. Instead, `validate` resolves the instance through
// `chatStore`'s existing `providers: Map<string, ChatProvider>` — populated
// by `providerRegistry.tsx`'s `setup()` via `chatStore.registerProvider()`
// (see `useAiProvider.ts`). `chatStore.ts` has no dependency on this module,
// so `aiSettingsStore -> chatStore` is a safe one-way edge. This reuses an
// already-live id -> instance registry instead of inventing a second one
// (e.g. a `setProviderResolver` callback registered by providerRegistry.tsx)
// — one fewer moving part for the same result.
//
// --- fs vs localStorage persistence split (judgment call, Group C task 10) ---
// "Is a project open" is read the same way `App.tsx` gates the whole app
// (`if (!fs) return <ProjectGate />`) and the same way `fileResolver.ts`/
// `fileStore.ts` treat `fs` as the signal a project is bound: presence of
// `useFileStore.getState().fs`. When set, non-secret prefs persist to
// `.archcanvas/settings.yaml` via `saveSettings` (storage/settingsCodec.ts);
// when null (web mode, no directory granted — Caveat 4), prefs fall back to
// a single JSON blob in `localStorage` under `archcanvas:aiSettingsFallback`.
// This mirrors the existing `persistLastActiveProject`/`apiKeyStore`
// try/catch-around-localStorage pattern rather than round-tripping through
// the YAML codec (which is fs-shaped, not localStorage-shaped).

import { create } from 'zustand';
import { useFileStore } from './fileStore';
import { useChatStore } from './chatStore';
import { saveSettings, type Settings } from '../storage/settingsCodec';

/** Per-provider non-secret configuration + validation state. */
export interface AiProviderConfig {
  model?: string;
  /** Only meaningful for host-based providers (Ollama). */
  baseUrl?: string;
  isValidated: boolean;
  isValidating: boolean;
  error?: string;
}

export interface AiSettingsState {
  selectedProviderId: string | null;
  byProvider: Record<string, AiProviderConfig>;

  setSelectedProvider(id: string): void;
  setModel(id: string, model: string): void;
  setBaseUrl(id: string, baseUrl: string): void;
  /**
   * "Test connection": calls the active provider's `listModels()` (resolved
   * via `chatStore.providers` — see the module-level doc comment above).
   * On success, sets `isValidated: true` and clears `error`. On failure (no
   * matching provider, or `listModels()` throwing), sets `error` and
   * `isValidated: false`.
   */
  validate(id: string): Promise<void>;
  /**
   * Populate `selectedProviderId`/`byProvider` from a loaded
   * `.archcanvas/settings.yaml` (or localStorage fallback) without
   * triggering a save — called once by `App.tsx` after `loadSettings(fs)`
   * resolves on project load. Using `set()` directly (not the setters
   * above) is what avoids a hydrate -> persist -> hydrate loop.
   */
  hydrateFromSettings(settings: Settings): void;
}

const DEFAULT_PROVIDER_CONFIG: AiProviderConfig = {
  isValidated: false,
  isValidating: false,
};

const LOCAL_STORAGE_FALLBACK_KEY = 'archcanvas:aiSettingsFallback';

function withProvider(
  byProvider: Record<string, AiProviderConfig>,
  id: string,
  patch: Partial<AiProviderConfig>,
): Record<string, AiProviderConfig> {
  const existing = byProvider[id] ?? DEFAULT_PROVIDER_CONFIG;
  return {
    ...byProvider,
    [id]: { ...existing, ...patch },
  };
}

/** Build the non-secret Settings shape persisted to YAML/localStorage from current store state. */
function toSettings(state: Pick<AiSettingsState, 'selectedProviderId' | 'byProvider'>): Settings {
  const providers: Settings['ai']['providers'] = {};
  for (const [id, cfg] of Object.entries(state.byProvider)) {
    const entry: { model?: string; baseUrl?: string } = {};
    if (cfg.model !== undefined) entry.model = cfg.model;
    if (cfg.baseUrl !== undefined) entry.baseUrl = cfg.baseUrl;
    providers[id] = entry;
  }
  return {
    ai: {
      ...(state.selectedProviderId ? { selectedProviderId: state.selectedProviderId } : {}),
      providers,
    },
  };
}

/** Fire-and-forget persistence: settings.yaml when a project is open, else localStorage fallback. */
function persist(state: Pick<AiSettingsState, 'selectedProviderId' | 'byProvider'>): void {
  const settings = toSettings(state);
  const fs = useFileStore.getState().fs;

  if (fs) {
    saveSettings(fs, settings).catch((err) => {
      console.error('[aiSettingsStore] Failed to save .archcanvas/settings.yaml:', err);
    });
    return;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(settings));
    }
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore, matching
    // the existing lastActiveProject.ts / apiKeyStore.ts fallback pattern.
  }
}

/** Read the localStorage fallback synchronously at store-creation time (web mode, no project yet). */
function loadFallbackFromLocalStorage(): Pick<AiSettingsState, 'selectedProviderId' | 'byProvider'> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY) : null;
    if (!raw) return { selectedProviderId: null, byProvider: {} };

    const parsed = JSON.parse(raw) as Partial<Settings>;
    const ai = parsed.ai;
    if (!ai || typeof ai !== 'object') return { selectedProviderId: null, byProvider: {} };

    const byProvider: Record<string, AiProviderConfig> = {};
    for (const [id, cfg] of Object.entries(ai.providers ?? {})) {
      byProvider[id] = {
        ...DEFAULT_PROVIDER_CONFIG,
        ...(cfg?.model !== undefined ? { model: cfg.model } : {}),
        ...(cfg?.baseUrl !== undefined ? { baseUrl: cfg.baseUrl } : {}),
      };
    }

    return { selectedProviderId: ai.selectedProviderId ?? null, byProvider };
  } catch {
    return { selectedProviderId: null, byProvider: {} };
  }
}

export const useAiSettingsStore = create<AiSettingsState>((set, get) => ({
  ...loadFallbackFromLocalStorage(),

  setSelectedProvider(id) {
    set({ selectedProviderId: id });
    persist(get());
  },

  setModel(id, model) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { model, isValidated: false }),
    }));
    persist(get());
  },

  setBaseUrl(id, baseUrl) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { baseUrl, isValidated: false }),
    }));
    persist(get());
  },

  async validate(id) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { isValidating: true, error: undefined }),
    }));

    try {
      const provider = useChatStore.getState().providers.get(id);
      if (!provider) {
        throw new Error(`Provider "${id}" is not available`);
      }
      await provider.listModels();
      set((state) => ({
        byProvider: withProvider(state.byProvider, id, {
          isValidating: false,
          isValidated: true,
          error: undefined,
        }),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      set((state) => ({
        byProvider: withProvider(state.byProvider, id, {
          isValidating: false,
          isValidated: false,
          error: message,
        }),
      }));
    }
  },

  hydrateFromSettings(settings) {
    set((state) => {
      let byProvider = state.byProvider;
      for (const [id, cfg] of Object.entries(settings.ai.providers)) {
        const existing = byProvider[id];
        // Mirror setModel()/setBaseUrl()'s invariant: a config value that
        // actually changes invalidates any prior "Test Connection" result
        // for this provider. Without this, a `baseUrl`/`model` arriving
        // from `.archcanvas/settings.yaml` (which may be synced through a
        // shared repo, i.e. not something the local user typed) could
        // silently inherit `isValidated: true` from a still-live session
        // that had validated a *different* value — letting the UI treat an
        // unvetted, file-supplied host as already-confirmed.
        const baseUrlChanged = cfg.baseUrl !== undefined && cfg.baseUrl !== existing?.baseUrl;
        const modelChanged = cfg.model !== undefined && cfg.model !== existing?.model;
        byProvider = withProvider(byProvider, id, {
          ...(cfg.model !== undefined ? { model: cfg.model } : {}),
          ...(cfg.baseUrl !== undefined ? { baseUrl: cfg.baseUrl } : {}),
          ...(baseUrlChanged || modelChanged ? { isValidated: false } : {}),
        });
      }
      return {
        byProvider,
        selectedProviderId: settings.ai.selectedProviderId ?? state.selectedProviderId,
      };
    });
  },
}));
