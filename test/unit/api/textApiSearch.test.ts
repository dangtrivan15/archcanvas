/**
 * Feature #49: Text API search() returns matching results
 *
 * TextAPI.search() performs full-text search and returns SearchResult objects.
 *
 * Steps verified:
 * 1. Create architecture with diverse nodes, edges, and notes
 * 2. Call textApi.search('Service')
 * 3. Verify results include matching nodes
 * 4. Verify each result has type, id, displayName, matchContext, score
 * 5. Verify results are sorted by relevance score
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNode(
  overrides: Partial<ArchNode> & { type: string; displayName: string },
): ArchNode {
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

function makeEdge(
  overrides: Partial<ArchEdge> & {
    fromNode: string;
    toNode: string;
  },
): ArchEdge {
  return {
    id: generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    fromPort: overrides.fromPort,
    toPort: overrides.toPort,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

function makeNote(content: string, author: string = 'user'): Note {
  return {
    id: generateId(),
    author,
    timestampMs: Date.now(),
    content,
    tags: [],
    status: 'none',
  };
}

describe('TextApi.search() - Feature #49', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  /**
   * Create a diverse architecture with nodes, edges, and notes.
   */
  function createDiverseGraph(): {
    graph: ArchGraph;
    api: TextApi;
    orderService: ArchNode;
    paymentGateway: ArchNode;
    userDb: ArchNode;
  } {
    const orderService = makeNode({
      type: 'compute/service',
      displayName: 'Order Service',
      args: { port: '8080', host: 'order.example.com' },
      notes: [makeNote('Handles order processing and fulfillment')],
    });
    const paymentGateway = makeNode({
      type: 'compute/api-gateway',
      displayName: 'Payment Gateway',
      args: { port: '443', endpoint: 'https://pay.stripe.com' },
      properties: { tier: 'critical', region: 'us-east-1' },
    });
    const userDb = makeNode({
      type: 'data/database',
      displayName: 'User Database',
      args: { engine: 'postgres', port: '5432' },
      notes: [makeNote('Primary user data store')],
    });

    const edge1 = makeEdge({
      fromNode: orderService.id,
      toNode: paymentGateway.id,
      label: 'Process Payment',
      type: 'sync',
    });
    const edge2 = makeEdge({
      fromNode: orderService.id,
      toNode: userDb.id,
      label: 'Query User Data',
      type: 'async',
      notes: [makeNote('Uses read replica for queries')],
    });

    const graph: ArchGraph = {
      name: 'E-Commerce Architecture',
      description: 'Online store backend',
      owners: ['team-backend'],
      nodes: [orderService, paymentGateway, userDb],
      edges: [edge1, edge2],
    };

    const api = new TextApi(graph, registry);

    return { graph, api, orderService, paymentGateway, userDb };
  }

  // --- Step 2: Call textApi.search('Service') ---

  it('should return results when searching for "Service"', () => {
    const { api } = createDiverseGraph();

    const results = api.search('Service');
    expect(results.length).toBeGreaterThan(0);
  });

  // --- Step 3: Verify results include matching nodes ---

  it('should include "Order Service" node when searching for "Service"', () => {
    const { api, orderService } = createDiverseGraph();

    const results = api.search('Service');
    const match = results.find(
      (r) => r.type === 'node' && r.id === orderService.id,
    );
    expect(match).toBeDefined();
    expect(match!.displayName).toBe('Order Service');
  });

  // --- Step 4: Verify each result has type, id, displayName, matchContext, score ---

  it('should return SearchResult with all required fields: type, id, displayName, matchContext, score', () => {
    const { api } = createDiverseGraph();

    const results = api.search('Service');
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('matchContext');
      expect(result).toHaveProperty('score');

      // Validate types
      expect(['node', 'edge', 'note']).toContain(result.type);
      expect(typeof result.id).toBe('string');
      expect(typeof result.displayName).toBe('string');
      expect(typeof result.matchContext).toBe('string');
      expect(typeof result.score).toBe('number');
    }
  });

  it('should have non-empty matchContext describing where the match was found', () => {
    const { api } = createDiverseGraph();

    const results = api.search('Order');
    const nodeResult = results.find((r) => r.type === 'node');
    expect(nodeResult).toBeDefined();
    expect(nodeResult!.matchContext.length).toBeGreaterThan(0);
    expect(nodeResult!.matchContext).toContain('Order Service');
  });

  // --- Step 5: Verify results are sorted by relevance score ---

  it('should return results sorted by score descending', () => {
    const { api } = createDiverseGraph();

    const results = api.search('Service');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should rank name matches higher than arg/property matches', () => {
    const { api } = createDiverseGraph();

    // "order" matches:
    // - Node name "Order Service" (score 20+)
    // - Arg "order.example.com" (score 5)
    const results = api.search('order');
    expect(results.length).toBeGreaterThan(0);

    // The name-match result should be first
    expect(results[0].type).toBe('node');
    expect(results[0].displayName).toBe('Order Service');
    expect(results[0].score).toBeGreaterThanOrEqual(20);
  });

  // --- Additional tests for diverse content ---

  it('should find matching edges by label', () => {
    const { api } = createDiverseGraph();

    const results = api.search('Payment');
    // Should match both: 'Payment Gateway' (node name) and 'Process Payment' (edge label)
    const nodeMatch = results.find((r) => r.type === 'node');
    const edgeMatch = results.find((r) => r.type === 'edge');

    expect(nodeMatch).toBeDefined();
    expect(nodeMatch!.displayName).toBe('Payment Gateway');

    expect(edgeMatch).toBeDefined();
    expect(edgeMatch!.matchContext).toContain('Process Payment');
  });

  it('should find matching notes on nodes', () => {
    const { api } = createDiverseGraph();

    // Search for text in a note: "fulfillment" appears in Order Service's note
    const results = api.search('fulfillment');
    expect(results.length).toBeGreaterThan(0);

    const noteMatch = results.find((r) => r.type === 'note');
    expect(noteMatch).toBeDefined();
    expect(noteMatch!.matchContext).toContain('fulfillment');
  });

  it('should return empty results for non-matching query', () => {
    const { api } = createDiverseGraph();

    const results = api.search('nonexistent_xyz_12345');
    expect(results).toHaveLength(0);
  });

  it('should return empty results for empty query string', () => {
    const { api } = createDiverseGraph();

    const results = api.search('');
    expect(results).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const { api, orderService } = createDiverseGraph();

    const lower = api.search('service');
    const upper = api.search('SERVICE');
    const mixed = api.search('sErViCe');

    // All should find Order Service
    expect(lower.some((r) => r.id === orderService.id)).toBe(true);
    expect(upper.some((r) => r.id === orderService.id)).toBe(true);
    expect(mixed.some((r) => r.id === orderService.id)).toBe(true);
  });

  it('should search across arg values', () => {
    const { api } = createDiverseGraph();

    // "postgres" appears in User Database's args
    const results = api.search('postgres');
    expect(results.length).toBeGreaterThan(0);

    const match = results.find(
      (r) => r.type === 'node' && r.displayName === 'User Database',
    );
    expect(match).toBeDefined();
  });

  it('should search across custom properties', () => {
    const { api } = createDiverseGraph();

    // "critical" appears in Payment Gateway's properties
    const results = api.search('critical');
    expect(results.length).toBeGreaterThan(0);

    const match = results.find(
      (r) => r.type === 'node' && r.displayName === 'Payment Gateway',
    );
    expect(match).toBeDefined();
  });

  it('should find notes on edges', () => {
    const { api } = createDiverseGraph();

    // "read replica" appears in an edge note
    const results = api.search('read replica');
    expect(results.length).toBeGreaterThan(0);
  });
});
