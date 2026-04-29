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
import { homedir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { buildSystemPrompt } from './systemPrompt';
import { loadHistory, saveHistory, archcanvasPath, trimHistory, buildSummary } from './conversationHistory';
import { extractDecisions, mergeIntoAdrFile, deleteDecisions } from './decisionExtractor';

function expandTilde(p: string): string {
  return p.startsWith('~') ? p.replace('~', homedir()) : p;
}

// ---------------------------------------------------------------------------
// SDK types — re-exported for tests and other modules
// ---------------------------------------------------------------------------

export type { Query as SDKQuery, SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * Shape of the SDK `query` function. Uses the SDK's own `Options` and `Query` types.
 * The real implementation comes from `@anthropic-ai/claude-agent-sdk`.
 * Tests inject a mock that conforms to this interface.
 *
 * The prompt is `string` for simple calls, or an `AsyncIterable` for streaming
 * input mode (required by some SDK features like MCP server integration).
 */
export type SDKQueryFn = (args: {
  prompt: string | AsyncIterable<{ type: 'user'; message: { role: 'user'; content: string } }>;
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
  clearHistory(): void;
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
  /** MCP servers to make available to the SDK (e.g., ArchCanvas tools). */
  mcpServers?: Record<string, any>;
  /** Tool names to auto-approve (skip canUseTool). Used for MCP tools. */
  allowedTools?: string[];
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
  // History persistence — lazy-loaded on first sendMessage()
  let resolvedCwd: string = expandTilde(cwd);
  let priorHistorySummary: string | null = null;
  let historyLoaded = false;
  let hasPriorHistory = false;

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
  /**
   * Timeout (ms) for the first SDK message. If the SDK doesn't emit anything
   * within this window, something is broken (CLI not found, auth expired, etc.).
   * Surface an error instead of hanging the UI forever.
   */
  const FIRST_MESSAGE_TIMEOUT_MS = 30_000;

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

    // Use a manual iterator so we can race the first .next() against a timeout.
    const iterator = sdkStream[Symbol.asyncIterator]();
    let firstMessage = true;

    while (true) {
      if (destroyed) return;

      let iterResult: IteratorResult<SDKMessage>;

      if (firstMessage) {
        const timeout = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), FIRST_MESSAGE_TIMEOUT_MS),
        );
        const raceResult = await Promise.race([iterator.next(), timeout]);
        if (raceResult === 'timeout') {
          yield {
            type: 'error',
            requestId,
            message: 'Claude Code did not respond within 30 seconds. Verify that the `claude` CLI is installed and authenticated (`claude --version`).',
            code: 'SDK_TIMEOUT',
          } as ChatEvent;
          return;
        }
        iterResult = raceResult;
        firstMessage = false;
      } else {
        iterResult = await iterator.next();
      }

      if (iterResult.done) return;

      const msg = iterResult.value;

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
      let assistantContent = '';           // ← BEFORE try{} — block-scope fix (TS let)

      try {
        resolvedCwd = expandTilde(context.projectPath || cwd);   // assign to closure var
        if (!existsSync(resolvedCwd)) {
          yield {
            type: 'error',
            requestId,
            message: `Project path "${resolvedCwd}" does not exist. Please check the path in the AI chat settings.`,
          } as ChatEvent;
          return;
        }

        // Lazy-load history exactly once per session
        if (!historyLoaded) {
          historyLoaded = true;
          const histFile = loadHistory(resolvedCwd);
          if (histFile.messages.length > 0) {
            hasPriorHistory = true;
            priorHistorySummary = buildSummary(histFile.messages);
          }
          if (histFile.sessionId) {
            sessionId = histFile.sessionId;
          }
        }

        // Inject prior-session context AFTER lazy-load sets hasPriorHistory
        const effectiveSystemPrompt = hasPriorHistory && priorHistorySummary
          ? `${systemPrompt}\n\n## Prior Session Context\n${priorHistorySummary}`
          : systemPrompt;

        const fn = await resolveQueryFn();

        const sdkQuery = fn({
          prompt: content,
          options: {
            systemPrompt: effectiveSystemPrompt,
            cwd: resolvedCwd,
            abortController,
            settingSources: ['user', 'project', 'local'],
            ...(sessionId ? { resume: sessionId } : {}),
            tools: ['Bash', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'AskUserQuestion'],
            ...(options.mcpServers ? { mcpServers: options.mcpServers } : {}),
            ...(options.allowedTools ? { allowedTools: options.allowedTools } : {}),
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
                // Override destination to 'localSettings' so "Always Allow" rules are
                // persisted to .claude/settings.local.json (gitignored), never to the
                // shared project settings.
                const updatedPermissions = response.updatedPermissions?.map(
                  (p) => ({ ...p, destination: 'localSettings' as const }),
                ) as PermissionUpdate[] | undefined;
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
        for await (const event of translateSDKStream(sdkQuery, requestId)) {
          if (event.type === 'text') assistantContent += event.content;
          yield event;
        }
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
        // Persist history after each completed turn
        if (assistantContent && !destroyed) {
          const histFile = loadHistory(resolvedCwd);
          histFile.messages = trimHistory([
            ...histFile.messages,
            { role: 'user', content, timestamp: Date.now() },
            { role: 'assistant', content: assistantContent, timestamp: Date.now() },
          ]);
          histFile.sessionId = sessionId;
          saveHistory(resolvedCwd, histFile);
          // Extract decisions from this turn only (per-turn only — no cross-call index)
          const decisions = extractDecisions([
            { role: 'user', content, timestamp: Date.now() },
            { role: 'assistant', content: assistantContent, timestamp: Date.now() },
          ]);
          if (decisions.length > 0) {
            mergeIntoAdrFile(resolvedCwd, decisions);
          }
        }
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
      // History is now managed bridge-side via conversationHistory.ts.
      // This method is kept for interface compatibility with legacy callers.
    },

    clearHistory(): void {
      historyLoaded = false;
      hasPriorHistory = false;
      priorHistorySummary = null;
      sessionId = undefined;
      const histPath = archcanvasPath(resolvedCwd, 'history.json');
      if (existsSync(histPath)) unlinkSync(histPath);
      deleteDecisions(resolvedCwd);
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
