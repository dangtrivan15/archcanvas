/**
 * ApiKeyProvider — in-browser ChatProvider using the Anthropic Messages API.
 *
 * Implements the manual tool loop: stream response → execute tools via
 * dispatchStoreAction → send results back → loop until end_turn.
 *
 * Uses @anthropic-ai/sdk with dangerouslyAllowBrowser: true for direct
 * browser-to-API communication with the user's own API key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { ulid } from 'ulid';
import { archCanvasToolDefs } from './toolDefs';
import { translateToolArgs } from './translateToolArgs';
import { dispatchStoreAction } from './storeActionDispatcher';
import { buildSystemPrompt } from './systemPrompt';
import { useApiKeyStore } from '../../store/apiKeyStore';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
} from './types';

const MODEL_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6-20250919': 16384,
  'claude-sonnet-4-6-20250919': 16384,
  'claude-haiku-4-5-20251001': 8192,
};

const DEFAULT_MAX_TOKENS = 16384;

/** Convert Zod schemas to Anthropic tool format using Zod 4's built-in JSON Schema converter */
function buildToolParams(): Anthropic.Messages.Tool[] {
  return archCanvasToolDefs.map((def) => ({
    name: def.name,
    description: def.description,
    input_schema: z.toJSONSchema(def.inputSchema) as Anthropic.Messages.Tool['input_schema'],
  }));
}

export class ApiKeyProvider implements ChatProvider {
  readonly id = 'claude-api-key';
  readonly displayName = 'Claude (API Key)';

  private messages: Anthropic.Messages.MessageParam[] = [];
  private abortController: AbortController | null = null;
  private toolParams = buildToolParams();

  get available(): boolean {
    return useApiKeyStore.getState().isValidated;
  }

  async *sendMessage(
    content: string,
    context: ProjectContext,
  ): AsyncIterable<ChatEvent> {
    const requestId = ulid();
    const { apiKey, model } = useApiKeyStore.getState();

    if (!apiKey) {
      yield { type: 'error', requestId, message: 'No API key configured' };
      return;
    }

    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const systemPrompt = buildSystemPrompt(context);
    const maxTokens = MODEL_MAX_TOKENS[model] ?? DEFAULT_MAX_TOKENS;

    // Append user message to history
    this.messages.push({ role: 'user', content });

    this.abortController = new AbortController();

    try {
      yield* this.toolLoop(client, systemPrompt, model, maxTokens, requestId);
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
    client: Anthropic,
    systemPrompt: string,
    model: string,
    maxTokens: number,
    requestId: string,
  ): AsyncIterable<ChatEvent> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const stream = client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: this.messages,
        tools: this.toolParams,
        stream: true,
      });

      // Process stream events
      const toolUseBlocks: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];

      let currentToolId = '';
      let currentToolName = '';
      let inputJsonAccum = '';

      for await (const event of await stream) {
        // Check abort
        if (this.abortController?.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        switch (event.type) {
          case 'content_block_start': {
            const block = (event as any).content_block;
            if (block?.type === 'tool_use') {
              currentToolId = block.id;
              currentToolName = block.name;
              inputJsonAccum = '';
            }
            break;
          }

          case 'content_block_delta': {
            const delta = (event as any).delta;
            if (delta?.type === 'text_delta') {
              yield { type: 'text', requestId, content: delta.text };
            } else if (delta?.type === 'input_json_delta') {
              inputJsonAccum += delta.partial_json;
            }
            break;
          }

          case 'content_block_stop': {
            if (currentToolId) {
              let parsedInput: Record<string, unknown> = {};
              try {
                parsedInput = inputJsonAccum ? JSON.parse(inputJsonAccum) : {};
              } catch { /* use empty input */ }

              toolUseBlocks.push({
                id: currentToolId,
                name: currentToolName,
                input: parsedInput,
              });

              yield {
                type: 'tool_call',
                requestId,
                name: currentToolName,
                args: parsedInput,
                id: currentToolId,
              };

              currentToolId = '';
              currentToolName = '';
              inputJsonAccum = '';
            }
            break;
          }
        }
      }

      // Get the final message to check stop_reason and full content blocks
      const finalMessage = await (stream as any).finalMessage();
      const stopReason = finalMessage.stop_reason;
      const contentBlocks = finalMessage.content;

      // Append assistant message to history
      this.messages.push({ role: 'assistant', content: contentBlocks });

      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        // Execute tools and collect results
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const tool of toolUseBlocks) {
          const { action, translatedArgs } = translateToolArgs(tool.name, tool.input);
          const result = dispatchStoreAction(action, translatedArgs as Record<string, unknown>);
          const resultObj = result as { ok: boolean; data?: unknown; error?: { code: string; message: string } };

          if (resultObj.ok) {
            yield {
              type: 'tool_result',
              requestId,
              id: tool.id,
              result: JSON.stringify(resultObj.data, null, 2),
            };
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify(resultObj.data, null, 2),
            });
          } else {
            yield {
              type: 'tool_result',
              requestId,
              id: tool.id,
              result: JSON.stringify(resultObj.error),
              isError: true,
            };
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify(resultObj.error),
              is_error: true,
            });
          }
        }

        // Append tool results as user message
        this.messages.push({ role: 'user', content: toolResults });

        // Continue loop — next iteration will send messages with tool results
        continue;
      }

      // end_turn or max_tokens — done
      yield { type: 'done', requestId };
      break;
    }
  }
}
