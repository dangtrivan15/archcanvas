/**
 * GeminiProvider — in-browser ChatProvider using the Google Generative AI
 * (Gemini) API. Runs its own manual tool loop (the Gemini streaming/
 * function-calling shape doesn't match OpenAI's, so it can't reuse
 * ChatCompletionsProviderBase) but drives the same shared
 * translateToolArgs → dispatchStoreAction dispatcher and emits the same
 * ChatEvent union as apiKeyProvider.ts / chatCompletionsProvider.ts.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Content, FunctionDeclarationsTool, GenerativeModel, Part } from '@google/generative-ai';
import { ulid } from 'ulid';
import { translateToolArgs } from '../translateToolArgs';
import { dispatchStoreAction } from '../storeActionDispatcher';
import { buildSystemPrompt } from '../systemPrompt';
import { toGeminiFunctionDeclarations } from './toolSchema';
import { getProviderApiKey } from './keyStorage';
import { useAiSettingsStore } from '../../../store/aiSettingsStore';
import { GEMINI_MODELS, GEMINI_MAX_TOKENS, GEMINI_DEFAULT_MAX_TOKENS, GEMINI_DEFAULT_MODEL } from './models';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
  ModelInfo,
  ProviderCapabilities,
} from '../types';

export const GEMINI_PROVIDER_ID = 'gemini';

const GEMINI_FUNCTION_DECLARATIONS = toGeminiFunctionDeclarations();

interface LiveGeminiConfig {
  apiKey: string | null;
  model: string;
}

export class GeminiProvider implements ChatProvider {
  readonly id = GEMINI_PROVIDER_ID;
  readonly displayName = 'Gemini';
  readonly capabilities: ProviderCapabilities = { tools: true, streaming: true };

  private history: Content[] = [];
  private abortController: AbortController | null = null;

  get available(): boolean {
    return useAiSettingsStore.getState().byProvider[this.id]?.isValidated ?? false;
  }

  supportsTools(): boolean {
    return true;
  }

  /**
   * The browser-facing `@google/generative-ai` SDK has no models.list()
   * call (only the server-side helpers / raw v1beta REST endpoint expose
   * that). Rather than hand-roll an authenticated REST fetch purely for a
   * Test-connection dropdown, fall back to the static list in models.ts —
   * consistent with Caveat 3's accepted coarseness for model metadata.
   */
  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  private getLiveConfig(): LiveGeminiConfig {
    const cfg = useAiSettingsStore.getState().byProvider[this.id];
    return {
      apiKey: getProviderApiKey(this.id),
      model: cfg?.model ?? GEMINI_DEFAULT_MODEL,
    };
  }

  async *sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
    const requestId = ulid();
    const { apiKey, model } = this.getLiveConfig();

    if (!apiKey) {
      yield { type: 'error', requestId, message: 'No API key configured' };
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const maxOutputTokens = GEMINI_MAX_TOKENS[model] ?? GEMINI_DEFAULT_MAX_TOKENS;

    const genModel = genAI.getGenerativeModel({
      model,
      systemInstruction: buildSystemPrompt(context),
      tools: [{ functionDeclarations: GEMINI_FUNCTION_DECLARATIONS } as unknown as FunctionDeclarationsTool],
      generationConfig: { maxOutputTokens },
    });

    this.history.push({ role: 'user', parts: [{ text: content }] });

    this.abortController = new AbortController();

    try {
      yield* this.toolLoop(genModel, requestId);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        yield { type: 'done', requestId };
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      yield { type: 'error', requestId, message };
    } finally {
      this.abortController = null;
    }
  }

  loadHistory(_messages: ChatMessage[]): void {
    this.history = [];
  }

  interrupt(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async *toolLoop(genModel: GenerativeModel, requestId: string): AsyncIterable<ChatEvent> {
    while (true) {
      const result = await genModel.generateContentStream({ contents: this.history });

      let textContent = '';
      const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const chunk of result.stream) {
        if (this.abortController?.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const text = chunk.text();
        if (text) {
          textContent += text;
          yield { type: 'text', requestId, content: text };
        }

        const calls = chunk.functionCalls();
        if (calls) {
          for (const call of calls) {
            functionCalls.push({ name: call.name, args: (call.args ?? {}) as Record<string, unknown> });
          }
        }
      }

      const responseParts: Part[] = [];
      if (textContent.length > 0) responseParts.push({ text: textContent });
      for (const call of functionCalls) {
        responseParts.push({ functionCall: { name: call.name, args: call.args } });
      }
      if (responseParts.length > 0) {
        this.history.push({ role: 'model', parts: responseParts });
      }

      if (functionCalls.length > 0) {
        const responseFunctionParts: Part[] = [];

        for (const call of functionCalls) {
          const id = ulid();
          yield { type: 'tool_call', requestId, name: call.name, args: call.args, id };

          // Every functionCall must get a matching functionResponse pushed to
          // history, even when translation/dispatch throws (e.g. import_yaml
          // with malformed YAML, which parseCanvas rejects). Otherwise the
          // model's turn is left with an unanswered function call and the next
          // generateContentStream request is malformed.
          let resultContent: string;
          let isError = false;
          try {
            const { action, translatedArgs } = translateToolArgs(call.name, call.args);
            const result = await dispatchStoreAction(action, translatedArgs as Record<string, unknown>);
            const resultObj = result as { ok: boolean; data?: unknown; error?: { code: string; message: string } };

            if (resultObj && typeof resultObj === 'object' && resultObj.ok === false) {
              resultContent = JSON.stringify(resultObj.error) || 'Unknown error';
              isError = true;
            } else {
              const data = resultObj && typeof resultObj === 'object' && 'ok' in resultObj ? resultObj.data : result;
              resultContent = JSON.stringify(data, null, 2) ?? '{}';
            }
          } catch (err) {
            resultContent = JSON.stringify({
              message: err instanceof Error ? err.message : 'Tool execution failed',
            });
            isError = true;
          }

          yield {
            type: 'tool_result',
            requestId,
            id,
            result: resultContent,
            ...(isError ? { isError: true } : {}),
          };

          responseFunctionParts.push({
            functionResponse: { name: call.name, response: { result: resultContent } },
          });
        }

        this.history.push({ role: 'function', parts: responseFunctionParts });
        continue;
      }

      yield { type: 'done', requestId };
      break;
    }
  }
}
