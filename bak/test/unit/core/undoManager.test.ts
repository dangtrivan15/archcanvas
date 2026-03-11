/**
 * Tests for UndoManager: verifies that undo() reverts last graph mutation.
 * Feature #34: Undo reverts last graph mutation
 *
 * Steps:
 * 1. Create architecture with 1 node
 * 2. Add a second node
 * 3. Verify architecture has 2 nodes
 * 4. Call undo()
 * 5. Verify architecture has 1 node again
 * 6. Verify the original node is still present
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

describe('UndoManager - undo reverts last graph mutation', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    undoManager = new UndoManager();
    graph = createEmptyGraph('Test Architecture');
  });

  describe('Feature #34 verification steps', () => {
    it('should revert addNode: from 2 nodes back to 1 node', () => {
      // Step 1: Create architecture with 1 node
      const node1 = createNode({ type: 'compute/service', displayName: 'Service A' });
      graph = addNode(graph, node1);

      // Take snapshot of state with 1 node
      undoManager.snapshot('Add first node', graph);

      // Step 2: Add a second node
      const node2 = createNode({ type: 'compute/service', displayName: 'Service B' });
      graph = addNode(graph, node2);

      // Take snapshot of state with 2 nodes
      undoManager.snapshot('Add second node', graph);

      // Step 3: Verify architecture has 2 nodes
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes[0].displayName).toBe('Service A');
      expect(graph.nodes[1].displayName).toBe('Service B');

      // Step 4: Call undo()
      const restoredGraph = undoManager.undo();

      // Step 5: Verify architecture has 1 node again
      expect(restoredGraph).toBeDefined();
      expect(restoredGraph!.nodes).toHaveLength(1);

      // Step 6: Verify the original node is still present
      expect(restoredGraph!.nodes[0].displayName).toBe('Service A');
      expect(restoredGraph!.nodes[0].id).toBe(node1.id);
      expect(restoredGraph!.nodes[0].type).toBe('compute/service');
    });

    it('should preserve all properties of the original node after undo', () => {
      const node1 = createNode({
        type: 'data/database',
        displayName: 'Primary DB',
        args: { engine: 'postgres', version: '15' },
        position: { x: 100, y: 200, width: 240, height: 120 },
      });
      graph = addNode(graph, node1);
      undoManager.snapshot('Add primary DB', graph);

      const node2 = createNode({ type: 'data/cache', displayName: 'Redis Cache' });
      graph = addNode(graph, node2);
      undoManager.snapshot('Add cache', graph);

      // Undo - should return to single-node state
      const restored = undoManager.undo();
      expect(restored).toBeDefined();
      expect(restored!.nodes).toHaveLength(1);

      const restoredNode = restored!.nodes[0];
      expect(restoredNode.displayName).toBe('Primary DB');
      expect(restoredNode.type).toBe('data/database');
      expect(restoredNode.args).toEqual({ engine: 'postgres', version: '15' });
      expect(restoredNode.position.x).toBe(100);
      expect(restoredNode.position.y).toBe(200);
    });
  });

  describe('UndoManager core behavior', () => {
    it('should return undefined when nothing to undo', () => {
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.undo()).toBeUndefined();
    });

    it('should not undo past the initial state', () => {
      undoManager.snapshot('Initial', graph);

      const node1 = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node1);
      undoManager.snapshot('Add A', graph);

      // First undo - restores to initial (0 nodes)
      const restored = undoManager.undo();
      expect(restored).toBeDefined();
      expect(restored!.nodes).toHaveLength(0);

      // Second undo - nothing left
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.undo()).toBeUndefined();
    });

    it('should track canUndo/canRedo correctly', () => {
      // Initial: no undo possible
      undoManager.snapshot('Initial', graph);
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(false);

      // After adding node: undo possible
      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);
      expect(undoManager.canUndo).toBe(true);
      expect(undoManager.canRedo).toBe(false);

      // After undo: redo possible
      undoManager.undo();
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(true);
    });

    it('should produce independent snapshots (deep clone)', () => {
      const node1 = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, node1);
      undoManager.snapshot('State 1', graph);

      const node2 = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(graph, node2);
      undoManager.snapshot('State 2', graph);

      // Undo
      const restored = undoManager.undo();

      // Modifying restored should NOT affect the snapshot
      restored!.nodes.push(createNode({ type: 'compute/worker', displayName: 'Intruder' }));

      // Redo should still return clean state with 2 nodes
      const redone = undoManager.redo();
      expect(redone!.nodes).toHaveLength(2);
    });
  });

  describe('Undo reverts different mutation types', () => {
    it('should revert addEdge mutation', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);

      undoManager.snapshot('Before edge', graph);

      const edge = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync' });
      graph = addEdge(graph, edge);
      undoManager.snapshot('Add edge', graph);

      expect(graph.edges).toHaveLength(1);

      const restored = undoManager.undo();
      expect(restored).toBeDefined();
      expect(restored!.edges).toHaveLength(0);
      expect(restored!.nodes).toHaveLength(2); // nodes unaffected
    });

    it('should revert removeNode mutation', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'DB' });
      graph = addNode(addNode(graph, nodeA), nodeB);

      undoManager.snapshot('Before remove', graph);

      graph = removeNode(graph, nodeB.id);
      undoManager.snapshot('Remove DB', graph);

      expect(graph.nodes).toHaveLength(1);

      const restored = undoManager.undo();
      expect(restored!.nodes).toHaveLength(2);
      expect(restored!.nodes.find((n) => n.id === nodeB.id)).toBeDefined();
      expect(restored!.nodes.find((n) => n.id === nodeB.id)!.displayName).toBe('DB');
    });

    it('should revert updateNode mutation', () => {
      const node = createNode({ type: 'compute/service', displayName: 'Original Name' });
      graph = addNode(graph, node);

      undoManager.snapshot('Before update', graph);

      graph = updateNode(graph, node.id, { displayName: 'Updated Name' });
      undoManager.snapshot('Update name', graph);

      expect(graph.nodes[0].displayName).toBe('Updated Name');

      const restored = undoManager.undo();
      expect(restored!.nodes[0].displayName).toBe('Original Name');
    });
  });

  describe('Multi-step undo', () => {
    it('should undo multiple steps sequentially', () => {
      // Initial empty state
      undoManager.snapshot('Initial', graph);

      // Add node A
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      // Add node B
      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(graph, nodeB);
      undoManager.snapshot('Add B', graph);

      // Add node C
      const nodeC = createNode({ type: 'compute/service', displayName: 'C' });
      graph = addNode(graph, nodeC);
      undoManager.snapshot('Add C', graph);

      // 3 nodes
      expect(graph.nodes).toHaveLength(3);

      // Undo 1: back to 2 nodes (A, B)
      let restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(2);
      expect(restored.nodes.map((n) => n.displayName)).toEqual(['A', 'B']);

      // Undo 2: back to 1 node (A)
      restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(1);
      expect(restored.nodes[0].displayName).toBe('A');

      // Undo 3: back to empty
      restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(0);

      // No more undo
      expect(undoManager.canUndo).toBe(false);
    });

    it('should undo then redo correctly', () => {
      undoManager.snapshot('Initial', graph);

      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      // Undo
      undoManager.undo();
      expect(undoManager.canRedo).toBe(true);

      // Redo
      const redone = undoManager.redo()!;
      expect(redone.nodes).toHaveLength(1);
      expect(redone.nodes[0].displayName).toBe('A');
    });

    it('should discard redo future on new action after undo (branch behavior)', () => {
      undoManager.snapshot('Initial', graph);

      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      graph = addNode(graph, nodeA);
      undoManager.snapshot('Add A', graph);

      const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
      graph = addNode(graph, nodeB);
      undoManager.snapshot('Add B', graph);

      // Undo to just A
      const restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(1);
      expect(undoManager.canRedo).toBe(true);

      // Now make a new action (different path) - should discard redo of B
      const nodeC = createNode({ type: 'data/database', displayName: 'C' });
      const newGraph = addNode(restored, nodeC);
      undoManager.snapshot('Add C', newGraph);

      // Redo should no longer be possible (branch discarded)
      expect(undoManager.canRedo).toBe(false);

      // Undo should go back to A (not to B)
      const backToA = undoManager.undo()!;
      expect(backToA.nodes).toHaveLength(1);
      expect(backToA.nodes[0].displayName).toBe('A');
    });
  });

  describe('History tracking', () => {
    it('should track history length correctly', () => {
      expect(undoManager.historyLength).toBe(0);

      undoManager.snapshot('Initial', graph);
      expect(undoManager.historyLength).toBe(1);

      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);
      expect(undoManager.historyLength).toBe(2);
    });

    it('should return entry descriptions', () => {
      undoManager.snapshot('Initial state', graph);
      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add service A', graph);

      expect(undoManager.getDescriptions()).toEqual(['Initial state', 'Add service A']);
    });

    it('should enforce max entries limit', () => {
      const smallUndo = new UndoManager(5);

      for (let i = 0; i < 10; i++) {
        graph = addNode(graph, createNode({ type: 'compute/service', displayName: `Node ${i}` }));
        smallUndo.snapshot(`Add node ${i}`, graph);
      }

      // Should be capped at 5
      expect(smallUndo.historyLength).toBe(5);
    });

    it('should clear all history', () => {
      undoManager.snapshot('Initial', graph);
      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);

      undoManager.clear();
      expect(undoManager.historyLength).toBe(0);
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(false);
    });
  });

  describe('Graph name and metadata preserved', () => {
    it('should preserve graph name through undo', () => {
      graph = { ...graph, name: 'My Architecture' };
      undoManager.snapshot('Initial', graph);

      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);

      const restored = undoManager.undo()!;
      expect(restored.name).toBe('My Architecture');
      expect(restored.description).toBe('');
      expect(restored.nodes).toHaveLength(0);
    });

    it('should preserve edges through undo of node addition', () => {
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);
      const edge = createEdge({
        fromNode: nodeA.id,
        toNode: nodeB.id,
        type: 'sync',
        label: 'reads',
      });
      graph = addEdge(graph, edge);

      // Snapshot with A, B, and edge
      undoManager.snapshot('With edge', graph);

      // Add node C
      const nodeC = createNode({ type: 'data/cache', displayName: 'C' });
      graph = addNode(graph, nodeC);
      undoManager.snapshot('Add C', graph);

      // Undo adding C
      const restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(2);
      expect(restored.edges).toHaveLength(1);
      expect(restored.edges[0].label).toBe('reads');
    });
  });
});
