/**
 * Feature #66: Render API includes badge counts on nodes
 *
 * RenderAPI calculates note count and code ref count for each node.
 *
 * Steps verified:
 * 1. Create node with 3 notes, 2 code refs
 * 2. Call renderApi.render() (which calls toCanvasNode internally)
 * 3. Verify CanvasNode data.noteCount equals 3
 * 4. Verify CanvasNode data.codeRefCount equals 2
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import {
  createEmptyGraph,
  createNode,
  createNote,
  addNode,
  addNoteToNode,
  addCodeRef,
} from '@/core/graph/graphEngine';
import type { CanvasNode, CanvasNodeData } from '@/types/canvas';

describe('Feature #66: Render API includes badge counts on nodes', () => {
  let renderApi: RenderApi;

  beforeAll(() => {
    const registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
  });

  describe('Node with 3 notes, 2 code refs', () => {
    let canvasNode: CanvasNode;

    beforeAll(() => {
      // Step 1: Create node with 3 notes, 2 code refs
      let graph = createEmptyGraph('Badge Count Test');

      const node = createNode({
        type: 'compute/service',
        displayName: 'Order Service',
        position: { x: 100, y: 200 },
      });

      graph = addNode(graph, node);

      // Add 3 notes
      const regularNote = createNote({
        author: 'user',
        content: 'This service handles order processing',
        status: 'none',
      });

      const acceptedNote = createNote({
        author: 'ai',
        content: 'Consider adding retry logic',
        status: 'accepted',
        suggestionType: 'improvement',
      });

      const pendingNote = createNote({
        author: 'ai',
        content: 'Add circuit breaker pattern',
        status: 'pending',
        suggestionType: 'architecture',
      });

      graph = addNoteToNode(graph, node.id, regularNote);
      graph = addNoteToNode(graph, node.id, acceptedNote);
      graph = addNoteToNode(graph, node.id, pendingNote);

      // Add 2 code refs
      graph = addCodeRef(graph, node.id, {
        path: 'src/services/order.ts',
        role: 'source',
      });
      graph = addCodeRef(graph, node.id, {
        path: 'src/api/order.spec.ts',
        role: 'test',
      });

      // Step 2: Render the graph
      const result = renderApi.render(graph, []);
      canvasNode = result.nodes[0]!;
    });

    // Step 3: Verify noteCount equals 3 (all notes)
    it('has noteCount equal to 3 (all notes)', () => {
      expect(canvasNode.data.noteCount).toBe(3);
    });

    // Step 4: Verify codeRefCount equals 2
    it('has codeRefCount equal to 2', () => {
      expect(canvasNode.data.codeRefCount).toBe(2);
    });
  });

  describe('Node with no notes or code refs', () => {
    let canvasNode: CanvasNode;

    beforeAll(() => {
      let graph = createEmptyGraph('Empty Counts Test');
      const node = createNode({
        type: 'data/database',
        displayName: 'Users DB',
        position: { x: 0, y: 0 },
      });
      graph = addNode(graph, node);

      const result = renderApi.render(graph, []);
      canvasNode = result.nodes[0]!;
    });

    it('has noteCount equal to 0', () => {
      expect(canvasNode.data.noteCount).toBe(0);
    });

    it('has codeRefCount equal to 0', () => {
      expect(canvasNode.data.codeRefCount).toBe(0);
    });
  });

  describe('Node with multiple notes of various statuses', () => {
    let canvasNode: CanvasNode;

    beforeAll(() => {
      let graph = createEmptyGraph('Multiple Notes Test');
      const node = createNode({
        type: 'messaging/message-queue',
        displayName: 'Event Bus',
        position: { x: 0, y: 0 },
      });
      graph = addNode(graph, node);

      // 5 notes total with various statuses
      graph = addNoteToNode(
        graph,
        node.id,
        createNote({
          author: 'ai',
          content: 'Suggestion 1',
          status: 'pending',
          suggestionType: 'add_node',
        }),
      );
      graph = addNoteToNode(
        graph,
        node.id,
        createNote({
          author: 'ai',
          content: 'Suggestion 2',
          status: 'pending',
          suggestionType: 'add_edge',
        }),
      );
      graph = addNoteToNode(
        graph,
        node.id,
        createNote({
          author: 'ai',
          content: 'Suggestion 3',
          status: 'pending',
          suggestionType: 'modify',
        }),
      );
      graph = addNoteToNode(
        graph,
        node.id,
        createNote({
          author: 'ai',
          content: 'Accepted one',
          status: 'accepted',
          suggestionType: 'add_node',
        }),
      );
      graph = addNoteToNode(
        graph,
        node.id,
        createNote({
          author: 'ai',
          content: 'Dismissed one',
          status: 'dismissed',
          suggestionType: 'modify',
        }),
      );

      const result = renderApi.render(graph, []);
      canvasNode = result.nodes[0]!;
    });

    it('has noteCount equal to 5 (all notes counted)', () => {
      expect(canvasNode.data.noteCount).toBe(5);
    });
  });

  describe('Node with many code refs of different roles', () => {
    let canvasNode: CanvasNode;

    beforeAll(() => {
      let graph = createEmptyGraph('Code Ref Roles Test');
      const node = createNode({
        type: 'compute/service',
        displayName: 'Auth Service',
        position: { x: 0, y: 0 },
      });
      graph = addNode(graph, node);

      // 5 code refs with different roles
      graph = addCodeRef(graph, node.id, { path: 'src/auth.ts', role: 'source' });
      graph = addCodeRef(graph, node.id, { path: 'src/auth.spec.ts', role: 'test' });
      graph = addCodeRef(graph, node.id, { path: 'api/auth.yaml', role: 'api-spec' });
      graph = addCodeRef(graph, node.id, { path: 'schema/auth.sql', role: 'schema' });
      graph = addCodeRef(graph, node.id, { path: 'deploy/auth.yaml', role: 'deployment' });

      const result = renderApi.render(graph, []);
      canvasNode = result.nodes[0]!;
    });

    it('has codeRefCount equal to 5 for all ref roles', () => {
      expect(canvasNode.data.codeRefCount).toBe(5);
    });
  });

  describe('Multiple nodes each with different badge counts', () => {
    let canvasNodes: CanvasNode[];

    beforeAll(() => {
      let graph = createEmptyGraph('Multi-Node Badge Test');

      // Node 1: 2 notes, 1 code ref
      const node1 = createNode({
        type: 'compute/service',
        displayName: 'API Gateway',
        position: { x: 0, y: 0 },
      });
      graph = addNode(graph, node1);
      graph = addNoteToNode(
        graph,
        node1.id,
        createNote({
          author: 'user',
          content: 'Note 1',
          status: 'none',
        }),
      );
      graph = addNoteToNode(
        graph,
        node1.id,
        createNote({
          author: 'user',
          content: 'Note 2',
          status: 'none',
        }),
      );
      graph = addCodeRef(graph, node1.id, { path: 'src/gateway.ts', role: 'source' });

      // Node 2: 1 note, 3 code refs
      const node2 = createNode({
        type: 'data/database',
        displayName: 'Main DB',
        position: { x: 200, y: 0 },
      });
      graph = addNode(graph, node2);
      graph = addNoteToNode(
        graph,
        node2.id,
        createNote({
          author: 'ai',
          content: 'Pending suggestion',
          status: 'pending',
          suggestionType: 'add_node',
        }),
      );
      graph = addCodeRef(graph, node2.id, { path: 'schema/main.sql', role: 'schema' });
      graph = addCodeRef(graph, node2.id, { path: 'src/db.ts', role: 'source' });
      graph = addCodeRef(graph, node2.id, { path: 'test/db.test.ts', role: 'test' });

      // Node 3: 0 notes, 0 code refs
      const node3 = createNode({
        type: 'messaging/message-queue',
        displayName: 'Task Queue',
        position: { x: 400, y: 0 },
      });
      graph = addNode(graph, node3);

      const result = renderApi.render(graph, []);
      canvasNodes = result.nodes;
    });

    it('first node has noteCount=2, codeRefCount=1', () => {
      const gateway = canvasNodes.find((n) => n.data.displayName === 'API Gateway')!;
      expect(gateway.data.noteCount).toBe(2);
      expect(gateway.data.codeRefCount).toBe(1);
    });

    it('second node has noteCount=1, codeRefCount=3', () => {
      const db = canvasNodes.find((n) => n.data.displayName === 'Main DB')!;
      expect(db.data.noteCount).toBe(1);
      expect(db.data.codeRefCount).toBe(3);
    });

    it('third node has noteCount=0, codeRefCount=0', () => {
      const queue = canvasNodes.find((n) => n.data.displayName === 'Task Queue')!;
      expect(queue.data.noteCount).toBe(0);
      expect(queue.data.codeRefCount).toBe(0);
    });
  });

  describe('Badge counts are numbers (type check)', () => {
    let data: CanvasNodeData;

    beforeAll(() => {
      let graph = createEmptyGraph('Type Check Test');
      const node = createNode({
        type: 'compute/service',
        displayName: 'Test Service',
        position: { x: 0, y: 0 },
      });
      graph = addNode(graph, node);

      const result = renderApi.render(graph, []);
      data = result.nodes[0]!.data;
    });

    it('noteCount is a number', () => {
      expect(typeof data.noteCount).toBe('number');
    });

    it('codeRefCount is a number', () => {
      expect(typeof data.codeRefCount).toBe('number');
    });
  });
});
