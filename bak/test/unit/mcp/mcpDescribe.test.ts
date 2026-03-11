/**
 * Feature #178: MCP describe tool returns architecture description.
 * Verifies that the MCP describe tool delegates to Text API and returns
 * architecture info including name, node list, and edge list.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleDescribe, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: generateId(),
    type: overrides.type,
    displayName: overrides.displayName,
    args: overrides.args ?? {},
    codeRefs: overrides.codeRefs ?? [],
    notes: overrides.notes ?? [],
    properties: overrides.properties ?? {},
    position: overrides.position ?? { x: 0, y: 0, width: 200, height: 100 },
    children: overrides.children ?? [],
    refSource: overrides.refSource,
  };
}

function makeEdge(overrides: Partial<ArchEdge> & { fromNode: string; toNode: string }): ArchEdge {
  return {
    id: generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

describe('MCP describe tool - Feature #178', () => {
  let ctx: ToolHandlerContext;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let edge1: ArchEdge;
  let edge2: ArchEdge;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    node1 = makeNode({ type: 'compute/service', displayName: 'Order Service' });
    node2 = makeNode({ type: 'data/database', displayName: 'Products DB' });
    node3 = makeNode({ type: 'compute/api-gateway', displayName: 'API Gateway' });

    edge1 = makeEdge({ fromNode: node3.id, toNode: node1.id, type: 'sync', label: 'REST API' });
    edge2 = makeEdge({ fromNode: node1.id, toNode: node2.id, type: 'data-flow', label: 'Queries' });

    const graph: ArchGraph = {
      name: 'E-Commerce System',
      description: 'A sample e-commerce architecture',
      owners: ['team-alpha'],
      nodes: [node1, node2, node3],
      edges: [edge1, edge2],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };
  });

  // Step 1: Call MCP describe tool
  it('dispatchToolCall routes to describe handler and returns valid JSON', () => {
    const result = dispatchToolCall(ctx, 'describe', {});
    expect(result).toBeTruthy();
    // Default format is structured (JSON)
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
  });

  it('handleDescribe returns valid structured JSON by default', () => {
    const result = handleDescribe(ctx, {});
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
    expect(typeof result).toBe('string');
  });

  // Step 2: Verify response contains architecture name
  it('response contains architecture name', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('E-Commerce System');
  });

  it('response contains architecture description', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.description).toBe('A sample e-commerce architecture');
  });

  it('response contains owners', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.owners).toContain('team-alpha');
  });

  // Step 3: Verify response contains node list
  it('response contains node list with correct count', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.nodeCount).toBe(3);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes).toHaveLength(3);
  });

  it('node list contains all node display names', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    const names = parsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('Order Service');
    expect(names).toContain('Products DB');
    expect(names).toContain('API Gateway');
  });

  it('each node in list has required fields', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    for (const node of parsed.nodes) {
      expect(node.id).toBeTruthy();
      expect(node.type).toBeTruthy();
      expect(node.displayName).toBeTruthy();
      expect(typeof node.childCount).toBe('number');
      expect(typeof node.noteCount).toBe('number');
      expect(typeof node.connectionCount).toBe('number');
    }
  });

  // Step 4: Verify response contains edge list
  it('response contains edge list with correct count', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.edgeCount).toBe(2);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.edges).toHaveLength(2);
  });

  it('each edge in list has required fields', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    for (const edge of parsed.edges) {
      expect(edge.id).toBeTruthy();
      expect(edge.fromNode).toBeTruthy();
      expect(edge.toNode).toBeTruthy();
      expect(edge.type).toBeTruthy();
      expect(typeof edge.noteCount).toBe('number');
    }
  });

  it('edge list contains correct edge types and labels', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    const syncEdge = parsed.edges.find((e: { type: string }) => e.type === 'sync');
    expect(syncEdge).toBeDefined();
    expect(syncEdge.label).toBe('REST API');

    const dfEdge = parsed.edges.find((e: { type: string }) => e.type === 'data-flow');
    expect(dfEdge).toBeDefined();
    expect(dfEdge.label).toBe('Queries');
  });

  // Additional: human format also works through MCP dispatch
  it('human format returns architecture name and counts', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(result).toContain('E-Commerce System');
    expect(result).toContain('Nodes: 3');
    expect(result).toContain('Edges: 2');
  });

  it('human format lists node names', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(result).toContain('Order Service');
    expect(result).toContain('Products DB');
    expect(result).toContain('API Gateway');
  });

  // Additional: AI format works through MCP dispatch
  it('AI format returns architecture info in XML structure', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(result).toContain('name="E-Commerce System"');
    expect(result).toContain('nodes="3"');
    expect(result).toContain('edges="2"');
  });

  it('AI format includes node and edge details', () => {
    const result = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(result).toContain('Order Service');
    expect(result).toContain('Products DB');
    expect(result).toContain('API Gateway');
    expect(result).toContain('compute/service');
    expect(result).toContain('data/database');
  });

  // Additional: empty architecture returns zero counts
  it('returns zero counts for empty architecture', () => {
    const registry = new RegistryManager();
    registry.initialize();
    const emptyGraph: ArchGraph = {
      name: 'Empty System',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const emptyCtx: ToolHandlerContext = {
      textApi: new TextApi(emptyGraph, registry),
      registry,
    };

    const result = dispatchToolCall(emptyCtx, 'describe', { format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Empty System');
    expect(parsed.nodeCount).toBe(0);
    expect(parsed.edgeCount).toBe(0);
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.edges).toHaveLength(0);
  });

  // Verify default format is structured when not specified
  it('defaults to structured format when no format specified', () => {
    const result = dispatchToolCall(ctx, 'describe', {});
    // Should be valid JSON (structured format)
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('E-Commerce System');
    expect(parsed.nodeCount).toBe(3);
    expect(parsed.edgeCount).toBe(2);
  });
});
