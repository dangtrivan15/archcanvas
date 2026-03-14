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
  AskUserQuestion,
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
    tools?: string[];
    permissionMode?: string;
    maxTurns?: number;
    effort?: 'low' | 'medium' | 'high' | 'max';
    includePartialMessages?: boolean;
    toolConfig?: {
      askUserQuestion?: {
        previewFormat?: 'markdown' | 'html';
      };
    };
    hooks?: Record<string, Array<{
      matcher?: string;
      hooks: Array<(
        input: Record<string, unknown>,
        toolUseID: string | undefined,
        options: { signal: AbortSignal },
      ) => Promise<Record<string, unknown>>>;
    }>>;
    canUseTool?: (
      toolName: string,
      input: Record<string, unknown>,
      options: {
        signal: AbortSignal;
        toolUseID: string;
        suggestions?: Array<{ tool: string; permission: string }>;
        blockedPath?: string;
        decisionReason?: string;
        agentID?: string;
      },
    ) => Promise<
      | { behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: Array<{ tool: string; permission: string }> }
      | { behavior: 'deny'; message: string; interrupt?: boolean }
    >;
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
  respondToPermission(
    id: string,
    allowed: boolean,
    options?: {
      updatedPermissions?: Array<{ tool: string; permission: string }>;
      interrupt?: boolean;
    },
  ): void;
  /** Provide the user's answers to an AskUserQuestion card. */
  respondToQuestion(id: string, answers: Record<string, string>): void;
  loadHistory(messages: ChatMessage[]): void;
  setPermissionMode(mode: string): void;
  setEffort(effort: string): void;
  abort(): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface PermissionResponse {
  allowed: boolean;
  updatedPermissions?: Array<{ tool: string; permission: string }>;
  interrupt?: boolean;
}

interface PendingPermission {
  resolve: (response: PermissionResponse) => void;
}

/**
 * Pending question: the canUseTool callback is blocked inside a Promise
 * waiting for the user's answer selections.  When the browser sends a
 * question_response message, we resolve this Promise with the answers
 * record and canUseTool returns `{ behavior: 'allow', updatedInput }`.
 */
interface PendingQuestion {
  resolve: (answers: Record<string, string>) => void;
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
  blockedPath?: string;
  decisionReason?: string;
}) => void;

/**
 * Callback invoked when Claude calls AskUserQuestion — the SDK's built-in
 * tool for clarifying questions.
 *
 * Unlike a regular permission request (allow/deny), AskUserQuestion needs
 * the user's actual answer selections.  The Vite plugin wires this to send
 * an ask_user_question event over WebSocket; the browser renders a question
 * card and the user's selections come back via respondToQuestion().
 *
 * See: https://platform.claude.com/docs/en/agent-sdk/user-input
 */
export type OnAskUserQuestion = (event: {
  type: 'ask_user_question';
  requestId: string;
  id: string;
  questions: AskUserQuestion[];
}) => void;

export interface BridgeSessionOptions {
  cwd: string;
  /** Injectable SDK query function. Defaults to the real SDK at runtime. */
  queryFn?: SDKQueryFn;
  /** Called when the SDK requests a tool permission decision. */
  onPermissionRequest?: OnPermissionRequest;
  /** Called when Claude calls AskUserQuestion and needs user input. */
  onAskUserQuestion?: OnAskUserQuestion;
}

export function createBridgeSession(options: BridgeSessionOptions): BridgeSession {
  const { cwd, onPermissionRequest, onAskUserQuestion } = options;

  // Lazy-load real SDK only when no mock is provided
  let queryFn: SDKQueryFn | undefined = options.queryFn;

  let abortController: AbortController | null = null;
  let sessionId: string | undefined;
  let destroyed = false;
  let permissionMode = 'default';
  let effort: 'low' | 'medium' | 'high' | 'max' = 'high';
  const pendingPermissions = new Map<string, PendingPermission>();
  const pendingQuestions = new Map<string, PendingQuestion>();
  // TODO: store conversation history for session context summary injection.

  async function resolveQueryFn(): Promise<SDKQueryFn> {
    if (queryFn) return queryFn;

    // Strip environment variables that cause the SDK to detect a nested
    // Claude Code session.  When ArchCanvas's dev server is launched from
    // within Claude Code (common during development), these vars are set
    // and the SDK refuses to spawn a subprocess.
    delete process.env.CLAUDECODE;
    delete process.env.CLAUDE_CODE_ENTRYPOINT;

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
    // Track whether we received streaming deltas via stream_event messages.
    // When includePartialMessages is true, the SDK emits both incremental
    // stream_event messages AND the final assistant message. We use this flag
    // to skip re-emitting text/thinking from the final assistant message
    // (which would cause double-counting), while still processing tool_use
    // blocks from it.
    let hasStreamedText = false;

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

        case 'stream_event': {
          // Partial assistant message — extract incremental text/thinking deltas.
          // The SDK wraps Anthropic BetaRawMessageStreamEvent objects.
          const event = msg.event as {
            type?: string;
            delta?: { type?: string; text?: string; thinking?: string };
          } | undefined;
          if (event?.type === 'content_block_delta' && event.delta) {
            if (event.delta.type === 'text_delta' && event.delta.text) {
              hasStreamedText = true;
              yield { type: 'text', requestId, content: event.delta.text };
            } else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
              hasStreamedText = true;
              yield { type: 'thinking', requestId, content: event.delta.thinking };
            }
          }
          break;
        }

        case 'assistant': {
          // Extract text and tool_use blocks from the assistant message.
          // If we already streamed text/thinking via stream_event deltas,
          // skip re-emitting those block types to avoid double-counting.
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
                // Only emit text if we haven't already streamed it
                if (!hasStreamedText) {
                  yield { type: 'text', requestId, content: block.text };
                }
              } else if (block.type === 'tool_use') {
                // AskUserQuestion tool_use blocks are handled specially:
                // the canUseTool callback (below) emits an ask_user_question
                // event and waits for the user's answers.  We still yield
                // the tool_call here so the UI can show what tool was used,
                // but the interactive question card comes from the event
                // emitted inside canUseTool.
                yield {
                  type: 'tool_call',
                  requestId,
                  name: block.name ?? 'unknown',
                  args: block.input ?? {},
                  id: block.id ?? '',
                };
              } else if (block.type === 'thinking' && block.text) {
                // Only emit thinking if we haven't already streamed it
                if (!hasStreamedText) {
                  yield { type: 'thinking', requestId, content: block.text };
                }
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

        case 'status': {
          // Status updates (e.g., "Reading file...", "Running command...")
          const statusMsg = typeof msg.message === 'string' ? msg.message : '';
          if (statusMsg) {
            yield { type: 'status', requestId, message: statusMsg };
          }
          break;
        }

        case 'tool_progress': {
          // Live output from running tools (e.g., streaming bash output)
          const progressContent = typeof msg.content === 'string'
            ? msg.content
            : typeof msg.message === 'string'
              ? msg.message
              : '';
          if (progressContent) {
            yield { type: 'status', requestId, message: progressContent };
          }
          break;
        }

        case 'rate_limit': {
          // Rate limit warnings from the API
          const rateLimitMsg = typeof msg.message === 'string'
            ? msg.message
            : 'Rate limit reached. Waiting...';
          yield { type: 'rate_limit', requestId, message: rateLimitMsg };
          break;
        }

        case 'prompt_suggestion': {
          // Suggested next prompts — captured in event stream but not rendered yet.
          // Future: render as clickable chips below the message.
          break;
        }

        default:
          // Unknown SDK message types — skip silently
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
            // We use a custom system prompt (not the SDK's preset) because the
            // preset would override our ArchCanvas-specific context (CLI commands,
            // project info).  Future: consider `{ type: 'preset', preset:
            // 'claude_code', append: buildSystemPrompt(context) }` to get the
            // full Claude Code prompt + our additions.
            systemPrompt,
            cwd,
            abortController,
            ...(sessionId ? { resume: sessionId } : {}),
            // `tools` controls which tools are *available* to the model.
            // `allowedTools` would auto-approve them (skipping canUseTool),
            // which is NOT what we want — we need canUseTool to gate every
            // tool invocation so the user can approve/deny in the UI.
            tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion'],
            permissionMode,
            effort,
            maxTurns: 50,
            includePartialMessages: true,
            toolConfig: {
              askUserQuestion: { previewFormat: 'markdown' },
            },
            canUseTool: async (toolName, input, opts) => {
              const toolUseId = opts.toolUseID;

              // -----------------------------------------------------------------
              // AskUserQuestion — Claude's clarifying-question tool.
              //
              // The SDK calls canUseTool for AskUserQuestion just like any other
              // tool.  But instead of a simple allow/deny gate, we need the
              // user's actual answers.  The official SDK pattern is:
              //
              //   return {
              //     behavior: 'allow',
              //     updatedInput: {
              //       questions: <pass-through from input>,
              //       answers:   { "question text": "selected label", ... }
              //     }
              //   }
              //
              // We emit an ask_user_question event to the browser (which shows
              // a question card), wait for the user's answer selections via
              // respondToQuestion(), and return them in the updatedInput.
              //
              // See: https://platform.claude.com/docs/en/agent-sdk/user-input
              // -----------------------------------------------------------------
              if (toolName === 'AskUserQuestion') {
                const questions = (input.questions ?? []) as AskUserQuestion[];

                // Emit the question event to the browser via side-channel.
                if (onAskUserQuestion) {
                  onAskUserQuestion({
                    type: 'ask_user_question',
                    requestId,
                    id: toolUseId,
                    questions,
                  });
                }

                // Block the SDK until the user answers via respondToQuestion().
                const answers = await new Promise<Record<string, string>>((resolve) => {
                  pendingQuestions.set(toolUseId, { resolve });
                });
                pendingQuestions.delete(toolUseId);

                // Return the user's answers in the format the SDK expects.
                return {
                  behavior: 'allow' as const,
                  updatedInput: { questions, answers },
                };
              }

              // -----------------------------------------------------------------
              // Regular tool permission request (Bash, Write, etc.)
              // -----------------------------------------------------------------
              const command = typeof input.command === 'string'
                ? input.command
                : `${toolName}(${JSON.stringify(input)})`;

              // Emit permission_request to the caller via side-channel callback.
              // The Vite plugin wires this to send the event over WebSocket.
              if (onPermissionRequest) {
                onPermissionRequest({
                  type: 'permission_request',
                  requestId,
                  id: toolUseId,
                  tool: toolName,
                  command,
                  ...(opts.blockedPath ? { blockedPath: opts.blockedPath } : {}),
                  ...(opts.decisionReason ? { decisionReason: opts.decisionReason } : {}),
                });
              }

              // Block the SDK until the user responds via respondToPermission()
              const response = await new Promise<PermissionResponse>((resolve) => {
                pendingPermissions.set(toolUseId, { resolve });
              });
              pendingPermissions.delete(toolUseId);

              if (response.allowed) {
                return {
                  behavior: 'allow' as const,
                  updatedInput: input,
                  ...(response.updatedPermissions ? { updatedPermissions: response.updatedPermissions } : {}),
                };
              } else {
                return {
                  behavior: 'deny' as const,
                  message: 'User denied permission',
                  ...(response.interrupt ? { interrupt: response.interrupt } : {}),
                };
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

    respondToPermission(
      id: string,
      allowed: boolean,
      options?: {
        updatedPermissions?: Array<{ tool: string; permission: string }>;
        interrupt?: boolean;
      },
    ): void {
      const pending = pendingPermissions.get(id);
      if (pending) {
        pending.resolve({
          allowed,
          updatedPermissions: options?.updatedPermissions,
          interrupt: options?.interrupt,
        });
      }
    },

    respondToQuestion(id: string, answers: Record<string, string>): void {
      const pending = pendingQuestions.get(id);
      if (pending) {
        pending.resolve(answers);
      }
    },

    loadHistory(_messages: ChatMessage[]): void {
      // The session resume mechanism handles history internally via sessionId.
      // TODO: store messages for context summary injection.
    },

    setPermissionMode(mode: string): void {
      permissionMode = mode;
    },

    setEffort(newEffort: string): void {
      effort = newEffort as 'low' | 'medium' | 'high' | 'max';
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
        pending.resolve({ allowed: false });
      }
      pendingPermissions.clear();
      // Reject any pending questions with empty answers
      for (const [, pending] of pendingQuestions) {
        pending.resolve({});
      }
      pendingQuestions.clear();
    },
  };
}
