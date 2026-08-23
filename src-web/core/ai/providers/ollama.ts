/**
 * OllamaProvider — in-browser ChatProvider talking to a local Ollama server
 * via its OpenAI-compatible `/v1` endpoint, through the shared
 * ChatCompletionsProviderBase tool loop.
 *
 * Host is user-editable (aiSettingsStore.byProvider['ollama'].baseUrl,
 * default OLLAMA_DEFAULT_HOST) and read live on every call, same as
 * apiKey/model — see chatCompletionsProvider.ts's config-read doc comment.
 * No API key is required (Caveat 1/2's BYO-key model doesn't apply to a
 * local server).
 */

import { ChatCompletionsProviderBase, type LiveProviderConfig } from './chatCompletionsProvider';
import { getProviderApiKey } from './keyStorage';
import { useAiSettingsStore } from '../../../store/aiSettingsStore';
import {
  OLLAMA_MODELS,
  OLLAMA_MAX_TOKENS,
  OLLAMA_DEFAULT_MAX_TOKENS,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_DEFAULT_HOST,
} from './models';
import type { ModelInfo, ProviderCapabilities } from '../types';

export const OLLAMA_PROVIDER_ID = 'ollama';

function resolveHost(): string {
  const cfg = useAiSettingsStore.getState().byProvider[OLLAMA_PROVIDER_ID];
  const host = cfg?.baseUrl || OLLAMA_DEFAULT_HOST;
  return host.replace(/\/+$/, '');
}

function resolveModel(): string {
  const cfg = useAiSettingsStore.getState().byProvider[OLLAMA_PROVIDER_ID];
  return cfg?.model ?? OLLAMA_DEFAULT_MODEL;
}

export class OllamaProvider extends ChatCompletionsProviderBase {
  readonly id = OLLAMA_PROVIDER_ID;
  readonly displayName = 'Ollama';
  readonly capabilities: ProviderCapabilities = { tools: true, streaming: true };

  get available(): boolean {
    return useAiSettingsStore.getState().byProvider[this.id]?.isValidated ?? false;
  }

  protected requiresApiKey(): boolean {
    return false;
  }

  protected getLiveConfig(): LiveProviderConfig {
    return {
      apiKey: getProviderApiKey(this.id),
      model: resolveModel(),
      baseURL: `${resolveHost()}/v1`,
    };
  }

  protected getMaxTokens(model: string): number {
    return OLLAMA_MAX_TOKENS[model] ?? OLLAMA_DEFAULT_MAX_TOKENS;
  }

  /**
   * Reads the currently selected model live and looks it up in models.ts's
   * static Ollama list. A model absent from that list defaults to `true`
   * (Caveat 3's accepted coarseness) — this is not a runtime probe of the
   * actual loaded model's capabilities.
   */
  supportsTools(): boolean {
    const model = resolveModel();
    const known = OLLAMA_MODELS.find((m) => m.id === model);
    return known?.supportsTools ?? true;
  }

  async listModels(): Promise<ModelInfo[]> {
    const host = resolveHost();
    try {
      const res = await fetch(`${host}/api/tags`);
      if (!res.ok) return OLLAMA_MODELS;

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const remote = data.models ?? [];
      if (remote.length === 0) return OLLAMA_MODELS;

      return remote.map((m) => {
        const known = OLLAMA_MODELS.find((k) => k.id === m.name);
        return {
          id: m.name,
          label: m.name,
          ...(known?.supportsTools !== undefined ? { supportsTools: known.supportsTools } : {}),
        };
      });
    } catch {
      return OLLAMA_MODELS;
    }
  }
}
