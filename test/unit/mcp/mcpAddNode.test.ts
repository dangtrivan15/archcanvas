/**
 * Feature #179: MCP add_node tool creates node.
 * Verifies that the MCP add_node tool creates a new node via Text API,
 * returns a success response with nodeId and displayName,
 * and the node appears in the describe output.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleAddNode, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP add_node tool - Feature #179', () => {
  let ctx: ToolHandlerContext;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing MCP add_node',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };
  });

  // Step 1: Call MCP add_node with type and displayName
  it('creates a node with type and displayName', () => {
    const result = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'API Gateway',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBeDefined();
    expect(typeof parsed.nodeId).toBe('string');
    expect(parsed.nodeId.length).toBeGreaterThan(0);
    expect(parsed.displayName).toBe('API Gateway');
  });

  // Step 2: Verify success response
  it('returns success true with valid nodeId', () => {
    const result = handleAddNode(ctx, {
      type: 'data/database',
      displayName: 'Users DB',
    });
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(true);
    expect(parsed.nodeId).toBeTruthy();
    expect(parsed.displayName).toBe('Users DB');
  });

  // Step 3: Call describe and verify new node appears
  it('node appears in describe output after creation', () => {
    // Create a node
    const addResult = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Order Service',
    });
    const addParsed = JSON.parse(addResult);
    expect(addParsed.success).toBe(true);

    // Call describe and verify node appears
    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(1);
    expect(descParsed.nodes).toHaveLength(1);
    expect(descParsed.nodes[0].displayName).toBe('Order Service');
    expect(descParsed.nodes[0].type).toBe('compute/service');
    expect(descParsed.nodes[0].id).toBe(addParsed.nodeId);
  });

  // Additional: Create multiple nodes
  it('creates multiple nodes that all appear in describe', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Service A',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Database B',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'messaging/message-queue',
      displayName: 'Queue C',
    });

    const descResult = dispatchToolCall(ctx, 'describe', { format: 'structured' });
    const descParsed = JSON.parse(descResult);

    expect(descParsed.nodeCount).toBe(3);
    expect(descParsed.nodes).toHaveLength(3);

    const names = descParsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('Service A');
    expect(names).toContain('Database B');
    expect(names).toContain('Queue C');
  });

  // Additional: Node with optional position
  it('creates a node with position args', () => {
    const result = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Positioned Service',
      x: 100,
      y: 200,
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.displayName).toBe('Positioned Service');
  });

  // Additional: Node with custom args
  it('creates a node with custom args', () => {
    const result = dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Postgres DB',
      args: { engine: 'PostgreSQL', version: 16 },
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.displayName).toBe('Postgres DB');
  });

  // Verify node ID uniqueness
  it('generates unique node IDs', () => {
    const result1 = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Service 1',
    }));
    const result2 = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Service 2',
    }));

    expect(result1.nodeId).not.toBe(result2.nodeId);
  });

  // Verify dispatch route
  it('dispatchToolCall correctly routes to add_node handler', () => {
    const result = dispatchToolCall(ctx, 'add_node', {
      type: 'compute/function',
      displayName: 'Lambda Handler',
    });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.displayName).toBe('Lambda Handler');
  });

  // Verify node appears in human format too
  it('node appears in human-readable describe output', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Auth Service',
    });

    const humanResult = dispatchToolCall(ctx, 'describe', { format: 'human' });
    expect(humanResult).toContain('Auth Service');
    expect(humanResult).toContain('compute/service');
  });

  // Verify node appears in AI format too
  it('node appears in AI describe format', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/cache',
      displayName: 'Redis Cache',
    });

    const aiResult = dispatchToolCall(ctx, 'describe', { format: 'ai' });
    expect(aiResult).toContain('Redis Cache');
    expect(aiResult).toContain('data/cache');
  });
});
