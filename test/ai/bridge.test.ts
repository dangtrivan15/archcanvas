import { describe, it, expect } from 'vitest';
import {
  createBridgeSession,
  type SDKQueryFn,
  collect,
  testContext,
  getTestCwd,
  sdkSystemInit,
  sdkResultSuccess,
  setupSession,
  toSDKQuery,
} from './bridge-test-helpers';

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
describe('BridgeSession — lifecycle', () => {
  it('passes cwd and systemPrompt to the SDK query function', async () => {
    const capturedArgs: Array<{ prompt: string; options?: Record<string, unknown> }> = [];

    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as { prompt: string; options?: Record<string, unknown> });
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-lifecycle');
        yield sdkResultSuccess();
      })());
    };

    const session = createBridgeSession({ cwd: '/my/project', queryFn: mockQueryFn });
    await collect(session.sendMessage('test prompt', testContext));

    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0].prompt).toBe('test prompt');
    // cwd is now context.projectPath (preferred) || session cwd (fallback)
    expect(capturedArgs[0].options?.cwd).toBe(testContext.projectPath);
    expect(capturedArgs[0].options?.systemPrompt).toContain('ArchCanvas');
    expect(capturedArgs[0].options?.systemPrompt).toContain('test-project');

    session.destroy();
  });

  it('throws after destroy()', async () => {
    const { session } = setupSession();
    session.destroy();

    await expect(async () => {
      await collect(session.sendMessage('test', testContext));
    }).rejects.toThrow('BridgeSession has been destroyed');
  });

  it('loadHistory stores messages without error', () => {
    const testCwd = getTestCwd();
    const mockQueryFn: SDKQueryFn = () => {
      return toSDKQuery((async function* () {
        yield sdkResultSuccess();
      })());
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });

    // Should not throw
    expect(() => {
      session.loadHistory([
        { role: 'user', content: 'hello', timestamp: Date.now() },
        { role: 'assistant', content: 'hi there', timestamp: Date.now() },
      ]);
    }).not.toThrow();

    session.destroy();
  });

  it('handles SDK query function throwing an error', async () => {
    const testCwd = getTestCwd();
    const mockQueryFn: SDKQueryFn = () => {
      throw new Error('SDK initialization failed');
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
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
    const testCwd = getTestCwd();
    const capturedArgs: Array<Record<string, unknown>> = [];

    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-resume-test');
        yield sdkResultSuccess();
      })());
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });

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
    const testCwd = getTestCwd();
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-mode');
        yield sdkResultSuccess();
      })());
    };
    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
    await collect(session.sendMessage('first', testContext));
    expect((capturedArgs[0].options as Record<string, unknown>)?.permissionMode).toBe('default');
    session.setPermissionMode('acceptEdits');
    await collect(session.sendMessage('second', testContext));
    expect((capturedArgs[1].options as Record<string, unknown>)?.permissionMode).toBe('acceptEdits');
    session.destroy();
  });

  it('setEffort changes the effort for subsequent queries', async () => {
    const testCwd = getTestCwd();
    const capturedArgs: Array<Record<string, unknown>> = [];
    const mockQueryFn: SDKQueryFn = (args) => {
      capturedArgs.push(args as Record<string, unknown>);
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-effort');
        yield sdkResultSuccess();
      })());
    };
    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
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
    const { session, capturedArgs } = setupSession();
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
// No custom hooks — SDK .claude permissions are the sole authority
// ---------------------------------------------------------------------------
describe('BridgeSession — no custom hooks', () => {
  it('does not pass PreToolUse hooks (relies on SDK built-in permissions)', async () => {
    const { session, capturedArgs } = setupSession();
    await collect(session.sendMessage('test', testContext));
    const opts = capturedArgs[0].options as Record<string, unknown>;
    expect(opts.hooks).toBeUndefined();
    session.destroy();
  });
});
