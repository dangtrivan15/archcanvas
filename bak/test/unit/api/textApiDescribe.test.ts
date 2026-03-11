/**
 * Feature #39: Text API describe() returns architecture overview.
 * Verifies that TextAPI.describe() returns a formatted description
 * of the entire architecture with name, node count, edge count, and summaries.
 */
import { describe, it, expect, beforeAll } from 'vitest';
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

describe('TextApi.describe() - Feature #39', () => {
  let textApi: TextApi;
  let node1: ArchNode;
  let node2: ArchNode;
  let node3: ArchNode;
  let edge1: ArchEdge;
  let edge2: ArchEdge;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();

    // Step 1: Create architecture with name 'E-Commerce System', 3 nodes, 2 edges
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

    textApi = new TextApi(graph, registry);
  });

  // Step 2: Call textApi.describe({format: 'structured'})
  it('returns valid JSON for structured format', () => {
    const result = textApi.describe({ format: 'structured' });
    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
  });

  // Step 3: Verify response includes architecture name
  it('includes architecture name "E-Commerce System"', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('E-Commerce System');
  });

  // Step 4: Verify response includes node count (3)
  it('includes correct node count (3)', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.nodeCount).toBe(3);
  });

  // Step 5: Verify response includes edge count (2)
  it('includes correct edge count (2)', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.edgeCount).toBe(2);
  });

  // Step 6: Verify response includes node summaries
  it('includes node summaries with correct structure', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBe(3);

    // Verify each node summary has expected fields
    for (const summary of parsed.nodes) {
      expect(summary.id).toBeTruthy();
      expect(summary.type).toBeTruthy();
      expect(summary.displayName).toBeTruthy();
      expect(typeof summary.childCount).toBe('number');
      expect(typeof summary.noteCount).toBe('number');
      expect(typeof summary.connectionCount).toBe('number');
    }
  });

  it('node summaries contain correct display names', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);
    const names = parsed.nodes.map((n: { displayName: string }) => n.displayName);

    expect(names).toContain('Order Service');
    expect(names).toContain('Products DB');
    expect(names).toContain('API Gateway');
  });

  it('node summaries have correct connection counts', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);

    // API Gateway: 1 outbound edge
    const gateway = parsed.nodes.find(
      (n: { displayName: string }) => n.displayName === 'API Gateway',
    );
    expect(gateway.connectionCount).toBe(1);

    // Order Service: 1 inbound + 1 outbound = 2
    const order = parsed.nodes.find(
      (n: { displayName: string }) => n.displayName === 'Order Service',
    );
    expect(order.connectionCount).toBe(2);

    // Products DB: 1 inbound edge
    const db = parsed.nodes.find((n: { displayName: string }) => n.displayName === 'Products DB');
    expect(db.connectionCount).toBe(1);
  });

  it('includes edge summaries', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);

    expect(Array.isArray(parsed.edges)).toBe(true);
    expect(parsed.edges.length).toBe(2);

    for (const edge of parsed.edges) {
      expect(edge.id).toBeTruthy();
      expect(edge.fromNode).toBeTruthy();
      expect(edge.toNode).toBeTruthy();
      expect(edge.type).toBeTruthy();
      expect(typeof edge.noteCount).toBe('number');
    }
  });

  it('includes description and owners in structured output', () => {
    const result = textApi.describe({ format: 'structured' });
    const parsed = JSON.parse(result);
    expect(parsed.description).toBe('A sample e-commerce architecture');
    expect(parsed.owners).toContain('team-alpha');
  });

  // Additional: human format also includes architecture name and counts
  it('human format includes architecture name', () => {
    const result = textApi.describe({ format: 'human' });
    expect(result).toContain('E-Commerce System');
    expect(result).toContain('Nodes: 3');
    expect(result).toContain('Edges: 2');
  });

  // Additional: AI format also includes architecture name and counts
  it('AI format includes architecture name and counts', () => {
    const result = textApi.describe({ format: 'ai' });
    expect(result).toContain('name="E-Commerce System"');
    expect(result).toContain('nodes="3"');
    expect(result).toContain('edges="2"');
  });
});
