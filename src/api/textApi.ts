/**
 * Text API - the primary interface for reading and mutating architecture data.
 * Used by both the UI and external AI agents (via MCP).
 *
 * Provides: describe, listNodes, getNode, getEdges, getNodeDef, search,
 * addNode, addEdge, addNote, updateNode, removeNode, removeEdge,
 * suggest, resolveSuggestion, getAIContext
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
  UpdateNodeParams,
  SuggestParams,
} from '@/types/api';
import type { AIContext } from '@/types/ai';
import type { RegistryManager } from '@/core/registry/registryManager';
import {
  createNode,
  createEdge,
  createNote,
  findNode,
  findEdge,
  addNode as engineAddNode,
  addEdge as engineAddEdge,
  addChildNode,
  removeNode as engineRemoveNode,
  removeEdge as engineRemoveEdge,
  updateNode as engineUpdateNode,
  addNoteToNode,
  addNoteToEdge,
  updateNoteStatus,
} from '@/core/graph/graphEngine';
import {
  searchGraph,
  getNeighbors,
  flattenNodes,
  countAllNodes,
} from '@/core/graph/graphQuery';

export class TextApi {
  private graph: ArchGraph;
  private readonly registry: RegistryManager;

  constructor(graph: ArchGraph, registry: RegistryManager) {
    this.graph = graph;
    this.registry = registry;
    console.log('[TextApi] Initialized');
  }

  /**
   * Get/set the current graph state.
   */
  getGraph(): ArchGraph {
    return this.graph;
  }

  setGraph(graph: ArchGraph): void {
    this.graph = graph;
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Describe the architecture in the requested format.
   */
  describe(options: DescribeOptions): string {
    const { format } = options;

    switch (format) {
      case 'structured':
        return JSON.stringify(this.buildStructuredDescription(options), null, 2);
      case 'human':
        return this.buildHumanDescription(options);
      case 'ai':
        return this.buildAIDescription(options);
      default:
        return JSON.stringify(this.buildStructuredDescription(options), null, 2);
    }
  }

  /**
   * List all nodes as summaries.
   */
  listNodes(): NodeSummary[] {
    const allNodes = flattenNodes(this.graph.nodes);
    return allNodes.map((node) => this.toNodeSummary(node));
  }

  /**
   * Get detailed information about a specific node.
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
   */
  getNodeDef(type: string) {
    return this.registry.resolve(type);
  }

  /**
   * Full-text search across the architecture.
   */
  search(query: string): SearchResult[] {
    return searchGraph(this.graph, query);
  }

  /**
   * Get AI context for the selected node (with neighbors).
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
   */
  addNode(params: AddNodeParams): ArchNode {
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
   * Add a new edge to the architecture.
   */
  addEdge(params: AddEdgeParams): ArchEdge {
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
   * Add a note to a node or edge.
   */
  addNote(params: AddNoteParams): Note {
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
   * Update a node's properties.
   */
  updateNode(nodeId: string, params: UpdateNodeParams): void {
    this.graph = engineUpdateNode(this.graph, nodeId, params);
  }

  /**
   * Remove a node and its connected edges.
   */
  removeNode(nodeId: string): void {
    this.graph = engineRemoveNode(this.graph, nodeId);
  }

  /**
   * Remove an edge.
   */
  removeEdge(edgeId: string): void {
    this.graph = engineRemoveEdge(this.graph, edgeId);
  }

  /**
   * Create an AI suggestion as a pending note.
   */
  suggest(params: SuggestParams): Note {
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
   * Accept or dismiss an AI suggestion.
   */
  resolveSuggestion(
    nodeId: string,
    noteId: string,
    action: 'accepted' | 'dismissed',
  ): void {
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

  private buildStructuredDescription(_options: DescribeOptions) {
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

  private buildHumanDescription(_options: DescribeOptions): string {
    const lines: string[] = [];
    lines.push(`# ${this.graph.name}`);
    if (this.graph.description) {
      lines.push(`\n${this.graph.description}`);
    }
    lines.push(`\n## Summary`);
    lines.push(`- Nodes: ${countAllNodes(this.graph)}`);
    lines.push(`- Edges: ${this.graph.edges.length}`);
    lines.push(`- Owners: ${this.graph.owners.join(', ') || 'none'}`);

    if (this.graph.nodes.length > 0) {
      lines.push(`\n## Nodes`);
      for (const node of flattenNodes(this.graph.nodes)) {
        lines.push(
          `- **${node.displayName}** (${node.type}) — ${node.notes.length} notes, ${node.children.length} children`,
        );
      }
    }

    if (this.graph.edges.length > 0) {
      lines.push(`\n## Edges`);
      for (const edge of this.graph.edges) {
        lines.push(
          `- ${edge.fromNode} → ${edge.toNode} [${edge.type}]${edge.label ? ` "${edge.label}"` : ''}`,
        );
      }
    }

    return lines.join('\n');
  }

  private buildAIDescription(_options: DescribeOptions): string {
    const lines: string[] = [];
    lines.push(`<architecture name="${this.graph.name}">`);
    lines.push(`  <summary nodes="${countAllNodes(this.graph)}" edges="${this.graph.edges.length}" />`);

    for (const node of flattenNodes(this.graph.nodes)) {
      lines.push(`  <node id="${node.id}" type="${node.type}" name="${node.displayName}">`);
      if (Object.keys(node.args).length > 0) {
        lines.push(`    <args>${JSON.stringify(node.args)}</args>`);
      }
      if (node.notes.length > 0) {
        lines.push(`    <notes count="${node.notes.length}" />`);
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
