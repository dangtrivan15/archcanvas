/**
 * Shared base for providers speaking the OpenAI Chat Completions streaming
 * API — used by both OpenAiProvider (api.openai.com) and OllamaProvider
 * (Ollama's OpenAI-compatible `/v1` endpoint).
 *
 * Implements the same manual tool loop as apiKeyProvider.ts: stream →
 * accumulate deltas → on tool_calls, execute via translateToolArgs +
 * dispatchStoreAction → feed tool results back → repeat until a non-
 * tool_calls finish_reason.
 *
 * CRITICAL config-read pattern (mirrors apiKeyProvider.ts's
 * `useApiKeyStore.getState()` pull inside `sendMessage()`): subclasses read
 * apiKey/model/baseURL fresh from `useAiSettingsStore.getState().byProvider[id]`
 * (+ `getProviderApiKey`) on every call via `getLiveConfig()` — never cached
 * at construction. providerRegistry constructs each provider exactly once
 * and only re-registers on validation-state changes, never on a model/key/
 * host edit, so a constructor-cached value would go stale the moment a user
 * edits Settings without re-running Test connection.
 */

import OpenAI from 'openai';
import { ulid } from 'ulid';
import { translateToolArgs } from '../translateToolArgs';
import { dispatchStoreAction } from '../storeActionDispatcher';
import { buildSystemPrompt } from '../systemPrompt';
import { toOpenAiTools } from './toolSchema';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
  ModelInfo,
  ProviderCapabilities,
} from '../types';

/** Live, per-call provider configuration — never cached across calls. */
export interface LiveProviderConfig {
  apiKey: string | null;
  model: string;
  baseURL: string;
}

const OPENAI_TOOL_PARAMS = toOpenAiTools();

interface AccumulatedToolCall {
  id: string;
  name: string;
  args: string;
}

export abstract class ChatCompletionsProviderBase implements ChatProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;

  private messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private abortController: AbortController | null = null;

  abstract get available(): boolean;

  /** Live per-call config (apiKey/model/baseURL). Must not be cached. */
  protected abstract getLiveConfig(): LiveProviderConfig;

  /** Max output tokens for the given model. */
  protected abstract getMaxTokens(model: string): number;

  /** False for providers that work without a key (Ollama). */
  protected requiresApiKey(): boolean {
    return true;
  }

  /** Dynamic, currently-selected-model tool-calling check. True by default. */
  supportsTools(): boolean {
    return true;
  }

  abstract listModels(): Promise<ModelInfo[]>;

  async *sendMessage(content: string, context: ProjectContext): AsyncIterable<ChatEvent> {
    const requestId = ulid();
    const { apiKey, model, baseURL } = this.getLiveConfig();

    if (this.requiresApiKey() && !apiKey) {
      yield { type: 'error', requestId, message: `No API key configured for ${this.displayName}` };
      return;
    }

    const client = new OpenAI({
      apiKey: apiKey ?? 'ollama',
      baseURL,
      dangerouslyAllowBrowser: true,
    });
    const maxTokens = this.getMaxTokens(model);
    const useTools = this.supportsTools();

    // Refresh the system prompt every turn (it embeds context-dependent fields
    // such as context.currentScope). Mirrors apiKeyProvider.ts / gemini.ts,
    // which rebuild the system prompt on every sendMessage — the base must not
    // freeze the turn-1 context for the rest of the session.
    const systemPrompt = buildSystemPrompt(context);
    if (this.messages.length === 0) {
      this.messages.push({ role: 'system', content: systemPrompt });
    } else if (this.messages[0]?.role === 'system') {
      this.messages[0] = { role: 'system', content: systemPrompt };
    }
    this.messages.push({ role: 'user', content });

    this.abortController = new AbortController();

    try {
      yield* this.toolLoop(client, model, maxTokens, useTools, requestId);
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
    this.messages = [];
  }

  interrupt(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async *toolLoop(
    client: OpenAI,
    model: string,
    maxTokens: number,
    useTools: boolean,
    requestId: string,
  ): AsyncIterable<ChatEvent> {
    while (true) {
      const stream = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: this.messages,
        ...(useTools ? { tools: OPENAI_TOOL_PARAMS } : {}),
        stream: true,
      });

      let textContent = '';
      const toolCallAccum = new Map<number, AccumulatedToolCall>();

      for await (const chunk of stream) {
        if (this.abortController?.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          textContent += delta.content;
          yield { type: 'text', requestId, content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallAccum.get(tc.index) ?? { id: '', name: '', args: '' };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            toolCallAccum.set(tc.index, existing);
          }
        }
      }

      const toolCalls = Array.from(toolCallAccum.values());

      this.messages.push({
        role: 'assistant',
        content: textContent.length > 0 ? textContent : null,
        ...(toolCalls.length > 0
          ? {
              tool_calls: toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.args },
              })),
            }
          : {}),
      });

      // Execute tools whenever any tool call was produced — NOT only when
      // finishReason === 'tool_calls'. OpenAI-compatible local servers
      // (llama.cpp, vLLM, Ollama's /v1 endpoint — a first-class target of
      // this base) routinely emit tool calls while ending the stream with
      // finish_reason 'stop' (or no finish_reason at all). The assistant
      // message above is appended with `tool_calls` whenever toolCalls is
      // non-empty, so the two must gate on the same condition: otherwise the
      // history carries a `tool_calls` message with no following `tool`
      // messages, which the API rejects with a 400 on the next turn.
      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = tc.args ? JSON.parse(tc.args) : {};
          } catch {
            /* use empty args */
          }

          yield { type: 'tool_call', requestId, name: tc.name, args: parsedArgs, id: tc.id };

          // A tool result MUST be appended for every tool_call id, even when
          // translation/dispatch throws (e.g. import_yaml with malformed YAML,
          // which parseCanvas rejects). Otherwise the assistant `tool_calls`
          // message is left dangling and every subsequent turn 400s until the
          // session is reset.
          let resultContent: string;
          let isError = false;
          try {
            const { action, translatedArgs } = translateToolArgs(tc.name, parsedArgs);
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
            id: tc.id,
            result: resultContent,
            ...(isError ? { isError: true } : {}),
          };

          this.messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultContent,
          });
        }

        continue;
      }

      yield { type: 'done', requestId };
      break;
    }
  }
}
