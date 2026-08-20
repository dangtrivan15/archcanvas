/**
 * OpenAiProvider — in-browser ChatProvider using the OpenAI Chat Completions
 * API, via the shared ChatCompletionsProviderBase tool loop.
 */

import OpenAI from 'openai';
import { ChatCompletionsProviderBase, type LiveProviderConfig } from './chatCompletionsProvider';
import { getProviderApiKey } from './keyStorage';
import { useAiSettingsStore } from '../../../store/aiSettingsStore';
import { OPENAI_MODELS, OPENAI_MAX_TOKENS, OPENAI_DEFAULT_MAX_TOKENS, OPENAI_DEFAULT_MODEL } from './models';
import type { ModelInfo, ProviderCapabilities } from '../types';

export const OPENAI_PROVIDER_ID = 'openai';

/**
 * The only value fixed at construction — it never varies by user input.
 * apiKey/model still come from the live aiSettingsStore read in getLiveConfig().
 */
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export class OpenAiProvider extends ChatCompletionsProviderBase {
  readonly id = OPENAI_PROVIDER_ID;
  readonly displayName = 'OpenAI';
  readonly capabilities: ProviderCapabilities = { tools: true, streaming: true };

  get available(): boolean {
    return useAiSettingsStore.getState().byProvider[this.id]?.isValidated ?? false;
  }

  protected getLiveConfig(): LiveProviderConfig {
    const cfg = useAiSettingsStore.getState().byProvider[this.id];
    return {
      apiKey: getProviderApiKey(this.id),
      model: cfg?.model ?? OPENAI_DEFAULT_MODEL,
      baseURL: OPENAI_BASE_URL,
    };
  }

  protected getMaxTokens(model: string): number {
    return OPENAI_MAX_TOKENS[model] ?? OPENAI_DEFAULT_MAX_TOKENS;
  }

  async listModels(): Promise<ModelInfo[]> {
    const apiKey = getProviderApiKey(this.id);
    if (!apiKey) return OPENAI_MODELS;

    try {
      const client = new OpenAI({ apiKey, baseURL: OPENAI_BASE_URL, dangerouslyAllowBrowser: true });
      const page = await client.models.list();
      const models: ModelInfo[] = [];
      for await (const m of page) {
        models.push({ id: m.id, label: m.id });
      }
      return models.length > 0 ? models : OPENAI_MODELS;
    } catch {
      return OPENAI_MODELS;
    }
  }
}
