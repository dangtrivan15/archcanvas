/**
 * Feature #31: Full-text search finds matches in node properties
 *
 * Search matches against node args and custom properties.
 *
 * Steps verified:
 * 1. Create node with args {port: '8080', host: 'api.example.com'}
 * 2. Search for 'example.com' and verify node is in results
 * 3. Search for '8080' and verify node is in results
 */

import { describe, it, expect } from 'vitest';
import { createEmptyGraph, createNode, addNode } from '@/core/graph/graphEngine';
import { searchGraph } from '@/core/graph/graphQuery';

describe('Feature #31: Full-text search finds matches in node properties', () => {
  function createTestGraph() {
    const node = createNode({
      type: 'compute/service',
      displayName: 'API Service',
      args: { port: '8080', host: 'api.example.com' },
    });
    // Add custom properties
    const nodeWithProps = {
      ...node,
      properties: { environment: 'production', tier: 'critical' },
    };
    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, nodeWithProps);
    return { graph, node: nodeWithProps };
  }

  it('should find node when searching for arg value "example.com"', () => {
    // Step 1: Create node with args {port: '8080', host: 'api.example.com'}
    const { graph, node } = createTestGraph();

    // Step 2: Search for 'example.com' and verify node is in results
    const results = searchGraph(graph, 'example.com');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
    expect(nodeResult!.displayName).toBe('API Service');
  });

  it('should find node when searching for arg value "8080"', () => {
    const { graph, node } = createTestGraph();

    // Step 3: Search for '8080' and verify node is in results
    const results = searchGraph(graph, '8080');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
    expect(nodeResult!.displayName).toBe('API Service');
  });

  it('should include matchContext referencing the matched arg', () => {
    const { graph } = createTestGraph();

    const results = searchGraph(graph, 'example.com');
    const nodeResult = results.find((r) => r.type === 'node');
    expect(nodeResult).toBeDefined();
    // matchContext should reference the arg key and value
    expect(nodeResult!.matchContext).toContain('host');
    expect(nodeResult!.matchContext).toContain('api.example.com');
  });

  it('should find node when searching by arg key name', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Worker',
      args: { replicas: '3', timeout: '30s' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    const results = searchGraph(graph, 'replicas');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should find node when searching for custom property value', () => {
    const { graph, node } = createTestGraph();

    // Search for property value 'production'
    const results = searchGraph(graph, 'production');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
    expect(nodeResult!.matchContext).toContain('environment');
    expect(nodeResult!.matchContext).toContain('production');
  });

  it('should find node when searching for custom property key', () => {
    const { graph, node } = createTestGraph();

    // Search for property key 'tier'
    const results = searchGraph(graph, 'tier');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should be case-insensitive for arg search', () => {
    const { graph, node } = createTestGraph();

    const results = searchGraph(graph, 'EXAMPLE.COM');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should be case-insensitive for property search', () => {
    const { graph, node } = createTestGraph();

    const results = searchGraph(graph, 'PRODUCTION');
    expect(results.length).toBeGreaterThan(0);

    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should return empty results for non-matching query', () => {
    const { graph } = createTestGraph();

    const results = searchGraph(graph, 'nonexistentvalue12345');
    expect(results).toHaveLength(0);
  });

  it('should return empty results for empty query', () => {
    const { graph } = createTestGraph();

    const results = searchGraph(graph, '');
    expect(results).toHaveLength(0);
  });

  it('should find multiple nodes matching the same property search', () => {
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'Service A',
      args: { port: '8080' },
    });
    const node2 = createNode({
      type: 'compute/service',
      displayName: 'Service B',
      args: { port: '8080' },
    });
    const node3 = createNode({
      type: 'data/database',
      displayName: 'Database',
      args: { port: '5432' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);

    const results = searchGraph(graph, '8080');
    const nodeResults = results.filter((r) => r.type === 'node');
    expect(nodeResults).toHaveLength(2);

    const ids = nodeResults.map((r) => r.id);
    expect(ids).toContain(node1.id);
    expect(ids).toContain(node2.id);
    expect(ids).not.toContain(node3.id);
  });

  it('should handle numeric arg values in search', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Worker',
    });
    const nodeWithNumericArgs = {
      ...node,
      args: { replicas: 5, maxRetries: 3 },
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithNumericArgs);

    // Search for numeric value as string
    const results = searchGraph(graph, '5');
    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should handle boolean arg values in search', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Debug Service',
    });
    const nodeWithBoolArgs = {
      ...node,
      args: { debug: true, verbose: false },
    };
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeWithBoolArgs);

    const results = searchGraph(graph, 'true');
    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });

  it('should prioritize name matches over property matches', () => {
    const node1 = createNode({
      type: 'compute/service',
      displayName: 'API Gateway',
      args: { port: '8080' },
    });
    const node2 = createNode({
      type: 'compute/service',
      displayName: 'Worker',
      args: { gateway: 'api-gateway-url' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);

    const results = searchGraph(graph, 'gateway');
    expect(results.length).toBeGreaterThanOrEqual(2);

    // Name match (node1) should have higher score than arg match (node2)
    const node1Result = results.find((r) => r.id === node1.id)!;
    const node2Result = results.find((r) => r.id === node2.id)!;
    expect(node1Result.score).toBeGreaterThan(node2Result.score);
  });

  it('should match partial arg values', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Service',
      args: { host: 'api.example.com' },
    });
    let graph = createEmptyGraph('Test');
    graph = addNode(graph, node);

    // Partial match
    const results = searchGraph(graph, 'api.ex');
    const nodeResult = results.find((r) => r.type === 'node' && r.id === node.id);
    expect(nodeResult).toBeDefined();
  });
});
