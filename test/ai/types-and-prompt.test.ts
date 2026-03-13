import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@/core/ai/systemPrompt';
import type {
  ChatEvent,
  ClientMessage,
  ChatMessage,
  ProjectContext,
  ChatProvider,
  TextEvent,
  ToolCallEvent,
  ToolResultEvent,
  ThinkingEvent,
  PermissionRequestEvent,
  DoneEvent,
  ChatErrorEvent,
} from '@/core/ai/types';
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
// Helper: collect all events from an async generator
// ---------------------------------------------------------------------------
async function collect(gen: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// ===========================================================================
// Types — compile-time checks (these tests verify that the types are usable)
// ===========================================================================
describe('AI types — compile-time checks', () => {
  it('ChatEvent discriminated union covers all 7 variants', () => {
    const events: ChatEvent[] = [
      { type: 'text', requestId: 'r1', content: 'hello' },
      { type: 'tool_call', requestId: 'r1', name: 'bash', args: {}, id: 'c1' },
      { type: 'tool_result', requestId: 'r1', id: 'c1', result: '' },
      { type: 'thinking', requestId: 'r1', content: '...' },
      { type: 'permission_request', requestId: 'r1', id: 'p1', command: 'run X', tool: 'bash' },
      { type: 'done', requestId: 'r1' },
      { type: 'error', requestId: 'r1', message: 'oops' },
    ];
    expect(events).toHaveLength(7);

    // Verify each variant's type field
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'text', 'tool_call', 'tool_result', 'thinking',
      'permission_request', 'done', 'error',
    ]);
  });

  it('ClientMessage discriminated union covers all 4 variants', () => {
    const ctx: ProjectContext = {
      projectName: 'Test',
      projectPath: '/tmp',
      currentScope: 'root',
    };
    const messages: ClientMessage[] = [
      { type: 'chat', requestId: 'r1', content: 'hello', context: ctx },
      { type: 'abort' },
      { type: 'load_history', messages: [] },
      { type: 'permission_response', id: 'p1', allowed: true },
    ];
    expect(messages).toHaveLength(4);
  });

  it('ChatMessage has the expected shape', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: 'Hello!',
      timestamp: Date.now(),
      events: [{ type: 'text', requestId: 'r1', content: 'Hello!' }],
    };
    expect(msg.role).toBe('assistant');
    expect(msg.events).toHaveLength(1);
  });

  it('ChatMessage events field is optional', () => {
    const msg: ChatMessage = {
      role: 'user',
      content: 'Hi',
      timestamp: Date.now(),
    };
    expect(msg.events).toBeUndefined();
  });

  it('ProjectContext carries project metadata', () => {
    const ctx: ProjectContext = {
      projectName: 'MyApp',
      projectPath: '/tmp/myapp',
      currentScope: 'root',
    };
    expect(ctx.projectDescription).toBeUndefined();
  });

  it('ChatProvider interface is structurally valid', () => {
    // We just verify we can define an object satisfying the interface.
    const _provider: ChatProvider = {
      id: 'mock',
      displayName: 'Mock Provider',
      available: true,
      sendMessage: async function* (_content, _ctx) {
        yield { type: 'done' as const, requestId: 'r1' };
      },
      loadHistory: () => {},
      abort: () => {},
    };
    expect(_provider.id).toBe('mock');
  });

  it('ChatErrorEvent code field is optional', () => {
    const err: ChatErrorEvent = { type: 'error', requestId: 'r1', message: 'fail' };
    expect(err.code).toBeUndefined();

    const errWithCode: ChatErrorEvent = { type: 'error', requestId: 'r1', message: 'fail', code: 'TIMEOUT' };
    expect(errWithCode.code).toBe('TIMEOUT');
  });

  it('ToolResultEvent isError field is optional', () => {
    const res: ToolResultEvent = { type: 'tool_result', requestId: 'r1', id: 'c1', result: 'ok' };
    expect(res.isError).toBeUndefined();

    const resWithError: ToolResultEvent = { type: 'tool_result', requestId: 'r1', id: 'c1', result: 'fail', isError: true };
    expect(resWithError.isError).toBe(true);
  });

  it('all ChatEvent variants carry requestId', () => {
    // Narrow through each variant to prove requestId is always accessible
    const event: ChatEvent = { type: 'done', requestId: 'r1' };
    // Access requestId without narrowing — this is the key compile-time check
    expect(event.requestId).toBe('r1');
  });
});

// ===========================================================================
// buildSystemPrompt
// ===========================================================================
describe('buildSystemPrompt', () => {
  const baseContext: ProjectContext = {
    projectName: 'TestProject',
    projectDescription: 'A test architecture',
    projectPath: '/home/user/testproject',
    currentScope: 'root',
  };

  it('includes the project name', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('TestProject');
  });

  it('includes the project path', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('/home/user/testproject');
  });

  it('includes the project description when present', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('A test architecture');
  });

  it('omits description line when not provided', () => {
    const ctx: ProjectContext = {
      projectName: 'NoDesc',
      projectPath: '/tmp/nodesc',
      currentScope: 'root',
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).not.toContain('**Description:**');
  });

  it('includes the current scope', () => {
    const ctx = { ...baseContext, currentScope: 'backend/api' };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('backend/api');
  });

  it('includes the role description', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('architecture assistant');
    expect(prompt).toContain('ArchCanvas');
  });

  it('instructs to use --json flag', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('--json');
  });

  // --- All 9 CLI command signatures ---
  const commandSignatures = [
    ['list', 'archcanvas list'],
    ['describe', 'archcanvas describe'],
    ['search', 'archcanvas search'],
    ['add-node', 'archcanvas add-node'],
    ['add-edge', 'archcanvas add-edge'],
    ['remove-node', 'archcanvas remove-node'],
    ['remove-edge', 'archcanvas remove-edge'],
    ['import', 'archcanvas import'],
    ['init', 'archcanvas init'],
  ] as const;

  for (const [name, signature] of commandSignatures) {
    it(`includes the ${name} command`, () => {
      const prompt = buildSystemPrompt(baseContext);
      expect(prompt).toContain(signature);
    });
  }

  it('add-edge signature includes --from and --to flags', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/add-edge\s+--from\s+<nodeId>\s+--to\s+<nodeId>/);
  });

  it('add-edge signature includes --from-port and --to-port flags', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('--from-port');
    expect(prompt).toContain('--to-port');
  });

  it('remove-edge signature includes --from and --to flags', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/remove-edge\s+--from\s+<nodeId>\s+--to\s+<nodeId>/);
  });

  it('list command includes --scope and --type flags', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/list\s+\[--scope/);
    expect(prompt).toContain('--type');
  });
});

// ===========================================================================
// Mock scenarios
// ===========================================================================
describe('Mock scenarios', () => {
  const requestId = 'test-req-001';

  describe('textStreaming', () => {
    it('yields text → text → text → done', async () => {
      const events = await collect(textStreaming({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toEqual(['text', 'text', 'text', 'done']);
    });

    it('stamps requestId on every event', async () => {
      const events = await collect(textStreaming({ requestId }));
      for (const event of events) {
        expect(event.requestId).toBe(requestId);
      }
    });

    it('text events contain content', async () => {
      const events = await collect(textStreaming({ requestId }));
      const textEvents = events.filter((e): e is TextEvent => e.type === 'text');
      for (const te of textEvents) {
        expect(te.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('toolCallFlow', () => {
    it('yields the full approved flow', async () => {
      const events = await collect(
        toolCallFlow({
          requestId,
          onPermission: async () => true,
        }),
      );
      const types = events.map((e) => e.type);
      expect(types).toEqual([
        'text', 'permission_request', 'tool_call', 'tool_result', 'text', 'done',
      ]);
    });

    it('permission_request has an id', async () => {
      const events = await collect(
        toolCallFlow({ requestId, onPermission: async () => true }),
      );
      const perm = events.find(
        (e): e is PermissionRequestEvent => e.type === 'permission_request',
      )!;
      expect(perm.id).toBeTruthy();
      expect(perm.tool).toBe('bash');
    });

    it('tool_call and tool_result share the same id', async () => {
      const events = await collect(
        toolCallFlow({ requestId, onPermission: async () => true }),
      );
      const call = events.find((e): e is ToolCallEvent => e.type === 'tool_call')!;
      const result = events.find((e): e is ToolResultEvent => e.type === 'tool_result')!;
      expect(call.id).toBe(result.id);
    });

    it('defaults to approved when no onPermission provided', async () => {
      const events = await collect(toolCallFlow({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toContain('tool_call');
    });
  });

  describe('permissionDenied', () => {
    it('yields text → permission_request → text → done when denied', async () => {
      const events = await collect(
        permissionDenied({
          requestId,
          onPermission: async () => false,
        }),
      );
      const types = events.map((e) => e.type);
      expect(types).toEqual(['text', 'permission_request', 'text', 'done']);
    });

    it('defaults to denied when no onPermission provided', async () => {
      const events = await collect(permissionDenied({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).not.toContain('tool_call');
      expect(types).toEqual(['text', 'permission_request', 'text', 'done']);
    });
  });

  describe('clarifyingQuestion', () => {
    it('yields text → done', async () => {
      const events = await collect(clarifyingQuestion({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toEqual(['text', 'done']);
    });

    it('text contains a question', async () => {
      const events = await collect(clarifyingQuestion({ requestId }));
      const text = events.find((e): e is TextEvent => e.type === 'text')!;
      expect(text.content).toContain('?');
    });
  });

  describe('errorScenario', () => {
    it('yields text → error', async () => {
      const events = await collect(errorScenario({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toEqual(['text', 'error']);
    });

    it('error event has message and code', async () => {
      const events = await collect(errorScenario({ requestId }));
      const err = events.find((e): e is ChatErrorEvent => e.type === 'error')!;
      expect(err.message).toBe('Connection lost');
      expect(err.code).toBe('CONNECTION_ERROR');
    });

    it('does not yield a done event', async () => {
      const events = await collect(errorScenario({ requestId }));
      expect(events.some((e) => e.type === 'done')).toBe(false);
    });
  });

  describe('abortMidStream', () => {
    it('yields done early when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const events = await collect(
        abortMidStream({ requestId, signal: controller.signal }),
      );
      const types = events.map((e) => e.type);
      // After first two text events, should see done (not more text)
      expect(types[types.length - 1]).toBe('done');
      // Should have fewer events than unaborted
      expect(types.length).toBeLessThanOrEqual(3); // text, text, done
    });

    it('yields full stream when not aborted', async () => {
      const events = await collect(abortMidStream({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toEqual(['text', 'text', 'text', 'done']);
    });

    it('stamps requestId on all events', async () => {
      const controller = new AbortController();
      controller.abort();
      const events = await collect(
        abortMidStream({ requestId, signal: controller.signal }),
      );
      for (const event of events) {
        expect(event.requestId).toBe(requestId);
      }
    });
  });

  describe('multipleMutations', () => {
    it('yields tool_call → tool_result → tool_call → tool_result → text → done', async () => {
      const events = await collect(multipleMutations({ requestId }));
      const types = events.map((e) => e.type);
      expect(types).toEqual([
        'tool_call', 'tool_result', 'tool_call', 'tool_result', 'text', 'done',
      ]);
    });

    it('each tool_call/tool_result pair shares an id', async () => {
      const events = await collect(multipleMutations({ requestId }));
      const calls = events.filter((e): e is ToolCallEvent => e.type === 'tool_call');
      const results = events.filter((e): e is ToolResultEvent => e.type === 'tool_result');
      expect(calls).toHaveLength(2);
      expect(results).toHaveLength(2);
      expect(calls[0].id).toBe(results[0].id);
      expect(calls[1].id).toBe(results[1].id);
      expect(calls[0].id).not.toBe(calls[1].id);
    });

    it('stamps requestId on all events', async () => {
      const events = await collect(multipleMutations({ requestId }));
      for (const event of events) {
        expect(event.requestId).toBe(requestId);
      }
    });
  });
});
