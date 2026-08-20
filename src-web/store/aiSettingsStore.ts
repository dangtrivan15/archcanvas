// Phase 2 extends this with settings.yaml persistence (loadSettings/saveSettings
// wiring) — shape here is intentionally final.
//
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

import { create } from 'zustand';

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
   * Placeholder "Test connection" check. Phase 2 wires this to the active
   * provider's `listModels()` call and flips `isValidated`/`error`
   * accordingly; here it only manages `isValidating` so Group B code and
   * its tests have something real to read/mock.
   */
  validate(id: string): Promise<void>;
}

const DEFAULT_PROVIDER_CONFIG: AiProviderConfig = {
  isValidated: false,
  isValidating: false,
};

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

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  selectedProviderId: null,
  byProvider: {},

  setSelectedProvider(id) {
    set({ selectedProviderId: id });
  },

  setModel(id, model) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { model, isValidated: false }),
    }));
  },

  setBaseUrl(id, baseUrl) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { baseUrl, isValidated: false }),
    }));
  },

  async validate(id) {
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { isValidating: true, error: undefined }),
    }));
    set((state) => ({
      byProvider: withProvider(state.byProvider, id, { isValidating: false, isValidated: true }),
    }));
  },
}));
