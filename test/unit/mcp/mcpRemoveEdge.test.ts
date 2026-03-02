/**
 * Feature #184: MCP remove_edge tool deletes edge.
 * Verifies that the MCP remove_edge tool removes an edge from the architecture,
 * returns a success response, and the edge no longer appears in describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleRemoveEdge, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP remove_edge tool - Feature #184', () => {
  let ctx: ToolHandlerContext;
  let nodeId1: string;
  let nodeId2: string;
  let edgeId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP remove_edge',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Step 1: Create 2 nodes and 1 edge via MCP
    const addResult1 = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Service A',
    });
    nodeId1 = JSON.parse(addResult1).nodeId;

    const addResult2 = dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Database B',
    });
    nodeId2 = JSON.parse(addResult2).nodeId;

    const edgeResult = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeId1,
      toNode: nodeId2,
      type: 'sync',
      label: 'queries',
    });
    edgeId = JSON.parse(edgeResult).edgeId;
  });

  // Step 2: Call MCP remove_edge
  // Step 3: Verify success response
  it('removes an edge and returns success', () => {
    const result = dispatchToolCall(ctx, 'remove_edge', {
      edgeId: edgeId,
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.edgeId).toBe(edgeId);
  });

  // Step 4: Call describe and verify no edges remain
  it('removed edge no longer appears in describe output', () => {
    dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.edgeCount).toBe(0);
    expect(descParsed.edges).toHaveLength(0);
    // Nodes still exist
    expect(descParsed.nodeCount).toBe(2);
    expect(descParsed.nodes).toHaveLength(2);
  });

  // Additional: direct handler call
  it('handleRemoveEdge returns success with edgeId', () => {
    const result = handleRemoveEdge(ctx, { edgeId: edgeId });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.edgeId).toBe(edgeId);
  });

  // Removed edge not in human format
  it('removed edge not in human-readable describe', () => {
    // Before removal - verify edge label present
    let humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).toContain('queries');

    // After removal
    dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });

    humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).not.toContain('queries');
  });

  // Removed edge not in AI format
  it('removed edge not in AI describe format', () => {
    dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).not.toContain(`from="${nodeId1}"`);
    expect(aiResult).not.toContain(`to="${nodeId2}"`);
  });

  // Nodes remain after edge removal
  it('does not affect nodes when removing edge', () => {
    dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    const names = descParsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('Service A');
    expect(names).toContain('Database B');
  });

  // Remove one edge, keep others
  it('only removes the targeted edge, others remain', () => {
    // Add a second edge
    const edge2Result = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeId2,
      toNode: nodeId1,
      type: 'async',
      label: 'notifies',
    });
    const edge2Id = JSON.parse(edge2Result).edgeId;

    // Verify 2 edges exist
    let descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    let descParsed = JSON.parse(descResult);
    expect(descParsed.edgeCount).toBe(2);

    // Remove only the first edge
    dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });

    descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    descParsed = JSON.parse(descResult);

    expect(descParsed.edgeCount).toBe(1);
    expect(descParsed.edges).toHaveLength(1);
    expect(descParsed.edges[0].id).toBe(edge2Id);
    expect(descParsed.edges[0].label).toBe('notifies');
  });

  // Dispatch routes correctly
  it('dispatchToolCall correctly routes to remove_edge', () => {
    const result = dispatchToolCall(ctx, 'remove_edge', { edgeId: edgeId });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });
});
