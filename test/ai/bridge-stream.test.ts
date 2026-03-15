import { describe, it, expect } from 'vitest';
import {
  createBridgeSession,
  type SDKQueryFn,
  type ChatEvent,
  collect,
  testContext,
  getTestCwd,
  sdkSystemInit,
  sdkAssistantText,
  sdkAssistantToolUse,
  sdkUserToolResult,
  sdkAssistantMixed,
  sdkAssistantThinking,
  sdkResultSuccess,
  sdkResultError,
  sdkStreamEvent,
  sdkStreamEventOther,
  sdkToolProgress,
  sdkRateLimit,
  sdkPromptSuggestion,
  setupSession,
  toSDKQuery,
} from './bridge-test-helpers';

// ---------------------------------------------------------------------------
// Scenario 1: Text streaming
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 1: textStreaming', () => {
  it('translates SDK text messages into ChatEvent text + done', async () => {
    const { session } = setupSession({
      yields: [
        sdkAssistantText('Let me '),
        sdkAssistantText('analyze your '),
        sdkAssistantText('architecture.'),
      ],
    });
    const events = await collect(session.sendMessage('hello', testContext()));

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
    const { session } = setupSession({
      yields: [
        sdkAssistantText('I will list the nodes.'),
        sdkAssistantToolUse('bash', { command: 'archcanvas list --json' }, 'call-1'),
        sdkUserToolResult('call-1', '{"nodes":["api-gateway","auth-service"]}'),
        sdkAssistantText('Found 2 nodes in your architecture.'),
      ],
    });
    const events = await collect(session.sendMessage('list my nodes', testContext()));

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
    const { session } = setupSession({
      yields: [
        sdkAssistantText('I need to run a command.'),
        // In real SDK, canUseTool would block. Here we simulate denial outcome.
        sdkAssistantText("Understood, I won't make that change."),
      ],
    });
    const events = await collect(session.sendMessage('add a service', testContext()));

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
    const { session } = setupSession({
      yields: [sdkAssistantText('Could you clarify which service you want to add?')],
    });
    const events = await collect(session.sendMessage('add a service', testContext()));

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
    const testCwd = getTestCwd();
    const mockQueryFn: SDKQueryFn = () => {
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-5');
        yield sdkAssistantText('Processing your request...');
        yield sdkResultError('error_during_execution', ['Connection lost']);
      })());
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('analyze', testContext()));

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
// Scenario 7: Multiple mutations
// ---------------------------------------------------------------------------
describe('BridgeSession — Scenario 7: multipleMutations', () => {
  it('translates multiple tool_use + tool_result pairs', async () => {
    const { session } = setupSession({
      yields: [
        sdkAssistantToolUse('bash', { command: 'archcanvas add-node --id svc-a --type compute/service --json' }, 'call-1'),
        sdkUserToolResult('call-1', '{"ok":true,"nodeId":"svc-a"}'),
        sdkAssistantToolUse('bash', { command: 'archcanvas add-edge --from svc-a --to db --json' }, 'call-2'),
        sdkUserToolResult('call-2', '{"ok":true}'),
        sdkAssistantText('Added service and connected it to the database.'),
      ],
    });
    const events = await collect(session.sendMessage('add service and connect', testContext()));

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
// Streaming text via stream_event
// ---------------------------------------------------------------------------
describe('BridgeSession — stream_event translation', () => {
  it('yields TextEvents from text_delta stream events', async () => {
    const { session } = setupSession({
      yields: [
        sdkStreamEvent('text_delta', { text: 'Hello ' }),
        sdkStreamEvent('text_delta', { text: 'world' }),
      ],
    });
    const events = await collect(session.sendMessage('hi', testContext()));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0]).toMatchObject({ type: 'text', content: 'Hello ' });
    expect(textEvents[1]).toMatchObject({ type: 'text', content: 'world' });
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });

  it('yields ThinkingEvents from thinking_delta stream events', async () => {
    const { session } = setupSession({
      yields: [
        sdkStreamEvent('thinking_delta', { thinking: 'Let me consider...' }),
        sdkStreamEvent('thinking_delta', { thinking: ' the options.' }),
      ],
    });
    const events = await collect(session.sendMessage('think', testContext()));

    const thinkingEvents = events.filter(e => e.type === 'thinking');
    expect(thinkingEvents).toHaveLength(2);
    expect(thinkingEvents[0]).toMatchObject({ type: 'thinking', content: 'Let me consider...' });
    expect(thinkingEvents[1]).toMatchObject({ type: 'thinking', content: ' the options.' });

    session.destroy();
  });

  it('skips non-content_block_delta stream events', async () => {
    const { session } = setupSession({
      yields: [
        sdkStreamEventOther('message_start'),
        sdkStreamEventOther('content_block_start'),
        sdkStreamEvent('text_delta', { text: 'Only this' }),
        sdkStreamEventOther('content_block_stop'),
        sdkStreamEventOther('message_stop'),
      ],
    });
    const events = await collect(session.sendMessage('test', testContext()));

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
    const { session } = setupSession({
      yields: [
        // Streaming deltas first
        sdkStreamEvent('text_delta', { text: 'Hello ' }),
        sdkStreamEvent('text_delta', { text: 'world' }),
        // Final assistant message (same text, plus a tool_use)
        sdkAssistantMixed('Hello world', 'Bash', { command: 'ls' }, 'call-1'),
        sdkUserToolResult('call-1', 'file.txt'),
      ],
    });
    const events = await collect(session.sendMessage('hi', testContext()));

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
    const { session } = setupSession({
      yields: [
        // Streaming thinking deltas
        sdkStreamEvent('thinking_delta', { thinking: 'Hmm...' }),
        // Final assistant message with the complete thinking block
        sdkAssistantThinking('Hmm...'),
      ],
    });
    const events = await collect(session.sendMessage('think', testContext()));

    // Thinking should appear only once (from streaming)
    const thinkingEvents = events.filter(e => e.type === 'thinking');
    expect(thinkingEvents).toHaveLength(1);
    expect(thinkingEvents[0]).toMatchObject({ content: 'Hmm...' });

    session.destroy();
  });

  it('emits text from assistant message when no stream_event deltas were received', async () => {
    // Fallback: if the SDK doesn't emit stream_events, the assistant message text is used
    const { session } = setupSession({
      yields: [sdkAssistantText('No streaming here.')],
    });
    const events = await collect(session.sendMessage('hi', testContext()));

    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toMatchObject({ content: 'No streaming here.' });

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tool progress
// ---------------------------------------------------------------------------
describe('BridgeSession — tool_progress messages', () => {
  it('does not yield status events (SDK type has no user-facing content)', async () => {
    const { session } = setupSession({
      yields: [
        sdkToolProgress(),
        sdkAssistantText('Done.'),
      ],
    });
    const events = await collect(session.sendMessage('build', testContext()));

    // tool_progress messages are acknowledged but don't produce status events
    const statusEvents = events.filter(e => e.type === 'status');
    expect(statusEvents).toHaveLength(0);
    expect(events.some(e => e.type === 'text')).toBe(true);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------
describe('BridgeSession — rate_limit messages', () => {
  it('yields RateLimitEvent from SDK rate_limit_event (rejected)', async () => {
    const { session } = setupSession({
      yields: [
        sdkRateLimit('rejected'),
        sdkAssistantText('After rate limit.'),
      ],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Rate limit reached. Waiting...',
    });

    // Streaming should continue after rate limit
    const textEvents = events.filter(e => e.type === 'text');
    expect(textEvents).toHaveLength(1);
    expect(events.some(e => e.type === 'done')).toBe(true);

    session.destroy();
  });

  it('yields warning for allowed_warning status', async () => {
    const { session } = setupSession({
      yields: [
        sdkRateLimit('allowed_warning'),
      ],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Approaching rate limit',
    });

    session.destroy();
  });

  it('skips allowed status (no warning needed)', async () => {
    const { session } = setupSession({
      yields: [
        sdkRateLimit('allowed'),
      ],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(0);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Prompt suggestions (ignored)
// ---------------------------------------------------------------------------
describe('BridgeSession — prompt_suggestion messages', () => {
  it('ignores prompt_suggestion messages (no events emitted)', async () => {
    const { session } = setupSession({
      yields: [
        sdkAssistantText('Here is my answer.'),
        sdkPromptSuggestion('Tell me more'),
      ],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    // Should only have text + done, no prompt_suggestion events
    expect(events.map(e => e.type)).toEqual(['text', 'done']);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// Full streaming scenario (stream_event + status + tool_use + result)
// ---------------------------------------------------------------------------
describe('BridgeSession — full streaming scenario', () => {
  it('handles a realistic mix of stream_event, assistant, tool, and result', async () => {
    const { session } = setupSession({
      yields: [
        // Streaming text deltas
        sdkStreamEvent('text_delta', { text: 'I will ' }),
        sdkStreamEvent('text_delta', { text: 'read your file.' }),
        // Final assistant message (text already streamed, but has tool_use)
        sdkAssistantMixed('I will read your file.', 'Read', { file_path: '/src/main.ts' }, 'read-1'),
        sdkUserToolResult('read-1', 'export function main() {}'),
        // More streaming for the follow-up
        sdkStreamEvent('text_delta', { text: 'Found the main function.' }),
        sdkAssistantText('Found the main function.'),
      ],
    });
    const events = await collect(session.sendMessage('read main', testContext()));

    const types = events.map(e => e.type);
    // Stream deltas, tool_call (from assistant), tool_result, more stream delta, done
    expect(types).toEqual([
      'text',        // 'I will '
      'text',        // 'read your file.'
      'tool_call',   // Read tool (from final assistant, text skipped)
      'tool_result', // tool result
      'text',        // 'Found the main function.' (streamed delta)
      'done',        // Final assistant text skipped (hasStreamedText), then done
    ]);

    session.destroy();
  });
});

// ---------------------------------------------------------------------------
// SDK regression tests — verify type fixes from progress doc 12
// ---------------------------------------------------------------------------
describe('BridgeSession — SDK type regression', () => {
  it('silently ignores unknown SDK message types', async () => {
    const testCwd = getTestCwd();
    const mockQueryFn: SDKQueryFn = () => {
      return toSDKQuery((async function* () {
        yield sdkSystemInit('session-unknown');
        // Simulate a future/unknown SDK message type
        yield {
          type: 'unknown_future_type',
          uuid: 'unk-1',
          session_id: 'session-unknown',
          payload: { foo: 'bar' },
        } as unknown as import('@/core/ai/claudeCodeBridge').SDKMessage;
        yield sdkResultSuccess();
      })());
    };

    const session = createBridgeSession({ cwd: testCwd, queryFn: mockQueryFn });
    const events = await collect(session.sendMessage('test', testContext()));

    // Only a done event should be emitted — the unknown type is silently skipped
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'done' });

    session.destroy();
  });

  it('emits rate_limit ChatEvent with "Rate limit reached. Waiting..." for rejected status', async () => {
    // Regression: SDK uses type 'rate_limit_event' (not 'rate_limit')
    const { session } = setupSession({
      yields: [sdkRateLimit('rejected')],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Rate limit reached. Waiting...',
    });

    session.destroy();
  });

  it('emits rate_limit ChatEvent with "Approaching rate limit" for allowed_warning status', async () => {
    // Regression: SDK uses type 'rate_limit_event' with rate_limit_info.status
    const { session } = setupSession({
      yields: [sdkRateLimit('allowed_warning')],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(1);
    expect(rateLimitEvents[0]).toMatchObject({
      type: 'rate_limit',
      message: 'Approaching rate limit',
    });

    session.destroy();
  });

  it('does NOT emit rate_limit ChatEvent for allowed status (below threshold)', async () => {
    // Regression: 'allowed' status means no throttling — no event needed
    const { session } = setupSession({
      yields: [sdkRateLimit('allowed')],
    });
    const events = await collect(session.sendMessage('test', testContext()));

    const rateLimitEvents = events.filter(e => e.type === 'rate_limit');
    expect(rateLimitEvents).toHaveLength(0);

    // Only done event expected
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'done' });

    session.destroy();
  });
});
