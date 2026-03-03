/**
 * Tests: Search responds within 500ms for 100-node architecture (Feature #232)
 *
 * Verifies that full-text search via graphQuery.searchGraph and TextApi.search
 * returns correct results quickly for architectures with 100+ nodes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  addNode,
  addEdge,
  addNoteToNode,
  createNote,
} from '@/core/graph/graphEngine';
import { searchGraph, countAllNodes } from '@/core/graph/graphQuery';
import { RegistryManager } from '@/core/registry/registryManager';
import { TextApi } from '@/api/textApi';
import type { ArchGraph } from '@/types/graph';

// Diverse node types for realistic graph
const NODE_TYPES = [
  'compute/service',
  'data/database',
  'data/cache',
  'messaging/event-bus',
  'messaging/message-queue',
  'compute/api-gateway',
  'network/load-balancer',
  'observability/logging',
  'observability/monitoring',
  'data/object-storage',
];

// Unique service name parts for generating distinctive display names
const PREFIXES = [
  'User', 'Order', 'Payment', 'Auth', 'Notification',
  'Inventory', 'Shipping', 'Search', 'Analytics', 'Report',
  'Billing', 'Catalog', 'Cart', 'Review', 'Media',
  'Config', 'Session', 'Rate', 'Audit', 'Export',
];

const SUFFIXES = [
  'Service', 'Database', 'Cache', 'EventBus', 'Queue',
  'Gateway', 'LoadBalancer', 'Logger', 'Monitor', 'Storage',
];

/**
 * Create a 100-node graph with unique display names, notes, and properties.
 */
function createSearchableGraph(): { graph: ArchGraph; nodeIds: string[] } {
  let graph = createEmptyGraph('Search Test Architecture');
  const nodeIds: string[] = [];

  for (let i = 0; i < 100; i++) {
    const type = NODE_TYPES[i % NODE_TYPES.length];
    const prefix = PREFIXES[i % PREFIXES.length];
    const suffix = SUFFIXES[i % SUFFIXES.length];
    // Ensure unique names by appending index for duplicates
    const displayName = `${prefix} ${suffix} ${i}`;

    const node = createNode({
      type,
      displayName,
      position: { x: (i % 10) * 350, y: Math.floor(i / 10) * 180 },
      args: { environment: i % 2 === 0 ? 'production' : 'staging', version: `v${i}` },
    });
    nodeIds.push(node.id);
    graph = addNode(graph, node);
  }

  // Add notes to some nodes for note search testing
  for (let i = 0; i < 20; i++) {
    const note = createNote({
      author: 'architect',
      content: `Review needed for ${PREFIXES[i % PREFIXES.length]} component - performance optimization required`,
      tags: ['review', 'performance'],
    });
    graph = addNoteToNode(graph, nodeIds[i * 5], note);
  }

  // Add edges with labels for edge search testing
  for (let i = 0; i < 50; i++) {
    const fromIdx = i * 2;
    const toIdx = Math.min(i * 2 + 1, 99);
    const edge = createEdge({
      fromNode: nodeIds[fromIdx],
      toNode: nodeIds[toIdx],
      type: i % 3 === 0 ? 'sync' : i % 3 === 1 ? 'async' : 'data-flow',
      label: `${PREFIXES[fromIdx % PREFIXES.length]}-to-${PREFIXES[toIdx % PREFIXES.length]}`,
    });
    graph = addEdge(graph, edge);
  }

  return { graph, nodeIds };
}

describe('Search responds within 500ms for 100-node architecture', () => {
  let graph: ArchGraph;
  let nodeIds: string[];

  beforeEach(() => {
    const result = createSearchableGraph();
    graph = result.graph;
    nodeIds = result.nodeIds;
  });

  // ========================================================
  // 1. Search correctness with 100 nodes
  // ========================================================

  describe('Search returns correct results', () => {
    it('graph has exactly 100 nodes', () => {
      expect(countAllNodes(graph)).toBe(100);
    });

    it('finds nodes by exact display name prefix', () => {
      const results = searchGraph(graph, 'User');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.type === 'node')).toBe(true);
      // All node results should contain "User" in display name or context
      for (const r of results.filter((r) => r.type === 'node')) {
        expect(
          r.displayName.toLowerCase().includes('user') ||
          r.matchContext.toLowerCase().includes('user'),
        ).toBe(true);
      }
    });

    it('finds nodes by partial display name', () => {
      const results = searchGraph(graph, 'Gateway');
      const nodeResults = results.filter((r) => r.type === 'node');
      // Should match nodes with "Gateway" in their display name
      expect(nodeResults.length).toBeGreaterThan(0);
      for (const r of nodeResults) {
        expect(r.displayName).toContain('Gateway');
      }
    });

    it('finds nodes by type', () => {
      const results = searchGraph(graph, 'database');
      const nodeResults = results.filter((r) => r.type === 'node');
      // Should match nodes of type "data/database"
      expect(nodeResults.length).toBeGreaterThan(0);
    });

    it('finds nodes by arg value', () => {
      const results = searchGraph(graph, 'production');
      const nodeResults = results.filter((r) => r.type === 'node');
      // 50 nodes have environment=production
      expect(nodeResults.length).toBe(50);
    });

    it('finds notes by content', () => {
      const results = searchGraph(graph, 'Review needed');
      const noteResults = results.filter((r) => r.type === 'note');
      // We added 20 notes with "Review needed"
      expect(noteResults.length).toBe(20);
    });

    it('finds edges by label', () => {
      const results = searchGraph(graph, 'User-to');
      const edgeResults = results.filter((r) => r.type === 'edge');
      expect(edgeResults.length).toBeGreaterThan(0);
    });

    it('returns empty results for non-matching query', () => {
      const results = searchGraph(graph, 'ZZZZNONEXISTENT');
      expect(results).toHaveLength(0);
    });

    it('returns empty results for empty query', () => {
      const results = searchGraph(graph, '');
      expect(results).toHaveLength(0);
    });

    it('results are sorted by relevance score', () => {
      const results = searchGraph(graph, 'Order');
      // Results should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('each result has required fields', () => {
      const results = searchGraph(graph, 'Service');
      for (const r of results) {
        expect(r.id).toBeTruthy();
        expect(r.type).toBeTruthy();
        expect(r.displayName).toBeTruthy();
        expect(r.matchContext).toBeTruthy();
        expect(typeof r.score).toBe('number');
        expect(r.score).toBeGreaterThan(0);
      }
    });
  });

  // ========================================================
  // 2. Search performance within 500ms
  // ========================================================

  describe('Search performance within 500ms', () => {
    it('search by name completes within 500ms for 100 nodes', () => {
      const start = performance.now();
      searchGraph(graph, 'Payment');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('search by type completes within 500ms for 100 nodes', () => {
      const start = performance.now();
      searchGraph(graph, 'compute/service');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('search by arg value completes within 500ms for 100 nodes', () => {
      const start = performance.now();
      searchGraph(graph, 'production');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('search by note content completes within 500ms for 100 nodes', () => {
      const start = performance.now();
      searchGraph(graph, 'performance optimization');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('broad search matching many results completes within 500ms', () => {
      // "Service" appears in many node names
      const start = performance.now();
      const results = searchGraph(graph, 'Service');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
      expect(results.length).toBeGreaterThan(5);
    });

    it('search with no matches completes within 500ms', () => {
      const start = performance.now();
      searchGraph(graph, 'ZZZZNONEXISTENTQUERY');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('10 sequential searches complete within 500ms total', () => {
      const queries = ['User', 'Order', 'Payment', 'Auth', 'Gateway',
        'Database', 'Cache', 'Queue', 'Logger', 'Monitor'];
      const start = performance.now();
      for (const q of queries) {
        searchGraph(graph, q);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    it('search on 500-node graph completes within 500ms', () => {
      // Create a larger graph
      let largeGraph = createEmptyGraph('Large Search Test');
      for (let j = 0; j < 500; j++) {
        const node = createNode({
          type: NODE_TYPES[j % NODE_TYPES.length],
          displayName: `${PREFIXES[j % PREFIXES.length]} ${SUFFIXES[j % SUFFIXES.length]} ${j}`,
        });
        largeGraph = addNode(largeGraph, node);
      }

      const start = performance.now();
      searchGraph(largeGraph, 'Payment');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  // ========================================================
  // 3. TextApi.search integration
  // ========================================================

  describe('TextApi.search integration', () => {
    let textApi: TextApi;

    beforeEach(() => {
      const registry = new RegistryManager();
      registry.initialize();
      textApi = new TextApi(graph, registry);
    });

    it('TextApi.search returns same results as searchGraph', () => {
      const directResults = searchGraph(graph, 'Payment');
      const apiResults = textApi.search('Payment');
      expect(apiResults).toHaveLength(directResults.length);
      for (let i = 0; i < apiResults.length; i++) {
        expect(apiResults[i].id).toBe(directResults[i].id);
        expect(apiResults[i].score).toBe(directResults[i].score);
      }
    });

    it('TextApi.search respects graph state changes', () => {
      const resultsBefore = textApi.search('UNIQUE_NEW_NODE');
      expect(resultsBefore).toHaveLength(0);

      // Add a new node
      textApi.addNode({
        type: 'compute/service',
        displayName: 'UNIQUE_NEW_NODE Service',
      });

      const resultsAfter = textApi.search('UNIQUE_NEW_NODE');
      expect(resultsAfter.length).toBeGreaterThan(0);
      expect(resultsAfter[0].displayName).toContain('UNIQUE_NEW_NODE');
    });

    it('TextApi.search completes within 500ms', () => {
      const start = performance.now();
      textApi.search('Service');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  // ========================================================
  // 4. Search specificity and edge cases
  // ========================================================

  describe('Search edge cases', () => {
    it('case-insensitive search works', () => {
      const upperResults = searchGraph(graph, 'USER');
      const lowerResults = searchGraph(graph, 'user');
      const mixedResults = searchGraph(graph, 'User');

      // All should return same number of results
      expect(upperResults.length).toBe(lowerResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
    });

    it('single character search works', () => {
      const results = searchGraph(graph, 'v');
      // Should match version args like v0, v1, v2... and other fields with 'v'
      expect(results.length).toBeGreaterThan(0);
    });

    it('numeric search works', () => {
      const results = searchGraph(graph, '42');
      // Should match "Node 42" and version "v42"
      expect(results.length).toBeGreaterThan(0);
    });

    it('special characters in search are handled gracefully', () => {
      // These should not throw errors
      expect(() => searchGraph(graph, '<script>')).not.toThrow();
      expect(() => searchGraph(graph, "O'Brien")).not.toThrow();
      expect(() => searchGraph(graph, 'foo & bar')).not.toThrow();
    });

    it('whitespace-only search returns empty', () => {
      const results = searchGraph(graph, '   ');
      expect(results).toHaveLength(0);
    });

    it('search with multiple words narrows results', () => {
      const broadResults = searchGraph(graph, 'Service');
      const narrowResults = searchGraph(graph, 'User Service');
      // Narrow search should find fewer or equal results
      expect(narrowResults.length).toBeLessThanOrEqual(broadResults.length);
    });
  });
});
