/**
 * Feature #182: MCP update_node tool modifies node.
 * Verifies that the MCP update_node tool updates node properties via Text API,
 * returns a success response, and the changes appear in the describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleUpdateNode, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP update_node tool - Feature #182', () => {
  let ctx: ToolHandlerContext;
  let createdNodeId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP update_node',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Step 1: Create a node via MCP
    const addResult = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Original Name',
    });
    const addParsed = JSON.parse(addResult);
    createdNodeId = addParsed.nodeId;
  });

  // Step 2: Call MCP update_node to change displayName
  it('updates displayName via dispatchToolCall', () => {
    const result = dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'Updated Name',
    });
    const parsed = JSON.parse(result);

    // Step 3: Verify success response
    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBe(createdNodeId);
  });

  // Step 4: Call describe and verify name changed
  it('displayName change reflected in describe output', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'Updated Name',
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodes).toHaveLength(1);
    expect(descParsed.nodes[0].displayName).toBe('Updated Name');
    expect(descParsed.nodes[0].id).toBe(createdNodeId);
  });

  // Additional: update via direct handler call
  it('handleUpdateNode returns success with nodeId', () => {
    const result = handleUpdateNode(ctx, {
      nodeId: createdNodeId,
      displayName: 'Handler Updated',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBe(createdNodeId);
  });

  // Update args
  it('updates node args via MCP', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      args: { engine: 'PostgreSQL', version: 16 },
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(descResult).toContain('PostgreSQL');
  });

  // Update properties
  it('updates node properties via MCP', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      properties: { env: 'production', region: 'us-east-1' },
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(descResult).toContain('production');
    expect(descResult).toContain('us-east-1');
  });

  // Update multiple fields at once
  it('updates displayName, args, and properties simultaneously', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'Multi-Update Service',
      args: { framework: 'Express' },
      properties: { tier: 'backend' },
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodes[0].displayName).toBe('Multi-Update Service');
  });

  // Updated name in human format
  it('updated name appears in human-readable describe', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'Human Readable Update',
    });

    const humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).toContain('Human Readable Update');
    expect(humanResult).not.toContain('Original Name');
  });

  // Updated name in AI format
  it('updated name appears in AI describe format', () => {
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'AI Format Update',
    });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).toContain('AI Format Update');
    expect(aiResult).not.toContain('Original Name');
  });

  // Other nodes remain unchanged after update
  it('does not affect other nodes when updating one', () => {
    // Create a second node
    const addResult2 = dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Unchanged DB',
    });
    const addParsed2 = JSON.parse(addResult2);

    // Update the first node only
    dispatchToolCall(ctx, 'update_node', {
      nodeId: createdNodeId,
      displayName: 'Changed Service',
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodes).toHaveLength(2);
    const names = descParsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('Changed Service');
    expect(names).toContain('Unchanged DB');
  });
});
