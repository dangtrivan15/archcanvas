/**
 * Tests for UndoManager redo: verifies that redo() re-applies undone mutations.
 * Feature #35: Redo restores undone mutation
 *
 * Steps:
 * 1. Create architecture, add a node, then undo
 * 2. Verify architecture has 0 nodes (after undo)
 * 3. Call redo()
 * 4. Verify architecture has 1 node again
 * 5. Verify the re-added node has same properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager } from '@/core/history/undoManager';
import {
  createEmptyGraph,
  createNode,
  addNode,
  addEdge,
  createEdge,
  removeNode,
  updateNode,
} from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';

describe('UndoManager - redo restores undone mutation', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    undoManager = new UndoManager();
    graph = createEmptyGraph('Test Architecture');
  });

  describe('Feature #35 verification steps', () => {
    it('should redo a previously undone addNode', () => {
      // Step 1: Create architecture, add a node, then undo
      undoManager.snapshot('Initial', graph);

      const node = createNode({
        type: 'compute/service',
        displayName: 'My Service',
        args: { language: 'TypeScript', framework: 'Express' },
        position: { x: 150, y: 250, width: 240, height: 120 },
      });
      graph = addNode(graph, node);
      undoManager.snapshot('Add My Service', graph);

      // Undo the addNode
      const undoneGraph = undoManager.undo()!;

      // Step 2: Verify architecture has 0 nodes (after undo)
      expect(undoneGraph.nodes).toHaveLength(0);

      // Step 3: Call redo()
      const redoneGraph = undoManager.redo()!;

      // Step 4: Verify architecture has 1 node again
      expect(redoneGraph).toBeDefined();
      expect(redoneGraph.nodes).toHaveLength(1);

      // Step 5: Verify the re-added node has same properties
      const redoneNode = redoneGraph.nodes[0];
      expect(redoneNode.id).toBe(node.id);
      expect(redoneNode.type).toBe('compute/service');
      expect(redoneNode.displayName).toBe('My Service');
      expect(redoneNode.args).toEqual({ language: 'TypeScript', framework: 'Express' });
      expect(redoneNode.position.x).toBe(150);
      expect(redoneNode.position.y).toBe(250);
      expect(redoneNode.position.width).toBe(240);
      expect(redoneNode.position.height).toBe(120);
    });

    it('should redo preserves all node metadata', () => {
      undoManager.snapshot('Initial', graph);

      const node = createNode({
        type: 'data/database',
        displayName: 'Primary DB',
        args: { engine: 'postgres', version: '15', replicas: 3 },
        position: { x: 300, y: 100, width: 260, height: 140 },
      });
      graph = addNode(graph, node);
      undoManager.snapshot('Add Primary DB', graph);

      // Undo then redo
      undoManager.undo();
      const redoneGraph = undoManager.redo()!;

      const restoredNode = redoneGraph.nodes[0];
      expect(restoredNode.id).toBe(node.id);
      expect(restoredNode.type).toBe('data/database');
      expect(restoredNode.displayName).toBe('Primary DB');
      expect(restoredNode.args.engine).toBe('postgres');
      expect(restoredNode.args.version).toBe('15');
      expect(restoredNode.args.replicas).toBe(3);
      expect(restoredNode.codeRefs).toEqual([]);
      expect(restoredNode.notes).toEqual([]);
      expect(restoredNode.children).toEqual([]);
    });
  });

  describe('Redo behavior', () => {
    it('should return undefined when nothing to redo', () => {
      expect(undoManager.canRedo).toBe(false);
      expect(undoManager.redo()).toBeUndefined();
    });

    it('should not redo when no undo was done', () => {
      undoManager.snapshot('Initial', graph);
      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);

      // No undo, so redo should not be available
      expect(undoManager.canRedo).toBe(false);
      expect(undoManager.redo()).toBeUndefined();
    });

    it('should redo addEdge after undo', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);
      undoManager.snapshot('Two nodes', graph);

      const edge = createEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
        label: 'queries',
      });
      graph = addEdge(graph, edge);
      undoManager.snapshot('Add edge', graph);

      // Undo edge addition
      const afterUndo = undoManager.undo()!;
      expect(afterUndo.edges).toHaveLength(0);

      // Redo edge addition
      const afterRedo = undoManager.redo()!;
      expect(afterRedo.edges).toHaveLength(1);
      expect(afterRedo.edges[0].id).toBe(edge.id);
      expect(afterRedo.edges[0].label).toBe('queries');
      expect(afterRedo.edges[0].fromNode).toBe(nodeA.id);
      expect(afterRedo.edges[0].toNode).toBe(nodeB.id);
    });

    it('should redo removeNode after undo', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);
      undoManager.snapshot('Two nodes', graph);

      graph = removeNode(graph, nodeB.id);
      undoManager.snapshot('Remove B', graph);

      // Undo removal (B comes back)
      const afterUndo = undoManager.undo()!;
      expect(afterUndo.nodes).toHaveLength(2);

      // Redo removal (B removed again)
      const afterRedo = undoManager.redo()!;
      expect(afterRedo.nodes).toHaveLength(1);
      expect(afterRedo.nodes[0].displayName).toBe('A');
    });

    it('should redo updateNode after undo', () => {
      const node = createNode({ type: 'compute/service', displayName: 'Original' });
      graph = addNode(graph, node);
      undoManager.snapshot('Before update', graph);

      graph = updateNode(graph, node.id, { displayName: 'Updated' });
      undoManager.snapshot('Update name', graph);

      // Undo update
      const afterUndo = undoManager.undo()!;
      expect(afterUndo.nodes[0].displayName).toBe('Original');

      // Redo update
      const afterRedo = undoManager.redo()!;
      expect(afterRedo.nodes[0].displayName).toBe('Updated');
    });
  });

  describe('Multiple undo/redo cycles', () => {
    it('should handle undo-redo-undo-redo pattern', () => {
      undoManager.snapshot('Initial', graph);

      const node = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node);
      undoManager.snapshot('Add A', graph);

      // Undo
      let current = undoManager.undo()!;
      expect(current.nodes).toHaveLength(0);

      // Redo
      current = undoManager.redo()!;
      expect(current.nodes).toHaveLength(1);

      // Undo again
      current = undoManager.undo()!;
      expect(current.nodes).toHaveLength(0);

      // Redo again
      current = undoManager.redo()!;
      expect(current.nodes).toHaveLength(1);
      expect(current.nodes[0].displayName).toBe('A');
    });

    it('should redo multiple steps', () => {
      undoManager.snapshot('Initial', graph);

      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(graph, nodeB);
      undoManager.snapshot('Add B', graph);

      const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
      graph = addNode(graph, nodeC);
      undoManager.snapshot('Add C', graph);

      // Undo 3 times back to empty
      undoManager.undo(); // 2 nodes
      undoManager.undo(); // 1 node
      undoManager.undo(); // 0 nodes

      // Redo all 3
      let state = undoManager.redo()!;
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].displayName).toBe('A');

      state = undoManager.redo()!;
      expect(state.nodes).toHaveLength(2);

      state = undoManager.redo()!;
      expect(state.nodes).toHaveLength(3);
      expect(state.nodes.map((n) => n.displayName)).toEqual(['A', 'B', 'C']);

      // No more redo
      expect(undoManager.canRedo).toBe(false);
    });

    it('should discard redo future when new action taken after undo', () => {
      undoManager.snapshot('Initial', graph);

      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      // Undo
      const afterUndo = undoManager.undo()!;
      expect(undoManager.canRedo).toBe(true);

      // New action (diverge from timeline)
      const nodeX = createNode({ type: 'data/cache', displayName: 'X' });
      const divergedGraph = addNode(afterUndo, nodeX);
      undoManager.snapshot('Add X (branched)', divergedGraph);

      // Redo is no longer possible (A was discarded)
      expect(undoManager.canRedo).toBe(false);
      expect(undoManager.redo()).toBeUndefined();

      // Undo goes back to empty (not to A)
      const backToEmpty = undoManager.undo()!;
      expect(backToEmpty.nodes).toHaveLength(0);
    });

    it('should produce deep clones on redo (independent snapshots)', () => {
      undoManager.snapshot('Initial', graph);

      const node = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node);
      undoManager.snapshot('Add A', graph);

      // Undo
      undoManager.undo();

      // Redo
      const redone1 = undoManager.redo()!;

      // Undo again
      undoManager.undo();

      // Mutate the first redo result
      redone1.nodes.push(createNode({ type: 'compute/worker', displayName: 'Intruder' }));

      // Redo again - should be clean, not affected by mutation
      const redone2 = undoManager.redo()!;
      expect(redone2.nodes).toHaveLength(1);
      expect(redone2.nodes[0].displayName).toBe('A');
    });
  });

  describe('Redo with graph metadata', () => {
    it('should preserve graph name and description through redo', () => {
      graph = { ...graph, name: 'My App', description: 'Microservices architecture' };
      undoManager.snapshot('Initial', graph);

      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'Gateway' }));
      undoManager.snapshot('Add Gateway', graph);

      // Undo then redo
      undoManager.undo();
      const redone = undoManager.redo()!;

      expect(redone.name).toBe('My App');
      expect(redone.description).toBe('Microservices architecture');
      expect(redone.nodes).toHaveLength(1);
      expect(redone.nodes[0].displayName).toBe('Gateway');
    });

    it('should preserve edges through redo of node additions', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);
      const edge = createEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'async',
        label: 'publishes',
      });
      graph = addEdge(graph, edge);
      undoManager.snapshot('Base with edge', graph);

      const nodeC = createNode({ type: 'data/cache', displayName: 'C' });
      graph = addNode(graph, nodeC);
      undoManager.snapshot('Add C', graph);

      // Undo, redo
      undoManager.undo();
      const redone = undoManager.redo()!;

      expect(redone.nodes).toHaveLength(3);
      expect(redone.edges).toHaveLength(1);
      expect(redone.edges[0].label).toBe('publishes');
      expect(redone.edges[0].type).toBe('async');
    });
  });
});
