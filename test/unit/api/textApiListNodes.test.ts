/**
 * Feature #40: Text API listNodes() returns node summaries with counts
 *
 * TextAPI.listNodes() returns an array of NodeSummary objects with child/note/connection counts.
 *
 * Steps verified:
 * 1. Create architecture with 3 nodes, 2 edges, some notes
 * 2. Call textApi.listNodes()
 * 3. Verify 3 NodeSummary objects returned
 * 4. Verify each summary has id, type, displayName
 * 5. Verify connectionCount reflects actual edges
 * 6. Verify noteCount reflects actual notes
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';
import type { NodeSummary } from '@/types/api';

describe('Feature #40: Text API listNodes() returns node summaries with counts', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('Architecture with 3 nodes, 2 edges, some notes', () => {
    let textApi: TextApi;
    let summaries: NodeSummary[];
    let serviceId: string;
    let dbId: string;
    let queueId: string;

    beforeAll(() => {
      // Step 1: Create architecture with 3 nodes, 2 edges, some notes
      const graph = createEmptyGraph('E-Commerce Platform');
      textApi = new TextApi(graph, registry);

      // Add 3 nodes
      const service = textApi.addNode({
        type: 'compute/service',
        displayName: 'Order Service',
        position: { x: 100, y: 200 },
        args: { language: 'TypeScript' },
      });
      serviceId = service.id;

      const db = textApi.addNode({
        type: 'data/database',
        displayName: 'Orders DB',
        position: { x: 400, y: 200 },
        args: { engine: 'PostgreSQL' },
      });
      dbId = db.id;

      const queue = textApi.addNode({
        type: 'messaging/message-queue',
        displayName: 'Order Events',
        position: { x: 250, y: 400 },
      });
      queueId = queue.id;

      // Add 2 edges: service→db (sync), service→queue (async)
      textApi.addEdge({
        fromNode: serviceId,
        toNode: dbId,
        type: 'sync',
        label: 'queries',
      });

      textApi.addEdge({
        fromNode: serviceId,
        toNode: queueId,
        type: 'async',
        label: 'publishes events',
      });

      // Add notes: 2 on service, 1 on db, 0 on queue
      textApi.addNote({
        nodeId: serviceId,
        author: 'user',
        content: 'Needs refactoring for better error handling',
      });
      textApi.addNote({
        nodeId: serviceId,
        author: 'ai',
        content: 'Consider adding retry logic',
      });
      textApi.addNote({
        nodeId: dbId,
        author: 'user',
        content: 'Add read replicas for scaling',
      });

      // Step 2: Call textApi.listNodes()
      summaries = textApi.listNodes();
    });

    // Step 3: Verify 3 NodeSummary objects returned
    it('returns 3 NodeSummary objects', () => {
      expect(summaries).toHaveLength(3);
    });

    // Step 4: Verify each summary has id, type, displayName
    it('each summary has id field', () => {
      for (const summary of summaries) {
        expect(summary.id).toBeDefined();
        expect(typeof summary.id).toBe('string');
        expect(summary.id.length).toBeGreaterThan(0);
      }
    });

    it('each summary has type field', () => {
      for (const summary of summaries) {
        expect(summary.type).toBeDefined();
        expect(typeof summary.type).toBe('string');
      }
    });

    it('each summary has displayName field', () => {
      for (const summary of summaries) {
        expect(summary.displayName).toBeDefined();
        expect(typeof summary.displayName).toBe('string');
      }
    });

    it('summaries include correct types for each node', () => {
      const types = summaries.map((s) => s.type);
      expect(types).toContain('compute/service');
      expect(types).toContain('data/database');
      expect(types).toContain('messaging/message-queue');
    });

    it('summaries include correct display names', () => {
      const names = summaries.map((s) => s.displayName);
      expect(names).toContain('Order Service');
      expect(names).toContain('Orders DB');
      expect(names).toContain('Order Events');
    });

    // Step 5: Verify connectionCount reflects actual edges
    it('Order Service has connectionCount=2 (connected to both DB and Queue)', () => {
      const service = summaries.find((s) => s.displayName === 'Order Service');
      expect(service).toBeDefined();
      expect(service!.connectionCount).toBe(2);
    });

    it('Orders DB has connectionCount=1 (connected to Service)', () => {
      const db = summaries.find((s) => s.displayName === 'Orders DB');
      expect(db).toBeDefined();
      expect(db!.connectionCount).toBe(1);
    });

    it('Order Events has connectionCount=1 (connected to Service)', () => {
      const queue = summaries.find((s) => s.displayName === 'Order Events');
      expect(queue).toBeDefined();
      expect(queue!.connectionCount).toBe(1);
    });

    // Step 6: Verify noteCount reflects actual notes
    it('Order Service has noteCount=2', () => {
      const service = summaries.find((s) => s.displayName === 'Order Service');
      expect(service!.noteCount).toBe(2);
    });

    it('Orders DB has noteCount=1', () => {
      const db = summaries.find((s) => s.displayName === 'Orders DB');
      expect(db!.noteCount).toBe(1);
    });

    it('Order Events has noteCount=0', () => {
      const queue = summaries.find((s) => s.displayName === 'Order Events');
      expect(queue!.noteCount).toBe(0);
    });
  });

  describe('Empty architecture', () => {
    it('returns empty array for empty graph', () => {
      const graph = createEmptyGraph('Empty');
      const textApi = new TextApi(graph, registry);
      expect(textApi.listNodes()).toEqual([]);
    });
  });

  describe('NodeSummary includes childCount', () => {
    it('parent node childCount reflects actual children', () => {
      const graph = createEmptyGraph('Nested Test');
      const textApi = new TextApi(graph, registry);

      const parent = textApi.addNode({
        type: 'compute/service',
        displayName: 'Parent Service',
      });

      textApi.addNode({
        type: 'compute/function',
        displayName: 'Child Function 1',
        parentId: parent.id,
      });

      textApi.addNode({
        type: 'compute/function',
        displayName: 'Child Function 2',
        parentId: parent.id,
      });

      const summaries = textApi.listNodes();
      const parentSummary = summaries.find((s) => s.displayName === 'Parent Service');
      expect(parentSummary).toBeDefined();
      expect(parentSummary!.childCount).toBe(2);
    });

    it('leaf node has childCount=0', () => {
      const graph = createEmptyGraph('Leaf Test');
      const textApi = new TextApi(graph, registry);

      textApi.addNode({
        type: 'data/database',
        displayName: 'Standalone DB',
      });

      const summaries = textApi.listNodes();
      expect(summaries[0].childCount).toBe(0);
    });
  });

  describe('Isolated node with no edges or notes', () => {
    it('has connectionCount=0 and noteCount=0', () => {
      const graph = createEmptyGraph('Isolated Test');
      const textApi = new TextApi(graph, registry);

      textApi.addNode({
        type: 'data/cache',
        displayName: 'Session Cache',
      });

      const summaries = textApi.listNodes();
      expect(summaries).toHaveLength(1);
      expect(summaries[0].connectionCount).toBe(0);
      expect(summaries[0].noteCount).toBe(0);
    });
  });
});
