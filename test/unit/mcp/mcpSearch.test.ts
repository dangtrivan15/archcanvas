/**
 * Feature #185: MCP search tool finds matching items.
 * Verifies that the MCP search tool performs full-text search across
 * the architecture, returning matching nodes/edges/notes and empty
 * results for non-matching queries.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchToolCall, handleSearch, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP search tool - Feature #185', () => {
  let ctx: ToolHandlerContext;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Search Test Architecture',
      description: 'Testing MCP search tool',
      owners: [],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };
  });

  // Step 1 + 2: Create nodes with distinct names, search for one
  it('finds a matching node by display name', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Payment Gateway',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'User Database',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'messaging/message-queue',
      displayName: 'Order Queue',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'Payment' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    const nodeResult = parsed.results.find(
      (r: { type: string; displayName: string }) =>
        r.type === 'node' && r.displayName === 'Payment Gateway',
    );
    expect(nodeResult).toBeDefined();
    expect(nodeResult.matchContext).toContain('Payment Gateway');
  });

  // Step 3: Verify matching node has correct structure
  it('returns search results with correct structure', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Auth Service',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'Auth' });
    const parsed = JSON.parse(result);

    expect(parsed.results).toBeInstanceOf(Array);
    expect(parsed.count).toBe(parsed.results.length);

    const match = parsed.results[0];
    expect(match).toHaveProperty('type');
    expect(match).toHaveProperty('id');
    expect(match).toHaveProperty('displayName');
    expect(match).toHaveProperty('matchContext');
    expect(match).toHaveProperty('score');
    expect(match.type).toBe('node');
    expect(match.score).toBeGreaterThan(0);
  });

  // Step 4 + 5: Non-matching query returns empty results
  it('returns empty results for non-matching query', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Payment Gateway',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'User Database',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'Nonexistent XYZ' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(0);
    expect(parsed.results).toEqual([]);
  });

  // Additional: Search matches node type
  it('finds node matching by type', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Orders DB',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'database' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    const nodeResult = parsed.results.find(
      (r: { type: string; displayName: string }) =>
        r.type === 'node' && r.displayName === 'Orders DB',
    );
    expect(nodeResult).toBeDefined();
  });

  // Additional: Search is case-insensitive
  it('search is case-insensitive', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'API Gateway',
    });

    // Search lowercase
    const lowerResult = JSON.parse(dispatchToolCall(ctx, 'search', { query: 'api gateway' }));
    expect(lowerResult.count).toBeGreaterThanOrEqual(1);

    // Search uppercase
    const upperResult = JSON.parse(dispatchToolCall(ctx, 'search', { query: 'API GATEWAY' }));
    expect(upperResult.count).toBeGreaterThanOrEqual(1);

    // Search mixed case
    const mixedResult = JSON.parse(dispatchToolCall(ctx, 'search', { query: 'Api GateWay' }));
    expect(mixedResult.count).toBeGreaterThanOrEqual(1);
  });

  // Additional: Search across edge labels
  it('finds matching edge by label', () => {
    // Create two nodes first
    const node1 = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Service A',
    }));
    const node2 = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'Database B',
    }));

    // Create edge with a distinct label
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: node1.nodeId,
      toNode: node2.nodeId,
      type: 'sync',
      label: 'fetch orders',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'fetch orders' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    const edgeResult = parsed.results.find(
      (r: { type: string }) => r.type === 'edge',
    );
    expect(edgeResult).toBeDefined();
    expect(edgeResult.matchContext).toContain('fetch orders');
  });

  // Additional: Search across notes
  it('finds matching note content', () => {
    const node = JSON.parse(dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Billing Service',
    }));

    dispatchToolCall(ctx, 'add_note', {
      nodeId: node.nodeId,
      author: 'tester',
      content: 'This service handles Stripe webhook processing',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'Stripe webhook' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    const noteResult = parsed.results.find(
      (r: { type: string }) => r.type === 'note',
    );
    expect(noteResult).toBeDefined();
    expect(noteResult.displayName).toContain('Billing Service');
  });

  // Additional: Search returns results sorted by score
  it('returns results sorted by score (display name match scores higher)', () => {
    // "Gateway" matches display name (score 20) for first node
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Gateway Service',
    });
    // "gateway" matches in type (score 10) for second node
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/api-gateway',
      displayName: 'Load Balancer',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'gateway' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(2);
    // First result should have higher score (display name match)
    expect(parsed.results[0].score).toBeGreaterThanOrEqual(parsed.results[1].score);
    expect(parsed.results[0].displayName).toBe('Gateway Service');
  });

  // Additional: handleSearch direct call works
  it('handleSearch returns results directly', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Notification Service',
    });

    const result = handleSearch(ctx, { query: 'Notification' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.results[0].displayName).toBe('Notification Service');
  });

  // Additional: dispatchToolCall routes to search correctly
  it('dispatchToolCall correctly routes to search handler', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/cache',
      displayName: 'Redis Cache',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'Redis' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBeGreaterThanOrEqual(1);
    expect(parsed.results[0].displayName).toBe('Redis Cache');
    expect(parsed.results[0].type).toBe('node');
  });

  // Additional: Empty query returns empty results
  it('returns empty results for empty query', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Some Service',
    });

    const result = dispatchToolCall(ctx, 'search', { query: '' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(0);
    expect(parsed.results).toEqual([]);
  });

  // Additional: Search with multiple matching nodes returns all
  it('returns all matching nodes when multiple match', () => {
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'User Auth Service',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'data/database',
      displayName: 'User Profile DB',
    });
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'Order Processing',
    });

    const result = dispatchToolCall(ctx, 'search', { query: 'User' });
    const parsed = JSON.parse(result);

    // At least 2 nodes match "User"
    const nodeResults = parsed.results.filter((r: { type: string }) => r.type === 'node');
    expect(nodeResults.length).toBeGreaterThanOrEqual(2);

    const names = nodeResults.map((r: { displayName: string }) => r.displayName);
    expect(names).toContain('User Auth Service');
    expect(names).toContain('User Profile DB');
    // Order Processing should NOT be in results
    expect(names).not.toContain('Order Processing');
  });
});
