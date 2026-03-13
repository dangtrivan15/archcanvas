import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBridgeSession,
  type BridgeSession,
  type SDKQueryFn,
  type SDKMessage,
} from '@/core/ai/claudeCodeBridge';
import type { ChatEvent, ProjectContext } from '@/core/ai/types';
import {
  textStreaming,
  toolCallFlow,
  permissionDenied,
  clarifyingQuestion,
  errorScenario,
  abortMidStream,
  multipleMutations,
} from '../mocks/mockClaudeCode';

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
    let canUseToolCallback: ((
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>) | null = null;

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
    const events = await collect(session.sendMessage('test', testContext));
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
    expect(result).toEqual({ behavior: 'allow' });

    session.destroy();
  });

  it('onPermissionRequest callback fires when canUseTool is invoked', async () => {
    const permissionEvents: Array<{ id: string; tool: string; command: string }> = [];
    let canUseToolCallback: ((
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>) | null = null;

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
    let canUseToolCallback: ((
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>) | null = null;

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
    let canUseToolCallback: ((
      toolName: string,
      input: Record<string, unknown>,
      options: { signal: AbortSignal; toolUseID: string },
    ) => Promise<{ behavior: 'allow' } | { behavior: 'deny'; message: string }>) | null = null;

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
