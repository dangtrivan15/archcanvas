/**
 * Text API - the primary interface for reading and mutating architecture data.
 * Used by both the UI and external AI agents (via MCP).
 *
 * Query methods:  describe, listNodes, getNode, getEdges, getNodeDef, search, getAIContext
 * Mutation methods: addNode, addEdge, addNote, removeNote, addCodeRef,
 *                   updateNode, updateNodeColor, updateEdge, removeNode, removeEdge,
 *                   suggest, updateNote, resolveSuggestion
 */

import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import type {
  DescribeOptions,
  NodeSummary,
  NodeDetail,
  EdgeSummary,
  SearchResult,
  AddNodeParams,
  AddEdgeParams,
  AddNoteParams,
  AddCodeRefParams,
  UpdateNodeParams,
  SuggestParams,
} from '@/types/api';
import type { AIContext } from '@/types/ai';
import type { NodeDef } from '@/types/nodedef';
import type { RegistryManagerCore } from '@/core/registry/registryCore';
import {
  createNode,
  createEdge,
  createNote,
  findNode,
  addNode as engineAddNode,
  addEdge as engineAddEdge,
  addChildNode,
  removeNode as engineRemoveNode,
  removeEdge as engineRemoveEdge,
  updateEdge as engineUpdateEdge,
  updateNode as engineUpdateNode,
  updateNodeColor as engineUpdateNodeColor,
  addNoteToNode,
  addNoteToEdge,
  updateNoteStatus,
  updateNoteContent,
  addCodeRef as engineAddCodeRef,
  removeNoteFromNode,
} from '@/core/graph/graphEngine';
import { searchGraph, getNeighbors, flattenNodes, countAllNodes } from '@/core/graph/graphQuery';
import {
  AddNodeSchema,
  AddEdgeSchema,
  AddNoteSchema,
  AddCodeRefSchema,
  UpdateNodeSchema,
  SuggestSchema,
  NodeIdSchema,
  EdgeIdSchema,
  NoteIdSchema,
  DescribeOptionsSchema,
  ResolveSuggestionActionSchema,
  formatValidationError,
} from './validation';

/**
 * TextApi provides the primary interface for reading and mutating architecture data.
 *
 * It wraps the core graph engine with Zod validation and is used by both the
 * interactive UI and external AI agents (via MCP). All mutations are immutable -
 * they produce new graph state rather than modifying in place.
 *
 * @example
 * ```ts
 * const api = new TextApi(graph, registry);
 * const node = api.addNode({ type: 'compute/service', displayName: 'Auth Service' });
 * const edge = api.addEdge({ fromNode: node.id, toNode: dbId, type: 'sync' });
 * const description = api.describe({ format: 'human' });
 * ```
 */
export class TextApi {
  private graph: ArchGraph;
  private readonly registry: RegistryManagerCore;

  /**
   * @param graph - The initial architecture graph state
   * @param registry - Node type registry for resolving NodeDef definitions
   */
  constructor(graph: ArchGraph, registry: RegistryManagerCore) {
    this.graph = graph;
    this.registry = registry;
  }

  /** Returns the current architecture graph state. */
  getGraph(): ArchGraph {
    return this.graph;
  }

  /** Replaces the current graph state (e.g., after loading a file). */
  setGraph(graph: ArchGraph): void {
    this.graph = graph;
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Describe the architecture in the requested format.
   *
   * @param options - Description options including format ('structured' | 'human' | 'ai')
   * @returns Formatted string representation of the architecture
   * @throws Error if options fail Zod validation
   *
   * @example
   * ```ts
   * const json = textApi.describe({ format: 'structured' });
   * const markdown = textApi.describe({ format: 'human' });
   * const xml = textApi.describe({ format: 'ai' }); // XML-like format optimized for LLMs
   * ```
   */
  describe(options: DescribeOptions): string {
    const parsed = DescribeOptionsSchema.safeParse(options);
    if (!parsed.success) {
      throw new Error(`Invalid describe options: ${formatValidationError(parsed.error)}`);
    }

    const { format } = options;

    switch (format) {
      case 'structured':
        return JSON.stringify(this.buildStructuredDescription(), null, 2);
      case 'human':
        return this.buildHumanDescription();
      case 'ai':
        return this.buildAIDescription();
      default:
        return JSON.stringify(this.buildStructuredDescription(), null, 2);
    }
  }

  /**
   * List all nodes (including nested children) as flat summaries.
   *
   * @returns Array of node summaries with id, type, displayName, and counts
   */
  listNodes(): NodeSummary[] {
    const allNodes = flattenNodes(this.graph.nodes);
    return allNodes.map((node) => this.toNodeSummary(node));
  }

  /**
   * Get detailed information about a specific node, including its edges,
   * notes, code refs, children, and NodeDef AI context.
   *
   * @param nodeId - The unique ID of the node to retrieve
   * @returns Full node detail with inbound/outbound edges, or undefined if not found
   */
  getNode(nodeId: string): NodeDetail | undefined {
    const node = findNode(this.graph, nodeId);
    if (!node) return undefined;

    const inboundEdges = this.graph.edges
      .filter((e) => e.toNode === nodeId)
      .map((e) => this.toEdgeSummary(e));

    const outboundEdges = this.graph.edges
      .filter((e) => e.fromNode === nodeId)
      .map((e) => this.toEdgeSummary(e));

    const nodeDef = this.registry.resolve(node.type);

    return {
      id: node.id,
      type: node.type,
      displayName: node.displayName,
      args: { ...node.args },
      properties: { ...node.properties },
      codeRefs: node.codeRefs.map((cr) => ({ path: cr.path, role: cr.role })),
      notes: node.notes.map((n) => ({
        id: n.id,
        author: n.author,
        content: n.content,
        timestampMs: n.timestampMs,
        status: n.status,
      })),
      children: node.children.map((c) => this.toNodeSummary(c)),
      inboundEdges,
      outboundEdges,
      nodedefAIContext: nodeDef?.spec.ai?.context,
    };
  }

  /**
   * Get all edges as summaries.
   */
  getEdges(): EdgeSummary[] {
    return this.graph.edges.map((e) => this.toEdgeSummary(e));
  }

  /**
   * Resolve a nodedef type definition.
   * Returns the NodeDef if found, or undefined if the type is not registered.
   */
  getNodeDef(type: string): NodeDef | undefined {
    return this.registry.resolve(type);
  }

  /**
   * Full-text search across the architecture.
   * @param query - Non-empty search string
   */
  search(query: string): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return searchGraph(this.graph, query);
  }

  /**
   * Build AI context for a selected node, including its neighbors within N hops.
   * Used to provide focused context to the Claude AI assistant.
   *
   * @param nodeId - Optional node to center the context on
   * @param hops - Number of edge hops to include neighbors (default: 1)
   * @returns AI-optimized context with architecture summary, selected node details, and neighbors
   */
  getAIContext(nodeId?: string, hops: number = 1): AIContext {
    const context: AIContext = {
      architectureName: this.graph.name,
      totalNodeCount: countAllNodes(this.graph),
      totalEdgeCount: this.graph.edges.length,
      neighbors: [],
    };

    if (nodeId) {
      const node = findNode(this.graph, nodeId);
      if (node) {
        context.selectedNode = {
          id: node.id,
          type: node.type,
          displayName: node.displayName,
          args: { ...node.args },
          notes: node.notes.map((n) => ({
            author: n.author,
            content: n.content,
          })),
          codeRefs: node.codeRefs.map((cr) => ({
            path: cr.path,
            role: cr.role,
          })),
        };

        const { nodes: neighborNodes, edges: neighborEdges } = getNeighbors(
          this.graph,
          nodeId,
          hops,
        );

        context.neighbors = neighborNodes.map((n) => {
          const connectingEdge = neighborEdges.find(
            (e) =>
              (e.fromNode === nodeId && e.toNode === n.id) ||
              (e.toNode === nodeId && e.fromNode === n.id),
          );
          return {
            id: n.id,
            type: n.type,
            displayName: n.displayName,
            connectionType: connectingEdge?.type ?? 'unknown',
          };
        });
      }
    }

    return context;
  }

  // ============================================================
  // Mutation Methods
  // ============================================================

  /**
   * Add a new node to the architecture.
   * Validates input via Zod schema and creates a node with a fresh ULID.
   *
   * @param params - Node creation parameters (type, displayName, optional position/args/parentId)
   * @returns The newly created ArchNode with generated ID
   * @throws Error if params fail validation
   *
   * @example
   * ```ts
   * const node = textApi.addNode({
   *   type: 'compute/service',
   *   displayName: 'User Service',
   *   position: { x: 100, y: 200 },
   *   args: { language: 'TypeScript' },
   * });
   * ```
   */
  addNode(params: AddNodeParams): ArchNode {
    const parsed = AddNodeSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid addNode params: ${formatValidationError(parsed.error)}`);
    }

    const node = createNode({
      type: params.type,
      displayName: params.displayName,
      position: params.position,
      args: params.args,
    });

    if (params.parentId) {
      this.graph = addChildNode(this.graph, params.parentId, node);
    } else {
      this.graph = engineAddNode(this.graph, node);
    }

    return node;
  }

  /**
   * Add a new edge (connection) between two nodes.
   * Validates input and verifies both endpoint nodes exist in the graph.
   *
   * @param params - Edge creation parameters (fromNode, toNode, type, optional label/ports)
   * @returns The newly created ArchEdge with generated ID
   * @throws Error if params fail validation or endpoint nodes don't exist
   *
   * @example
   * ```ts
   * const edge = textApi.addEdge({
   *   fromNode: serviceId,
   *   toNode: databaseId,
   *   type: 'sync',
   *   label: 'queries',
   * });
   * ```
   */
  addEdge(params: AddEdgeParams): ArchEdge {
    const parsed = AddEdgeSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid addEdge params: ${formatValidationError(parsed.error)}`);
    }

    // Validate that fromNode exists
    const fromNodeObj = findNode(this.graph, params.fromNode);
    if (!fromNodeObj) {
      throw new Error(
        `Cannot create edge: source node '${params.fromNode}' does not exist in the architecture.`,
      );
    }

    // Validate that toNode exists
    const toNodeObj = findNode(this.graph, params.toNode);
    if (!toNodeObj) {
      throw new Error(
        `Cannot create edge: target node '${params.toNode}' does not exist in the architecture.`,
      );
    }

    const edge = createEdge({
      fromNode: params.fromNode,
      toNode: params.toNode,
      type: params.type,
      fromPort: params.fromPort,
      toPort: params.toPort,
      label: params.label,
    });

    this.graph = engineAddEdge(this.graph, edge);
    return edge;
  }

  /**
   * Add a note (annotation/comment) to a node or edge.
   *
   * @param params - Note creation parameters. Exactly one of nodeId or edgeId must be set.
   * @returns The newly created Note with generated ID and timestamp
   * @throws Error if params fail validation or neither nodeId nor edgeId is provided
   */
  addNote(params: AddNoteParams): Note {
    const parsed = AddNoteSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid addNote params: ${formatValidationError(parsed.error)}`);
    }

    const note = createNote({
      author: params.author,
      content: params.content,
      tags: params.tags,
    });

    if (params.nodeId) {
      this.graph = addNoteToNode(this.graph, params.nodeId, note);
    } else if (params.edgeId) {
      this.graph = addNoteToEdge(this.graph, params.edgeId, note);
    }

    return note;
  }

  /**
   * Remove a note from a node by ID.
   *
   * @param nodeId - The ID of the node containing the note
   * @param noteId - The ID of the note to remove
   * @throws Error if nodeId or noteId fail validation
   */
  removeNote(nodeId: string, noteId: string): void {
    const nodeIdParsed = NodeIdSchema.safeParse(nodeId);
    if (!nodeIdParsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(nodeIdParsed.error)}`);
    }
    const noteIdParsed = NoteIdSchema.safeParse(noteId);
    if (!noteIdParsed.success) {
      throw new Error(`Invalid noteId: ${formatValidationError(noteIdParsed.error)}`);
    }
    this.graph = removeNoteFromNode(this.graph, nodeId, noteId);
  }

  /**
   * Add a code reference (file path + role) to a node.
   *
   * @param params - Code ref parameters (nodeId, path, role)
   * @throws Error if params fail validation
   */
  addCodeRef(params: AddCodeRefParams): void {
    const parsed = AddCodeRefSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid addCodeRef params: ${formatValidationError(parsed.error)}`);
    }
    const codeRef = { path: params.path, role: params.role };
    this.graph = engineAddCodeRef(this.graph, params.nodeId, codeRef);
  }

  /**
   * Update a node's displayName, args, or properties.
   *
   * @param nodeId - The ID of the node to update
   * @param params - Fields to update (at least one required)
   * @throws Error if nodeId or params fail validation
   */
  updateNode(nodeId: string, params: UpdateNodeParams): void {
    const nodeIdParsed = NodeIdSchema.safeParse(nodeId);
    if (!nodeIdParsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(nodeIdParsed.error)}`);
    }
    const parsed = UpdateNodeSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid updateNode params: ${formatValidationError(parsed.error)}`);
    }
    this.graph = engineUpdateNode(this.graph, nodeId, params);
  }

  /**
   * Update a node's color (stored in position.color).
   * Pass undefined to clear the custom color (reverts to type default).
   */
  updateNodeColor(nodeId: string, color: string | undefined): void {
    const nodeIdParsed = NodeIdSchema.safeParse(nodeId);
    if (!nodeIdParsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(nodeIdParsed.error)}`);
    }
    this.graph = engineUpdateNodeColor(this.graph, nodeId, color);
  }

  /**
   * Remove a node, its children, and all connected edges from the graph.
   *
   * @param nodeId - The ID of the node to remove
   * @throws Error if nodeId fails validation
   */
  removeNode(nodeId: string): void {
    const parsed = NodeIdSchema.safeParse(nodeId);
    if (!parsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(parsed.error)}`);
    }
    this.graph = engineRemoveNode(this.graph, nodeId);
  }

  /**
   * Update an edge's type, label, or properties.
   */
  updateEdge(
    edgeId: string,
    updates: Partial<Pick<ArchEdge, 'type' | 'label' | 'properties'>>,
  ): void {
    const parsed = EdgeIdSchema.safeParse(edgeId);
    if (!parsed.success) {
      throw new Error(`Invalid edgeId: ${formatValidationError(parsed.error)}`);
    }
    this.graph = engineUpdateEdge(this.graph, edgeId, updates);
  }

  /**
   * Remove an edge.
   */
  removeEdge(edgeId: string): void {
    const parsed = EdgeIdSchema.safeParse(edgeId);
    if (!parsed.success) {
      throw new Error(`Invalid edgeId: ${formatValidationError(parsed.error)}`);
    }
    this.graph = engineRemoveEdge(this.graph, edgeId);
  }

  /**
   * Create an AI suggestion attached as a pending note on a node.
   * The suggestion can later be accepted or dismissed via {@link resolveSuggestion}.
   *
   * @param params - Suggestion parameters (nodeId, content, optional suggestionType)
   * @returns The created Note with status 'pending' and author 'ai'
   * @throws Error if params fail validation
   */
  suggest(params: SuggestParams): Note {
    const parsed = SuggestSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid suggest params: ${formatValidationError(parsed.error)}`);
    }

    const note = createNote({
      author: 'ai',
      content: params.content,
      status: 'pending',
      suggestionType: params.suggestionType,
    });

    this.graph = addNoteToNode(this.graph, params.nodeId, note);
    return note;
  }

  /**
   * Update a note's content.
   */
  updateNote(nodeId: string, noteId: string, content: string): void {
    const nodeIdParsed = NodeIdSchema.safeParse(nodeId);
    if (!nodeIdParsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(nodeIdParsed.error)}`);
    }
    const noteIdParsed = NoteIdSchema.safeParse(noteId);
    if (!noteIdParsed.success) {
      throw new Error(`Invalid noteId: ${formatValidationError(noteIdParsed.error)}`);
    }
    this.graph = updateNoteContent(this.graph, nodeId, noteId, content);
  }

  /**
   * Accept or dismiss an AI suggestion (changes the note's status).
   *
   * @param nodeId - The node containing the suggestion note
   * @param noteId - The suggestion note to resolve
   * @param action - Whether to accept or dismiss the suggestion
   * @throws Error if any parameter fails validation
   */
  resolveSuggestion(nodeId: string, noteId: string, action: 'accepted' | 'dismissed'): void {
    const nodeIdParsed = NodeIdSchema.safeParse(nodeId);
    if (!nodeIdParsed.success) {
      throw new Error(`Invalid nodeId: ${formatValidationError(nodeIdParsed.error)}`);
    }
    const noteIdParsed = NoteIdSchema.safeParse(noteId);
    if (!noteIdParsed.success) {
      throw new Error(`Invalid noteId: ${formatValidationError(noteIdParsed.error)}`);
    }
    const actionParsed = ResolveSuggestionActionSchema.safeParse(action);
    if (!actionParsed.success) {
      throw new Error(`Invalid action: ${formatValidationError(actionParsed.error)}`);
    }
    this.graph = updateNoteStatus(this.graph, nodeId, noteId, action);
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private toNodeSummary(node: ArchNode): NodeSummary {
    const connectionCount = this.graph.edges.filter(
      (e) => e.fromNode === node.id || e.toNode === node.id,
    ).length;

    return {
      id: node.id,
      type: node.type,
      displayName: node.displayName,
      childCount: node.children.length,
      noteCount: node.notes.length,
      connectionCount,
    };
  }

  private toEdgeSummary(edge: ArchEdge): EdgeSummary {
    return {
      id: edge.id,
      fromNode: edge.fromNode,
      toNode: edge.toNode,
      type: edge.type,
      label: edge.label,
      noteCount: edge.notes.length,
    };
  }

  private buildStructuredDescription() {
    return {
      name: this.graph.name,
      description: this.graph.description,
      owners: this.graph.owners,
      nodeCount: countAllNodes(this.graph),
      edgeCount: this.graph.edges.length,
      nodes: this.listNodes(),
      edges: this.getEdges(),
    };
  }

  private buildHumanDescription(): string {
    const lines: string[] = [];
    lines.push(`# ${this.graph.name}`);
    if (this.graph.description) {
      lines.push(`\n${this.graph.description}`);
    }
    lines.push(`\n## Summary`);
    lines.push(`- Nodes: ${countAllNodes(this.graph)}`);
    lines.push(`- Edges: ${this.graph.edges.length}`);
    lines.push(`- Owners: ${this.graph.owners.join(', ') || 'none'}`);

    const allNodes = flattenNodes(this.graph.nodes);
    const nodeIdToName = new Map<string, string>();
    for (const node of allNodes) {
      nodeIdToName.set(node.id, node.displayName);
    }

    if (allNodes.length > 0) {
      lines.push(`\n## Nodes`);
      for (const node of allNodes) {
        const emoji = getNodeTypeEmoji(node.type);
        lines.push(
          `- ${emoji} **${node.displayName}** (${node.type}) — ${node.notes.length} notes, ${node.children.length} children`,
        );
      }
    }

    if (this.graph.edges.length > 0) {
      lines.push(`\n## Edges`);
      for (const edge of this.graph.edges) {
        const fromName = nodeIdToName.get(edge.fromNode) ?? edge.fromNode;
        const toName = nodeIdToName.get(edge.toNode) ?? edge.toNode;
        lines.push(
          `- ${fromName} → ${toName} [${edge.type}]${edge.label ? ` "${edge.label}"` : ''}`,
        );
      }
    }

    return lines.join('\n');
  }

  private buildAIDescription(): string {
    const lines: string[] = [];
    lines.push(`<architecture name="${this.graph.name}">`);
    lines.push(
      `  <summary nodes="${countAllNodes(this.graph)}" edges="${this.graph.edges.length}" />`,
    );

    for (const node of flattenNodes(this.graph.nodes)) {
      lines.push(`  <node id="${node.id}" type="${node.type}" name="${node.displayName}">`);
      if (Object.keys(node.args).length > 0) {
        lines.push(`    <args>${JSON.stringify(node.args)}</args>`);
      }
      if (Object.keys(node.properties).length > 0) {
        lines.push(`    <properties>${JSON.stringify(node.properties)}</properties>`);
      }
      if (node.codeRefs.length > 0) {
        lines.push(`    <coderefs>`);
        for (const ref of node.codeRefs) {
          lines.push(`      <ref path="${ref.path}" role="${ref.role}" />`);
        }
        lines.push(`    </coderefs>`);
      }
      if (node.notes.length > 0) {
        lines.push(`    <notes count="${node.notes.length}">`);
        for (const note of node.notes) {
          lines.push(
            `      <note author="${note.author}" status="${note.status}">${note.content}</note>`,
          );
        }
        lines.push(`    </notes>`);
      }
      lines.push(`  </node>`);
    }

    for (const edge of this.graph.edges) {
      lines.push(
        `  <edge from="${edge.fromNode}" to="${edge.toNode}" type="${edge.type}"${edge.label ? ` label="${edge.label}"` : ''} />`,
      );
    }

    lines.push(`</architecture>`);
    return lines.join('\n');
  }
}

// ============================================================
// Emoji badge mapping for human-readable output
// ============================================================

const NODE_TYPE_EMOJI_MAP: Record<string, string> = {
  // Compute namespace
  'compute/service': '⚙️',
  'compute/function': '⚡',
  'compute/worker': '👷',
  'compute/api-gateway': '🚪',
  // Data namespace
  'data/database': '🗄️',
  'data/cache': '📦',
  'data/object-storage': '📁',
  'data/repository': '📚',
  // Messaging namespace
  'messaging/message-queue': '📨',
  'messaging/event-bus': '🚌',
  'messaging/stream-processor': '🌊',
  // Network namespace
  'network/load-balancer': '⚖️',
  'network/cdn': '🌐',
  'network/dns': '🔍',
  // Observability namespace
  'observability/logging': '📋',
  'observability/monitoring': '📊',
};

const NAMESPACE_EMOJI_FALLBACK: Record<string, string> = {
  compute: '⚙️',
  data: '🗄️',
  messaging: '📨',
  network: '🌐',
  observability: '📊',
};

/**
 * Get an emoji badge for a node type.
 * Falls back to namespace emoji, then a generic icon.
 */
export function getNodeTypeEmoji(type: string): string {
  // Exact match
  if (NODE_TYPE_EMOJI_MAP[type]) {
    return NODE_TYPE_EMOJI_MAP[type];
  }

  // Namespace fallback
  const namespace = type.split('/')[0] ?? '';
  const nsEmoji = NAMESPACE_EMOJI_FALLBACK[namespace];
  if (nsEmoji) {
    return nsEmoji;
  }

  // Generic fallback
  return '📦';
}
