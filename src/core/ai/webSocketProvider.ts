import { ulid } from 'ulid';
import type {
  ChatProvider,
  ChatEvent,
  ChatMessage,
  ProjectContext,
} from './types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import type { Node, Edge, Entity } from '@/types/schema';
import { validateAndBuildNode } from '@/core/validation/addNodeValidation';

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

  private handleStoreAction(msg: StoreActionMessage): void {
    const { action, args, correlationId } = msg;

    let result: unknown;
    try {
      result = this.dispatchStoreAction(action, args);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dispatchStoreAction(action: string, args: Record<string, unknown>): unknown {
    switch (action) {
      // --- Write actions ---
      case 'addNode':
        return this.dispatchAddNode(args);
      case 'addEdge':
        return useGraphStore.getState().addEdge(args.canvasId as string, args.edge as any);
      case 'removeNode':
        return useGraphStore.getState().removeNode(args.canvasId as string, args.nodeId as string);
      case 'removeEdge':
        return useGraphStore.getState().removeEdge(args.canvasId as string, args.from as string, args.to as string);
      case 'import':
        return this.dispatchImport(args);

      // --- Read actions ---
      case 'list':
        return this.dispatchList(args);
      case 'describe':
        return this.dispatchDescribe(args);
      case 'search':
        return this.dispatchSearch(args);
      case 'catalog':
        return this.dispatchCatalog(args);

      default:
        return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } };
    }
  }

  // -------------------------------------------------------------------------
  // Write action dispatchers
  // -------------------------------------------------------------------------

  /**
   * addNode with enrichment: validates type against registry (with fuzzy
   * matching), resolves displayName from NodeDef, constructs InlineNode.
   */
  private dispatchAddNode(args: Record<string, unknown>): unknown {
    const canvasId = args.canvasId as string;

    const result = validateAndBuildNode(
      {
        id: args.id as string,
        type: args.type as string,
        name: args.name as string | undefined,
        args: args.args as string | undefined,
      },
      useRegistryStore.getState(),
    );
    if (!result.ok) {
      return { ok: false, error: { code: result.code, message: result.message } };
    }

    return useGraphStore.getState().addNode(canvasId, result.node);
  }

  /** Import pre-parsed nodes/edges/entities into a canvas. */
  private dispatchImport(args: Record<string, unknown>): unknown {
    const canvasId = args.canvasId as string;
    const nodes = (args.nodes as Node[] | undefined) ?? [];
    const edges = (args.edges as Edge[] | undefined) ?? [];
    const entities = (args.entities as Entity[] | undefined) ?? [];

    // Validate canvas exists
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) {
      return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
    }

    const added = { nodes: 0, edges: 0, entities: 0 };
    const errors: { type: string; item: unknown; error: string }[] = [];
    const gs = useGraphStore.getState();

    for (const node of nodes) {
      const result = gs.addNode(canvasId, node);
      if (result.ok) { added.nodes++; }
      else { errors.push({ type: 'node', item: node, error: `${result.error.code}` }); }
    }
    for (const edge of edges) {
      const result = gs.addEdge(canvasId, edge);
      if (result.ok) { added.edges++; }
      else { errors.push({ type: 'edge', item: edge, error: `${result.error.code}` }); }
    }
    for (const entity of entities) {
      const result = gs.addEntity(canvasId, entity);
      if (result.ok) { added.entities++; }
      else { errors.push({ type: 'entity', item: entity, error: `${result.error.code}` }); }
    }

    return { added, errors };
  }

  // -------------------------------------------------------------------------
  // Read action dispatchers
  // -------------------------------------------------------------------------

  /** List nodes/edges/entities in a canvas. */
  private dispatchList(args: Record<string, unknown>): unknown {
    const canvasId = (args.canvasId as string | undefined) ?? ROOT_CANVAS_KEY;
    const typeFilter = (args.type as string | undefined) ?? 'all';

    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (!canvas) {
      return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
    }

    const data = canvas.data;
    const result: Record<string, unknown> = {};

    if (typeFilter === 'all' || typeFilter === 'nodes') {
      result.nodes = (data.nodes ?? []).map((n: Node) => ({
        id: n.id,
        type: 'type' in n ? n.type : `ref:${'ref' in n ? n.ref : ''}`,
        displayName: 'displayName' in n ? n.displayName : undefined,
      }));
    }
    if (typeFilter === 'all' || typeFilter === 'edges') {
      result.edges = (data.edges ?? []).map((e: Edge) => ({
        from: e.from.node,
        to: e.to.node,
        label: e.label,
        protocol: e.protocol,
      }));
    }
    if (typeFilter === 'all' || typeFilter === 'entities') {
      result.entities = (data.entities ?? []).map((e: Entity) => ({
        name: e.name,
        description: e.description,
      }));
    }

    return result;
  }

  /** Describe a node or the full architecture. */
  private dispatchDescribe(args: Record<string, unknown>): unknown {
    const nodeId = args.id as string | undefined;

    if (nodeId) {
      const canvasId = (args.canvasId as string | undefined) ?? ROOT_CANVAS_KEY;
      const canvas = useFileStore.getState().getCanvas(canvasId);
      if (!canvas) {
        return { ok: false, error: { code: 'CANVAS_NOT_FOUND', message: `Canvas '${canvasId}' not found.` } };
      }

      const nodes = canvas.data.nodes ?? [];
      const node = nodes.find((n: Node) => n.id === nodeId);
      if (!node) {
        return { ok: false, error: { code: 'NODE_NOT_FOUND', message: `Node '${nodeId}' not found in canvas '${canvasId}'.` } };
      }

      const edges = canvas.data.edges ?? [];
      const connectedEdges = edges
        .filter((e: Edge) => e.from.node === nodeId || e.to.node === nodeId)
        .map((e: Edge) => ({ from: e.from.node, to: e.to.node, label: e.label, protocol: e.protocol }));

      const result: Record<string, unknown> = { id: node.id };
      if ('type' in node) {
        result.type = node.type;
        result.displayName = node.displayName;
        result.args = node.args;
        result.notes = node.notes;
        result.codeRefs = node.codeRefs;
        const nodeDef = useRegistryStore.getState().resolve(node.type);
        if (nodeDef) { result.ports = nodeDef.spec.ports; }
      } else if ('ref' in node) {
        result.ref = node.ref;
      }
      result.connectedEdges = connectedEdges;

      return { node: result };
    }

    // Describe full architecture
    const project = useFileStore.getState().project;
    if (!project) {
      return { ok: false, error: { code: 'PROJECT_LOAD_FAILED', message: 'No project loaded.' } };
    }

    const rootCanvas = project.canvases.get(ROOT_CANVAS_KEY);
    const projectName = rootCanvas?.data.project?.name ?? 'Unknown';
    const scopes: Record<string, unknown>[] = [];

    for (const [cid, cv] of project.canvases) {
      const d = cv.data;
      const scopeInfo: Record<string, unknown> = {
        canvasId: cid,
        nodeCount: (d.nodes ?? []).length,
        edgeCount: (d.edges ?? []).length,
        entityCount: (d.entities ?? []).length,
      };

      // Include child canvas data for ref nodes (matching CLI describe output)
      if (cid !== ROOT_CANVAS_KEY) {
        const refNodes = (d.nodes ?? []).filter((n: Node) => 'ref' in n);
        if (refNodes.length > 0) {
          scopeInfo.childRefs = refNodes.map((n: Node) => {
            // Canvas map is keyed by node.id, not the ref filename
            const childCanvas = project.canvases.get(n.id);
            return {
              ref: 'ref' in n ? n.ref : '',
              nodeCount: childCanvas ? (childCanvas.data.nodes ?? []).length : 0,
              edgeCount: childCanvas ? (childCanvas.data.edges ?? []).length : 0,
            };
          });
        }
      }

      scopes.push(scopeInfo);
    }

    return { project: projectName, scopes };
  }

  /** Search across all canvases. */
  private dispatchSearch(args: Record<string, unknown>): unknown {
    const query = (args.query as string).toLowerCase();
    const typeFilter = (args.type as string | undefined) ?? 'all';
    const project = useFileStore.getState().project;

    if (!project) {
      return { results: [] };
    }

    const results: { type: string; scope: string; item: Record<string, unknown> }[] = [];

    for (const [canvasId, canvas] of project.canvases) {
      const data = canvas.data;

      if (typeFilter === 'all' || typeFilter === 'nodes') {
        for (const node of data.nodes ?? []) {
          const fields = [node.id, 'displayName' in node ? node.displayName : undefined, 'type' in node ? node.type : undefined];
          if (fields.some((f) => f?.toLowerCase().includes(query))) {
            results.push({
              type: 'node', scope: canvasId,
              item: { id: node.id, type: 'type' in node ? node.type : `ref:${'ref' in node ? node.ref : ''}`, displayName: 'displayName' in node ? node.displayName : undefined },
            });
          }
        }
      }

      if (typeFilter === 'all' || typeFilter === 'edges') {
        for (const edge of data.edges ?? []) {
          const fields = [edge.label, edge.from.node, edge.to.node];
          if (fields.some((f) => f?.toLowerCase().includes(query))) {
            results.push({
              type: 'edge', scope: canvasId,
              item: { from: edge.from.node, to: edge.to.node, label: edge.label, protocol: edge.protocol },
            });
          }
        }
      }

      if (typeFilter === 'all' || typeFilter === 'entities') {
        for (const entity of data.entities ?? []) {
          const fields = [entity.name, entity.description];
          if (fields.some((f) => f?.toLowerCase().includes(query))) {
            results.push({
              type: 'entity', scope: canvasId,
              item: { name: entity.name, description: entity.description },
            });
          }
        }
      }
    }

    return { results };
  }

  /** List all registered node types. */
  private dispatchCatalog(args: Record<string, unknown>): unknown {
    const namespace = args.namespace as string | undefined;
    const registry = useRegistryStore.getState();
    const allDefs = namespace ? registry.listByNamespace(namespace) : registry.list();

    const nodeTypes = allDefs.map((def) => ({
      type: `${def.metadata.namespace}/${def.metadata.name}`,
      displayName: def.metadata.displayName,
      namespace: def.metadata.namespace,
      description: def.metadata.description,
      tags: def.metadata.tags ?? [],
    }));

    return { nodeTypes };
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
