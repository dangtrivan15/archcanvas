import { ulid } from 'ulid';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
} from './types';
import { dispatchStoreAction } from './storeActionDispatcher';

// ---------------------------------------------------------------------------
// Internal message types (bridge <-> browser, not part of public ChatEvent)
// ---------------------------------------------------------------------------

interface StoreActionMessage {
  type: 'store_action';
  action: string;
  args: Record<string, unknown>;
  correlationId: string;
}

interface StoreActionResultMessage {
  type: 'store_action_result';
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// WebSocket-backed ChatProvider
// ---------------------------------------------------------------------------

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export type ConnectionChangeCallback = (connected: boolean) => void;

export class WebSocketClaudeCodeProvider implements ChatProvider {
  readonly id = 'claude-code';
  readonly displayName = 'Claude Code';

  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private onConnectionChange: ConnectionChangeCallback | null = null;

  // Listeners keyed by requestId, for routing incoming ChatEvents
  private eventListeners = new Map<string, (event: ChatEvent) => void>();

  /** Abort callback for the current event stream (set during sendMessage). */
  private currentStreamAbort: (() => void) | null = null;

  get available(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Register a callback that fires when connection status changes. */
  setConnectionChangeCallback(cb: ConnectionChangeCallback | null): void {
    this.onConnectionChange = cb;
  }

  connect(url: string): void {
    this.url = url;
    this.intentionalClose = false;
    this.establishConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  sendMessage(
    content: string,
    context: ProjectContext,
  ): AsyncIterable<ChatEvent> {
    const requestId = ulid();
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      async function* errorStream(): AsyncIterable<ChatEvent> {
        const err: ChatEvent = { type: 'error', requestId: '', message: 'Not connected to AI bridge' };
        yield err;
      }
      return errorStream();
    }

    ws.send(
      JSON.stringify({
        type: 'chat',
        requestId,
        content,
        context,
      }),
    );

    const { stream, abort } = this.createEventStream(requestId);
    this.currentStreamAbort = abort;
    return stream;
  }

  loadHistory(messages: ChatMessage[]): void {
    this.send({ type: 'load_history', messages });
  }

  interrupt(): void {
    // Immediately terminate the browser-side event stream so the
    // for-await loop in chatStore.sendMessage breaks right away.
    if (this.currentStreamAbort) {
      this.currentStreamAbort();
      this.currentStreamAbort = null;
    }
    // Tell the server to interrupt the SDK turn (preserves session context)
    this.send({ type: 'interrupt' });
  }

  /** Send a permission response back to the bridge. */
  sendPermissionResponse(
    id: string,
    allowed: boolean,
    options?: {
      updatedPermissions?: import('./types').PermissionSuggestion[];
      interrupt?: boolean;
    },
  ): void {
    this.send({
      type: 'permission_response',
      id,
      allowed,
      ...(options?.updatedPermissions && { updatedPermissions: options.updatedPermissions }),
      ...(options?.interrupt !== undefined && { interrupt: options.interrupt }),
    });
  }

  /**
   * Send the user's answers to an AskUserQuestion card back to the bridge.
   * The bridge uses these to build the `updatedInput.answers` record that
   * the SDK expects: `{ "question text": "selected label", ... }`.
   */
  sendQuestionResponse(id: string, answers: Record<string, string>): void {
    this.send({ type: 'question_response', id, answers });
  }

  /** Change the permission mode for the current bridge session. */
  sendSetPermissionMode(mode: string): void {
    this.send({ type: 'set_permission_mode', mode });
  }

  /** Change the effort level for the current bridge session. */
  sendSetEffort(effort: string): void {
    this.send({ type: 'set_effort', effort });
  }

  /** Tell the bridge to clear its persisted conversation history. */
  sendClearHistory(): void {
    this.send({ type: 'clear_history' });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private establishConnection(): void {
    if (!this.url) return;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.onConnectionChange?.(true);
    });

    ws.addEventListener('close', () => {
      this.onConnectionChange?.(false);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    ws.addEventListener('error', () => {
      // The 'close' event always fires after 'error', so reconnect is handled there
    });

    ws.addEventListener('message', (event) => {
      this.handleMessage(event.data as string);
    });
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.establishConnection();
    }, delay);
  }

  private handleMessage(raw: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // ignore malformed messages
    }

    // Handle store_action messages (from MCP tool relay)
    if (parsed.type === 'store_action') {
      this.handleStoreAction(parsed as unknown as StoreActionMessage);
      return;
    }

    // Route ChatEvent to the appropriate listener by requestId
    const requestId = parsed.requestId as string | undefined;
    if (requestId && this.eventListeners.has(requestId)) {
      this.eventListeners.get(requestId)!(parsed as unknown as ChatEvent);
    }
  }

  private async handleStoreAction(msg: StoreActionMessage): Promise<void> {
    const { action, args, correlationId } = msg;

    let result: unknown;
    try {
      result = await dispatchStoreAction(action, args);
    } catch (err) {
      this.send({
        type: 'store_action_result',
        correlationId,
        ok: false,
        error: { code: 'STORE_ACTION_ERROR', message: err instanceof Error ? err.message : String(err) },
      } satisfies StoreActionResultMessage);
      return;
    }

    // Dispatch returned an error result
    if (
      result &&
      typeof result === 'object' &&
      'ok' in result &&
      (result as { ok: boolean }).ok === false
    ) {
      const errResult = result as { ok: false; error: { code: string; message: string } };
      this.send({
        type: 'store_action_result',
        correlationId,
        ok: false,
        error: errResult.error,
      } satisfies StoreActionResultMessage);
      return;
    }

    // No auto-save — dirty tracking marks the canvas, user saves via Cmd+S
    this.send({
      type: 'store_action_result',
      correlationId,
      ok: true,
      data: result,
    } satisfies StoreActionResultMessage);
  }

  private createEventStream(requestId: string): { stream: AsyncIterable<ChatEvent>; abort: () => void } {
    const listeners = this.eventListeners;

    // Use a queue-based approach for the async generator
    const queue: ChatEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    let aborted = false;

    const listener = (event: ChatEvent) => {
      if (aborted) return;
      queue.push(event);
      if (resolve) {
        resolve();
        resolve = null;
      }
      if (event.type === 'done' || event.type === 'error') {
        done = true;
      }
    };

    listeners.set(requestId, listener);

    /** Immediately terminate the generator. */
    const abort = () => {
      aborted = true;
      done = true;
      // Unblock the generator if it's awaiting the next event
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    async function* generator(): AsyncGenerator<ChatEvent> {
      try {
        while (!aborted) {
          while (queue.length > 0 && !aborted) {
            const event = queue.shift()!;
            yield event;
            if (event.type === 'done' || event.type === 'error') {
              return;
            }
          }
          if (done || aborted) return;
          // Wait for the next event
          await new Promise<void>((r) => {
            resolve = r;
          });
          if (aborted) return;
        }
      } finally {
        listeners.delete(requestId);
      }
    }

    return { stream: generator(), abort };
  }
}
