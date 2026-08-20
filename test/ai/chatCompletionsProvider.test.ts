import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatEvent, ProjectContext } from '../../src-web/core/ai/types';

// --- SDK Mock ---

const mockCreate = vi.fn();
const mockModelsList = vi.fn();
const constructorCalls: Array<{ apiKey?: string; baseURL?: string }> = [];

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    models = { list: mockModelsList };
    constructor(opts: { apiKey?: string; baseURL?: string }) {
      constructorCalls.push(opts);
    }
  },
}));

// --- Dispatcher / prompt mocks (same pattern as apiKeyProvider.test.ts) ---

vi.mock('../../src-web/core/ai/storeActionDispatcher', () => ({
  dispatchStoreAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 'svc-1' } }),
}));

vi.mock('../../src-web/core/ai/systemPrompt', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
}));

const mockContext: ProjectContext = {
  projectName: 'test-project',
  currentScope: '__root__',
  projectPath: '/test',
};

/** Helper: create a mock streaming async iterable of ChatCompletionChunks. */
function createMockStream(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function textChunk(content: string, finishReason: string | null = null) {
  return { choices: [{ index: 0, delta: { content }, finish_reason: finishReason }] };
}

function toolCallStartChunk(index: number, id: string, name: string) {
  return {
    choices: [
      {
        index: 0,
        delta: { tool_calls: [{ index, id, type: 'function', function: { name, arguments: '' } }] },
        finish_reason: null,
      },
    ],
  };
}

function toolCallArgsChunk(index: number, argsFragment: string) {
  return {
    choices: [
      {
        index: 0,
        delta: { tool_calls: [{ index, function: { arguments: argsFragment } }] },
        finish_reason: null,
      },
    ],
  };
}

function finishChunk(finishReason: string) {
  return { choices: [{ index: 0, delta: {}, finish_reason: finishReason }] };
}

describe('ChatCompletionsProviderBase (via OpenAiProvider)', () => {
  let OpenAiProvider: typeof import('../../src-web/core/ai/providers/openai').OpenAiProvider;
  let useAiSettingsStore: typeof import('../../src-web/store/aiSettingsStore').useAiSettingsStore;
  let setProviderApiKey: typeof import('../../src-web/core/ai/providers/keyStorage').setProviderApiKey;
  let dispatchStoreAction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    mockModelsList.mockReset();
    constructorCalls.length = 0;
    localStorage.clear();

    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        chat = { completions: { create: mockCreate } };
        models = { list: mockModelsList };
        constructor(opts: { apiKey?: string; baseURL?: string }) {
          constructorCalls.push(opts);
        }
      },
    }));

    vi.doMock('../../src-web/core/ai/storeActionDispatcher', () => ({
      dispatchStoreAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 'svc-1' } }),
    }));

    vi.doMock('../../src-web/core/ai/systemPrompt', () => ({
      buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
    }));

    const openaiMod = await import('../../src-web/core/ai/providers/openai');
    OpenAiProvider = openaiMod.OpenAiProvider;

    const storeMod = await import('../../src-web/store/aiSettingsStore');
    useAiSettingsStore = storeMod.useAiSettingsStore;
    useAiSettingsStore.setState({ selectedProviderId: null, byProvider: {} });

    const keyMod = await import('../../src-web/core/ai/providers/keyStorage');
    setProviderApiKey = keyMod.setProviderApiKey;

    const dispatcherMod = await import('../../src-web/core/ai/storeActionDispatcher');
    dispatchStoreAction = dispatcherMod.dispatchStoreAction as unknown as ReturnType<typeof vi.fn>;
  });

  it('has correct id, displayName, and capabilities', () => {
    const provider = new OpenAiProvider();
    expect(provider.id).toBe('openai');
    expect(provider.displayName).toBe('OpenAI');
    expect(provider.capabilities).toEqual({ tools: true, streaming: true });
    expect(provider.supportsTools()).toBe(true);
  });

  it('yields text events from streaming response', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Hello'), textChunk(' world'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    const textEvents = events.filter((e) => e.type === 'text');
    expect(textEvents.length).toBe(2);
    expect((textEvents[0] as any).content).toBe('Hello');
    expect((textEvents[1] as any).content).toBe(' world');
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('executes tool loop: tool_call → dispatchStoreAction → tool_result → continue', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'add_node'),
        toolCallArgsChunk(0, '{"id":"svc-1",'),
        toolCallArgsChunk(0, '"type":"compute/service"}'),
        finishChunk('tool_calls'),
      ]),
    );
    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Added node svc-1'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);

    const toolCall = events.find((e) => e.type === 'tool_call') as any;
    expect(toolCall.name).toBe('add_node');
    expect(toolCall.id).toBe('call_1');
    expect(toolCall.args).toEqual({ id: 'svc-1', type: 'compute/service' });

    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.id).toBe('call_1');
    expect(toolResult.isError).toBeFalsy();

    expect(dispatchStoreAction).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles tool execution error with isError', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    dispatchStoreAction.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Node not found' },
    });

    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'remove_node'),
        toolCallArgsChunk(0, '{"id":"missing"}'),
        finishChunk('tool_calls'),
      ]),
    );
    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Node not found'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Remove missing', mockContext)) {
      events.push(event);
    }

    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.isError).toBe(true);
  });

  it('executes tool calls even when finish_reason is "stop" (local OpenAI-compat servers)', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    // Tool call is accumulated but the stream ends with finish_reason 'stop'
    // (not 'tool_calls') — the documented behavior of llama.cpp/vLLM/Ollama.
    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'add_node'),
        toolCallArgsChunk(0, '{"id":"svc-1","type":"compute/service"}'),
        finishChunk('stop'),
      ]),
    );
    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Added node svc-1'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    // Tool was executed despite finish_reason !== 'tool_calls'.
    expect(dispatchStoreAction).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    // Loop continued to feed the tool result back (second create call).
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // The follow-up request must carry the assistant `tool_calls` message AND a
    // matching `tool` message — otherwise OpenAI 400s "an assistant message
    // with tool_calls must be followed by tool messages".
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const assistantMsg = secondCallMessages.find((m: any) => m.role === 'assistant' && m.tool_calls);
    expect(assistantMsg?.tool_calls?.[0]?.id).toBe('call_1');
    const toolMsg = secondCallMessages.find((m: any) => m.role === 'tool');
    expect(toolMsg?.tool_call_id).toBe('call_1');
  });

  it('keeps history consistent (a tool result per call) when tool dispatch throws', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    // Simulate translateToolArgs/dispatch throwing (e.g. import_yaml on
    // malformed YAML, which parseCanvas rejects).
    dispatchStoreAction.mockRejectedValueOnce(new Error('store exploded'));

    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'add_node'),
        toolCallArgsChunk(0, '{"id":"svc-1","type":"compute/service"}'),
        finishChunk('tool_calls'),
      ]),
    );
    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Recovered'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    // The throw is surfaced as an error tool_result, not an unhandled crash.
    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult).toBeDefined();
    expect(toolResult.isError).toBe(true);
    expect(toolResult.result).toContain('store exploded');
    // The loop still terminates cleanly, and the follow-up request carries a
    // matching `tool` message so it wouldn't 400.
    expect(events.some((e) => e.type === 'done')).toBe(true);
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    expect(secondCallMessages.some((m: any) => m.role === 'tool' && m.tool_call_id === 'call_1')).toBe(true);
  });

  it('falls back to empty args (does not crash) when accumulated tool-call arguments are malformed JSON', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    // Truncated/invalid JSON — e.g. a stream cut short mid-argument.
    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'add_node'),
        toolCallArgsChunk(0, '{"id":"svc-1", "type":'),
        finishChunk('tool_calls'),
      ]),
    );
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('Recovered'), finishChunk('stop')]));

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    // No crash: the tool call still executes with `{}` args, and dispatch
    // (and thus the rest of the loop) still runs.
    const toolCallEvent = events.find((e) => e.type === 'tool_call') as any;
    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent.args).toEqual({});
    expect(dispatchStoreAction).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('executes and records a result for every call when multiple tool calls arrive in one turn', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(
      createMockStream([
        toolCallStartChunk(0, 'call_1', 'add_node'),
        toolCallArgsChunk(0, '{"id":"svc-1","type":"compute/service"}'),
        toolCallStartChunk(1, 'call_2', 'add_node'),
        toolCallArgsChunk(1, '{"id":"svc-2","type":"compute/service"}'),
        finishChunk('tool_calls'),
      ]),
    );
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('Added both'), finishChunk('stop')]));

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add two services', mockContext)) {
      events.push(event);
    }

    expect(dispatchStoreAction).toHaveBeenCalledTimes(2);
    const toolResults = events.filter((e) => e.type === 'tool_result') as any[];
    expect(toolResults).toHaveLength(2);
    expect(toolResults.map((r) => r.id).sort()).toEqual(['call_1', 'call_2']);

    // Both calls' results must be present in the follow-up request, or the
    // API would 400 on the dangling second `tool_calls` entry.
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolMsgs = secondCallMessages.filter((m: any) => m.role === 'tool');
    expect(toolMsgs.map((m: any) => m.tool_call_id).sort()).toEqual(['call_1', 'call_2']);
  });

  it('refreshes the system prompt on every turn (not frozen at turn 1)', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(createMockStream([textChunk('one'), finishChunk('stop')]));
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('two'), finishChunk('stop')]));

    const provider = new OpenAiProvider();
    for await (const _ of provider.sendMessage('First', { ...mockContext, currentScope: '__root__' })) {
      // drain
    }
    for await (const _ of provider.sendMessage('Second', { ...mockContext, currentScope: 'billing' })) {
      // drain
    }

    // Both requests carry exactly one system message at position 0 (it is
    // replaced, not duplicated, on the second turn).
    const secondMessages = mockCreate.mock.calls[1][0].messages;
    const systemMessages = secondMessages.filter((m: any) => m.role === 'system');
    expect(systemMessages).toHaveLength(1);
    expect(secondMessages[0].role).toBe('system');
  });

  it('emits ChatErrorEvent on API error', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockImplementation(() => {
      throw new Error('Internal server error');
    });

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('test', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'error')).toBe(true);
    const errorEvent = events.find((e) => e.type === 'error') as any;
    expect(errorEvent.message).toContain('Internal server error');
  });

  it('emits error when no API key is configured', async () => {
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    const provider = new OpenAiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('test', mockContext)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('interrupt() aborts an in-flight stream and ends with done', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    const provider = new OpenAiProvider();

    mockCreate.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield textChunk('Hello');
        throw new DOMException('The operation was aborted', 'AbortError');
      },
    });

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Long task', mockContext)) {
      events.push(event);
      if (events.length === 1) {
        provider.interrupt();
      }
    }

    expect(events[events.length - 1]?.type).toBe('done');
  });

  it('degradation: omits tools and skips dispatch when supportsTools() is false', async () => {
    setProviderApiKey('openai', 'sk-test');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Just talking, no tools.'), finishChunk('stop')]),
    );

    const provider = new OpenAiProvider();
    // Force degraded mode without needing a second provider class.
    vi.spyOn(provider, 'supportsTools').mockReturnValue(false);

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Analyze only', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'text')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(events.some((e) => e.type === 'tool_call')).toBe(false);
    expect(dispatchStoreAction).not.toHaveBeenCalled();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('tools');
  });

  it('live-config regression: reflects aiSettingsStore/key edits without reconstruction', async () => {
    setProviderApiKey('openai', 'sk-test-1');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o-mini');

    mockCreate.mockReturnValueOnce(createMockStream([textChunk('First'), finishChunk('stop')]));

    const provider = new OpenAiProvider();
    const firstEvents: ChatEvent[] = [];
    for await (const event of provider.sendMessage('First call', mockContext)) {
      firstEvents.push(event);
    }

    expect(mockCreate.mock.calls[0][0].model).toBe('gpt-4o-mini');
    expect(constructorCalls[0].apiKey).toBe('sk-test-1');

    // Mutate the store/key WITHOUT reconstructing the provider.
    setProviderApiKey('openai', 'sk-test-2');
    useAiSettingsStore.getState().setModel('openai', 'gpt-4o');

    mockCreate.mockReturnValueOnce(createMockStream([textChunk('Second'), finishChunk('stop')]));

    const secondEvents: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Second call', mockContext)) {
      secondEvents.push(event);
    }

    expect(mockCreate.mock.calls[1][0].model).toBe('gpt-4o');
    expect(constructorCalls[1].apiKey).toBe('sk-test-2');
  });
});

describe('OllamaProvider', () => {
  let OllamaProvider: typeof import('../../src-web/core/ai/providers/ollama').OllamaProvider;
  let useAiSettingsStore: typeof import('../../src-web/store/aiSettingsStore').useAiSettingsStore;
  let dispatchStoreAction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    mockModelsList.mockReset();
    constructorCalls.length = 0;
    localStorage.clear();

    vi.doMock('openai', () => ({
      default: class MockOpenAI {
        chat = { completions: { create: mockCreate } };
        models = { list: mockModelsList };
        constructor(opts: { apiKey?: string; baseURL?: string }) {
          constructorCalls.push(opts);
        }
      },
    }));

    vi.doMock('../../src-web/core/ai/storeActionDispatcher', () => ({
      dispatchStoreAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 'svc-1' } }),
    }));

    vi.doMock('../../src-web/core/ai/systemPrompt', () => ({
      buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
    }));

    const mod = await import('../../src-web/core/ai/providers/ollama');
    OllamaProvider = mod.OllamaProvider;

    const storeMod = await import('../../src-web/store/aiSettingsStore');
    useAiSettingsStore = storeMod.useAiSettingsStore;
    useAiSettingsStore.setState({ selectedProviderId: null, byProvider: {} });

    const dispatcherMod = await import('../../src-web/core/ai/storeActionDispatcher');
    dispatchStoreAction = dispatcherMod.dispatchStoreAction as unknown as ReturnType<typeof vi.fn>;
  });

  it('has correct id and displayName; no API key required', () => {
    const provider = new OllamaProvider();
    expect(provider.id).toBe('ollama');
    expect(provider.displayName).toBe('Ollama');
  });

  it('defaults to http://localhost:11434/v1 when baseUrl is unset', async () => {
    useAiSettingsStore.getState().setModel('ollama', 'llama3.1');
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('hi'), finishChunk('stop')]));

    const provider = new OllamaProvider();
    for await (const _ of provider.sendMessage('Hi', mockContext)) {
      // drain
    }

    expect(constructorCalls[0].baseURL).toBe('http://localhost:11434/v1');
  });

  it('builds baseURL from the configured host', async () => {
    useAiSettingsStore.getState().setModel('ollama', 'llama3.1');
    useAiSettingsStore.getState().setBaseUrl('ollama', 'http://my-ollama-box:11434');
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('hi'), finishChunk('stop')]));

    const provider = new OllamaProvider();
    for await (const _ of provider.sendMessage('Hi', mockContext)) {
      // drain
    }

    expect(constructorCalls[0].baseURL).toBe('http://my-ollama-box:11434/v1');
  });

  it('does not error when no API key is configured (key optional)', async () => {
    useAiSettingsStore.getState().setModel('ollama', 'llama3.1');
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('hi'), finishChunk('stop')]));

    const provider = new OllamaProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // supportsTools() — models.ts lookup
  // -------------------------------------------------------------------------

  describe('supportsTools()', () => {
    it('returns false for a model flagged non-tool-capable in models.ts', () => {
      useAiSettingsStore.getState().setModel('ollama', 'nomic-embed-text');
      const provider = new OllamaProvider();
      expect(provider.supportsTools()).toBe(false);
    });

    it('returns true (default) for a model absent from the static list', () => {
      useAiSettingsStore.getState().setModel('ollama', 'some-unlisted-model:latest');
      const provider = new OllamaProvider();
      expect(provider.supportsTools()).toBe(true);
    });

    it('returns true for a known tool-capable model', () => {
      useAiSettingsStore.getState().setModel('ollama', 'llama3.1');
      const provider = new OllamaProvider();
      expect(provider.supportsTools()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Degradation path (Decision 6 / §4)
  // -------------------------------------------------------------------------

  it('degradation: a non-tool-capable model sends no tools and never dispatches', async () => {
    useAiSettingsStore.getState().setModel('ollama', 'nomic-embed-text');

    mockCreate.mockReturnValueOnce(
      createMockStream([textChunk('Conversational answer only.'), finishChunk('stop')]),
    );

    const provider = new OllamaProvider();
    expect(provider.supportsTools()).toBe(false);

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Review my architecture', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'text')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(events.some((e) => e.type === 'tool_call')).toBe(false);
    expect(dispatchStoreAction).not.toHaveBeenCalled();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('tools');
  });

  // -------------------------------------------------------------------------
  // listModels() — /api/tags mapping
  // -------------------------------------------------------------------------

  describe('listModels()', () => {
    it('maps remote /api/tags models against the static supportsTools list', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.1' }, { name: 'nomic-embed-text' }, { name: 'brand-new-model' }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const provider = new OllamaProvider();
      const models = await provider.listModels();

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags');
      const byId = new Map(models.map((m) => [m.id, m]));
      expect(byId.get('llama3.1')?.supportsTools).toBeUndefined(); // known tool-capable → omitted (true by absence)
      expect(byId.get('nomic-embed-text')?.supportsTools).toBe(false);
      expect(byId.get('brand-new-model')?.supportsTools).toBeUndefined();

      vi.unstubAllGlobals();
    });

    it('falls back to the static list when the fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

      const provider = new OllamaProvider();
      const models = await provider.listModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === 'nomic-embed-text' && m.supportsTools === false)).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  it('live-config regression: host/model edits apply without reconstruction', async () => {
    useAiSettingsStore.getState().setModel('ollama', 'llama3.1');
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('a'), finishChunk('stop')]));

    const provider = new OllamaProvider();
    for await (const _ of provider.sendMessage('First', mockContext)) {
      // drain
    }
    expect(mockCreate.mock.calls[0][0].model).toBe('llama3.1');
    expect(constructorCalls[0].baseURL).toBe('http://localhost:11434/v1');

    useAiSettingsStore.getState().setModel('ollama', 'qwen2.5');
    useAiSettingsStore.getState().setBaseUrl('ollama', 'http://other-host:11434');
    mockCreate.mockReturnValueOnce(createMockStream([textChunk('b'), finishChunk('stop')]));

    for await (const _ of provider.sendMessage('Second', mockContext)) {
      // drain
    }
    expect(mockCreate.mock.calls[1][0].model).toBe('qwen2.5');
    expect(constructorCalls[1].baseURL).toBe('http://other-host:11434/v1');
  });
});
