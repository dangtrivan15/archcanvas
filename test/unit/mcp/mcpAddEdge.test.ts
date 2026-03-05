/**
 * Feature #180: MCP add_edge tool creates edge.
 * Verifies that the MCP add_edge tool creates an edge between two nodes,
 * returns a success response with edgeId,
 * and the edge appears in the describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleAddEdge, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP add_edge tool - Feature #180', () => {
  let ctx: ToolHandlerContext;
  let nodeAId: string;
  let nodeBId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP add_edge',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Step 1: Create 2 nodes via MCP
    const nodeA = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Service A',
      }),
    );
    const nodeB = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'data/database',
        displayName: 'Database B',
      }),
    );
    nodeAId = nodeA.nodeId;
    nodeBId = nodeB.nodeId;
  });

  // Step 2: Call MCP add_edge with fromNode and toNode
  it('creates an edge between two nodes', () => {
    const result = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'sync',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.edgeId).toBeDefined();
    expect(typeof parsed.edgeId).toBe('string');
    expect(parsed.edgeId.length).toBeGreaterThan(0);
  });

  // Step 3: Verify success response
  it('returns success true with valid edgeId', () => {
    const result = handleAddEdge(ctx, {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'async',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.edgeId).toBeTruthy();
  });

  // Step 4: Call describe and verify edge appears
  it('edge appears in describe output after creation', () => {
    // Create an edge
    const addResult = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'sync',
    });
    const addParsed = JSON.parse(addResult);
    expect(addParsed.success).toBe(true);

    // Call describe and verify edge appears
    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.edgeCount).toBe(1);
    expect(descParsed.edges).toHaveLength(1);
    expect(descParsed.edges[0].fromNode).toBe(nodeAId);
    expect(descParsed.edges[0].toNode).toBe(nodeBId);
    expect(descParsed.edges[0].type).toBe('sync');
    expect(descParsed.edges[0].id).toBe(addParsed.edgeId);
  });

  // Additional: Create edge with different types
  it('creates sync edge', () => {
    const result = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'sync',
      }),
    );
    expect(result.success).toBe(true);

    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edges[0].type).toBe('sync');
  });

  it('creates async edge', () => {
    const result = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'async',
      }),
    );
    expect(result.success).toBe(true);

    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edges[0].type).toBe('async');
  });

  it('creates data-flow edge', () => {
    const result = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'data-flow',
      }),
    );
    expect(result.success).toBe(true);

    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edges[0].type).toBe('data-flow');
  });

  // Additional: Create edge with label
  it('creates an edge with a label', () => {
    const result = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'sync',
        label: 'HTTP REST',
      }),
    );
    expect(result.success).toBe(true);

    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edges[0].label).toBe('HTTP REST');
  });

  // Verify edge ID uniqueness
  it('generates unique edge IDs', () => {
    const result1 = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeAId,
        toNode: nodeBId,
        type: 'sync',
      }),
    );
    const result2 = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeBId,
        toNode: nodeAId,
        type: 'async',
      }),
    );

    expect(result1.edgeId).not.toBe(result2.edgeId);
  });

  // Verify edge in human-readable format
  it('edge appears in human-readable describe output', () => {
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'sync',
    });

    const humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).toContain('Service A');
    expect(humanResult).toContain('Database B');
    expect(humanResult).toContain('sync');
  });

  // Verify edge in AI format
  it('edge appears in AI describe format', () => {
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'data-flow',
    });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).toContain(nodeAId);
    expect(aiResult).toContain(nodeBId);
    expect(aiResult).toContain('data-flow');
  });

  // Verify dispatch route
  it('dispatchToolCall correctly routes to add_edge handler', () => {
    const result = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'sync',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.edgeId).toBeTruthy();
  });

  // Verify multiple edges
  it('creates multiple edges that all appear in describe', () => {
    // Create a third node
    const nodeC = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'messaging/message-queue',
        displayName: 'Message Queue',
      }),
    );

    dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeBId,
      type: 'sync',
    });
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeAId,
      toNode: nodeC.nodeId,
      type: 'async',
    });
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeC.nodeId,
      toNode: nodeBId,
      type: 'data-flow',
    });

    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edgeCount).toBe(3);
    expect(desc.edges).toHaveLength(3);
  });
});
