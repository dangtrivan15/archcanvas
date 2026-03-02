/**
 * AI client for communicating with the Anthropic Claude API.
 * Sends messages through a Vite proxy (/api/anthropic) to avoid CORS issues.
 * Supports both streaming and non-streaming responses.
 */

import { getAnthropicApiKey, aiConfig } from './config';

/** A message in the conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Options for sending a message. */
export interface SendMessageOptions {
  /** Conversation history (user/assistant messages) */
  messages: ChatMessage[];
  /** System prompt */
  system?: string;
  /** Model to use (defaults to aiConfig.model) */
  model?: string;
  /** Max tokens in response (defaults to aiConfig.maxTokens) */
  maxTokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Callback for each streamed text chunk */
  onChunk?: (text: string) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/** Result of a completed message. */
export interface SendMessageResult {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** Error from the Anthropic API. */
export class AIClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorType?: string,
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

/**
 * Get the base URL for API requests.
 * Uses the Vite proxy in development, direct URL otherwise.
 */
function getBaseUrl(): string {
  // In development, use the Vite proxy
  if (import.meta.env.DEV) {
    return '/api/anthropic';
  }
  // In production, use direct API URL (requires separate CORS solution)
  return 'https://api.anthropic.com';
}

/**
 * Send a message to the Anthropic Claude API.
 * Supports both streaming and non-streaming responses.
 */
export async function sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new AIClientError('Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in .env');
  }

  const {
    messages,
    system,
    model = aiConfig.model,
    maxTokens = aiConfig.maxTokens,
    stream = true,
    onChunk,
    signal,
  } = options;

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/v1/messages`;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (system) {
    body.system = system;
  }

  if (stream) {
    body.stream = true;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}`;
    let errorType: string | undefined;
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        errorMessage = errorBody.error.message || errorMessage;
        errorType = errorBody.error.type;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new AIClientError(errorMessage, response.status, errorType);
  }

  if (stream) {
    return handleStreamingResponse(response, onChunk);
  }

  return handleNonStreamingResponse(response);
}

/**
 * Handle a non-streaming response from the API.
 */
async function handleNonStreamingResponse(response: Response): Promise<SendMessageResult> {
  const data = await response.json();
  const content = data.content
    ?.filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('') ?? '';

  return {
    content,
    stopReason: data.stop_reason ?? null,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/**
 * Handle a streaming response from the API using SSE.
 */
async function handleStreamingResponse(
  response: Response,
  onChunk?: (text: string) => void,
): Promise<SendMessageResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AIClientError('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'message_start':
                if (event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens ?? 0;
                }
                break;

              case 'content_block_delta':
                if (event.delta?.type === 'text_delta' && event.delta?.text) {
                  const text = event.delta.text;
                  fullContent += text;
                  onChunk?.(text);
                }
                break;

              case 'message_delta':
                if (event.delta?.stop_reason) {
                  stopReason = event.delta.stop_reason;
                }
                if (event.usage?.output_tokens) {
                  outputTokens = event.usage.output_tokens;
                }
                break;

              case 'error':
                throw new AIClientError(
                  event.error?.message ?? 'Stream error',
                  undefined,
                  event.error?.type,
                );
            }
          } catch (e) {
            if (e instanceof AIClientError) throw e;
            // Ignore individual line parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    content: fullContent,
    stopReason,
    usage: {
      inputTokens,
      outputTokens,
    },
  };
}
