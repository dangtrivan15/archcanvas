import { describe, it, expect } from 'vitest';
import {
  createBridgeSession,
  type SDKQueryFn,
  type SDKMessage,
} from '@/core/ai/claudeCodeBridge';
import type { ChatEvent, ProjectContext } from '@/core/ai/types';

// NOTE: The Task 1 mock scenarios (test/mocks/mockClaudeCode.ts) emit
// post-translation ChatEvent objects. The bridge's job is to translate
// pre-translation SDK messages (SDKMessage) into ChatEvents. Therefore these
// tests use inline SDK-shaped message generators (sdkSystemInit, sdkAssistantText,
// etc.) to exercise the bridge's translation layer directly, rather than the
// Task 1 mocks which would bypass it.

// ---------------------------------------------------------------------------
// Helper: collect all events from an async iterable
// ---------------------------------------------------------------------------
async function collect(iter: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iter) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Test context
// ---------------------------------------------------------------------------
const testContext: ProjectContext = {
  projectName: 'test-project',
  projectDescription: 'A test architecture project',
  currentScope: '@root',
  projectPath: '/tmp/test-project',
};

/**
 * Creates a mock SDKQueryFn that wraps a mock scenario generator.
 *
 * The mock scenarios from Task 1 emit ChatEvent objects directly.
 * The real SDK emits SDKMessage objects (assistant, result, system, etc.)
 * which the bridge translates into ChatEvents.
 *
 * Since the bridge has its own translation layer, for these tests we create
 * a mock SDKQueryFn that returns SDK-shaped messages. However, to test the
 * full flow including translation, we create two categories:
 *
 * 1. "Passthrough" mocks — wrap ChatEvent scenarios into SDKMessage-like
 *    assistant/result messages that the bridge's translateSDKStream can handle.
 * 2. Direct scenario tests — test that the bridge correctly manages sessions,
 *    abort, permissions, etc.
 */

// ---------------------------------------------------------------------------
// SDK Message factories — simulate what the real SDK would emit
// ---------------------------------------------------------------------------

function sdkSystemInit(sessionId: string): SDKMessage {
  return {
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    uuid: 'sys-uuid',
    tools: ['Bash'],
    model: 'claude-sonnet-4-20250514',
    cwd: '/tmp',
    mcp_servers: [],
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'text',
    skills: [],
    plugins: [],
    apiKeySource: 'env',
    claude_code_version: '2.0.0',
    agents: [],
    betas: [],
  };
}

function sdkAssistantText(text: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: `ast-${Date.now()}`,
    session_id: 'test-session',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
  };
}

function sdkAssistantToolUse(name: string, input: Record<string, unknown>, id: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: `ast-${Date.now()}`,
    session_id: 'test-session',
    message: {
      content: [{ type: 'tool_use', name, input, id }],
    },
    parent_tool_use_id: null,
  };
}

function sdkUserToolResult(toolUseId: string, content: string, isError = false): SDKMessage {
  return {
    type: 'user',
    uuid: `usr-${Date.now()}`,
    session_id: 'test-session',
    message: {
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
    },
    parent_tool_use_id: null,
  };
}

function sdkResultSuccess(): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    uuid: 'res-uuid',
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

function sdkResultError(subtype: string, errors: string[]): SDKMessage {
  return {
    type: 'result',
    subtype,
    uuid: 'res-uuid',
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

function sdkStreamEvent(deltaType: string, delta: Record<string, string>): SDKMessage {
  return {
    type: 'stream_event',
    uuid: `se-${Date.now()}`,
    session_id: 'test-session',
    event: {
      type: 'content_block_delta',
      delta: { type: deltaType, ...delta },
    },
  };
}

function sdkStreamEventOther(eventType: string): SDKMessage {
  return {
    type: 'stream_event',
    uuid: `se-${Date.now()}`,
    session_id: 'test-session',
    event: { type: eventType },
  };
}

function sdkStatus(message: string): SDKMessage {
  return {
    type: 'status',
    uuid: `st-${Date.now()}`,
    session_id: 'test-session',
    message,
  };
}

function sdkToolProgress(content: string): SDKMessage {
  return {
    type: 'tool_progress',
    uuid: `tp-${Date.now()}`,
    session_id: 'test-session',
    content,
    tool_use_id: 'tool-1',
  };
}

function sdkRateLimit(message: string): SDKMessage {
  return {
    type: 'rate_limit',
    uuid: `rl-${Date.now()}`,
    session_id: 'test-session',
    message,
  };
}

function sdkPromptSuggestion(suggestions: string[]): SDKMessage {
  return {
    type: 'prompt_suggestion',
    uuid: `ps-${Date.now()}`,
    session_id: 'test-session',
    suggestions,
  };
}

/** Assistant message with both text and tool_use blocks (common in final messages). */
function sdkAssistantMixed(
  text: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolId: string,
): SDKMessage {
  return {
    type: 'assistant',
    uuid: `ast-${Date.now()}`,
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

function sdkAssistantThinking(thinkingText: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: `ast-${Date.now()}`,
    session_id: 'test-session',
    message: {
      content: [{ type: 'thinking', text: thinkingText }],
    },
    parent_tool_use_id: null,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Text streaming
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 1: textStreaming', () => {
  it('translates SDK text messages into ChatEvent text + done', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-1');
        yield sdkAssistantText('Let me ');
        yield sdkAssistantText('analyze your ');
        yield sdkAssistantText('architecture.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('hello', testContext));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(3);
    expect(textEvents[0]).toMatchObject({ type: 'text', content: 'Let me ' });
    expect(textEvents[1]).toMatchObject({ type: 'text', content: 'analyze your ' });
    expect(textEvents[2]).toMatchObject({ type: 'text', content: 'architecture.' });

    const doneEvents = events.filter(e => e.type === 'done');
    expect(doneEvents).toHaveLength(1);

    // All events share the same requestId
    const requestId = events[0].requestId;
    expect(events.every(e => e.requestId === requestId)).toBe(true);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Tool call flow (with permission approve)
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 2: toolCallFlow', () => {
  it('translates SDK tool_use and tool_result messages', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-2');
        yield sdkAssistantText('I will list the nodes.');
        yield sdkAssistantToolUse('bash', { command: 'archcanvas list --json' }, 'call-1');
        yield sdkUserToolResult('call-1', '{"nodes":["api-gateway","auth-service"]}');
        yield sdkAssistantText('Found 2 nodes in your architecture.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('list my nodes', testContext));

    expect(events[0]).toMatchObject({ type: 'text', content: 'I will list the nodes.' });
    expect(events[1]).toMatchObject({ type: 'tool_call', name: 'bash', id: 'call-1' });
    expect(events[2]).toMatchObject({ type: 'tool_result', id: 'call-1', isError: false });
    expect(events[3]).toMatchObject({ type: 'text', content: 'Found 2 nodes in your architecture.' });
    expect(events[4]).toMatchObject({ type: 'done' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Permission denied
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 3: permissionDenied', () => {
  it('translates SDK denial into text and done events', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-3');
        yield sdkAssistantText('I need to run a command.');
        // In real SDK, canUseTool would block. Here we simulate denial outcome.
        yield sdkAssistantText("Understood, I won't make that change.");
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('add a service', testContext));

    expect(events[0]).toMatchObject({ type: 'text', content: 'I need to run a command.' });
    expect(events[1]).toMatchObject({ type: 'text', content: "Understood, I won't make that change." });
    expect(events[2]).toMatchObject({ type: 'done' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Clarifying question
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 4: clarifyingQuestion', () => {
  it('translates a single text message and done', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-4');
        yield sdkAssistantText('Could you clarify which service you want to add?');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('add a service', testContext));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'text',
      content: 'Could you clarify which service you want to add?',
    });
    expect(events[1]).toMatchObject({ type: 'done' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Error
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 5: errorScenario', () => {
  it('translates SDK error result into error ChatEvent', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-5');
        yield sdkAssistantText('Processing your request...');
        yield sdkResultError('error_during_execution', ['Connection lost']);
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('analyze', testContext));

    expect(events[0]).toMatchObject({ type: 'text', content: 'Processing your request...' });
    expect(events[1]).toMatchObject({
      type: 'error',
      message: 'Connection lost',
      code: 'error_during_execution',
    });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Abort mid-stream
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 6: abortMidStream', () => {
  it('stops yielding events after abort() is called', async () => {
    let resolveGate: (() => void) | null = null;
    const gate = new Promise<void>(resolve => { resolveGate = resolve; });

    const mockQueryFn: SDKQueryFn = (args) => {
      const abortController = args.options?.abortController;
      return (async function* () {
        yield sdkSystemInit('session-6');
        yield sdkAssistantText('Starting analysis');
        // Pause here — the test will abort and then open the gate
        await gate;
        // After abort, the real SDK would stop. We check abortController.
        if (abortController?.signal.aborted) {
          yield sdkResultSuccess();
          return;
        }
        yield sdkAssistantText(' of your system');
        yield sdkAssistantText(' architecture.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events: ChatEvent[] = [];

    // We need to consume the stream async and abort once we see the first text.
    // The generator is paused at the gate, so we abort first, then open the gate.
    const stream = session.sendMessage('analyze', testContext);
    for await (const event of stream) {
      events.push(event);
      if (event.type === 'text' && event.content === 'Starting analysis') {
        // Abort first, then release the gate
        session.abort();
        resolveGate!();
      }
    }

    // Should have: text('Starting analysis') + done
    // The second and third text events should NOT appear
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toMatchObject({ content: 'Starting analysis' });
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Multiple mutations
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 7: multipleMutations', () => {
  it('translates multiple tool_use + tool_result pairs', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-7');
        yield sdkAssistantToolUse('bash', { command: 'archcanvas add-node --id svc-a --type compute/service --json' }, 'call-1');
        yield sdkUserToolResult('call-1', '{"ok":true,"nodeId":"svc-a"}');
        yield sdkAssistantToolUse('bash', { command: 'archcanvas add-edge --from svc-a --to db --json' }, 'call-2');
        yield sdkUserToolResult('call-2', '{"ok":true}');
        yield sdkAssistantText('Added service and connected it to the database.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('add service and connect', testContext));

    // Expected: tool_call, tool_result, tool_call, tool_result, text, done
    expect(events[0]).toMatchObject({ type: 'tool_call', name: 'bash', id: 'call-1' });
    expect(events[1]).toMatchObject({ type: 'tool_result', id: 'call-1' });
    expect(events[2]).toMatchObject({ type: 'tool_call', name: 'bash', id: 'call-2' });
    expect(events[3]).toMatchObject({ type: 'tool_result', id: 'call-2' });
    expect(events[4]).toMatchObject({ type: 'text', content: 'Added service and connected it to the database.' });
    expect(events[5]).toMatchObject({ type: 'done' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
describe('BridgeSession — lifecycle', () => {
  it('passes cwd and systemPrompt to the SDK query function', async () => {
    const capturedArgs: Array<{ prompt: string; options?: Record<string, unknown> }> = [];

    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as { prompt: string; options?: Record<string, unknown> });
      return (async function* () {
        yield sdkSystemInit('session-lifecycle');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/my/project', queryFn: mockQueryFn });
    await collect(session.sendMessage('test prompt', testContext));

    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0].prompt).toBe('test prompt');
    expect(capturedArgs[0].options?.cwd).toBe('/my/project');
    expect(capturedArgs[0].options?.systemPrompt).toContain('ArchCanvas');
    expect(capturedArgs[0].options?.systemPrompt).toContain('test-project');

    session.destroy();
  });

  it('throws after destroy()', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-destroyed');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    session.destroy();

    await expect(async () => {
      await collect(session.sendMessage('test', testContext));
    }).rejects.toThrow('BridgeSession has been destroyed');
  });

  it('loadHistory stores messages without error', () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });

    // Should not throw
    expect(() => {
      session.loadHistory([
        { role: 'user', content: 'hello', timestamp: Date.now() },
        { role: 'assistant', content: 'hi there', timestamp: Date.now() },
      ]);
    }).not.toThrow();

    session.destroy();
  });

  it('respondToPermission resolves pending permission', async () => {
    // This test verifies the permission flow through canUseTool.
    // We create a mock that invokes canUseTool, which creates a pending promise.
    // The test then calls respondToPermission to resolve it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;

    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool ?? null;
      return (async function* () {
        yield sdkSystemInit('session-perm');
        yield sdkAssistantText('Done.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });

    // Start the stream to capture the canUseTool callback
    await collect(session.sendMessage('test', testContext));
    expect(canUseToolCallback).not.toBeNull();

    // Now simulate the SDK calling canUseTool
    const permPromise = canUseToolCallback!(
      'Bash',
      { command: 'echo hi' },
      { signal: new AbortController().signal, toolUseID: 'perm-123' },
    );

    // Respond to the permission
    session.respondToPermission('perm-123', true);

    const result = await permPromise;
    expect(result).toEqual({ behavior: 'allow', updatedInput: { command: 'echo hi' } });

    session.destroy();
  });

  it('onPermissionRequest callback fires when canUseTool is invoked', async () => {
    const permissionEvents: Array<{ id: string; tool: string; command: string }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;

    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool ?? null;
      return (async function* () {
        yield sdkSystemInit('session-perm-cb');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({
      cwd: '/tmp',
      queryFn: mockQueryFn,
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });

    await collect(session.sendMessage('test', testContext));

    // Simulate SDK calling canUseTool
    const permPromise = canUseToolCallback!(
      'Bash',
      { command: 'archcanvas list --json' },
      { signal: new AbortController().signal, toolUseID: 'perm-cb-1' },
    );

    // The callback should have fired
    expect(permissionEvents).toHaveLength(1);
    expect(permissionEvents[0]).toMatchObject({
      id: 'perm-cb-1',
      tool: 'Bash',
      command: 'archcanvas list --json',
    });

    // Clean up — respond so the promise resolves
    session.respondToPermission('perm-cb-1', true);
    await permPromise;

    session.destroy();
  });

  it('respondToPermission with denial returns deny result', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;

    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool ?? null;
      return (async function* () {
        yield sdkSystemInit('session-perm-deny');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));

    const permPromise = canUseToolCallback!(
      'Bash',
      { command: 'rm -rf /' },
      { signal: new AbortController().signal, toolUseID: 'perm-456' },
    );

    session.respondToPermission('perm-456', false);

    const result = await permPromise;
    expect(result).toEqual({ behavior: 'deny', message: 'User denied permission' });

    session.destroy();
  });

  it('destroy() resolves pending permissions with false', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;

    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool ?? null;
      return (async function* () {
        yield sdkSystemInit('session-perm-destroy');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));

    const permPromise = canUseToolCallback!(
      'Bash',
      { command: 'echo hi' },
      { signal: new AbortController().signal, toolUseID: 'perm-789' },
    );

    session.destroy();

    const result = await permPromise;
    // destroy() resolves pending with false → deny
    expect(result).toEqual({ behavior: 'deny', message: 'User denied permission' });
  });

  it('handles SDK query function throwing an error', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      throw new Error('SDK initialization failed');
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      message: 'SDK initialization failed',
      code: 'BRIDGE_ERROR',
    });

    session.destroy();
  });

  it('captures sessionId from init message for resume', async () => {
    const capturedArgs: Array<Record<string, unknown>> = [];

    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return (async function* () {
        yield sdkSystemInit('session-resume-test');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });

    // First call — no resume
    await collect(session.sendMessage('first', testContext));
    expect((capturedArgs[0].options as Record<string, unknown>)?.resume).toBeUndefined();

    // Second call — should include resume with captured sessionId
    await collect(session.sendMessage('second', testContext));
    expect((capturedArgs[1].options as Record<string, unknown>)?.resume).toBe('session-resume-test');

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Session settings
// ---------------------------------------------------------------------------
describe('BridgeSession — session settings', () => {
  it('setPermissionMode changes the mode for subsequent queries', async () => {
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return (async function* () {
        yield sdkSystemInit('session-mode');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('first', testContext));
    expect((capturedArgs[0].options as Record<string, unknown>)?.permissionMode).toBe('default');
    session.setPermissionMode('acceptEdits');
    await collect(session.sendMessage('second', testContext));
    expect((capturedArgs[1].options as Record<string, unknown>)?.permissionMode).toBe('acceptEdits');
    session.destroy();
  });

  it('setEffort changes the effort for subsequent queries', async () => {
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return (async function* () {
        yield sdkSystemInit('session-effort');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('first', testContext));
    expect((capturedArgs[0].options as Record<string, unknown>)?.effort).toBe('high');
    session.setEffort('low');
    await collect(session.sendMessage('second', testContext));
    expect((capturedArgs[1].options as Record<string, unknown>)?.effort).toBe('low');
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// SDK options
// ---------------------------------------------------------------------------
describe('BridgeSession — SDK options', () => {
  it('passes tools (not allowedTools), maxTurns, includePartialMessages, and toolConfig', async () => {
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return (async function* () {
        yield sdkSystemInit('session-opts');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));
    const opts = capturedArgs[0].options as Record<string, unknown>;
    // Tools should be in `tools` (available to the model), NOT `allowedTools`
    // (which would auto-approve them and skip canUseTool permission checks).
    const tools = opts.tools as string[];
    expect(tools).toContain('Write');
    expect(tools).toContain('Edit');
    expect(tools).toContain('WebFetch');
    expect(tools).toContain('WebSearch');
    expect(tools).toContain('AskUserQuestion');
    expect(tools).toContain('Bash');
    expect(tools).toContain('Read');
    expect(tools).toContain('Glob');
    expect(tools).toContain('Grep');
    expect(opts.allowedTools).toBeUndefined();
    expect(opts.maxTurns).toBe(50);
    expect(opts.includePartialMessages).toBe(true);
    expect(opts.effort).toBe('high');
    expect(opts.toolConfig).toEqual({
      askUserQuestion: { previewFormat: 'markdown' },
    });
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Permission context forwarding
// ---------------------------------------------------------------------------
describe('BridgeSession — permission context forwarding', () => {
  it('onPermissionRequest receives blockedPath and decisionReason from canUseTool', async () => {
    const permissionEvents: Array<Record<string, unknown>> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-context');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({
      cwd: '/tmp',
      queryFn: mockQueryFn,
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext));
    const permPromise = canUseToolCallback!(
      'Write',
      { file_path: '/src/main.ts', content: 'hello' },
      {
        signal: new AbortController().signal,
        toolUseID: 'perm-ctx-1',
        blockedPath: '/src/main.ts',
        decisionReason: 'Write tool requires permission',
      },
    );
    expect(permissionEvents).toHaveLength(1);
    expect(permissionEvents[0].blockedPath).toBe('/src/main.ts');
    expect(permissionEvents[0].decisionReason).toBe('Write tool requires permission');
    session.respondToPermission('perm-ctx-1', true);
    await permPromise;
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Permission suggestion forwarding
// ---------------------------------------------------------------------------
describe('BridgeSession — permission suggestion forwarding', () => {
  it('forwards opts.suggestions as permissionSuggestions in onPermissionRequest', async () => {
    const permissionEvents: Array<Record<string, unknown>> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-suggestions');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({
      cwd: '/tmp',
      queryFn: mockQueryFn,
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext));
    const suggestions = [
      { type: 'addRules' as const, rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow' as const, destination: 'localSettings' },
      { type: 'addRules' as const, rules: [{ toolName: 'Bash', ruleContent: 'npm test' }], behavior: 'allow' as const, destination: 'localSettings' },
    ];
    const permPromise = canUseToolCallback!(
      'Bash', { command: 'npm test' },
      {
        signal: new AbortController().signal,
        toolUseID: 'perm-sug-1',
        suggestions,
      },
    );
    expect(permissionEvents).toHaveLength(1);
    expect(permissionEvents[0].permissionSuggestions).toEqual(suggestions);
    session.respondToPermission('perm-sug-1', true);
    await permPromise;
    session.destroy();
  });

  it('omits permissionSuggestions when opts.suggestions is undefined', async () => {
    const permissionEvents: Array<Record<string, unknown>> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-no-sug');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({
      cwd: '/tmp',
      queryFn: mockQueryFn,
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext));
    const permPromise = canUseToolCallback!(
      'Bash', { command: 'echo hi' },
      { signal: new AbortController().signal, toolUseID: 'perm-nosug-1' },
    );
    expect(permissionEvents).toHaveLength(1);
    expect(permissionEvents[0].permissionSuggestions).toBeUndefined();
    session.respondToPermission('perm-nosug-1', true);
    await permPromise;
    session.destroy();
  });

  it('forwards addDirectories suggestions from opts.suggestions', async () => {
    const permissionEvents: Array<Record<string, unknown>> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-dir-sug');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({
      cwd: '/tmp',
      queryFn: mockQueryFn,
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext));
    const suggestions = [
      { type: 'addDirectories' as const, directories: ['/Users/x/project/src'], destination: 'localSettings' },
    ];
    const permPromise = canUseToolCallback!(
      'Write', { file_path: '/Users/x/project/src/foo.ts', content: 'bar' },
      {
        signal: new AbortController().signal,
        toolUseID: 'perm-dirsug-1',
        suggestions,
        blockedPath: '/Users/x/project/src',
      },
    );
    expect(permissionEvents).toHaveLength(1);
    expect(permissionEvents[0].permissionSuggestions).toEqual(suggestions);
    expect(permissionEvents[0].blockedPath).toBe('/Users/x/project/src');
    session.respondToPermission('perm-dirsug-1', true);
    await permPromise;
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// respondToPermission options
// ---------------------------------------------------------------------------
describe('BridgeSession — respondToPermission options', () => {
  it('respondToPermission with updatedPermissions returns SDK-shaped suggestions in allow result', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-upd-perms');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));
    const permPromise = canUseToolCallback!(
      'Bash', { command: 'npm test' },
      { signal: new AbortController().signal, toolUseID: 'perm-upd-1' },
    );
    session.respondToPermission('perm-upd-1', true, {
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }],
    });
    const result = await permPromise;
    expect(result.behavior).toBe('allow');
    expect(result.updatedInput).toEqual({ command: 'npm test' });
    expect(result.updatedPermissions).toEqual([
      { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
    ]);
    session.destroy();
  });

  it('respondToPermission with addDirectories suggestion returns it in allow result', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-add-dirs');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));
    const permPromise = canUseToolCallback!(
      'Write', { file_path: '/src/foo.ts', content: 'bar' },
      { signal: new AbortController().signal, toolUseID: 'perm-dir-1' },
    );
    session.respondToPermission('perm-dir-1', true, {
      updatedPermissions: [{ type: 'addDirectories', directories: ['/src'], destination: 'localSettings' }],
    });
    const result = await permPromise;
    expect(result.behavior).toBe('allow');
    expect(result.updatedPermissions).toEqual([
      { type: 'addDirectories', directories: ['/src'], destination: 'localSettings' },
    ]);
    session.destroy();
  });

  it('respondToPermission with interrupt returns it in deny result', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canUseToolCallback: any = null;
    const mockQueryFn: SDKQueryFn = (args) => {
      canUseToolCallback = args.options?.canUseTool;
      return (async function* () {
        yield sdkSystemInit('session-interrupt');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));
    const permPromise = canUseToolCallback!(
      'Bash', { command: 'rm -rf /' },
      { signal: new AbortController().signal, toolUseID: 'perm-int-1' },
    );
    session.respondToPermission('perm-int-1', false, { interrupt: true });
    const result = await permPromise;
    expect(result.behavior).toBe('deny');
    expect(result.interrupt).toBe(true);
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// No custom hooks — SDK .claude permissions are the sole authority
// ---------------------------------------------------------------------------
describe('BridgeSession — no custom hooks', () => {
  it('does not pass PreToolUse hooks (relies on SDK built-in permissions)', async () => {
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return (async function* () {
        yield sdkSystemInit('session-hooks');
        yield sdkResultSuccess();
      })();
    };
    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    await collect(session.sendMessage('test', testContext));
    const opts = capturedArgs[0].options as Record<string, unknown>;
    expect(opts.hooks).toBeUndefined();
    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Streaming text via stream_event
// ---------------------------------------------------------------------------
describe('BridgeSession — stream_event translation', () => {
  it('yields TextEvents from text_delta stream events', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-stream-1');
        yield sdkStreamEvent('text_delta', { text: 'Hello ' });
        yield sdkStreamEvent('text_delta', { text: 'world' });
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('hi', testContext));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0]).toMatchObject({ type: 'text', content: 'Hello ' });
    expect(textEvents[1]).toMatchObject({ type: 'text', content: 'world' });
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });

  it('yields ThinkingEvents from thinking_delta stream events', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-stream-think');
        yield sdkStreamEvent('thinking_delta', { thinking: 'Let me consider...' });
        yield sdkStreamEvent('thinking_delta', { thinking: ' the options.' });
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('think', testContext));

    const thinkingEvents = events.filter(e => e.type === 'thinking');
    expect(thinkingEvents).toHaveLength(2);
    expect(thinkingEvents[0]).toMatchObject({ type: 'thinking', content: 'Let me consider...' });
    expect(thinkingEvents[1]).toMatchObject({ type: 'thinking', content: ' the options.' });

    session.destroy();
  });

  it('skips non-content_block_delta stream events', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-stream-skip');
        yield sdkStreamEventOther('message_start');
        yield sdkStreamEventOther('content_block_start');
        yield sdkStreamEvent('text_delta', { text: 'Only this' });
        yield sdkStreamEventOther('content_block_stop');
        yield sdkStreamEventOther('message_stop');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toMatchObject({ content: 'Only this' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// No double text: streaming + final assistant message
// ---------------------------------------------------------------------------
describe('BridgeSession — no double text', () => {
  it('skips text from final assistant message when stream_event deltas were received', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-no-double');
        // Streaming deltas first
        yield sdkStreamEvent('text_delta', { text: 'Hello ' });
        yield sdkStreamEvent('text_delta', { text: 'world' });
        // Final assistant message (same text, plus a tool_use)
        yield sdkAssistantMixed('Hello world', 'Bash', { command: 'ls' }, 'call-1');
        yield sdkUserToolResult('call-1', 'file.txt');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('hi', testContext));

    // Text should appear only from streaming (2 deltas), not from the final assistant message
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0]).toMatchObject({ content: 'Hello ' });
    expect(textEvents[1]).toMatchObject({ content: 'world' });

    // But tool_use from the final assistant message should still be emitted
    const toolCallEvents = events.filter(e => e.type === 'tool_call');
    expect(toolCallEvents).toHaveLength(1);
    expect(toolCallEvents[0]).toMatchObject({ name: 'Bash', id: 'call-1' });

    // And tool_result should come through
    const toolResultEvents = events.filter(e => e.type === 'tool_result');
    expect(toolResultEvents).toHaveLength(1);

    session.destroy();
  });

  it('skips thinking from final assistant message when stream_event deltas were received', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-no-double-think');
        // Streaming thinking deltas
        yield sdkStreamEvent('thinking_delta', { thinking: 'Hmm...' });
        // Final assistant message with the complete thinking block
        yield sdkAssistantThinking('Hmm...');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('think', testContext));

    // Thinking should appear only once (from streaming)
    const thinkingEvents = events.filter(e => e.type === 'thinking');
    expect(thinkingEvents).toHaveLength(1);
    expect(thinkingEvents[0]).toMatchObject({ content: 'Hmm...' });

    session.destroy();
  });

  it('emits text from assistant message when no stream_event deltas were received', async () => {
    // Fallback: if the SDK doesn't emit stream_events, the assistant message text is used
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-fallback');
        yield sdkAssistantText('No streaming here.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('hi', testContext));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toMatchObject({ content: 'No streaming here.' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------
describe('BridgeSession — status messages', () => {
  it('yields StatusEvent from SDK status messages', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-status');
        yield sdkStatus('Reading file...');
        yield sdkStatus('Running command...');
        yield sdkAssistantText('Done.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('do stuff', testContext));

    const statusEvents = events.filter(e => e.type === 'status');
    expect(statusEvents).toHaveLength(2);
    expect(statusEvents[0]).toMatchObject({ type: 'status', message: 'Reading file...' });
    expect(statusEvents[1]).toMatchObject({ type: 'status', message: 'Running command...' });

    session.destroy();
  });

  it('skips status messages with empty content', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-status-empty');
        yield { type: 'status', uuid: 'st-1', session_id: 'test', message: '' };
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    const statusEvents = events.filter(e => e.type === 'status');
    expect(statusEvents).toHaveLength(0);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tool progress
// ---------------------------------------------------------------------------
describe('BridgeSession — tool_progress messages', () => {
  it('yields StatusEvent from SDK tool_progress messages', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-progress');
        yield sdkToolProgress('Building project...');
        yield sdkToolProgress('Compilation complete.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('build', testContext));

    const statusEvents = events.filter(e => e.type === 'status');
    expect(statusEvents).toHaveLength(2);
    expect(statusEvents[0]).toMatchObject({ type: 'status', message: 'Building project...' });
    expect(statusEvents[1]).toMatchObject({ type: 'status', message: 'Compilation complete.' });

    session.destroy();
  });

  it('falls back to message field when content is missing', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-progress-msg');
        yield { type: 'tool_progress', uuid: 'tp-1', session_id: 'test', message: 'via message field', tool_use_id: 'tool-1' };
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    const statusEvents = events.filter(e => e.type === 'status');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]).toMatchObject({ message: 'via message field' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------
describe('BridgeSession — rate_limit messages', () => {
  it('yields RateLimitEvent from SDK rate_limit messages', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-ratelimit');
        yield sdkRateLimit('Rate limited. Retrying in 30s...');
        yield sdkAssistantText('After rate limit.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Rate limited. Retrying in 30s...',
    });

    // Streaming should continue after rate limit
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });

  it('uses default message when rate_limit has no message', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-ratelimit-default');
        yield { type: 'rate_limit', uuid: 'rl-1', session_id: 'test' };
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Rate limit reached. Waiting...',
    });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Prompt suggestions (ignored)
// ---------------------------------------------------------------------------
describe('BridgeSession — prompt_suggestion messages', () => {
  it('ignores prompt_suggestion messages (no events emitted)', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-suggestions');
        yield sdkAssistantText('Here is my answer.');
        yield sdkPromptSuggestion(['Tell me more', 'Show details']);
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext));

    // Should only have text + done, no prompt_suggestion events
    expect(events.map(e => e.type)).toEqual(['text', 'done']);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Full streaming scenario (stream_event + status + tool_use + result)
// ---------------------------------------------------------------------------
describe('BridgeSession — full streaming scenario', () => {
  it('handles a realistic mix of stream_event, status, assistant, and result', async () => {
    const mockQueryFn: SDKQueryFn = () => {
      return (async function* () {
        yield sdkSystemInit('session-full');
        // Streaming text deltas
        yield sdkStreamEvent('text_delta', { text: 'I will ' });
        yield sdkStreamEvent('text_delta', { text: 'read your file.' });
        // Status while reading
        yield sdkStatus('Reading file...');
        // Final assistant message (text already streamed, but has tool_use)
        yield sdkAssistantMixed('I will read your file.', 'Read', { file_path: '/src/main.ts' }, 'read-1');
        yield sdkUserToolResult('read-1', 'export function main() {}');
        // More streaming for the follow-up
        yield sdkStreamEvent('text_delta', { text: 'Found the main function.' });
        yield sdkAssistantText('Found the main function.');
        yield sdkResultSuccess();
      })();
    };

    const session = createBridgeSession({ cwd: '/tmp', queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('read main', testContext));

    const types = events.map(e => e.type);
    // Stream deltas, status, tool_call (from assistant), tool_result, more stream delta, done
    expect(types).toEqual([
      'text',        // 'I will '
      'text',        // 'read your file.'
      'status',      // 'Reading file...'
      'tool_call',   // Read tool (from final assistant, text skipped)
      'tool_result', // tool result
      'text',        // 'Found the main function.' (streamed delta)
      'done',        // Final assistant text skipped (hasStreamedText), then done
    ]);

    session.destroy();
  });
});
