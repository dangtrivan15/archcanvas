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
  PermissionSuggestion,
} from './types';
import type {
  Query,
  SDKMessage,
  Options as SDKOptions,
  PermissionMode,
  PermissionUpdate,
} from '@anthropic-ai/claude-agent-sdk';
import { buildSystemPrompt } from './systemPrompt';
import { loadPermissions, savePermission, isAutoApproved } from './permissionStore';

// ---------------------------------------------------------------------------
// SDK types — re-exported for tests and other modules
// ---------------------------------------------------------------------------

export type { Query as SDKQuery, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * Shape of the SDK `query` function. Uses the SDK's own `Options` and `Query` types.
 * The real implementation comes from `@anthropic-ai/claude-agent-sdk`.
 * Tests inject a mock that conforms to this interface.
 */
export type SDKQueryFn = (args: {
  prompt: string;
  options?: SDKOptions;
}) => Query;

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
      updatedPermissions?: PermissionSuggestion[];
      interrupt?: boolean;
    },
  ): void;
  /** Provide the user's answers to an AskUserQuestion card. */
  respondToQuestion(id: string, answers: Record<string, string>): void;
  loadHistory(messages: ChatMessage[]): void;
  setPermissionMode(mode: string): void;
  setEffort(effort: string): void;
  /** Interrupt the current turn via the SDK's native interrupt(). Preserves session context. */
  interrupt(): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface PermissionResponse {
  allowed: boolean;
  updatedPermissions?: PermissionSuggestion[];
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
  permissionSuggestions?: PermissionSuggestion[];
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
  /** The active SDK Query object — holds the interrupt() method. */
  let activeQuery: Query | null = null;
  let sessionId: string | undefined;
  let destroyed = false;
  let permissionMode: PermissionMode = 'default';
  let effort: 'low' | 'medium' | 'high' | 'max' = 'high';
  const pendingPermissions = new Map<string, PendingPermission>();
  const pendingQuestions = new Map<string, PendingQuestion>();
  // TODO: store conversation history for session context summary injection.

  // Load persisted "Always Allow" rules from disk
  let savedPermissions = loadPermissions(cwd);

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
    queryFn = sdk.query as SDKQueryFn;
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
          // SDKSystemMessage (subtype: 'init') and SDKStatusMessage (subtype: 'status')
          // both have type: 'system'. We only need the session ID from init.
          if ('subtype' in msg && msg.subtype === 'init') {
            sessionId = msg.session_id;
          }
          break;
        }

        case 'stream_event': {
          // SDKPartialAssistantMessage — incremental text/thinking deltas.
          // The event field is a BetaRawMessageStreamEvent from the Anthropic API.
          const event = msg.event as {
            type?: string;
            delta?: { type?: string; text?: string; thinking?: string };
          };
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
          // SDKAssistantMessage — msg.message is a BetaMessage with content blocks.
          // If we already streamed text/thinking via stream_event deltas,
          // skip re-emitting those block types to avoid double-counting.
          const content = msg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && 'text' in block) {
                if (!hasStreamedText) {
                  yield { type: 'text', requestId, content: block.text };
                }
              } else if (block.type === 'tool_use' && 'name' in block) {
                yield {
                  type: 'tool_call',
                  requestId,
                  name: block.name,
                  args: (block.input ?? {}) as Record<string, unknown>,
                  id: block.id,
                };
              } else if (block.type === 'thinking' && 'thinking' in block) {
                if (!hasStreamedText) {
                  yield { type: 'thinking', requestId, content: block.thinking };
                }
              }
            }
          }
          break;
        }

        case 'user': {
          // SDKUserMessage — may contain tool_result blocks from the SDK's tool loop.
          const content = msg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (typeof block === 'object' && 'type' in block && block.type === 'tool_result') {
                const toolResult = block as { tool_use_id: string; content?: unknown; is_error?: boolean };
                yield {
                  type: 'tool_result',
                  requestId,
                  id: toolResult.tool_use_id ?? '',
                  result: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
                  isError: toolResult.is_error,
                };
              }
            }
          }
          break;
        }

        case 'result': {
          // SDKResultMessage = SDKResultSuccess | SDKResultError
          if (msg.subtype === 'success') {
            yield { type: 'done', requestId };
          } else {
            // msg is now narrowed to SDKResultError which has `errors: string[]`
            yield {
              type: 'error',
              requestId,
              message: msg.errors.join('; ') || `Session ended: ${msg.subtype}`,
              code: msg.subtype,
            };
          }
          break;
        }

        case 'tool_progress': {
          // SDKToolProgressMessage — live output from running tools.
          // The SDK type doesn't carry a user-facing message; tool progress
          // is communicated via tool_name and elapsed_time_seconds.
          break;
        }

        case 'rate_limit_event': {
          // SDKRateLimitEvent — rate limit warnings from the API.
          const info = msg.rate_limit_info;
          if (info.status === 'rejected' || info.status === 'allowed_warning') {
            const rateLimitMsg = info.status === 'rejected'
              ? 'Rate limit reached. Waiting...'
              : 'Approaching rate limit';
            yield { type: 'rate_limit', requestId, message: rateLimitMsg };
          }
          break;
        }

        case 'prompt_suggestion': {
          // Suggested next prompts — not rendered yet.
          // Future: render as clickable chips below the message.
          break;
        }

        default:
          // Other SDK message types (auth_status, hook_*, task_*, etc.) — skip
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

        const sdkQuery = fn({
          prompt: content,
          options: {
            // We use a custom system prompt (not the SDK's preset) because the
            // preset would override our ArchCanvas-specific context (CLI commands,
            // project info).  Future: consider `{ type: 'preset', preset:
            // 'claude_code', append: buildSystemPrompt(context) }` to get the
            // full Claude Code prompt + our additions.
            systemPrompt,
            cwd: context.projectPath || cwd,
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

              // Auto-approve if the tool matches a saved "Always Allow" rule
              if (isAutoApproved(savedPermissions, toolName, input)) {
                return { behavior: 'allow' as const, updatedInput: input };
              }

              const command = typeof input.command === 'string'
                ? input.command
                : `${toolName}(${JSON.stringify(input)})`;

              // Emit permission_request to the caller via side-channel callback.
              // The Vite plugin wires this to send the event over WebSocket.
              if (onPermissionRequest) {
                // SDK suggestions are PermissionUpdate[]; cast to our UI type
                const suggestions = opts.suggestions as PermissionSuggestion[] | undefined;
                onPermissionRequest({
                  type: 'permission_request',
                  requestId,
                  id: toolUseId,
                  tool: toolName,
                  command,
                  ...(opts.blockedPath ? { blockedPath: opts.blockedPath } : {}),
                  ...(opts.decisionReason ? { decisionReason: opts.decisionReason } : {}),
                  ...(suggestions?.length ? { permissionSuggestions: suggestions } : {}),
                });
              }

              // Block the SDK until the user responds via respondToPermission()
              const response = await new Promise<PermissionResponse>((resolve) => {
                pendingPermissions.set(toolUseId, { resolve });
              });
              pendingPermissions.delete(toolUseId);

              if (response.allowed) {
                // Cast PermissionSuggestion[] → PermissionUpdate[] at the bridge boundary.
                // Our UI type is a subset of the SDK type; the cast is safe.
                const updatedPermissions = response.updatedPermissions as PermissionUpdate[] | undefined;
                return {
                  behavior: 'allow' as const,
                  updatedInput: input,
                  ...(updatedPermissions ? { updatedPermissions } : {}),
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

        activeQuery = sdkQuery;
        yield* translateSDKStream(sdkQuery, requestId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield {
          type: 'error',
          requestId,
          message,
          code: 'BRIDGE_ERROR',
        };
      } finally {
        activeQuery = null;
        abortController = null;
      }
    },

    respondToPermission(
      id: string,
      allowed: boolean,
      options?: {
        updatedPermissions?: PermissionSuggestion[];
        interrupt?: boolean;
      },
    ): void {
      // Persist "Always Allow" rules to disk and update in-memory cache
      if (options?.updatedPermissions) {
        for (const perm of options.updatedPermissions) {
          savePermission(cwd, perm);
        }
        savedPermissions = loadPermissions(cwd);
      }

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
      permissionMode = mode as PermissionMode;
    },

    setEffort(newEffort: string): void {
      effort = newEffort as 'low' | 'medium' | 'high' | 'max';
    },

    interrupt(): void {
      // Use the SDK's native interrupt() — stops the current turn while
      // preserving session context for subsequent resume.
      if (activeQuery) {
        activeQuery.interrupt().catch(() => {
          // Interrupt may fail if the query already finished — safe to ignore.
        });
      }
      // Also resolve any pending permission/question prompts so the SDK
      // isn't stuck waiting for user input that will never come.
      for (const [, pending] of pendingPermissions) {
        pending.resolve({ allowed: false, interrupt: true });
      }
      pendingPermissions.clear();
      for (const [, pending] of pendingQuestions) {
        pending.resolve({});
      }
      pendingQuestions.clear();
    },

    destroy(): void {
      destroyed = true;
      // Abort any in-flight request (hard kill on disconnect)
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      activeQuery = null;
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
