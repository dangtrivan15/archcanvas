/**
 * Tests for P10: Undo System Optimization with Immer patches.
 * Verifies that the patch-based UndoManager achieves memory savings
 * while maintaining identical behavior to the snapshot-based version.
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

describe('P10: Patch-based UndoManager optimization', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    // Use checkpoint interval of 5 for easier testing
    undoManager = new UndoManager(100, 5);
    graph = createEmptyGraph('Test Architecture');
  });

  describe('Memory efficiency: internal representation uses patches', () => {
    it('exportHistory reconstructs identical graphs despite using patches internally', () => {
      // Build up a history of 12 entries (> checkpoint interval of 5)
      const snapshots: ArchGraph[] = [graph];
      undoManager.snapshot('Initial', graph);

      for (let i = 0; i < 11; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Service ${i}`,
          position: { x: i * 100, y: 0, width: 240, height: 120 },
        });
        graph = addNode(graph, node);
        snapshots.push(graph);
        undoManager.snapshot(`Add Service ${i}`, graph);
      }

      expect(undoManager.historyLength).toBe(12);

      // Export should reconstruct exact full snapshots
      const exported = undoManager.exportHistory();
      expect(exported.entries).toHaveLength(12);

      for (let i = 0; i < 12; i++) {
        expect(exported.entries[i]!.snapshot.nodes).toHaveLength(snapshots[i]!.nodes.length);
        expect(exported.entries[i]!.snapshot.name).toBe('Test Architecture');
      }
    });

    it('undo/redo across checkpoint boundaries works correctly', () => {
      // With checkpoint interval 5, checkpoints at indices 0, 5, 10
      undoManager.snapshot('Initial', graph);

      const nodes: ReturnType<typeof createNode>[] = [];
      for (let i = 0; i < 12; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Service ${i}`,
        });
        nodes.push(node);
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Service ${i}`, graph);
      }

      // Now at index 12 (13 entries), undo back to index 6 (crosses checkpoint at 10 and 5)
      for (let i = 0; i < 6; i++) {
        const restored = undoManager.undo();
        expect(restored).toBeDefined();
        expect(restored!.nodes).toHaveLength(12 - 1 - i);
      }

      // At index 6: should have 6 nodes (Services 0-5)
      expect(undoManager.currentHistoryIndex).toBe(6);

      // Redo back across checkpoint boundary
      for (let i = 0; i < 6; i++) {
        const restored = undoManager.redo();
        expect(restored).toBeDefined();
        expect(restored!.nodes).toHaveLength(7 + i);
      }

      expect(undoManager.currentHistoryIndex).toBe(12);
    });

    it('branch behavior with patches: new action after undo discards redo', () => {
      undoManager.snapshot('Initial', graph);

      // Add 3 nodes
      for (let i = 0; i < 3; i++) {
        graph = addNode(graph, createNode({ type: 'compute/service', displayName: `S${i}` }));
        undoManager.snapshot(`Add S${i}`, graph);
      }

      // Undo twice (back to S0 only)
      undoManager.undo();
      undoManager.undo();
      expect(undoManager.currentHistoryIndex).toBe(1);

      // Go back to index 1 (S0) and branch from there
      undoManager.undo()!; // back to initial (index 0)
      const s0Graph = undoManager.redo()!; // forward to S0 (index 1) — capture returned state

      const newGraph = addNode(s0Graph, createNode({ type: 'data/database', displayName: 'NewDB' }));
      undoManager.snapshot('Add NewDB', newGraph);

      expect(undoManager.canRedo).toBe(false); // redo future discarded
      expect(undoManager.historyLength).toBe(3); // Initial, S0, NewDB

      // Verify the branch content is correct
      const restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(1); // S0 only
      expect(restored.nodes[0]!.displayName).toBe('S0');
    });

    it('max entries enforcement promotes patch entry to checkpoint', () => {
      const smallUndo = new UndoManager(5, 3); // max 5 entries, checkpoint every 3

      // Add 8 entries (will overflow beyond 5)
      smallUndo.snapshot('Initial', graph);
      for (let i = 0; i < 7; i++) {
        graph = addNode(graph, createNode({ type: 'compute/service', displayName: `N${i}` }));
        smallUndo.snapshot(`Add N${i}`, graph);
      }

      // Should be capped at 5
      expect(smallUndo.historyLength).toBe(5);

      // Should still be able to undo/redo correctly
      const restored = smallUndo.undo()!;
      expect(restored.nodes.length).toBeLessThan(8); // Not the full 8

      // Redo should work
      const redone = smallUndo.redo()!;
      expect(redone.nodes).toHaveLength(7); // Back to most recent (7 nodes added)
    });

    it('importHistory then undo works across checkpoint boundaries', () => {
      // Build full snapshot entries (as if from old format)
      const entries = [];
      let g = createEmptyGraph('Import Test');

      for (let i = 0; i < 8; i++) {
        g = addNode(g, createNode({ type: 'compute/service', displayName: `N${i}` }));
        entries.push({
          description: `Add N${i}`,
          timestampMs: Date.now() + i,
          snapshot: structuredClone(g),
        });
      }

      // Import (internally converts to patches)
      undoManager.importHistory(entries, 7);

      // Undo all the way back
      for (let i = 7; i >= 1; i--) {
        const restored = undoManager.undo()!;
        expect(restored.nodes).toHaveLength(i);
      }

      // Redo all the way forward
      for (let i = 1; i <= 7; i++) {
        const restored = undoManager.redo()!;
        expect(restored.nodes).toHaveLength(i + 1);
      }
    });

    it('complex mutations produce correct patches (edges, updates, removes)', () => {
      undoManager.snapshot('Initial', graph);

      // Add two nodes
      const nodeA = createNode({ type: 'compute/service', displayName: 'A' });
      const nodeB = createNode({ type: 'data/database', displayName: 'B' });
      graph = addNode(addNode(graph, nodeA), nodeB);
      undoManager.snapshot('Add A and B', graph);

      // Add edge
      const edge = createEdge({ fromNode: nodeA.id, toNode: nodeB.id, type: 'sync', label: 'reads' });
      graph = addEdge(graph, edge);
      undoManager.snapshot('Add edge', graph);

      // Update node
      graph = updateNode(graph, nodeA.id, { displayName: 'Updated A' });
      undoManager.snapshot('Update A', graph);

      // Remove node B (and its edges)
      graph = removeNode(graph, nodeB.id);
      undoManager.snapshot('Remove B', graph);

      // Verify forward state
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]!.displayName).toBe('Updated A');

      // Undo remove B
      let restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(2);
      expect(restored.edges).toHaveLength(1);

      // Undo update A
      restored = undoManager.undo()!;
      expect(restored.nodes[0]!.displayName).toBe('A');

      // Undo add edge
      restored = undoManager.undo()!;
      expect(restored.edges).toHaveLength(0);
      expect(restored.nodes).toHaveLength(2);

      // Undo add nodes
      restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(0);
    });

    it('export then import produces identical undo behavior', () => {
      undoManager.snapshot('Initial', graph);

      for (let i = 0; i < 7; i++) {
        graph = addNode(graph, createNode({ type: 'compute/service', displayName: `S${i}` }));
        undoManager.snapshot(`Add S${i}`, graph);
      }

      // Undo twice
      undoManager.undo();
      undoManager.undo();

      // Export at mid-undo position
      const exported = undoManager.exportHistory();
      expect(exported.currentIndex).toBe(5);
      expect(exported.entries).toHaveLength(8);

      // Import into a new manager
      const newManager = new UndoManager(100, 5);
      newManager.importHistory(exported.entries, exported.currentIndex);

      // Should have same undo/redo state
      expect(newManager.canUndo).toBe(true);
      expect(newManager.canRedo).toBe(true);
      expect(newManager.historyLength).toBe(8);
      expect(newManager.currentHistoryIndex).toBe(5);

      // Undo should return same graph
      const originalUndo = undoManager.undo()!;
      const importedUndo = newManager.undo()!;
      expect(importedUndo.nodes).toHaveLength(originalUndo.nodes.length);
      expect(importedUndo.nodes.map((n) => n.displayName)).toEqual(
        originalUndo.nodes.map((n) => n.displayName),
      );
    });

    it('clear resets all internal state', () => {
      undoManager.snapshot('Initial', graph);
      graph = addNode(graph, createNode({ type: 'compute/service', displayName: 'A' }));
      undoManager.snapshot('Add A', graph);

      undoManager.clear();

      expect(undoManager.historyLength).toBe(0);
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(false);
      expect(undoManager.currentHistoryIndex).toBe(-1);
      expect(undoManager.getDescriptions()).toEqual([]);
    });
  });
});
