/**
 * Tests for Feature #37: New action after undo discards redo future.
 * Performing a new mutation after undo clears the redo stack (branch behavior).
 *
 * Steps:
 * 1. Add node A, add node B, undo (B removed)
 * 2. Verify redo is available (canRedo = true)
 * 3. Add node C (new action while redo is available)
 * 4. Verify canRedo is now false
 * 5. Verify architecture has nodes A and C (not B)
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

describe('Feature #37: New action after undo discards redo future', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    undoManager = new UndoManager();
    graph = createEmptyGraph('Test Architecture');
    undoManager.snapshot('Initial', graph);
  });

  it('follows exact feature steps: add A, add B, undo, add C → redo discarded', () => {
    // Step 1a: Add node A
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add node A', graph);

    // Step 1b: Add node B
    const nodeB = createNode({ type: 'data/database', displayName: 'B' });
    graph = addNode(graph, nodeB);
    undoManager.snapshot('Add node B', graph);

    // Verify: graph has A and B
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].displayName).toBe('A');
    expect(graph.nodes[1].displayName).toBe('B');

    // Step 1c: Undo (B removed)
    const undoneGraph = undoManager.undo()!;
    expect(undoneGraph).toBeDefined();
    expect(undoneGraph.nodes).toHaveLength(1);
    expect(undoneGraph.nodes[0].displayName).toBe('A');

    // Step 2: Verify redo is available (canRedo = true)
    expect(undoManager.canRedo).toBe(true);

    // Step 3: Add node C (new action while redo is available)
    const nodeC = createNode({ type: 'data/cache', displayName: 'C' });
    const branchedGraph = addNode(undoneGraph, nodeC);
    undoManager.snapshot('Add node C', branchedGraph);

    // Step 4: Verify canRedo is now false
    expect(undoManager.canRedo).toBe(false);
    expect(undoManager.redo()).toBeUndefined();

    // Step 5: Verify architecture has nodes A and C (not B)
    expect(branchedGraph.nodes).toHaveLength(2);
    const nodeNames = branchedGraph.nodes.map((n) => n.displayName);
    expect(nodeNames).toContain('A');
    expect(nodeNames).toContain('C');
    expect(nodeNames).not.toContain('B');
  });

  it('redo future discarded after undo + removeNode', () => {
    // Add A, B, C
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add A', graph);

    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    graph = addNode(graph, nodeB);
    undoManager.snapshot('Add B', graph);

    const nodeC = createNode({ type: 'data/database', displayName: 'C' });
    graph = addNode(graph, nodeC);
    undoManager.snapshot('Add C', graph);

    // Undo twice: back to just A
    undoManager.undo(); // removes C
    const afterUndo = undoManager.undo()!; // removes B
    expect(afterUndo.nodes).toHaveLength(1);
    expect(afterUndo.nodes[0].displayName).toBe('A');
    expect(undoManager.canRedo).toBe(true);

    // New action: remove A
    const afterRemove = removeNode(afterUndo, nodeA.id);
    undoManager.snapshot('Remove A', afterRemove);

    // Redo future discarded
    expect(undoManager.canRedo).toBe(false);
    expect(afterRemove.nodes).toHaveLength(0);
  });

  it('redo future discarded after undo + updateNode', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add A', graph);

    graph = updateNode(graph, nodeA.id, { displayName: 'A-Updated' });
    undoManager.snapshot('Update A', graph);

    // Undo the update
    const afterUndo = undoManager.undo()!;
    expect(afterUndo.nodes[0].displayName).toBe('A');
    expect(undoManager.canRedo).toBe(true);

    // New action: update A to something different
    const afterNewUpdate = updateNode(afterUndo, nodeA.id, { displayName: 'A-Branched' });
    undoManager.snapshot('Branch update A', afterNewUpdate);

    // Redo future discarded
    expect(undoManager.canRedo).toBe(false);
    // The update to 'A-Updated' is gone; current is 'A-Branched'
    expect(afterNewUpdate.nodes[0].displayName).toBe('A-Branched');
  });

  it('redo future discarded after undo + addEdge', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    const nodeB = createNode({ type: 'data/database', displayName: 'B' });
    graph = addNode(addNode(graph, nodeA), nodeB);
    undoManager.snapshot('Two nodes', graph);

    const edge1 = createEdge({
      fromNode: nodeA.id,
      toNode: nodeB.id,
      type: 'sync',
      label: 'original',
    });
    graph = addEdge(graph, edge1);
    undoManager.snapshot('Add original edge', graph);

    // Undo the edge
    const afterUndo = undoManager.undo()!;
    expect(afterUndo.edges).toHaveLength(0);
    expect(undoManager.canRedo).toBe(true);

    // New action: add a different edge
    const edge2 = createEdge({
      fromNode: nodeB.id,
      toNode: nodeA.id,
      type: 'async',
      label: 'branched',
    });
    const branchedGraph = addEdge(afterUndo, edge2);
    undoManager.snapshot('Add branched edge', branchedGraph);

    // Redo future discarded
    expect(undoManager.canRedo).toBe(false);
    expect(branchedGraph.edges).toHaveLength(1);
    expect(branchedGraph.edges[0].label).toBe('branched');
    expect(branchedGraph.edges[0].type).toBe('async');
  });

  it('multiple undos + new action discards entire redo stack', () => {
    // Create a long history: empty → A → A,B → A,B,C → A,B,C,D
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add A', graph);

    const nodeB = createNode({ type: 'compute/service', displayName: 'B' });
    graph = addNode(graph, nodeB);
    undoManager.snapshot('Add B', graph);

    const nodeC = createNode({ type: 'data/database', displayName: 'C' });
    graph = addNode(graph, nodeC);
    undoManager.snapshot('Add C', graph);

    const nodeD = createNode({ type: 'data/cache', displayName: 'D' });
    graph = addNode(graph, nodeD);
    undoManager.snapshot('Add D', graph);

    // Undo 3 times: back to just A
    undoManager.undo(); // removes D → A,B,C
    undoManager.undo(); // removes C → A,B
    const afterUndo = undoManager.undo()!; // removes B → A
    expect(afterUndo.nodes).toHaveLength(1);
    expect(afterUndo.nodes[0].displayName).toBe('A');
    expect(undoManager.canRedo).toBe(true);

    // New action: add E
    const nodeE = createNode({ type: 'messaging/message-queue', displayName: 'E' });
    const branchedGraph = addNode(afterUndo, nodeE);
    undoManager.snapshot('Add E (branch)', branchedGraph);

    // Entire redo stack (B, C, D) is discarded
    expect(undoManager.canRedo).toBe(false);
    expect(branchedGraph.nodes).toHaveLength(2);
    const names = branchedGraph.nodes.map((n) => n.displayName);
    expect(names).toContain('A');
    expect(names).toContain('E');
    expect(names).not.toContain('B');
    expect(names).not.toContain('C');
    expect(names).not.toContain('D');
  });

  it('canRedo transitions: false → true (after undo) → false (after new action)', () => {
    // Initially no redo
    expect(undoManager.canRedo).toBe(false);

    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add A', graph);

    // Still no redo (at tip)
    expect(undoManager.canRedo).toBe(false);

    // Undo → redo available
    undoManager.undo();
    expect(undoManager.canRedo).toBe(true);

    // New action → redo no longer available
    const nodeZ = createNode({ type: 'compute/service', displayName: 'Z' });
    const branchedGraph = addNode(graph, nodeZ);
    undoManager.snapshot('Branch with Z', branchedGraph);
    expect(undoManager.canRedo).toBe(false);
  });

  it('history length is trimmed after branching', () => {
    const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
    graph = addNode(graph, nodeA);
    undoManager.snapshot('Add A', graph);

    const nodeB = createNode({ type: 'data/database', displayName: 'B' });
    graph = addNode(graph, nodeB);
    undoManager.snapshot('Add B', graph);

    // History: [Initial, Add A, Add B] → length 3
    expect(undoManager.historyLength).toBe(3);

    // Undo once
    undoManager.undo();
    // History still has 3 entries, but index is at 1
    expect(undoManager.historyLength).toBe(3);

    // New action: branch
    const nodeC = createNode({ type: 'data/cache', displayName: 'C' });
    const branchedGraph = addNode(graph, nodeC);
    undoManager.snapshot('Add C (branch)', branchedGraph);

    // History trimmed: [Initial, Add A, Add C] → length 3 (Add B discarded)
    expect(undoManager.historyLength).toBe(3);
    expect(undoManager.canRedo).toBe(false);

    // Can still undo through the new branch
    expect(undoManager.canUndo).toBe(true);
    const undoneOnce = undoManager.undo()!;
    expect(undoneOnce.nodes).toHaveLength(1);
    expect(undoneOnce.nodes[0].displayName).toBe('A');
  });
});
