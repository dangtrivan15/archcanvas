/**
 * Feature #183: MCP remove_node tool deletes node.
 * Verifies that the MCP remove_node tool removes a node from the architecture,
 * returns a success response, and the node no longer appears in describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleRemoveNode, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP remove_node tool - Feature #183', () => {
  let ctx: ToolHandlerContext;
  let nodeId1: string;
  let nodeId2: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP remove_node',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Step 1: Create 2 nodes via MCP
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
  });

  // Step 2: Call MCP remove_node on first node
  // Step 3: Verify success response
  it('removes a node and returns success', () => {
    const result = dispatchToolCall(ctx, 'remove_node', {
      nodeId: nodeId1,
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBe(nodeId1);
  });

  // Step 4: Call describe and verify only 1 node remains
  it('removed node no longer appears in describe output', () => {
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(1);
    expect(descParsed.nodes).toHaveLength(1);
    expect(descParsed.nodes[0].displayName).toBe('Database B');
    expect(descParsed.nodes[0].id).toBe(nodeId2);
  });

  // Additional: direct handler call
  it('handleRemoveNode returns success with nodeId', () => {
    const result = handleRemoveNode(ctx, { nodeId: nodeId2 });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBe(nodeId2);
  });

  // Remove all nodes
  it('can remove all nodes leaving empty architecture', () => {
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId2 });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(0);
    expect(descParsed.nodes).toHaveLength(0);
  });

  // Removed node name not in human format
  it('removed node not in human-readable describe', () => {
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });

    const humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).not.toContain('Service A');
    expect(humanResult).toContain('Database B');
  });

  // Removed node not in AI format
  it('removed node not in AI describe format', () => {
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).not.toContain('Service A');
    expect(aiResult).toContain('Database B');
  });

  // Remove node also removes connected edges
  it('removes connected edges when node is removed', () => {
    // Create an edge between the two nodes
    const edgeResult = dispatchToolCall(ctx, 'add_edge', {
      fromNode: nodeId1,
      toNode: nodeId2,
      type: 'sync',
      label: 'reads from',
    });
    const edgeParsed = JSON.parse(edgeResult);
    expect(edgeParsed.success).toBe(true);

    // Verify edge exists
    let descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    let descParsed = JSON.parse(descResult);
    expect(descParsed.edgeCount).toBe(1);

    // Remove node1 - edge should also be removed
    dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });

    descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(1);
    expect(descParsed.edgeCount).toBe(0);
    expect(descParsed.edges).toHaveLength(0);
  });

  // Dispatch routes correctly
  it('dispatchToolCall correctly routes to remove_node', () => {
    const result = dispatchToolCall(ctx, 'remove_node', { nodeId: nodeId1 });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });
});
