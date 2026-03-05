/**
 * Feature #56: Structured formatter produces valid JSON output.
 * Verifies that the Structured formatter produces parseable JSON with correct schema.
 *
 * Steps:
 * 1. Create architecture with nodes, edges, notes
 * 2. Call describe with format='structured'
 * 3. Verify output parses as valid JSON
 * 4. Verify JSON has nodes array
 * 5. Verify JSON has edges array
 * 6. Verify each node has id, type, displayName fields
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? generateId(),
    author: overrides.author ?? 'developer',
    timestampMs: overrides.timestampMs ?? Date.now(),
    content: overrides.content ?? 'A test note',
    tags: overrides.tags ?? [],
    status: overrides.status ?? 'none',
    suggestionType: overrides.suggestionType,
  };
}

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: overrides.id ?? generateId(),
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
    id: overrides.id ?? generateId(),
    fromNode: overrides.fromNode,
    toNode: overrides.toNode,
    type: overrides.type ?? 'sync',
    label: overrides.label,
    properties: overrides.properties ?? {},
    notes: overrides.notes ?? [],
  };
}

describe('Structured formatter produces valid JSON - Feature #56', () => {
  let textApi: TextApi;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let edge1: ArchEdge;
  let edge2: ArchEdge;
  let result: string;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    // Step 1: Create architecture with nodes, edges, notes
    const note1 = makeNote({ author: 'alice', content: 'Gateway handles all ingress traffic' });
    const note2 = makeNote({
      author: 'bob',
      content: 'Consider adding rate limiting',
      tags: ['todo'],
    });
    const note3 = makeNote({
      author: 'charlie',
      content: 'DB schema needs review',
      status: 'pending',
    });

    node1 = makeNode({
      type: 'compute/api-gateway',
      displayName: 'API Gateway',
      notes: [note1, note2],
    });
    node2 = makeNode({
      type: 'compute/service',
      displayName: 'Order Service',
      args: { port: 8080, env: 'production' },
    });
    node3 = makeNode({
      type: 'data/database',
      displayName: 'Orders DB',
      notes: [note3],
    });

    edge1 = makeEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'REST API',
    });
    edge2 = makeEdge({
      fromNode: node2.id,
      toNode: node3.id,
      type: 'data-flow',
      label: 'SQL Queries',
    });

    const graph: ArchGraph = {
      name: 'Order Management System',
      description: 'Handles order lifecycle',
      owners: ['team-orders', 'team-platform'],
      nodes: [node1, node2, node3],
      edges: [edge1, edge2],
    };

    textApi = new TextApi(graph, registry);
  });

  // Step 2: Call describe with format='structured'
  it('returns a non-empty string from describe', () => {
    result = textApi.describe({ format: 'structured' });
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  // Step 3: Verify output parses as valid JSON
  it('parses as valid JSON without throwing', () => {
    const output = textApi.describe({ format: 'structured' });
    let parsed: unknown;
    expect(() => {
      parsed = JSON.parse(output);
    }).not.toThrow();
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
  });

  it('produces well-formatted JSON (pretty-printed with indentation)', () => {
    const output = textApi.describe({ format: 'structured' });
    // The output should contain newlines and indentation (pretty-printed)
    expect(output).toContain('\n');
    expect(output).toContain('  ');
  });

  // Step 4: Verify JSON has nodes array
  it('has a nodes property that is an array', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    expect(parsed).toHaveProperty('nodes');
    expect(Array.isArray(parsed.nodes)).toBe(true);
  });

  it('nodes array has correct length (3 nodes)', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    expect(parsed.nodes.length).toBe(3);
  });

  // Step 5: Verify JSON has edges array
  it('has an edges property that is an array', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    expect(parsed).toHaveProperty('edges');
    expect(Array.isArray(parsed.edges)).toBe(true);
  });

  it('edges array has correct length (2 edges)', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    expect(parsed.edges.length).toBe(2);
  });

  // Step 6: Verify each node has id, type, displayName fields
  it('every node has id, type, displayName string fields', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    for (const node of parsed.nodes) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('displayName');
      expect(typeof node.id).toBe('string');
      expect(typeof node.type).toBe('string');
      expect(typeof node.displayName).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
      expect(node.type.length).toBeGreaterThan(0);
      expect(node.displayName.length).toBeGreaterThan(0);
    }
  });

  it('node display names match the created nodes', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    const names = parsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('API Gateway');
    expect(names).toContain('Order Service');
    expect(names).toContain('Orders DB');
  });

  it('node types match the created nodes', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    const types = parsed.nodes.map((n: { type: string }) => n.type);
    expect(types).toContain('compute/api-gateway');
    expect(types).toContain('compute/service');
    expect(types).toContain('data/database');
  });

  // Additional schema validation: nodes have full NodeSummary shape
  it('each node has childCount, noteCount, connectionCount numeric fields', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    for (const node of parsed.nodes) {
      expect(typeof node.childCount).toBe('number');
      expect(typeof node.noteCount).toBe('number');
      expect(typeof node.connectionCount).toBe('number');
    }
  });

  it('note counts reflect actual notes on nodes', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    const gateway = parsed.nodes.find(
      (n: { displayName: string }) => n.displayName === 'API Gateway',
    );
    const ordersDb = parsed.nodes.find(
      (n: { displayName: string }) => n.displayName === 'Orders DB',
    );
    const orderSvc = parsed.nodes.find(
      (n: { displayName: string }) => n.displayName === 'Order Service',
    );
    expect(gateway.noteCount).toBe(2); // 2 notes on API Gateway
    expect(ordersDb.noteCount).toBe(1); // 1 note on Orders DB
    expect(orderSvc.noteCount).toBe(0); // no notes on Order Service
  });

  // Additional schema validation: edges have full EdgeSummary shape
  it('each edge has id, fromNode, toNode, type, noteCount fields', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    for (const edge of parsed.edges) {
      expect(typeof edge.id).toBe('string');
      expect(typeof edge.fromNode).toBe('string');
      expect(typeof edge.toNode).toBe('string');
      expect(typeof edge.type).toBe('string');
      expect(typeof edge.noteCount).toBe('number');
    }
  });

  it('edge references point to valid node IDs', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    const nodeIds = new Set(parsed.nodes.map((n: { id: string }) => n.id));
    for (const edge of parsed.edges) {
      expect(nodeIds.has(edge.fromNode)).toBe(true);
      expect(nodeIds.has(edge.toNode)).toBe(true);
    }
  });

  it('edges have correct types and labels', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    const syncEdge = parsed.edges.find((e: { label: string }) => e.label === 'REST API');
    const dataEdge = parsed.edges.find((e: { label: string }) => e.label === 'SQL Queries');
    expect(syncEdge).toBeDefined();
    expect(syncEdge.type).toBe('sync');
    expect(dataEdge).toBeDefined();
    expect(dataEdge.type).toBe('data-flow');
  });

  // Top-level metadata fields
  it('has name, description, owners, nodeCount, edgeCount top-level fields', () => {
    const parsed = JSON.parse(textApi.describe({ format: 'structured' }));
    expect(parsed.name).toBe('Order Management System');
    expect(parsed.description).toBe('Handles order lifecycle');
    expect(Array.isArray(parsed.owners)).toBe(true);
    expect(parsed.owners).toContain('team-orders');
    expect(parsed.owners).toContain('team-platform');
    expect(parsed.nodeCount).toBe(3);
    expect(parsed.edgeCount).toBe(2);
  });

  // Round-trip: JSON.stringify then parse should be identical
  it('output is idempotent through parse-stringify round-trip', () => {
    const output = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(output);
    const reStringified = JSON.stringify(parsed, null, 2);
    expect(reStringified).toBe(output);
  });
});

describe('Structured formatter edge cases - Feature #56', () => {
  it('produces valid JSON for empty architecture', () => {
    const registry = new RegistryManager();
    registry.initialize();
    const emptyGraph: ArchGraph = {
      name: 'Empty Arch',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const api = new TextApi(emptyGraph, registry);
    const output = api.describe({ format: 'structured' });
    const parsed = JSON.parse(output);

    expect(parsed.name).toBe('Empty Arch');
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBe(0);
    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.edges.length).toBe(0);
    expect(parsed.nodeCount).toBe(0);
    expect(parsed.edgeCount).toBe(0);
  });

  it('produces valid JSON for architecture with child nodes', () => {
    const registry = new RegistryManager();
    registry.initialize();
    const childNode = makeNode({ type: 'compute/function', displayName: 'Lambda Handler' });
    const parentNode = makeNode({
      type: 'compute/service',
      displayName: 'Service',
      children: [childNode],
    });
    const graph: ArchGraph = {
      name: 'Nested Arch',
      description: 'Has nested children',
      owners: [],
      nodes: [parentNode],
      edges: [],
    };
    const api = new TextApi(graph, registry);
    const output = api.describe({ format: 'structured' });
    const parsed = JSON.parse(output);

    // nodeCount includes children
    expect(parsed.nodeCount).toBe(2);
    // nodes array is flattened — includes parent and child
    expect(parsed.nodes.length).toBe(2);
    const names = parsed.nodes.map((n: { displayName: string }) => n.displayName);
    expect(names).toContain('Service');
    expect(names).toContain('Lambda Handler');
    // Each still has required fields
    for (const node of parsed.nodes) {
      expect(typeof node.id).toBe('string');
      expect(typeof node.type).toBe('string');
      expect(typeof node.displayName).toBe('string');
    }
  });
});
