/**
 * Unit tests for the agentic loop engine (src/ai/agentLoop.ts).
 *
 * Uses a mock Anthropic client to verify:
 * - Loop executes tools and terminates correctly
 * - Max iteration guard triggers and returns gracefully
 * - Abort/cancel support
 * - Tool error handling
 * - Tool call logging
 * - Zod schema → Anthropic tool conversion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
  type ToolRegistry,
  type ToolCallLog,
  type AgentLoopOptions,
} from '@/ai/agentLoop';
import { zodFieldsToJsonSchema, zodSchemasToAnthropicTools } from '@/ai/zodToAnthropicTools';

// ── Mock Anthropic client builder ────────────────────────

interface MockResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

function createMockClient(responses: MockResponse[]) {
  let callIndex = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        if (callIndex >= responses.length) {
          // Default to end_turn if we run out of scripted responses
          return {
            content: [{ type: 'text' as const, text: 'No more responses' }],
            stop_reason: 'end_turn' as const,
          };
        }
        return responses[callIndex++];
      }),
    },
  } as unknown as import('@anthropic-ai/sdk').default;
}

// ── Simple tool registry for tests ──────────────────────

function createTestRegistry(): ToolRegistry {
  const registry: ToolRegistry = new Map();

  registry.set('add_numbers', {
    description: 'Add two numbers together',
    inputSchema: {
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    },
    handler: (input) => {
      const a = input.a as number;
      const b = input.b as number;
      return JSON.stringify({ result: a + b });
    },
  });

  registry.set('echo', {
    description: 'Echo back the input message',
    inputSchema: {
      message: z.string().describe('Message to echo'),
    },
    handler: (input) => {
      return JSON.stringify({ echoed: input.message });
    },
  });

  return registry;
}

function defaultOptions(
  client: import('@anthropic-ai/sdk').default,
  overrides?: Partial<AgentLoopOptions>,
): AgentLoopOptions {
  return {
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Please add 2 and 3.',
    client,
    toolRegistry: createTestRegistry(),
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1024,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

describe('zodFieldsToJsonSchema', () => {
  it('converts simple Zod fields to JSON Schema', () => {
    const fields = {
      name: z.string().describe('A name'),
      count: z.number().optional().describe('Optional count'),
    };
    const schema = zodFieldsToJsonSchema(fields);

    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.name).toBeDefined();
    expect(props.count).toBeDefined();

    // 'name' is required (not optional), 'count' is optional
    const required = (schema as Record<string, unknown>).required as string[] | undefined;
    expect(required).toContain('name');
    expect(required).not.toContain('count');
  });

  it('converts enum Zod fields', () => {
    const fields = {
      format: z.enum(['json', 'xml', 'csv']).describe('Output format'),
    };
    const schema = zodFieldsToJsonSchema(fields);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.format.enum).toEqual(['json', 'xml', 'csv']);
  });

  it('handles empty schema', () => {
    const schema = zodFieldsToJsonSchema({});
    expect(schema.type).toBe('object');
  });

  it('converts array fields', () => {
    const fields = {
      tags: z.array(z.string()).describe('List of tags'),
    };
    const schema = zodFieldsToJsonSchema(fields);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.tags.type).toBe('array');
  });
});

describe('zodSchemasToAnthropicTools', () => {
  it('converts tool registry to Anthropic tool array', () => {
    const registry = createTestRegistry();
    const tools = zodSchemasToAnthropicTools(registry);

    expect(tools).toHaveLength(2);

    const addTool = tools.find((t) => t.name === 'add_numbers');
    expect(addTool).toBeDefined();
    expect(addTool!.description).toBe('Add two numbers together');
    expect(addTool!.input_schema.type).toBe('object');

    const echoTool = tools.find((t) => t.name === 'echo');
    expect(echoTool).toBeDefined();
    expect(echoTool!.description).toBe('Echo back the input message');
  });

  it('includes required fields in the schema', () => {
    const registry = createTestRegistry();
    const tools = zodSchemasToAnthropicTools(registry);

    const addTool = tools.find((t) => t.name === 'add_numbers')!;
    const required = (addTool.input_schema as Record<string, unknown>).required as string[];
    expect(required).toContain('a');
    expect(required).toContain('b');
  });
});

describe('runAgentLoop', () => {
  it('returns final text when model responds without tool_use', async () => {
    const client = createMockClient([
      {
        content: [{ type: 'text', text: 'The answer is 5.' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    expect(result.response).toBe('The answer is 5.');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.iterations).toBe(1);
    expect(result.hitMaxIterations).toBe(false);
  });

  it('executes tool calls and sends results back', async () => {
    const client = createMockClient([
      // First response: model calls the add_numbers tool
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 2, b: 3 } },
        ],
        stop_reason: 'tool_use',
      },
      // Second response: model gives final answer
      {
        content: [{ type: 'text', text: '2 + 3 = 5' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    expect(result.response).toBe('2 + 3 = 5');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('add_numbers');
    expect(result.toolCalls[0]!.input).toEqual({ a: 2, b: 3 });
    expect(result.toolCalls[0]!.result).toBe(JSON.stringify({ result: 5 }));
    expect(result.toolCalls[0]!.isError).toBe(false);
    expect(result.iterations).toBe(2);
    expect(result.hitMaxIterations).toBe(false);
  });

  it('handles multiple sequential tool calls', async () => {
    const client = createMockClient([
      // First: call add_numbers
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 1, b: 2 } },
        ],
        stop_reason: 'tool_use',
      },
      // Second: call echo
      {
        content: [
          { type: 'tool_use', id: 'call_2', name: 'echo', input: { message: 'hello' } },
        ],
        stop_reason: 'tool_use',
      },
      // Third: final answer
      {
        content: [{ type: 'text', text: 'Done!' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    expect(result.response).toBe('Done!');
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]!.name).toBe('add_numbers');
    expect(result.toolCalls[1]!.name).toBe('echo');
    expect(result.iterations).toBe(3);
  });

  it('handles parallel tool calls in a single response', async () => {
    const client = createMockClient([
      // Model calls both tools at once
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 1, b: 2 } },
          { type: 'tool_use', id: 'call_2', name: 'echo', input: { message: 'hi' } },
        ],
        stop_reason: 'tool_use',
      },
      // Final answer
      {
        content: [{ type: 'text', text: 'All done!' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    expect(result.response).toBe('All done!');
    expect(result.toolCalls).toHaveLength(2);
    expect(result.iterations).toBe(2);

    // Verify both results were sent back
    const createCall = (client.messages.create as ReturnType<typeof vi.fn>);
    const lastCallArgs = createCall.mock.calls[1]![0];
    // The user message with tool results should have both results
    const lastUserMsg = lastCallArgs.messages[lastCallArgs.messages.length - 1];
    expect(lastUserMsg.content).toHaveLength(2);
  });

  it('handles unknown tool names gracefully', async () => {
    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'nonexistent_tool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'I see the tool failed.' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.isError).toBe(true);
    expect(result.toolCalls[0]!.result).toContain('Unknown tool');
  });

  it('handles tool handler errors gracefully', async () => {
    const registry = createTestRegistry();
    registry.set('failing_tool', {
      description: 'A tool that always fails',
      inputSchema: {},
      handler: () => {
        throw new Error('Something went wrong');
      },
    });

    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'failing_tool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Tool failed, sorry.' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(
      defaultOptions(client, { toolRegistry: registry }),
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.isError).toBe(true);
    expect(result.toolCalls[0]!.result).toContain('Something went wrong');
  });

  it('handles async tool handlers', async () => {
    const registry = createTestRegistry();
    registry.set('async_tool', {
      description: 'An async tool',
      inputSchema: {
        delay: z.number().describe('Delay in ms'),
      },
      handler: async (input) => {
        return JSON.stringify({ delayed: input.delay });
      },
    });

    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'async_tool', input: { delay: 100 } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Async done.' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(
      defaultOptions(client, { toolRegistry: registry }),
    );

    expect(result.toolCalls[0]!.result).toBe(JSON.stringify({ delayed: 100 }));
    expect(result.toolCalls[0]!.isError).toBe(false);
  });
});

describe('runAgentLoop - max iteration guard', () => {
  it('stops after maxIterations and returns gracefully', async () => {
    // Create a client that always requests tool_use (infinite loop scenario)
    const infiniteResponses: MockResponse[] = Array.from({ length: 60 }, (_, i) => ({
      content: [
        { type: 'tool_use' as const, id: `call_${i}`, name: 'echo', input: { message: `iter_${i}` } },
      ],
      stop_reason: 'tool_use' as const,
    }));

    const client = createMockClient(infiniteResponses);

    const result = await runAgentLoop(
      defaultOptions(client, { maxIterations: 5 }),
    );

    expect(result.hitMaxIterations).toBe(true);
    expect(result.iterations).toBe(5);
    expect(result.toolCalls).toHaveLength(5); // 1 tool call per iteration
    expect(result.response).toContain('terminated');
    expect(result.response).toContain('5');
  });

  it('uses DEFAULT_MAX_ITERATIONS when not specified', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(50);
  });
});

describe('runAgentLoop - abort/cancel support', () => {
  it('returns early when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const client = createMockClient([]);

    const result = await runAgentLoop(
      defaultOptions(client, { signal: controller.signal }),
    );

    expect(result.response).toBe('');
    expect(result.iterations).toBe(0);
    expect(result.toolCalls).toHaveLength(0);
  });

  it('stops between tool calls when aborted mid-loop', async () => {
    const controller = new AbortController();

    const registry = createTestRegistry();
    // Override echo handler to abort after it's called
    registry.set('echo', {
      description: 'Echo with abort',
      inputSchema: { message: z.string().describe('Message') },
      handler: (input) => {
        controller.abort(); // Abort after this tool executes
        return JSON.stringify({ echoed: input.message });
      },
    });

    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'echo', input: { message: 'first' } },
          { type: 'tool_use', id: 'call_2', name: 'echo', input: { message: 'second' } },
        ],
        stop_reason: 'tool_use',
      },
    ]);

    const result = await runAgentLoop(
      defaultOptions(client, { signal: controller.signal, toolRegistry: registry }),
    );

    // Should have executed first tool, then stopped before second
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.input).toEqual({ message: 'first' });
  });
});

describe('runAgentLoop - onToolCall callback', () => {
  it('invokes onToolCall for each tool execution', async () => {
    const logs: ToolCallLog[] = [];

    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 10, b: 20 } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Sum is 30.' }],
        stop_reason: 'end_turn',
      },
    ]);

    await runAgentLoop(
      defaultOptions(client, { onToolCall: (log) => logs.push(log) }),
    );

    expect(logs).toHaveLength(1);
    expect(logs[0]!.name).toBe('add_numbers');
    expect(logs[0]!.result).toBe(JSON.stringify({ result: 30 }));
  });
});

describe('runAgentLoop - message construction', () => {
  it('sends system prompt and user message on first call', async () => {
    const client = createMockClient([
      {
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
      },
    ]);

    await runAgentLoop(defaultOptions(client));

    const createCall = (client.messages.create as ReturnType<typeof vi.fn>);
    expect(createCall).toHaveBeenCalledTimes(1);

    const firstCallArgs = createCall.mock.calls[0]![0];
    expect(firstCallArgs.system).toBe('You are a helpful assistant.');
    expect(firstCallArgs.messages).toHaveLength(1);
    expect(firstCallArgs.messages[0].role).toBe('user');
    expect(firstCallArgs.messages[0].content).toBe('Please add 2 and 3.');
    expect(firstCallArgs.tools).toBeDefined();
    expect(firstCallArgs.tools.length).toBeGreaterThan(0);
  });

  it('sends tool results as user message after tool execution', async () => {
    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 5, b: 7 } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: '12' }],
        stop_reason: 'end_turn',
      },
    ]);

    await runAgentLoop(defaultOptions(client));

    const createCall = (client.messages.create as ReturnType<typeof vi.fn>);
    expect(createCall).toHaveBeenCalledTimes(2);

    // Second call should have: [user, assistant(tool_use), user(tool_result)]
    const secondCallArgs = createCall.mock.calls[1]![0];
    expect(secondCallArgs.messages).toHaveLength(3);
    expect(secondCallArgs.messages[0].role).toBe('user');
    expect(secondCallArgs.messages[1].role).toBe('assistant');
    expect(secondCallArgs.messages[2].role).toBe('user');

    // Tool result content
    const toolResultContent = secondCallArgs.messages[2].content;
    expect(toolResultContent).toHaveLength(1);
    expect(toolResultContent[0].type).toBe('tool_result');
    expect(toolResultContent[0].tool_use_id).toBe('call_1');
    expect(toolResultContent[0].content).toBe(JSON.stringify({ result: 12 }));
    expect(toolResultContent[0].is_error).toBe(false);
  });

  it('marks tool results as is_error when handler throws', async () => {
    const registry = createTestRegistry();
    registry.set('bad_tool', {
      description: 'Fails',
      inputSchema: {},
      handler: () => { throw new Error('Boom'); },
    });

    const client = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'call_err', name: 'bad_tool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Error noted.' }],
        stop_reason: 'end_turn',
      },
    ]);

    await runAgentLoop(defaultOptions(client, { toolRegistry: registry }));

    const createCall = (client.messages.create as ReturnType<typeof vi.fn>);
    const secondCallArgs = createCall.mock.calls[1]![0];
    const toolResult = secondCallArgs.messages[2].content[0];
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('Boom');
  });
});

describe('runAgentLoop - mixed content blocks', () => {
  it('extracts text from response with mixed text and tool_use blocks', async () => {
    const client = createMockClient([
      // Model sends text + tool_use in one response
      {
        content: [
          { type: 'text', text: 'Let me calculate: ' },
          { type: 'tool_use', id: 'call_1', name: 'add_numbers', input: { a: 1, b: 1 } },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'The result is 2.' }],
        stop_reason: 'end_turn',
      },
    ]);

    const result = await runAgentLoop(defaultOptions(client));

    // Final response is from the last message
    expect(result.response).toBe('The result is 2.');
    expect(result.toolCalls).toHaveLength(1);
  });
});
