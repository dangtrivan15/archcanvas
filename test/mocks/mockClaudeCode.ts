import type { ChatEvent } from '@/core/ai/types';

/** Options shared by all mock scenarios. */
export interface MockScenarioOptions {
  requestId: string;
  /** Delay (ms) between yielded events. Defaults to 0 for fast tests. */
  delay?: number;
}

/** Options for scenarios that involve a permission gate. */
export interface PermissionScenarioOptions extends MockScenarioOptions {
  /** Called when the scenario reaches a permission_request point.
   *  Return `true` to approve, `false` to deny. */
  onPermission?: (permissionId: string) => Promise<boolean>;
}

/** Options for the abort scenario. */
export interface AbortScenarioOptions extends MockScenarioOptions {
  signal?: AbortSignal;
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

// ---------------------------------------------------------------------------
// 1. textStreaming — text → text → text → done
// ---------------------------------------------------------------------------
export async function* textStreaming(
  opts: MockScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0 } = opts;

  yield { type: 'text', requestId, text: 'Let me ' };
  await wait(delay);
  yield { type: 'text', requestId, text: 'analyze your ' };
  await wait(delay);
  yield { type: 'text', requestId, text: 'architecture.' };
  await wait(delay);
  yield { type: 'done', requestId };
}

// ---------------------------------------------------------------------------
// 2. toolCallFlow — text → permission_request → (approved) → tool_call →
//                   tool_result → text → done
// ---------------------------------------------------------------------------
export async function* toolCallFlow(
  opts: PermissionScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0, onPermission } = opts;
  const permissionId = `perm-${requestId}`;
  const callId = `call-${requestId}`;

  yield { type: 'text', requestId, text: 'I will list the nodes.' };
  await wait(delay);

  yield {
    type: 'permission_request',
    requestId,
    permissionId,
    description: 'Run archcanvas list --json',
    toolName: 'bash',
  };
  await wait(delay);

  const approved = onPermission ? await onPermission(permissionId) : true;

  if (!approved) {
    // Caller denied — gracefully finish (shouldn't normally reach here;
    // use the permissionDenied scenario for that flow).
    yield { type: 'text', requestId, text: 'Okay, I won\'t run that.' };
    await wait(delay);
    yield { type: 'done', requestId };
    return;
  }

  yield {
    type: 'tool_call',
    requestId,
    toolName: 'bash',
    args: { command: 'archcanvas list --json' },
    callId,
  };
  await wait(delay);

  yield {
    type: 'tool_result',
    requestId,
    callId,
    output: '{"nodes":["api-gateway","auth-service"]}',
    isError: false,
  };
  await wait(delay);

  yield { type: 'text', requestId, text: 'Found 2 nodes in your architecture.' };
  await wait(delay);
  yield { type: 'done', requestId };
}

// ---------------------------------------------------------------------------
// 3. permissionDenied — text → permission_request → (denied) → text → done
// ---------------------------------------------------------------------------
export async function* permissionDenied(
  opts: PermissionScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0, onPermission } = opts;
  const permissionId = `perm-${requestId}`;

  yield { type: 'text', requestId, text: 'I need to run a command.' };
  await wait(delay);

  yield {
    type: 'permission_request',
    requestId,
    permissionId,
    description: 'Run archcanvas add-node --id svc --type compute/service --json',
    toolName: 'bash',
  };
  await wait(delay);

  const approved = onPermission ? await onPermission(permissionId) : false;

  if (approved) {
    // Shouldn't happen in the "denied" scenario, but handle gracefully.
    yield { type: 'text', requestId, text: 'Running the command now.' };
    await wait(delay);
    yield { type: 'done', requestId };
    return;
  }

  yield {
    type: 'text', requestId,
    text: 'Understood, I won\'t make that change.',
  };
  await wait(delay);
  yield { type: 'done', requestId };
}

// ---------------------------------------------------------------------------
// 4. clarifyingQuestion — text (question) → done
// ---------------------------------------------------------------------------
export async function* clarifyingQuestion(
  opts: MockScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0 } = opts;

  yield {
    type: 'text', requestId,
    text: 'Could you clarify which service you want to add?',
  };
  await wait(delay);
  yield { type: 'done', requestId };
}

// ---------------------------------------------------------------------------
// 5. errorScenario — text → error
// ---------------------------------------------------------------------------
export async function* errorScenario(
  opts: MockScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0 } = opts;

  yield { type: 'text', requestId, text: 'Processing your request...' };
  await wait(delay);
  yield {
    type: 'error', requestId,
    message: 'Connection lost',
    code: 'CONNECTION_ERROR',
  };
}

// ---------------------------------------------------------------------------
// 6. abortMidStream — text → text → (abort signal) → done
// ---------------------------------------------------------------------------
export async function* abortMidStream(
  opts: AbortScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0, signal } = opts;

  yield { type: 'text', requestId, text: 'Starting analysis' };
  await wait(delay);
  yield { type: 'text', requestId, text: ' of your system' };
  await wait(delay);

  if (signal?.aborted) {
    yield { type: 'done', requestId };
    return;
  }

  // In a real scenario more events would follow; the abort cuts them short.
  yield { type: 'text', requestId, text: ' architecture.' };
  await wait(delay);
  yield { type: 'done', requestId };
}

// ---------------------------------------------------------------------------
// 7. multipleMutations — tool_call → tool_result → tool_call → tool_result →
//                         text → done
// ---------------------------------------------------------------------------
export async function* multipleMutations(
  opts: MockScenarioOptions,
): AsyncGenerator<ChatEvent> {
  const { requestId, delay = 0 } = opts;
  const callId1 = `call-${requestId}-1`;
  const callId2 = `call-${requestId}-2`;

  yield {
    type: 'tool_call', requestId,
    toolName: 'bash',
    args: { command: 'archcanvas add-node --id svc-a --type compute/service --json' },
    callId: callId1,
  };
  await wait(delay);

  yield {
    type: 'tool_result', requestId,
    callId: callId1,
    output: '{"ok":true,"nodeId":"svc-a"}',
    isError: false,
  };
  await wait(delay);

  yield {
    type: 'tool_call', requestId,
    toolName: 'bash',
    args: { command: 'archcanvas add-edge --from svc-a --to db --json' },
    callId: callId2,
  };
  await wait(delay);

  yield {
    type: 'tool_result', requestId,
    callId: callId2,
    output: '{"ok":true}',
    isError: false,
  };
  await wait(delay);

  yield { type: 'text', requestId, text: 'Added service and connected it to the database.' };
  await wait(delay);
  yield { type: 'done', requestId };
}
