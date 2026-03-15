/**
 * Shared test infrastructure for bridge test files.
 *
 * Provides SDK message factories, the `setupSession` helper, and the
 * `collect()` async-iterable collector so that bridge-*.test.ts files
 * stay focused on the behaviour they verify.
 */

import { beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createBridgeSession,
  type SDKQueryFn,
  type SDKQuery,
  type SDKMessage,
} from '@/core/ai/claudeCodeBridge';
import type { ChatEvent, ProjectContext } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------
export { createBridgeSession, type SDKQueryFn, type SDKQuery, type SDKMessage };
export type { ChatEvent, ProjectContext };

// ---------------------------------------------------------------------------
// Isolated temp directory per test — prevents cross-test permission pollution
// ---------------------------------------------------------------------------
let testCwd: string;

export function getTestCwd(): string {
  return testCwd;
}

beforeEach(async () => {
  testCwd = await mkdtemp(join(tmpdir(), 'archcanvas-bridge-test-'));
});

afterEach(async () => {
  await rm(testCwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: collect all events from an async iterable
// ---------------------------------------------------------------------------
export async function collect(iter: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iter) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Test context
// ---------------------------------------------------------------------------
export const testContext: ProjectContext = {
  projectName: 'test-project',
  projectDescription: 'A test architecture project',
  currentScope: '@root',
  projectPath: '/tmp/test-project',
};

// ---------------------------------------------------------------------------
// SDK Message factories — simulate what the real SDK would emit
// ---------------------------------------------------------------------------

/** Valid UUID format required by the SDK's UUID type (from `crypto`). */
const FAKE_UUID = '00000000-0000-0000-0000-000000000000' as import('crypto').UUID;

export function sdkSystemInit(sessionId: string): SDKMessage {
  return {
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    uuid: FAKE_UUID,
    tools: ['Bash'],
    model: 'claude-sonnet-4-20250514',
    cwd: testCwd,
    mcp_servers: [],
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'text',
    skills: [],
    plugins: [],
    apiKeySource: 'user',
    claude_code_version: '2.0.0',
    agents: [],
    betas: [],
  };
}

export function sdkAssistantText(text: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
  };
}

export function sdkAssistantToolUse(name: string, input: Record<string, unknown>, id: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    message: {
      content: [{ type: 'tool_use', name, input, id }],
    },
    parent_tool_use_id: null,
  };
}

export function sdkUserToolResult(toolUseId: string, content: string, isError = false): SDKMessage {
  return {
    type: 'user',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    message: {
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
    },
    parent_tool_use_id: null,
  };
}

export function sdkResultSuccess(): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    duration_ms: 100,
    duration_api_ms: 80,
    is_error: false,
    num_turns: 1,
    result: 'done',
    stop_reason: 'end_turn',
    total_cost_usd: 0.01,
    usage: { input_tokens: 100, output_tokens: 50 },
    modelUsage: {},
    permission_denials: [],
  };
}

export function sdkResultError(
  subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries',
  errors: string[],
): SDKMessage {
  return {
    type: 'result',
    subtype,
    uuid: FAKE_UUID,
    session_id: 'test-session',
    duration_ms: 100,
    duration_api_ms: 80,
    is_error: true,
    num_turns: 1,
    stop_reason: null,
    total_cost_usd: 0,
    usage: { input_tokens: 100, output_tokens: 0 },
    modelUsage: {},
    permission_denials: [],
    errors,
  };
}

export function sdkStreamEvent(deltaType: string, delta: Record<string, string>): SDKMessage {
  return {
    type: 'stream_event',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    parent_tool_use_id: null,
    event: {
      type: 'content_block_delta',
      delta: { type: deltaType, ...delta },
    },
  };
}

export function sdkStreamEventOther(eventType: string): SDKMessage {
  return {
    type: 'stream_event',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    parent_tool_use_id: null,
    event: { type: eventType },
  };
}

export function sdkToolProgress(): SDKMessage {
  return {
    type: 'tool_progress',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    tool_use_id: 'tool-1',
    tool_name: 'Bash',
    parent_tool_use_id: null,
    elapsed_time_seconds: 1,
  };
}

export function sdkRateLimit(status: 'rejected' | 'allowed_warning' | 'allowed' = 'rejected'): SDKMessage {
  return {
    type: 'rate_limit_event',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    rate_limit_info: { status },
  };
}

export function sdkPromptSuggestion(suggestion: string): SDKMessage {
  return {
    type: 'prompt_suggestion',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    suggestion,
  };
}

/** Assistant message with both text and tool_use blocks (common in final messages). */
export function sdkAssistantMixed(
  text: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolId: string,
): SDKMessage {
  return {
    type: 'assistant',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    message: {
      content: [
        { type: 'text', text },
        { type: 'tool_use', name: toolName, input: toolInput, id: toolId },
      ],
    },
    parent_tool_use_id: null,
  };
}

export function sdkAssistantThinking(thinkingText: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: FAKE_UUID,
    session_id: 'test-session',
    message: {
      content: [{ type: 'thinking', text: thinkingText }],
    },
    parent_tool_use_id: null,
  };
}

// ---------------------------------------------------------------------------
// Test session factory — reduces boilerplate for the common pattern:
//   create session → collect events → assert → destroy
// ---------------------------------------------------------------------------

export type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  opts: {
    signal: AbortSignal;
    toolUseID: string;
    suggestions?: unknown[];
    blockedPath?: string;
    decisionReason?: string;
  },
) => Promise<{ behavior: string; updatedInput?: unknown; updatedPermissions?: unknown[]; message?: string; interrupt?: boolean }>;

/** Wrap an async generator into an SDKQuery with a no-op interrupt(). */
export function toSDKQuery(gen: AsyncGenerator<SDKMessage>): SDKQuery {
  const query = gen as unknown as SDKQuery;
  (query as unknown as Record<string, unknown>).interrupt = async () => {};
  return query;
}

export function setupSession(opts?: {
  yields?: SDKMessage[];
  onPermissionRequest?: (event: Record<string, unknown>) => void;
  onAskUserQuestion?: (event: Record<string, unknown>) => void;
  cwd?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let canUseTool: any = null;
  const capturedArgs: Array<Record<string, unknown>> = [];

  const queryFn: SDKQueryFn = (args) => {
    canUseTool = args.options?.canUseTool;
    capturedArgs.push(args as Record<string, unknown>);
    return toSDKQuery((async function* () {
      yield sdkSystemInit(`s-${Date.now()}`);
      if (opts?.yields) {
        yield* opts.yields;
      }
      yield sdkResultSuccess();
    })());
  };

  const session = createBridgeSession({
    cwd: opts?.cwd ?? testCwd,
    queryFn,
    ...(opts?.onPermissionRequest && { onPermissionRequest: opts.onPermissionRequest }),
    ...(opts?.onAskUserQuestion && { onAskUserQuestion: opts.onAskUserQuestion }),
  });

  return {
    session,
    canUseTool: () => canUseTool as CanUseToolFn,
    capturedArgs,
  };
}
