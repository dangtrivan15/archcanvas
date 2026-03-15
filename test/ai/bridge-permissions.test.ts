import { describe, it, expect } from 'vitest';
import {
  createBridgeSession,
  type SDKQueryFn,
  type SDKQuery,
  type ChatEvent,
  collect,
  testContext,
  getTestCwd,
  sdkSystemInit,
  sdkAssistantText,
  sdkResultSuccess,
  setupSession,
  toSDKQuery,
} from './bridge-test-helpers';

// ---------------------------------------------------------------------------
// Scenario 6: Interrupt mid-stream
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 6: interruptMidStream', () => {
  it('calls query.interrupt() and resolves pending permissions', async () => {
    const testCwd = getTestCwd();
    let interruptCalled = false;
    let resolveGate: (() => void) | null = null;
    const gate = new Promise<void>(resolve => { resolveGate = resolve; });

    const mockQueryFn: SDKQueryFn = () => {
      const gen = (async function* () {
        yield sdkSystemInit('session-6');
        yield sdkAssistantText('Starting analysis');
        // Pause here — the test will interrupt and then open the gate
        await gate;
        yield sdkResultSuccess();
      })();

      // Attach interrupt() method to make it an SDKQuery
      const query = gen as unknown as SDKQuery;
      (query as unknown as Record<string, unknown>).interrupt = async () => { interruptCalled = true; };
      return query;
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
    const events: ChatEvent[] = [];

    const stream = session.sendMessage('analyze', testContext());
    for await (const event of stream) {
      events.push(event);
      if (event.type === 'text' && event.content === 'Starting analysis') {
        // Interrupt, then release the gate so the generator can finish
        session.interrupt();
        resolveGate!();
      }
    }

    expect(interruptCalled).toBe(true);
    // Text event should be present
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toMatchObject({ content: 'Starting analysis' });
    // The generator finishes naturally with done
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Permission lifecycle (respond, deny, destroy)
// ---------------------------------------------------------------------------
describe('BridgeSession — permission lifecycle', () => {
  it('respondToPermission resolves pending permission', async () => {
    // This test verifies the permission flow through canUseTool.
    // We create a mock that invokes canUseTool, which creates a pending promise.
    // The test then calls respondToPermission to resolve it.
    const { session, canUseTool } = setupSession({
      yields: [sdkAssistantText('Done.')],
    });

    // Start the stream to capture the canUseTool callback
    await collect(session.sendMessage('test', testContext()));
    expect(canUseTool()).not.toBeNull();

    // Now simulate the SDK calling canUseTool
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession({
      onPermissionRequest: (event) => {
        permissionEvents.push(event as { id: string; tool: string; command: string });
      },
    });

    await collect(session.sendMessage('test', testContext()));

    // Simulate SDK calling canUseTool
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession();
    await collect(session.sendMessage('test', testContext()));

    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession();
    await collect(session.sendMessage('test', testContext()));

    const permPromise = canUseTool()(
      'Bash',
      { command: 'echo hi' },
      { signal: new AbortController().signal, toolUseID: 'perm-789' },
    );

    session.destroy();

    const result = await permPromise;
    // destroy() resolves pending with false → deny
    expect(result).toEqual({ behavior: 'deny', message: 'User denied permission' });
  });
});

// ---------------------------------------------------------------------------
// Permission context forwarding
// ---------------------------------------------------------------------------
describe('BridgeSession — permission context forwarding', () => {
  it('onPermissionRequest receives blockedPath and decisionReason from canUseTool', async () => {
    const permissionEvents: Array<Record<string, unknown>> = [];
    const { session, canUseTool } = setupSession({
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext()));
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession({
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext()));
    const suggestions = [
      { type: 'addRules' as const, rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow' as const, destination: 'localSettings' },
      { type: 'addRules' as const, rules: [{ toolName: 'Bash', ruleContent: 'npm test' }], behavior: 'allow' as const, destination: 'localSettings' },
    ];
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession({
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext()));
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession({
      onPermissionRequest: (event) => {
        permissionEvents.push(event);
      },
    });
    await collect(session.sendMessage('test', testContext()));
    const suggestions = [
      { type: 'addDirectories' as const, directories: ['/Users/x/project/src'], destination: 'localSettings' },
    ];
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession();
    await collect(session.sendMessage('test', testContext()));
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession();
    await collect(session.sendMessage('test', testContext()));
    const permPromise = canUseTool()(
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
    const { session, canUseTool } = setupSession();
    await collect(session.sendMessage('test', testContext()));
    const permPromise = canUseTool()(
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
