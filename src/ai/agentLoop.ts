/**
 * Agentic loop engine using the Anthropic SDK's native tool_use capability.
 *
 * Sends a prompt to Claude, receives tool_use blocks, executes them via the
 * Text API (same functions MCP tools call), feeds results back, and repeats
 * until Claude sends a final text response (stop_reason === 'end_turn').
 *
 * Tool definitions are derived from the existing MCP tool Zod schemas via
 * zodSchemasToAnthropicTools().
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolResultBlockParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages';

import { zodSchemasToAnthropicTools } from './zodToAnthropicTools';

// ── Public types ──────────────────────────────────────────

/** A tool handler function: takes validated input, returns a string result. */
export type ToolHandler = (input: Record<string, unknown>) => string | Promise<string>;

/** Registry entry: Zod schema (from TOOL_DEFINITIONS) + handler function. */
export interface ToolRegistryEntry {
  /** Description shown to the model */
  description: string;
  /** Zod schema object (the inputSchema from TOOL_DEFINITIONS) */
  inputSchema: Record<string, import('zod').ZodTypeAny>;
  /** Handler that executes the tool and returns a string result */
  handler: ToolHandler;
}

/** Map of tool name → registry entry */
export type ToolRegistry = Map<string, ToolRegistryEntry>;

/** A single tool call log entry */
export interface ToolCallLog {
  /** Tool name that was called */
  name: string;
  /** Input arguments the model provided */
  input: Record<string, unknown>;
  /** Result string returned by the handler */
  result: string;
  /** Whether the tool call resulted in an error */
  isError: boolean;
}

/** Options for the agentic loop */
export interface AgentLoopOptions {
  /** System prompt for the conversation */
  systemPrompt: string;
  /** Initial user prompt */
  userPrompt: string;
  /** Anthropic SDK client instance */
  client: Anthropic;
  /** Tool registry: tool name → { description, inputSchema, handler } */
  toolRegistry: ToolRegistry;
  /** Model to use (defaults to 'claude-sonnet-4-20250514') */
  model?: string;
  /** Max tokens per response (defaults to 4096) */
  maxTokens?: number;
  /** Maximum number of loop iterations before forced termination (default: 50) */
  maxIterations?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Optional callback invoked after each tool call */
  onToolCall?: (log: ToolCallLog) => void;
}

/** Result returned by the agentic loop */
export interface AgentLoopResult {
  /** The final text response from the model */
  response: string;
  /** Log of all tool calls made during the loop */
  toolCalls: ToolCallLog[];
  /** Number of loop iterations executed */
  iterations: number;
  /** Whether the loop hit the max iteration guard */
  hitMaxIterations: boolean;
}

/** Default maximum iterations to prevent runaway loops */
export const DEFAULT_MAX_ITERATIONS = 50;

// ── Main loop ─────────────────────────────────────────────

/**
 * Run the agentic loop.
 *
 * 1. Converts the tool registry's Zod schemas to Anthropic tool definitions
 * 2. Sends the initial message with tools
 * 3. If response has tool_use blocks → execute each → send results back → repeat
 * 4. Terminates when the model sends a final text response (end_turn)
 *    or the max iteration guard fires.
 *
 * @returns The final text and a log of all tool calls
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    userPrompt,
    client,
    toolRegistry,
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4096,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    signal,
    onToolCall,
  } = options;

  // Convert Zod schemas → Anthropic tool definitions
  const tools: Tool[] = zodSchemasToAnthropicTools(toolRegistry);

  // Build conversation messages
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  const toolCallLog: ToolCallLog[] = [];
  let iterations = 0;
  let hitMaxIterations = false;

  while (iterations < maxIterations) {
    // Check for cancellation
    if (signal?.aborted) {
      return {
        response: '',
        toolCalls: toolCallLog,
        iterations,
        hitMaxIterations: false,
      };
    }

    iterations++;

    // Call Claude
    const response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools,
      },
      signal ? { signal } : undefined,
    );

    // If stop_reason is not 'tool_use', we're done — extract final text
    if (response.stop_reason !== 'tool_use') {
      const finalText = response.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        response: finalText,
        toolCalls: toolCallLog,
        iterations,
        hitMaxIterations: false,
      };
    }

    // Extract tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      // No tool_use blocks despite stop_reason being 'tool_use' — shouldn't happen
      // but treat as end of conversation
      const text = response.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        response: text,
        toolCalls: toolCallLog,
        iterations,
        hitMaxIterations: false,
      };
    }

    // Add assistant's response (with tool_use blocks) to conversation
    messages.push({ role: 'assistant', content: response.content });

    // Execute each tool and collect results
    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      // Check for cancellation between tool calls
      if (signal?.aborted) {
        return {
          response: '',
          toolCalls: toolCallLog,
          iterations,
          hitMaxIterations: false,
        };
      }

      const entry = toolRegistry.get(toolUse.name);
      let result: string;
      let isError = false;

      if (!entry) {
        result = JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
        isError = true;
      } else {
        try {
          const input = (toolUse.input ?? {}) as Record<string, unknown>;
          result = await Promise.resolve(entry.handler(input));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result = JSON.stringify({ error: message });
          isError = true;
        }
      }

      const logEntry: ToolCallLog = {
        name: toolUse.name,
        input: (toolUse.input ?? {}) as Record<string, unknown>,
        result,
        isError,
      };
      toolCallLog.push(logEntry);
      onToolCall?.(logEntry);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
        is_error: isError,
      });
    }

    // Add tool results as the next user message
    messages.push({ role: 'user', content: toolResults });
  }

  // Hit max iterations — extract whatever text we have
  hitMaxIterations = true;
  const lastResponse = toolCallLog.length > 0
    ? `Agent loop terminated after ${maxIterations} iterations (max iteration guard).`
    : '';

  return {
    response: lastResponse,
    toolCalls: toolCallLog,
    iterations,
    hitMaxIterations,
  };
}
