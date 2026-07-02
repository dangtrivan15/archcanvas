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
import { useApiKeyStore } from '@/store/apiKeyStore';
import { ApiKeySettings, ClaudeCodeSettings } from './AiProviderSettings';

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
];

export function getProviderDescriptor(
  id: string | null | undefined,
): ProviderDescriptor | undefined {
  return providerDescriptors.find((d) => d.id === id);
}
