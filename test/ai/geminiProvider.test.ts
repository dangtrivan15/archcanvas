import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatEvent, ProjectContext } from '../../src-web/core/ai/types';

// --- SDK Mock ---

const mockGenerateContentStream = vi.fn();
const modelConstructorCalls: Array<{ model: string; tools?: unknown; systemInstruction?: unknown }> = [];

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    apiKey: string;
    constructor(apiKey: string) {
      this.apiKey = apiKey;
    }
    getGenerativeModel(params: { model: string; tools?: unknown; systemInstruction?: unknown }) {
      modelConstructorCalls.push(params);
      return { generateContentStream: mockGenerateContentStream };
    }
  },
}));

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

function makeChunk(text: string | null, calls: Array<{ name: string; args: Record<string, unknown> }> | null = null) {
  return {
    text: () => text ?? '',
    functionCalls: () => calls ?? undefined,
  };
}

function streamResult(chunks: unknown[]) {
  return {
    stream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    response: Promise.resolve({}),
  };
}

describe('GeminiProvider', () => {
  let GeminiProvider: typeof import('../../src-web/core/ai/providers/gemini').GeminiProvider;
  let useAiSettingsStore: typeof import('../../src-web/store/aiSettingsStore').useAiSettingsStore;
  let setProviderApiKey: typeof import('../../src-web/core/ai/providers/keyStorage').setProviderApiKey;
  let dispatchStoreAction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockGenerateContentStream.mockReset();
    modelConstructorCalls.length = 0;
    localStorage.clear();

    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: class MockGoogleGenerativeAI {
        apiKey: string;
        constructor(apiKey: string) {
          this.apiKey = apiKey;
        }
        getGenerativeModel(params: { model: string; tools?: unknown; systemInstruction?: unknown }) {
          modelConstructorCalls.push(params);
          return { generateContentStream: mockGenerateContentStream };
        }
      },
    }));

    vi.doMock('../../src-web/core/ai/storeActionDispatcher', () => ({
      dispatchStoreAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 'svc-1' } }),
    }));

    vi.doMock('../../src-web/core/ai/systemPrompt', () => ({
      buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
    }));

    const mod = await import('../../src-web/core/ai/providers/gemini');
    GeminiProvider = mod.GeminiProvider;

    const storeMod = await import('../../src-web/store/aiSettingsStore');
    useAiSettingsStore = storeMod.useAiSettingsStore;
    useAiSettingsStore.setState({ selectedProviderId: null, byProvider: {} });

    const keyMod = await import('../../src-web/core/ai/providers/keyStorage');
    setProviderApiKey = keyMod.setProviderApiKey;

    const dispatcherMod = await import('../../src-web/core/ai/storeActionDispatcher');
    dispatchStoreAction = dispatcherMod.dispatchStoreAction as unknown as ReturnType<typeof vi.fn>;
  });

  it('has correct id, displayName, and capabilities', () => {
    const provider = new GeminiProvider();
    expect(provider.id).toBe('gemini');
    expect(provider.displayName).toBe('Gemini');
    expect(provider.capabilities).toEqual({ tools: true, streaming: true });
    expect(provider.supportsTools()).toBe(true);
  });

  it('listModels() returns the static fallback list (no browser SDK list endpoint)', async () => {
    const provider = new GeminiProvider();
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === 'gemini-2.0-flash')).toBe(true);
  });

  it('emits error when no API key is configured', async () => {
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    const provider = new GeminiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('error');
  });

  it('yields text events from streamed chunks and ends with done', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    mockGenerateContentStream.mockResolvedValueOnce(
      streamResult([makeChunk('Hello'), makeChunk(' world')]),
    );

    const provider = new GeminiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    const textEvents = events.filter((e) => e.type === 'text');
    expect(textEvents.length).toBe(2);
    expect((textEvents[0] as any).content).toBe('Hello');
    expect((textEvents[1] as any).content).toBe(' world');
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(dispatchStoreAction).not.toHaveBeenCalled();
  });

  it('a functionCall part drives the dispatcher loop through to done', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    // First call: model wants to call add_node.
    mockGenerateContentStream.mockResolvedValueOnce(
      streamResult([
        makeChunk(null, [{ name: 'add_node', args: { id: 'svc-1', type: 'compute/service' } }]),
      ]),
    );
    // Second call (after tool result fed back): final text answer.
    mockGenerateContentStream.mockResolvedValueOnce(streamResult([makeChunk('Added node svc-1')]));

    const provider = new GeminiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);

    const toolCall = events.find((e) => e.type === 'tool_call') as any;
    expect(toolCall.name).toBe('add_node');
    expect(toolCall.args).toEqual({ id: 'svc-1', type: 'compute/service' });

    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.id).toBe(toolCall.id);
    expect(toolResult.isError).toBeFalsy();

    expect(dispatchStoreAction).toHaveBeenCalledTimes(1);
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);

    // The fed-back history must record the model's functionCall (role 'model')
    // AND a well-formed functionResponse (role 'function') for it — the exact
    // reason this provider hand-rolls its own loop. A wrong role or missing
    // `response` object would malform the next generateContentStream request.
    const history = mockGenerateContentStream.mock.calls[1][0].contents as Array<any>;
    const fnCallEntry = history.find(
      (c) => c.role === 'model' && c.parts?.some((p: any) => p.functionCall),
    );
    expect(fnCallEntry).toBeDefined();
    const fnResponseEntry = history.find(
      (c) => c.role === 'function' && c.parts?.some((p: any) => p.functionResponse),
    );
    expect(fnResponseEntry).toBeDefined();
    const fnResponse = fnResponseEntry.parts.find((p: any) => p.functionResponse).functionResponse;
    expect(fnResponse.name).toBe('add_node');
    expect(fnResponse.response).toBeTypeOf('object');
  });

  it('surfaces tool execution errors with isError', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    dispatchStoreAction.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Node not found' },
    });

    mockGenerateContentStream.mockResolvedValueOnce(
      streamResult([makeChunk(null, [{ name: 'remove_node', args: { id: 'missing' } }])]),
    );
    mockGenerateContentStream.mockResolvedValueOnce(streamResult([makeChunk('Node not found')]));

    const provider = new GeminiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Remove missing', mockContext)) {
      events.push(event);
    }

    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.isError).toBe(true);
  });

  it('emits ChatErrorEvent when the SDK call throws', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    mockGenerateContentStream.mockImplementation(() => {
      throw new Error('Request failed');
    });

    const provider = new GeminiProvider();
    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'error')).toBe(true);
    const errorEvent = events.find((e) => e.type === 'error') as any;
    expect(errorEvent.message).toContain('Request failed');
  });

  it('interrupt() aborts an in-flight stream and ends with done', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    const provider = new GeminiProvider();

    mockGenerateContentStream.mockResolvedValueOnce({
      stream: (async function* () {
        yield makeChunk('Hello');
        throw new DOMException('The operation was aborted', 'AbortError');
      })(),
      response: Promise.resolve({}),
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

  it('passes sanitized Gemini function declarations as tools at model construction', async () => {
    setProviderApiKey('gemini', 'gm-test-key');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');

    mockGenerateContentStream.mockResolvedValueOnce(streamResult([makeChunk('ok')]));

    const provider = new GeminiProvider();
    for await (const _ of provider.sendMessage('Hi', mockContext)) {
      // drain
    }

    expect(modelConstructorCalls).toHaveLength(1);
    expect(modelConstructorCalls[0].model).toBe('gemini-2.0-flash');
    const tools = modelConstructorCalls[0].tools as Array<{ functionDeclarations: Array<{ name: string }> }>;
    expect(tools[0].functionDeclarations.length).toBeGreaterThan(0);
    // Prove these are the SANITIZED declarations, not raw z.toJSONSchema output:
    // no Gemini-rejected keyword ($schema / additionalProperties) survives, so a
    // regression to the raw converter (or toOpenAiTools) would fail here.
    const serialized = JSON.stringify(tools[0].functionDeclarations);
    expect(serialized).not.toContain('$schema');
    expect(serialized).not.toContain('additionalProperties');
  });

  it('live-config regression: model/key edits apply without reconstruction', async () => {
    setProviderApiKey('gemini', 'gm-key-1');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-2.0-flash');
    mockGenerateContentStream.mockResolvedValueOnce(streamResult([makeChunk('a')]));

    const provider = new GeminiProvider();
    for await (const _ of provider.sendMessage('First', mockContext)) {
      // drain
    }
    expect(modelConstructorCalls[0].model).toBe('gemini-2.0-flash');

    setProviderApiKey('gemini', 'gm-key-2');
    useAiSettingsStore.getState().setModel('gemini', 'gemini-1.5-pro');
    mockGenerateContentStream.mockResolvedValueOnce(streamResult([makeChunk('b')]));

    for await (const _ of provider.sendMessage('Second', mockContext)) {
      // drain
    }
    expect(modelConstructorCalls[1].model).toBe('gemini-1.5-pro');
  });
});
