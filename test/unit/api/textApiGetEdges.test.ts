/**
 * Feature #42: Text API getEdges() returns edge summaries
 *
 * TextAPI.getEdges() returns an array of EdgeSummary objects.
 *
 * Steps verified:
 * 1. Create architecture with 3 edges of different types (sync, async, data-flow)
 * 2. Call textApi.getEdges()
 * 3. Verify 3 EdgeSummary objects returned
 * 4. Verify each has fromNode, toNode, type, label fields
 * 5. Verify edge types match what was created
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';
import type { EdgeSummary } from '@/types/api';

describe('Feature #42: Text API getEdges() returns edge summaries', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('Architecture with 3 edges of different types', () => {
    let textApi: TextApi;
    let edges: EdgeSummary[];
    let serviceId: string;
    let dbId: string;
    let queueId: string;
    let cacheId: string;

    beforeAll(() => {
      // Step 1: Create architecture with 3 edges of different types
      const graph = createEmptyGraph('Edge Test Architecture');
      textApi = new TextApi(graph, registry);

      const service = textApi.addNode({
        type: 'compute/service',
        displayName: 'Order Service',
        position: { x: 0, y: 0 },
      });
      serviceId = service.id;

      const db = textApi.addNode({
        type: 'data/database',
        displayName: 'Orders DB',
        position: { x: 200, y: 0 },
      });
      dbId = db.id;

      const queue = textApi.addNode({
        type: 'messaging/message-queue',
        displayName: 'Event Queue',
        position: { x: 400, y: 0 },
      });
      queueId = queue.id;

      const cache = textApi.addNode({
        type: 'data/cache',
        displayName: 'Session Cache',
        position: { x: 0, y: 200 },
      });
      cacheId = cache.id;

      // Edge 1: sync (service → db)
      textApi.addEdge({
        fromNode: serviceId,
        toNode: dbId,
        type: 'sync',
        label: 'SQL queries',
      });

      // Edge 2: async (service → queue)
      textApi.addEdge({
        fromNode: serviceId,
        toNode: queueId,
        type: 'async',
        label: 'publishes events',
      });

      // Edge 3: data-flow (cache → service)
      textApi.addEdge({
        fromNode: cacheId,
        toNode: serviceId,
        type: 'data-flow',
        label: 'session data',
      });

      // Step 2: Call textApi.getEdges()
      edges = textApi.getEdges();
    });

    // Step 3: Verify 3 EdgeSummary objects returned
    it('returns 3 EdgeSummary objects', () => {
      expect(edges).toHaveLength(3);
    });

    // Step 4: Verify each has fromNode, toNode, type, label fields
    it('each edge has id field', () => {
      for (const edge of edges) {
        expect(edge.id).toBeDefined();
        expect(typeof edge.id).toBe('string');
        expect(edge.id.length).toBeGreaterThan(0);
      }
    });

    it('each edge has fromNode field', () => {
      for (const edge of edges) {
        expect(edge.fromNode).toBeDefined();
        expect(typeof edge.fromNode).toBe('string');
      }
    });

    it('each edge has toNode field', () => {
      for (const edge of edges) {
        expect(edge.toNode).toBeDefined();
        expect(typeof edge.toNode).toBe('string');
      }
    });

    it('each edge has type field', () => {
      for (const edge of edges) {
        expect(edge.type).toBeDefined();
        expect(typeof edge.type).toBe('string');
      }
    });

    it('each edge has noteCount field', () => {
      for (const edge of edges) {
        expect(typeof edge.noteCount).toBe('number');
      }
    });

    // Step 5: Verify edge types match what was created
    it('contains a sync edge from service to db', () => {
      const syncEdge = edges.find((e) => e.fromNode === serviceId && e.toNode === dbId);
      expect(syncEdge).toBeDefined();
      expect(syncEdge!.type).toBe('sync');
      expect(syncEdge!.label).toBe('SQL queries');
    });

    it('contains an async edge from service to queue', () => {
      const asyncEdge = edges.find((e) => e.fromNode === serviceId && e.toNode === queueId);
      expect(asyncEdge).toBeDefined();
      expect(asyncEdge!.type).toBe('async');
      expect(asyncEdge!.label).toBe('publishes events');
    });

    it('contains a data-flow edge from cache to service', () => {
      const dfEdge = edges.find((e) => e.fromNode === cacheId && e.toNode === serviceId);
      expect(dfEdge).toBeDefined();
      expect(dfEdge!.type).toBe('data-flow');
      expect(dfEdge!.label).toBe('session data');
    });

    it('all three edge types are represented', () => {
      const types = edges.map((e) => e.type);
      expect(types).toContain('sync');
      expect(types).toContain('async');
      expect(types).toContain('data-flow');
    });
  });

  describe('Edge without label', () => {
    it('returns edge with undefined label', () => {
      const graph = createEmptyGraph('No Label Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service A',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Service B',
      });

      textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
      });

      const edges = textApi.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0].label).toBeUndefined();
    });
  });

  describe('Empty architecture', () => {
    it('returns empty array when no edges exist', () => {
      const graph = createEmptyGraph('Empty');
      const textApi = new TextApi(graph, registry);
      expect(textApi.getEdges()).toEqual([]);
    });
  });

  describe('Edge noteCount reflects actual notes', () => {
    it('edge with 2 notes has noteCount=2', () => {
      const graph = createEmptyGraph('Edge Notes Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Frontend',
      });
      const n2 = textApi.addNode({
        type: 'compute/service',
        displayName: 'Backend',
      });

      const edge = textApi.addEdge({
        fromNode: n1.id,
        toNode: n2.id,
        type: 'sync',
        label: 'REST calls',
      });

      textApi.addNote({
        edgeId: edge.id,
        author: 'user',
        content: 'Consider switching to gRPC',
      });
      textApi.addNote({
        edgeId: edge.id,
        author: 'ai',
        content: 'Latency is high here',
      });

      const edges = textApi.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0].noteCount).toBe(2);
    });
  });

  describe('Unique edge IDs', () => {
    it('all edges have unique IDs', () => {
      const graph = createEmptyGraph('Unique ID Test');
      const textApi = new TextApi(graph, registry);

      const n1 = textApi.addNode({ type: 'compute/service', displayName: 'A' });
      const n2 = textApi.addNode({ type: 'compute/service', displayName: 'B' });
      const n3 = textApi.addNode({ type: 'compute/service', displayName: 'C' });

      textApi.addEdge({ fromNode: n1.id, toNode: n2.id, type: 'sync' });
      textApi.addEdge({ fromNode: n2.id, toNode: n3.id, type: 'async' });
      textApi.addEdge({ fromNode: n1.id, toNode: n3.id, type: 'data-flow' });

      const edges = textApi.getEdges();
      const ids = edges.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
