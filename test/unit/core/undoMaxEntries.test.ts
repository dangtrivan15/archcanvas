/**
 * Tests for UndoManager max entries limit.
 * Feature #36: Undo stack limited to max 100 entries
 *
 * Steps:
 * 1. Perform 105 mutations (add nodes)
 * 2. Verify undo history has exactly 100 entries (not 105)
 * 3. Verify undo() still works for the last 100 mutations
 * 4. Verify earliest mutations are discarded
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager } from '@/core/history/undoManager';
import {
  createEmptyGraph,
  createNode,
  addNode,
} from '@/core/graph/graphEngine';
import { MAX_UNDO_ENTRIES } from '@/utils/constants';
import type { ArchGraph } from '@/types/graph';

describe('UndoManager - undo stack limited to max 100 entries', () => {
  let undoManager: UndoManager;
  let graph: ArchGraph;

  beforeEach(() => {
    undoManager = new UndoManager();
    graph = createEmptyGraph('Test Architecture');
  });

  describe('Feature #36 verification steps', () => {
    it('should limit history to 100 entries after 105 mutations', () => {
      // Step 1: Perform 105 mutations (add nodes)
      for (let i = 0; i < 105; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Step 2: Verify undo history has exactly 100 entries (not 105)
      expect(undoManager.historyLength).toBe(MAX_UNDO_ENTRIES);
      expect(undoManager.historyLength).toBe(100);
    });

    it('should allow undo for the last 100 mutations', () => {
      // Perform 105 mutations
      for (let i = 0; i < 105; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Step 3: Verify undo() still works for the last 100 mutations
      // The latest snapshot has 105 nodes. Undo should go back through 99 steps
      // (we can undo from index 99 down to index 0, which is 99 undos)
      let undoCount = 0;
      while (undoManager.canUndo) {
        const restored = undoManager.undo();
        expect(restored).toBeDefined();
        undoCount++;
      }

      // Should be able to undo 99 times (100 entries, current starts at index 99)
      expect(undoCount).toBe(99);
    });

    it('should discard earliest mutations when limit exceeded', () => {
      // Step 4: Verify earliest mutations are discarded
      for (let i = 0; i < 105; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // The first 5 entries (Node 0 through Node 4) should be discarded
      const descriptions = undoManager.getDescriptions();
      expect(descriptions).toHaveLength(100);

      // First remaining entry should be "Add Node 5" (entries 0-4 were discarded)
      expect(descriptions[0]).toBe('Add Node 5');

      // Last entry should be "Add Node 104"
      expect(descriptions[99]).toBe('Add Node 104');

      // Entries for Node 0 through Node 4 should NOT exist
      expect(descriptions).not.toContain('Add Node 0');
      expect(descriptions).not.toContain('Add Node 1');
      expect(descriptions).not.toContain('Add Node 2');
      expect(descriptions).not.toContain('Add Node 3');
      expect(descriptions).not.toContain('Add Node 4');
    });

    it('should have correct graph state after full undo at limit', () => {
      // After 105 mutations, undo back to the earliest retained state
      for (let i = 0; i < 105; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Undo all the way back
      let restored: ArchGraph | undefined;
      while (undoManager.canUndo) {
        restored = undoManager.undo();
      }

      // The earliest retained state should have 6 nodes (Nodes 0-5)
      // because the snapshot at "Add Node 5" captured a graph with nodes 0-5
      expect(restored).toBeDefined();
      expect(restored!.nodes).toHaveLength(6);
      expect(restored!.nodes[0].displayName).toBe('Node 0');
      expect(restored!.nodes[5].displayName).toBe('Node 5');
    });
  });

  describe('MAX_UNDO_ENTRIES constant', () => {
    it('should use the constant value of 100', () => {
      expect(MAX_UNDO_ENTRIES).toBe(100);
    });

    it('should respect custom max entries', () => {
      const smallUndo = new UndoManager(10);

      for (let i = 0; i < 20; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        smallUndo.snapshot(`Add Node ${i}`, graph);
      }

      expect(smallUndo.historyLength).toBe(10);

      // First entry should be "Add Node 10"
      const descriptions = smallUndo.getDescriptions();
      expect(descriptions[0]).toBe('Add Node 10');
      expect(descriptions[9]).toBe('Add Node 19');
    });
  });

  describe('Edge cases at limit boundary', () => {
    it('should have exactly 100 entries when doing exactly 100 snapshots', () => {
      for (let i = 0; i < 100; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Exactly at limit - nothing should be discarded
      expect(undoManager.historyLength).toBe(100);
      const descriptions = undoManager.getDescriptions();
      expect(descriptions[0]).toBe('Add Node 0');
      expect(descriptions[99]).toBe('Add Node 99');
    });

    it('should discard oldest on the 101st snapshot', () => {
      for (let i = 0; i < 101; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      expect(undoManager.historyLength).toBe(100);
      const descriptions = undoManager.getDescriptions();
      // Node 0 should be discarded
      expect(descriptions[0]).toBe('Add Node 1');
      expect(descriptions[99]).toBe('Add Node 100');
    });

    it('should handle undo after limit enforcement correctly', () => {
      // Fill to 105
      for (let i = 0; i < 105; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Undo one step - from 105 nodes to 104 nodes
      const restored = undoManager.undo()!;
      expect(restored.nodes).toHaveLength(104);

      // Redo back - 105 nodes
      const redone = undoManager.redo()!;
      expect(redone.nodes).toHaveLength(105);
    });

    it('should maintain limit after undo-then-new-action', () => {
      // Fill to 100 exactly
      for (let i = 0; i < 100; i++) {
        const node = createNode({
          type: 'compute/service',
          displayName: `Node ${i}`,
        });
        graph = addNode(graph, node);
        undoManager.snapshot(`Add Node ${i}`, graph);
      }

      // Undo 5 times
      for (let i = 0; i < 5; i++) {
        undoManager.undo();
      }

      // New action (branches, discards redo future)
      const newNode = createNode({ type: 'data/database', displayName: 'Branched' });
      const latestRestore = undoManager.undo();
      // restore from current position and add
      const branchedGraph = addNode(latestRestore!, newNode);
      undoManager.snapshot('Branched action', branchedGraph);

      // History should be trimmed from both ends:
      // - Front: oldest entries may be dropped
      // - Back: redo future was discarded
      expect(undoManager.historyLength).toBeLessThanOrEqual(100);
      expect(undoManager.canRedo).toBe(false);
    });
  });
});
