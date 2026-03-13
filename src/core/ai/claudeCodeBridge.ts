/**
 * Claude Code Bridge — wraps the Claude Agent SDK to provide session management.
 *
 * This is a Node.js-only module. It must NEVER be bundled into the browser build.
 * The `vite.config.ts` externalises it via `build.rollupOptions.external`.
 */

import type {
  ChatEvent,
  ChatMessage,
  ProjectContext,
} from './types';
import { buildSystemPrompt } from './systemPrompt';

// ---------------------------------------------------------------------------
// SDK function type — dependency injection for testability
// ---------------------------------------------------------------------------

/**
 * Minimal shape of the SDK `query` function we depend on.
 * The real implementation comes from `@anthropic-ai/claude-agent-sdk`.
 * Tests inject a mock that conforms to this interface.
 */
export type SDKQueryFn = (args: {
  prompt: string;
  options?: {
    systemPrompt?: string;
    cwd?: string;
    abortController?: AbortController;
    resume?: string;
    allowedTools?: string[];
    permissionMode?: string;
    canUseTool?: (
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>;
  };
}) => AsyncIterable<SDKMessage>;

/** Minimal SDK message shape we translate from. */
export interface SDKMessage {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// BridgeSession interface
// ---------------------------------------------------------------------------

export interface BridgeSession {
  sendMessage(
    content: string,
    context: ProjectContext,
  ): AsyncIterable<ChatEvent>;
  respondToPermission(id: string, allowed: boolean): void;
  loadHistory(messages: ChatMessage[]): void;
  abort(): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface PendingPermission {
  resolve: (allowed: boolean) => void;
}

// ---------------------------------------------------------------------------
// createBridgeSession
// ---------------------------------------------------------------------------

/**
 * Callback invoked when the SDK needs a tool permission decision.
 * The Vite plugin wires this to send the permission_request over WebSocket.
 */
export type OnPermissionRequest = (event: {
  type: 'permission_request';
  requestId: string;
  id: string;
  tool: string;
  command: string;
}) => void;

export interface BridgeSessionOptions {
  cwd: string;
  /** Injectable SDK query function. Defaults to the real SDK at runtime. */
  queryFn?: SDKQueryFn;
  /** Called when the SDK requests a tool permission decision. */
  onPermissionRequest?: OnPermissionRequest;
}

export function createBridgeSession(options: BridgeSessionOptions): BridgeSession {
  const { cwd, onPermissionRequest } = options;

  // Lazy-load real SDK only when no mock is provided
  let queryFn: SDKQueryFn | undefined = options.queryFn;

  let abortController: AbortController | null = null;
  let sessionId: string | undefined;
  let destroyed = false;
  const pendingPermissions = new Map<string, PendingPermission>();
  let conversationHistory: ChatMessage[] = [];

  async function resolveQueryFn(): Promise<SDKQueryFn> {
    if (queryFn) return queryFn;
    // Dynamic import so the real SDK is only loaded at runtime in Node.js
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    queryFn = sdk.query as unknown as SDKQueryFn;
    return queryFn;
  }

  /**
   * Translate SDK messages into our ChatEvent stream.
   * The SDK emits rich typed messages; we map them to our simpler ChatEvent union.
   */
  async function* translateSDKStream(
    sdkStream: AsyncIterable<SDKMessage>,
    requestId: string,
  ): AsyncGenerator<ChatEvent> {
    for await (const msg of sdkStream) {
      if (destroyed) return;

      switch (msg.type) {
        case 'system': {
          // Capture session ID for potential resume
          if (msg.subtype === 'init' && typeof msg.session_id === 'string') {
            sessionId = msg.session_id;
          }
          // System messages are internal; don't forward to client
          break;
        }

        case 'assistant': {
          // Extract text and tool_use blocks from the assistant message
          const message = msg.message as {
            content?: Array<{
              type: string;
              text?: string;
              id?: string;
              name?: string;
              input?: Record<string, unknown>;
            }>;
          };
          if (message?.content && Array.isArray(message.content)) {
            for (const block of message.content) {
              if (block.type === 'text' && block.text) {
                yield { type: 'text', requestId, content: block.text };
              } else if (block.type === 'tool_use') {
                yield {
                  type: 'tool_call',
                  requestId,
                  name: block.name ?? 'unknown',
                  args: block.input ?? {},
                  id: block.id ?? '',
                };
              } else if (block.type === 'thinking' && block.text) {
                yield { type: 'thinking', requestId, content: block.text };
              }
            }
          }
          break;
        }

        case 'user': {
          // User messages may contain tool_results (from the SDK's tool loop)
          const userMsg = msg.message as {
            content?: Array<{
              type: string;
              tool_use_id?: string;
              content?: string;
              is_error?: boolean;
            }>;
          };
          if (userMsg?.content && Array.isArray(userMsg.content)) {
            for (const block of userMsg.content) {
              if (block.type === 'tool_result') {
                yield {
                  type: 'tool_result',
                  requestId,
                  id: block.tool_use_id ?? '',
                  result: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                  isError: block.is_error,
                };
              }
            }
          }
          break;
        }

        case 'result': {
          const subtype = msg.subtype as string;
          if (subtype === 'success') {
            yield { type: 'done', requestId };
          } else {
            // Error result
            const errors = (msg.errors as string[] | undefined) ?? [];
            yield {
              type: 'error',
              requestId,
              message: errors.join('; ') || `Session ended: ${subtype}`,
              code: subtype,
            };
          }
          break;
        }

        default:
          // Other SDK message types (stream_event, status, etc.) — skip
          break;
      }
    }
  }

  return {
    async *sendMessage(
      content: string,
      context: ProjectContext,
    ): AsyncIterable<ChatEvent> {
      if (destroyed) {
        throw new Error('BridgeSession has been destroyed');
      }

      const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      abortController = new AbortController();
      const systemPrompt = buildSystemPrompt(context);

      try {
        const fn = await resolveQueryFn();

        const sdkStream = fn({
          prompt: content,
          options: {
            systemPrompt,
            cwd,
            abortController,
            ...(sessionId ? { resume: sessionId } : {}),
            allowedTools: ['Bash', 'Read', 'Glob', 'Grep'],
            permissionMode: 'default',
            canUseTool: async (toolName, input, opts) => {
              const permId = opts.toolUseID;
              const command = typeof input.command === 'string'
                ? input.command
                : `${toolName}(${JSON.stringify(input)})`;

              // Emit permission_request to the caller via side-channel callback.
              // The Vite plugin wires this to send the event over WebSocket.
              if (onPermissionRequest) {
                onPermissionRequest({
                  type: 'permission_request',
                  requestId,
                  id: permId,
                  tool: toolName,
                  command,
                });
              }

              // Block the SDK until the user responds via respondToPermission()
              const permissionPromise = new Promise<boolean>((resolve) => {
                pendingPermissions.set(permId, { resolve });
              });

              const allowed = await permissionPromise;
              pendingPermissions.delete(permId);

              if (allowed) {
                return { behavior: 'allow' as const };
              } else {
                return { behavior: 'deny' as const, message: 'User denied permission' };
              }
            },
          },
        });

        yield* translateSDKStream(sdkStream, requestId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield {
          type: 'error',
          requestId,
          message,
          code: 'BRIDGE_ERROR',
        };
      } finally {
        abortController = null;
      }
    },

    respondToPermission(id: string, allowed: boolean): void {
      const pending = pendingPermissions.get(id);
      if (pending) {
        pending.resolve(allowed);
      }
    },

    loadHistory(messages: ChatMessage[]): void {
      conversationHistory = messages;
      // The session resume mechanism handles history internally via sessionId.
      // This stores messages for potential future use (e.g., summary injection).
    },

    abort(): void {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    },

    destroy(): void {
      destroyed = true;
      // Abort any in-flight request
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      // Reject any pending permissions
      for (const [, pending] of pendingPermissions) {
        pending.resolve(false);
      }
      pendingPermissions.clear();
      conversationHistory = [];
    },
  };
}
