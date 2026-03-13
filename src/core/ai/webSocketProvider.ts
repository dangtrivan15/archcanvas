import { ulid } from 'ulid';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
} from './types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';

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
  result: unknown;
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

    return this.createEventStream(requestId);
  }

  loadHistory(messages: ChatMessage[]): void {
    this.send({ type: 'load_history', messages });
  }

  abort(): void {
    this.send({ type: 'abort' });
  }

  /** Send a permission response back to the bridge. */
  sendPermissionResponse(id: string, allowed: boolean): void {
    this.send({ type: 'permission_response', id, allowed });
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

    // Handle store_action messages (from HTTP mutation path)
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
      result = this.dispatchStoreAction(action, args);

      // Unknown action — return immediately without attempting save
      if (
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        (result as { ok: boolean }).ok === false
      ) {
        this.send({
          type: 'store_action_result',
          correlationId,
          result,
        } satisfies StoreActionResultMessage);
        return;
      }

      // Persist if filesystem is available
      const fileStore = useFileStore.getState();
      if (fileStore.fs) {
        await fileStore.save();
      } else {
        result = { ok: false, error: { code: 'NO_FILESYSTEM', message: 'No filesystem available for persistence' } };
      }
    } catch (err) {
      result = {
        ok: false,
        error: { code: 'STORE_ACTION_ERROR', message: err instanceof Error ? err.message : String(err) },
      };
    }

    this.send({
      type: 'store_action_result',
      correlationId,
      result,
    } satisfies StoreActionResultMessage);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatchStoreAction(action: string, args: Record<string, unknown>): unknown {
    const gs = useGraphStore.getState();
    switch (action) {
      case 'addNode':
        return gs.addNode(args.canvasId as string, args.node as any);
      case 'addEdge':
        return gs.addEdge(args.canvasId as string, args.edge as any);
      case 'removeNode':
        return gs.removeNode(args.canvasId as string, args.nodeId as string);
      case 'removeEdge':
        return gs.removeEdge(args.canvasId as string, args.from as string, args.to as string);
      default:
        return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } };
    }
  }

  private createEventStream(requestId: string): AsyncIterable<ChatEvent> {
    const listeners = this.eventListeners;

    // Use a queue-based approach for the async generator
    const queue: ChatEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const listener = (event: ChatEvent) => {
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

    async function* generator(): AsyncGenerator<ChatEvent> {
      try {
        while (true) {
          while (queue.length > 0) {
            const event = queue.shift()!;
            yield event;
            if (event.type === 'done' || event.type === 'error') {
              return;
            }
          }
          if (done) return;
          // Wait for the next event
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      } finally {
        listeners.delete(requestId);
      }
    }

    return generator();
  }
}
