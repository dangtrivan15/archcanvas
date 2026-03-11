/**
 * Feature #33: Full-text search finds matches in edge labels
 *
 * Search matches against edge label text.
 *
 * Steps verified:
 * 1. Create edge with label 'HTTP REST'
 * 2. Search for 'REST' and verify edge match found
 * 3. Search for 'HTTP' and verify edge match found
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
} from '@/core/graph/graphEngine';
import { searchGraph } from '@/core/graph/graphQuery';

describe('Feature #33: Full-text search finds matches in edge labels', () => {
  /** Helper: create a graph with an edge labelled 'HTTP REST' */
  function createTestGraph() {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Frontend App',
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Backend Service',
    });
    const edge = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'HTTP REST',
    });

    let graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, edge);

    return { graph, nodeA, nodeB, edge };
  }

  // --- Step 1 & 2: Search for 'REST' in edge label ---

  it('should find edge when searching for "REST" in label', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'REST');
    expect(results.length).toBeGreaterThan(0);

    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
  });

  // --- Step 3: Search for 'HTTP' in edge label ---

  it('should find edge when searching for "HTTP" in label', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'HTTP');
    expect(results.length).toBeGreaterThan(0);

    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
  });

  // --- Edge result properties ---

  it('should return result with type "edge" for label matches', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'REST');
    const edgeResult = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.type).toBe('edge');
  });

  it('should include "Label:" in matchContext for edge label matches', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'REST');
    const edgeResult = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.matchContext).toContain('Label:');
    expect(edgeResult!.matchContext).toContain('HTTP REST');
  });

  it('should use edge label as displayName when available', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'REST');
    const edgeResult = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.displayName).toBe('HTTP REST');
  });

  // --- Case insensitivity ---

  it('should be case-insensitive when searching edge labels', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'rest');
    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
  });

  it('should match mixed-case queries against edge labels', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'hTtP rEsT');
    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
  });

  // --- Score verification ---

  it('should give edge label matches a score of 10', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'REST');
    const edgeResult = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.score).toBe(10);
  });

  // --- Multiple edges ---

  it('should find matches across multiple edges with different labels', () => {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Service B',
    });
    const nodeC = createNode({
      type: 'data/database',
      displayName: 'Database',
    });

    const edge1 = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'gRPC calls',
    });
    const edge2 = createEdge({
      fromNode: nodeB.id,
      toNode: nodeC.id,
      type: 'async',
      label: 'SQL queries',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addNode(graph, nodeC);
    graph = addEdge(graph, edge1);
    graph = addEdge(graph, edge2);

    // Search for edge1's label
    const results1 = searchGraph(graph, 'gRPC');
    const match1 = results1.find((r) => r.type === 'edge' && r.id === edge1.id);
    expect(match1).toBeDefined();

    // Search for edge2's label
    const results2 = searchGraph(graph, 'SQL');
    const match2 = results2.find((r) => r.type === 'edge' && r.id === edge2.id);
    expect(match2).toBeDefined();
  });

  // --- Edge without label ---

  it('should not match edge with no label', () => {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Service B',
    });
    const unlabelledEdge = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, unlabelledEdge);

    const results = searchGraph(graph, 'REST');
    const edgeMatch = results.find((r) => r.type === 'edge');
    expect(edgeMatch).toBeUndefined();
  });

  // --- Partial match ---

  it('should find edge with partial label match (substring)', () => {
    const { graph, edge } = createTestGraph();

    // 'TTP' is a substring of 'HTTP'
    const results = searchGraph(graph, 'TTP');
    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
  });

  // --- Edge with no-label uses arrow notation in displayName ---

  it('should use fromNode→toNode format in displayName for unlabelled edges', () => {
    const nodeA = createNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    const nodeB = createNode({
      type: 'compute/service',
      displayName: 'Service B',
    });
    const note = {
      id: 'note-1',
      author: 'dev',
      content: 'This edge needs retry logic',
      timestampMs: Date.now(),
      tags: [],
      status: 'none' as const,
    };

    const edge = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
    });

    let graph = createEmptyGraph('Test');
    graph = addNode(graph, nodeA);
    graph = addNode(graph, nodeB);
    graph = addEdge(graph, edge);
    // Manually add note to the edge for testing
    graph = {
      ...graph,
      edges: graph.edges.map((e) => (e.id === edge.id ? { ...e, notes: [note] } : e)),
    };

    // Search for something in the note (edge has no label)
    const results = searchGraph(graph, 'retry logic');
    const edgeMatch = results.find((r) => r.type === 'edge' && r.id === edge.id);
    expect(edgeMatch).toBeDefined();
    // displayName should use the arrow format since there's no label
    expect(edgeMatch!.displayName).toContain('→');
  });

  // --- No false positives ---

  it("should return no edge matches when query doesn't match any label", () => {
    const { graph } = createTestGraph();

    const results = searchGraph(graph, 'GraphQL');
    const edgeMatch = results.find((r) => r.type === 'edge');
    expect(edgeMatch).toBeUndefined();
  });

  // --- Result has correct edge ID ---

  it('should use edge ID for search result ID', () => {
    const { graph, edge } = createTestGraph();

    const results = searchGraph(graph, 'HTTP REST');
    const edgeResult = results.find((r) => r.type === 'edge');
    expect(edgeResult).toBeDefined();
    expect(edgeResult!.id).toBe(edge.id);
  });
});
