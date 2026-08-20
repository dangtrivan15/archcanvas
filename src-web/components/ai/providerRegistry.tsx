/**
 * Provider registry — the single composition root for AI chat providers.
 *
 * Each descriptor bundles everything the app needs to know about one
 * provider: how to create and wire it (`setup`) and which settings UI it
 * exposes (`SettingsComponent`). UI code looks providers up here instead
 * of branching on hardcoded provider IDs.
 *
 * To add a provider: implement `ChatProvider` in `core/ai/`, then append
 * a descriptor below. Nothing else in the UI layer needs to change.
 *
 * Registration order matters: chatStore auto-selects the first registered
 * provider as active.
 */
import type { ComponentType } from 'react';
import type { ChatProvider } from '@/core/ai/types';
import {
  WebSocketClaudeCodeProvider,
  CLAUDE_CODE_PROVIDER_ID,
  resolveBridgeUrl,
} from '@/core/ai/webSocketProvider';
import { ApiKeyProvider, CLAUDE_API_KEY_PROVIDER_ID } from '@/core/ai/apiKeyProvider';
import { OpenAiProvider, OPENAI_PROVIDER_ID } from '@/core/ai/providers/openai';
import { OllamaProvider, OLLAMA_PROVIDER_ID } from '@/core/ai/providers/ollama';
import { GeminiProvider, GEMINI_PROVIDER_ID } from '@/core/ai/providers/gemini';
import { useApiKeyStore } from '@/store/apiKeyStore';
import { useAiSettingsStore } from '@/store/aiSettingsStore';
import { ApiKeySettings, ClaudeCodeSettings } from './AiProviderSettings';
import { createProviderKeySettings } from './ProviderKeySettings';

export interface ProviderDescriptor {
  id: string;
  /**
   * Create the provider, wire its transport, and hand it to `register`.
   * Must call `register` synchronously once, and again whenever
   * availability changes so Zustand subscribers see the updated
   * `provider.available`. Returns a cleanup function.
   */
  setup(register: (provider: ChatProvider) => void): () => void;
  /** Settings UI rendered when this provider is active. */
  SettingsComponent: ComponentType;
  /** Selecting this provider while unavailable opens the settings dialog. */
  opensSettingsWhenUnavailable?: boolean;
}

export const providerDescriptors: ProviderDescriptor[] = [
  {
    id: CLAUDE_CODE_PROVIDER_ID,
    SettingsComponent: ClaudeCodeSettings,
    setup(register) {
      const provider = new WebSocketClaudeCodeProvider();
      register(provider);
      provider.setConnectionChangeCallback(() => register(provider));

      // Resolve the bridge URL (async for Tauri port discovery) and connect
      resolveBridgeUrl()
        .then((wsUrl) => provider.connect(wsUrl))
        .catch((err) => {
          console.error('[providerRegistry] Failed to resolve bridge URL:', err);
        });

      return () => {
        provider.setConnectionChangeCallback(null);
        provider.disconnect();
      };
    },
  },
  {
    id: CLAUDE_API_KEY_PROVIDER_ID,
    SettingsComponent: ApiKeySettings,
    opensSettingsWhenUnavailable: true,
    setup(register) {
      const provider = new ApiKeyProvider();
      register(provider);

      // Re-register when validation state changes so Zustand sees updated `available`
      const unsubscribe = useApiKeyStore.subscribe((state, prev) => {
        if (state.isValidated !== prev.isValidated) {
          register(provider);
        }
      });

      // Auto-validate stored API key so the provider is immediately available
      if (useApiKeyStore.getState().apiKey) {
        useApiKeyStore.getState().validateKey().catch(() => {});
      }

      return unsubscribe;
    },
  },
  ...buildKeyProviderDescriptors(),
];

/**
 * OpenAI / Ollama / Gemini descriptors — all follow the same shape (unlike
 * the two Claude descriptors above, which differ enough from each other and
 * from these to not be worth folding into the same helper): construct the
 * provider once inside `setup()`, register it, and re-register whenever
 * `aiSettingsStore`'s validation state for that id flips (mirrors the
 * `useApiKeyStore.subscribe` pattern above, keyed off
 * `state.byProvider[id]?.isValidated` instead of a dedicated store's
 * top-level field). `opensSettingsWhenUnavailable: true` matches the
 * existing Claude API-key descriptor so picking an unconfigured provider
 * from ChatProviderSelector opens Settings instead of silently no-op-ing.
 *
 * These three are appended *after* the two Claude descriptors so Claude
 * stays the auto-selected default (registration order = auto-select order,
 * per chatStore.registerProvider's "auto-select if no active provider").
 *
 * Unlike the Claude API-key descriptor, these do NOT auto-validate a stored
 * key on mount — Test Connection is the only trigger. Auto-validating would
 * fire a live network call (or a local Ollama fetch) on every app boot for
 * any provider with a key ever entered, which is more surprising here than
 * for the single pre-existing Claude path this mirrors.
 *
 * `aiSettingsStore.validate(id)` (Group C task 10) resolves the ChatProvider
 * instance to call `listModels()` on via `chatStore.providers.get(id)` —
 * the same map `register()` populates here — rather than a second
 * resolution mechanism; see aiSettingsStore.ts's module doc comment for the
 * full reasoning (avoids a circular import back into these provider files).
 */
function buildKeyProviderDescriptors(): ProviderDescriptor[] {
  function setupKeyProvider(id: string, createProvider: () => ChatProvider) {
    return (register: (provider: ChatProvider) => void): (() => void) => {
      const provider = createProvider();
      register(provider);

      const unsubscribe = useAiSettingsStore.subscribe((state, prev) => {
        if (state.byProvider[id]?.isValidated !== prev.byProvider[id]?.isValidated) {
          register(provider);
        }
      });

      return unsubscribe;
    };
  }

  return [
    {
      id: OPENAI_PROVIDER_ID,
      SettingsComponent: createProviderKeySettings(OPENAI_PROVIDER_ID),
      opensSettingsWhenUnavailable: true,
      setup: setupKeyProvider(OPENAI_PROVIDER_ID, () => new OpenAiProvider()),
    },
    {
      id: OLLAMA_PROVIDER_ID,
      SettingsComponent: createProviderKeySettings(OLLAMA_PROVIDER_ID),
      opensSettingsWhenUnavailable: true,
      setup: setupKeyProvider(OLLAMA_PROVIDER_ID, () => new OllamaProvider()),
    },
    {
      id: GEMINI_PROVIDER_ID,
      SettingsComponent: createProviderKeySettings(GEMINI_PROVIDER_ID),
      opensSettingsWhenUnavailable: true,
      setup: setupKeyProvider(GEMINI_PROVIDER_ID, () => new GeminiProvider()),
    },
  ];
}

export function getProviderDescriptor(
  id: string | null | undefined,
): ProviderDescriptor | undefined {
  return providerDescriptors.find((d) => d.id === id);
}
