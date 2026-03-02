/**
 * Feature #191: Adding edge between non-existent nodes fails gracefully.
 *
 * Verifies that attempting to create an edge referencing invalid node IDs
 * produces clear errors mentioning the invalid node ID, and the architecture
 * state remains unchanged.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleAddEdge, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('Feature #191: Adding edge between non-existent nodes fails gracefully', () => {
  let ctx: ToolHandlerContext;
  let validNodeId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing invalid edge creation',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Create one valid node
    const nodeResult = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Valid Service',
    }));
    validNodeId = nodeResult.nodeId;
  });

  it('returns error when fromNode ID does not exist', () => {
    const result = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: 'nonexistent-node-id',
      toNode: validNodeId,
      type: 'sync',
    }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('nonexistent-node-id');
  });

  it('returns error when toNode ID does not exist', () => {
    const result = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: validNodeId,
      toNode: 'another-fake-id',
      type: 'async',
    }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('another-fake-id');
  });

  it('returns error when both fromNode and toNode do not exist', () => {
    const result = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: 'fake-from-node',
      toNode: 'fake-to-node',
      type: 'data-flow',
    }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Should mention the first invalid ID (fromNode is checked first)
    expect(result.error).toContain('fake-from-node');
  });

  it('error message mentions "does not exist" for invalid node ID', () => {
    const result = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: 'missing-node-xyz',
      toNode: validNodeId,
      type: 'sync',
    }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not exist/i);
  });

  it('architecture state is unchanged after failed edge creation', () => {
    // Get initial state
    const describeBefore = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    const edgeCountBefore = describeBefore.edgeCount;
    const nodeCountBefore = describeBefore.nodeCount;

    // Attempt to add edge with invalid node
    const result = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: 'nonexistent-id',
      toNode: validNodeId,
      type: 'sync',
    }));
    expect(result.success).toBe(false);

    // Verify state is unchanged
    const describeAfter = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(describeAfter.edgeCount).toBe(edgeCountBefore);
    expect(describeAfter.nodeCount).toBe(nodeCountBefore);
  });

  it('textApi.addEdge() throws Error for non-existent fromNode', () => {
    expect(() => {
      ctx.textApi.addEdge({
        fromNode: 'bad-from-node',
        toNode: validNodeId,
        type: 'sync',
      });
    }).toThrow(/does not exist/i);
  });

  it('textApi.addEdge() throws Error for non-existent toNode', () => {
    expect(() => {
      ctx.textApi.addEdge({
        fromNode: validNodeId,
        toNode: 'bad-to-node',
        type: 'sync',
      });
    }).toThrow(/does not exist/i);
  });

  it('textApi.addEdge() error mentions the specific invalid node ID', () => {
    try {
      ctx.textApi.addEdge({
        fromNode: 'specific-invalid-id-12345',
        toNode: validNodeId,
        type: 'sync',
      });
      // Should not reach here
      expect.unreachable('Expected addEdge to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('specific-invalid-id-12345');
    }
  });

  it('valid edge creation still works after failed attempt', () => {
    // First, fail
    const failResult = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: 'nonexistent',
      toNode: validNodeId,
      type: 'sync',
    }));
    expect(failResult.success).toBe(false);

    // Create a second valid node
    const nodeB = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Database B',
    }));

    // Now create a valid edge — should succeed
    const successResult = JSON.parse(dispatchToolCall(ctx, 'add_edge', {
      fromNode: validNodeId,
      toNode: nodeB.nodeId,
      type: 'sync',
    }));
    expect(successResult.success).toBe(true);
    expect(successResult.edgeId).toBeDefined();

    // Verify edge exists in architecture
    const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(desc.edgeCount).toBe(1);
  });

  it('handleAddEdge returns error JSON instead of throwing', () => {
    const resultStr = handleAddEdge(ctx, {
      fromNode: 'non-existent-node-via-handler',
      toNode: validNodeId,
      type: 'sync',
    });

    const result = JSON.parse(resultStr);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('non-existent-node-via-handler');
  });
});
