/**
 * Tests for AI client - sends messages to Anthropic Claude API.
 * Feature #166: AI client sends messages to Anthropic Claude API.
 *
 * Uses mock fetch to verify:
 * - Request format and headers are correct
 * - Streaming responses are parsed correctly
 * - Non-streaming responses are parsed correctly
 * - Error handling works properly
 * - Response content is returned to caller
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendMessage, AIClientError } from '@/ai/client';
import type { ChatMessage, SendMessageResult } from '@/ai/client';

// Mock the config module
vi.mock('@/ai/config', () => ({
  getAnthropicApiKey: vi.fn(() => 'test-api-key-12345'),
  aiConfig: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
  },
}));

// We need to mock import.meta.env
vi.stubEnv('DEV', 'true');

// Helper to create a mock non-streaming response
function createMockResponse(content: string, stopReason = 'end_turn'): Response {
  const body = {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: stopReason,
    usage: { input_tokens: 50, output_tokens: 25 },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper to create a mock SSE streaming response
function createMockStreamResponse(chunks: string[]): Response {
  const events = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","usage":{"input_tokens":50}}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    ...chunks.map(
      (chunk) =>
        `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${chunk}"}}\n\n`,
    ),
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":25}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('AI Client - sendMessage', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends request with correct headers and body format', async () => {
    let capturedRequest: { url: string; init: RequestInit } | null = null;

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: url as string, init: init! };
      return createMockResponse('Hello!');
    }) as unknown as typeof fetch;

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
    await sendMessage({ messages, stream: false });

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toContain('/v1/messages');

    const headers = capturedRequest!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-api-key']).toBe('test-api-key-12345');
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(capturedRequest!.init.body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(4096);
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('includes system prompt when provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return createMockResponse('Response');
    }) as unknown as typeof fetch;

    await sendMessage({
      messages: [{ role: 'user', content: 'Hi' }],
      system: 'You are an architecture assistant.',
      stream: false,
    });

    expect(capturedBody!.system).toBe('You are an architecture assistant.');
  });

  it('sends stream=true when streaming is enabled', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return createMockStreamResponse(['Hello', ' world', '!']);
    }) as unknown as typeof fetch;

    await sendMessage({
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
    });

    expect(capturedBody!.stream).toBe(true);
  });

  it('returns complete content from non-streaming response', async () => {
    global.fetch = vi.fn(async () =>
      createMockResponse('The database is a PostgreSQL instance.'),
    ) as unknown as typeof fetch;

    const result: SendMessageResult = await sendMessage({
      messages: [{ role: 'user', content: 'Describe the database' }],
      stream: false,
    });

    expect(result.content).toBe('The database is a PostgreSQL instance.');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(50);
    expect(result.usage.outputTokens).toBe(25);
  });

  it('returns complete content from streaming response', async () => {
    global.fetch = vi.fn(async () =>
      createMockStreamResponse(['Hello', ' from', ' Claude', '!']),
    ) as unknown as typeof fetch;

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    });

    expect(result.content).toBe('Hello from Claude!');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(50);
    expect(result.usage.outputTokens).toBe(25);
  });

  it('calls onChunk for each streaming text chunk', async () => {
    const chunks = ['Hello', ' from', ' Claude', '!'];
    global.fetch = vi.fn(async () => createMockStreamResponse(chunks)) as unknown as typeof fetch;

    const receivedChunks: string[] = [];
    await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
      onChunk: (text) => receivedChunks.push(text),
    });

    expect(receivedChunks).toEqual(chunks);
  });

  it('handles multiple messages in conversation history', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return createMockResponse('Sure, the API Gateway connects to...');
    }) as unknown as typeof fetch;

    const messages: ChatMessage[] = [
      { role: 'user', content: 'What is in my architecture?' },
      { role: 'assistant', content: 'Your architecture has 5 nodes.' },
      { role: 'user', content: 'Tell me more about the API Gateway.' },
    ];

    await sendMessage({ messages, stream: false });

    const body = capturedBody as Record<string, unknown>;
    const sentMessages = body.messages as ChatMessage[];
    expect(sentMessages).toHaveLength(3);
    expect(sentMessages[0].role).toBe('user');
    expect(sentMessages[1].role).toBe('assistant');
    expect(sentMessages[2].role).toBe('user');
    expect(sentMessages[2].content).toBe('Tell me more about the API Gateway.');
  });

  it('throws AIClientError when API key is not configured', async () => {
    const configModule = await import('@/ai/config');
    vi.mocked(configModule.getAnthropicApiKey).mockReturnValue(undefined);

    await expect(sendMessage({ messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(
      AIClientError,
    );

    await expect(sendMessage({ messages: [{ role: 'user', content: 'Hello' }] })).rejects.toThrow(
      'API key not configured',
    );

    // Restore the mock for subsequent tests
    vi.mocked(configModule.getAnthropicApiKey).mockReturnValue('test-api-key-12345');
  });

  it('throws AIClientError on HTTP error response', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'Invalid API key',
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    try {
      await sendMessage({
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      });
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AIClientError);
      const err = e as AIClientError;
      expect(err.message).toBe('Invalid API key');
      expect(err.statusCode).toBe(401);
      expect(err.errorType).toBe('authentication_error');
    }
  });

  it('throws AIClientError on rate limit (429) response', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          type: 'error',
          error: {
            type: 'rate_limit_error',
            message: 'Rate limit exceeded',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    try {
      await sendMessage({
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      });
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AIClientError);
      const err = e as AIClientError;
      expect(err.statusCode).toBe(429);
      expect(err.errorType).toBe('rate_limit_error');
    }
  });

  it('uses custom model and maxTokens when provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return createMockResponse('Response');
    }) as unknown as typeof fetch;

    await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'claude-3-haiku-20240307',
      maxTokens: 1024,
      stream: false,
    });

    expect(capturedBody!.model).toBe('claude-3-haiku-20240307');
    expect(capturedBody!.max_tokens).toBe(1024);
  });

  it('request URL uses proxy path in dev mode', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url as string;
      return createMockResponse('Response');
    }) as unknown as typeof fetch;

    await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    });

    // In dev mode, should use the proxy path
    expect(capturedUrl).toContain('/api/anthropic/v1/messages');
  });

  it('concatenates multiple text content blocks in non-streaming response', async () => {
    const multiBlockBody = {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Part one. ' },
        { type: 'text', text: 'Part two.' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 8 },
    };

    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(multiBlockBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
    });

    expect(result.content).toBe('Part one. Part two.');
  });

  it('handles empty streaming response gracefully', async () => {
    // Stream with no content blocks
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":5}}}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":0}}\n\n',
          ),
        );
        controller.close();
      },
    });

    global.fetch = vi.fn(async () => {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as unknown as typeof fetch;

    const result = await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    });

    expect(result.content).toBe('');
    expect(result.stopReason).toBe('end_turn');
  });

  it('passes AbortSignal through to fetch', async () => {
    let capturedSignal: AbortSignal | undefined;

    global.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return createMockResponse('Response');
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    await sendMessage({
      messages: [{ role: 'user', content: 'Hello' }],
      stream: false,
      signal: controller.signal,
    });

    expect(capturedSignal).toBe(controller.signal);
  });
});
