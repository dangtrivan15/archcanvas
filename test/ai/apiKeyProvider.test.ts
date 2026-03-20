import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProjectContext, ChatEvent } from '../../src/core/ai/types';

// --- SDK Mock ---

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  },
}));

// --- Store Mocks ---

vi.mock('../../src/store/apiKeyStore', () => ({
  useApiKeyStore: {
    getState: vi.fn().mockReturnValue({
      apiKey: 'sk-ant-test-key',
      model: 'claude-sonnet-4-6-20250919',
      isValidated: true,
    }),
    setState: vi.fn(),
  },
}));

vi.mock('../../src/core/ai/storeActionDispatcher', () => ({
  dispatchStoreAction: vi.fn().mockReturnValue({ ok: true, data: { id: 'svc-1' } }),
}));

vi.mock('../../src/core/ai/systemPrompt', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
}));

const mockContext: ProjectContext = {
  projectName: 'test-project',
  currentScope: '__root__',
  projectPath: '/test',
};

/** Helper: create a mock streaming response */
function createMockStream(events: unknown[], stopReason = 'end_turn', contentBlocks: unknown[] = []) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
    finalMessage: async () => ({
      stop_reason: stopReason,
      content: contentBlocks,
    }),
  };
}

describe('ApiKeyProvider', () => {
  let ApiKeyProvider: typeof import('../../src/core/ai/apiKeyProvider').ApiKeyProvider;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();

    // Re-apply mocks after resetModules
    vi.mock('@anthropic-ai/sdk', () => ({
      default: class MockAnthropic {
        messages = { create: mockCreate };
        constructor(_opts: unknown) {}
      },
    }));

    vi.mock('../../src/store/apiKeyStore', () => ({
      useApiKeyStore: {
        getState: vi.fn().mockReturnValue({
          apiKey: 'sk-ant-test-key',
          model: 'claude-sonnet-4-6-20250919',
          isValidated: true,
        }),
        setState: vi.fn(),
      },
    }));

    vi.mock('../../src/core/ai/storeActionDispatcher', () => ({
      dispatchStoreAction: vi.fn().mockReturnValue({ ok: true, data: { id: 'svc-1' } }),
    }));

    vi.mock('../../src/core/ai/systemPrompt', () => ({
      buildSystemPrompt: vi.fn().mockReturnValue('You are an architecture assistant.'),
    }));

    const mod = await import('../../src/core/ai/apiKeyProvider');
    ApiKeyProvider = mod.ApiKeyProvider;
  });

  it('has correct id and displayName', () => {
    const provider = new ApiKeyProvider();
    expect(provider.id).toBe('claude-api-key');
    expect(provider.displayName).toBe('Claude (API Key)');
  });

  it('yields text events from streaming response', async () => {
    const provider = new ApiKeyProvider();

    mockCreate.mockReturnValue(createMockStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ], 'end_turn', [{ type: 'text', text: 'Hello world' }]));

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Hi', mockContext)) {
      events.push(event);
    }

    const textEvents = events.filter((e) => e.type === 'text');
    expect(textEvents.length).toBe(2);
    expect(textEvents[0].requestId).toBeTruthy();
    expect((textEvents[0] as any).content).toBe('Hello');
    expect((textEvents[1] as any).content).toBe(' world');
    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('executes tool loop: tool_use → dispatchStoreAction → tool_result → continue', async () => {
    const provider = new ApiKeyProvider();

    // First call: returns tool_use
    mockCreate.mockReturnValueOnce(createMockStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tool-1', name: 'add_node', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"id":"svc-1","type":"compute/service"}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ], 'tool_use', [
      { type: 'tool_use', id: 'tool-1', name: 'add_node', input: { id: 'svc-1', type: 'compute/service' } },
    ]));

    // Second call: returns text (end of loop)
    mockCreate.mockReturnValueOnce(createMockStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Added node svc-1' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ], 'end_turn', [{ type: 'text', text: 'Added node svc-1' }]));

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Add a service', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'tool_call')).toBe(true);
    expect(events.some((e) => e.type === 'tool_result')).toBe(true);
    expect(events.some((e) => e.type === 'done')).toBe(true);

    // Verify tool_call event has correct data
    const toolCall = events.find((e) => e.type === 'tool_call') as any;
    expect(toolCall.name).toBe('add_node');
    expect(toolCall.id).toBe('tool-1');

    // Verify tool_result event
    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.id).toBe('tool-1');
    expect(toolResult.isError).toBeFalsy();

    // Two API calls made
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles tool execution error with is_error', async () => {
    const provider = new ApiKeyProvider();

    // Import to access the mock
    const { dispatchStoreAction } = await import('../../src/core/ai/storeActionDispatcher');
    (dispatchStoreAction as any).mockReturnValueOnce({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Node not found' },
    });

    // First call: tool_use
    mockCreate.mockReturnValueOnce(createMockStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tool-1', name: 'remove_node', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"id":"missing"}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ], 'tool_use', [
      { type: 'tool_use', id: 'tool-1', name: 'remove_node', input: { id: 'missing' } },
    ]));

    // Second call: Claude handles the error gracefully
    mockCreate.mockReturnValueOnce(createMockStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Node not found' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_stop' },
    ], 'end_turn', [{ type: 'text', text: 'Node not found' }]));

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('Remove missing', mockContext)) {
      events.push(event);
    }

    const toolResult = events.find((e) => e.type === 'tool_result') as any;
    expect(toolResult.isError).toBe(true);
  });

  it('handles interrupt via AbortController', async () => {
    const provider = new ApiKeyProvider();

    // Create a slow streaming response
    mockCreate.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
        yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } };
        // Simulate slow stream - throw AbortError when aborted
        throw new DOMException('The operation was aborted', 'AbortError');
      },
      finalMessage: async () => ({ stop_reason: 'end_turn', content: [] }),
    });

    const events: ChatEvent[] = [];
    const iter = provider.sendMessage('Long task', mockContext);

    for await (const event of iter) {
      events.push(event);
      if (events.length === 1) {
        provider.interrupt();
      }
    }

    // Should end with done event (graceful stop)
    expect(events[events.length - 1]?.type).toBe('done');
  });

  it('handles API errors', async () => {
    const provider = new ApiKeyProvider();

    mockCreate.mockImplementation(() => {
      throw new Error('Internal server error');
    });

    const events: ChatEvent[] = [];
    for await (const event of provider.sendMessage('test', mockContext)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'error')).toBe(true);
    const errorEvent = events.find((e) => e.type === 'error') as any;
    expect(errorEvent.message).toContain('Internal server error');
  });

  it('clears history on loadHistory', () => {
    const provider = new ApiKeyProvider();
    // Calling loadHistory should not throw
    provider.loadHistory([]);
  });

  it('available reflects apiKeyStore.isValidated', async () => {
    const { useApiKeyStore } = await import('../../src/store/apiKeyStore');

    // With validated key
    (useApiKeyStore.getState as any).mockReturnValue({ isValidated: true, apiKey: 'key', model: 'model' });
    const provider = new ApiKeyProvider();
    expect(provider.available).toBe(true);

    // Without validated key
    (useApiKeyStore.getState as any).mockReturnValue({ isValidated: false, apiKey: null, model: 'model' });
    expect(provider.available).toBe(false);
  });
});
