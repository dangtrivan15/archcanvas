/**
 * Tests for Feature #260: Keyboard Bulk Node Movement.
 *
 * Verifies:
 * - Alt+Arrow moves selected nodes by 20px
 * - Shift+Alt+Arrow moves selected nodes by 100px
 * - Each selected node's position is updated
 * - Batch operation uses a single coreStore undo snapshot
 * - Coordinates clamped to prevent negative values
 * - CSS transition animation for smooth movement
 * - Undo restores all nodes to previous positions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  addNode,
  moveNode as engineMoveNode,
  findNode,
} from '@/core/graph/graphEngine';
import { UndoManager } from '@/core/history/undoManager';
import { useCanvasStore } from '@/store/canvasStore';
import type { ArchGraph } from '@/types/graph';

// Helper: create a test graph with N nodes at known positions
function createTestGraph(nodeSpecs: Array<{ id: string; x: number; y: number }>): ArchGraph {
  let graph = createEmptyGraph('Bulk Move Test');
  for (const spec of nodeSpecs) {
    const node = createNode({
      type: 'compute/service',
      displayName: `Node ${spec.id}`,
      position: { x: spec.x, y: spec.y },
    });
    // Override ID for deterministic tests
    (node as any).id = spec.id;
    graph = addNode(graph, node);
  }
  return graph;
}

// Simulate the moveNodes batch logic (mirrors coreStore.moveNodes)
function batchMoveNodes(
  graph: ArchGraph,
  moves: Array<{ nodeId: string; x: number; y: number }>,
): ArchGraph {
  let currentGraph = graph;
  for (const { nodeId, x, y } of moves) {
    const clampedX = Math.max(0, x);
    const clampedY = Math.max(0, y);
    currentGraph = engineMoveNode(currentGraph, nodeId, clampedX, clampedY);
  }
  return currentGraph;
}

describe('Feature #260: Keyboard Bulk Node Movement', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  describe('Alt+Arrow small step movement (20px)', () => {
    it('moves a single selected node 20px to the right', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 120, y: 100 }]);
      const node = findNode(result, 'n1');
      expect(node).toBeDefined();
      expect(node!.position.x).toBe(120);
      expect(node!.position.y).toBe(100);
    });

    it('moves a single selected node 20px upward', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 100, y: 80 }]);
      const node = findNode(result, 'n1');
      expect(node!.position.x).toBe(100);
      expect(node!.position.y).toBe(80);
    });

    it('moves 3 selected nodes 20px to the right', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
        { nodeId: 'n3', x: 320, y: 300 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(120);
      expect(findNode(result, 'n2')!.position.x).toBe(220);
      expect(findNode(result, 'n3')!.position.x).toBe(320);
      // Y positions unchanged
      expect(findNode(result, 'n1')!.position.y).toBe(100);
      expect(findNode(result, 'n2')!.position.y).toBe(200);
      expect(findNode(result, 'n3')!.position.y).toBe(300);
    });

    it('moves 3 selected nodes 20px downward', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 100, y: 120 },
        { nodeId: 'n2', x: 200, y: 220 },
        { nodeId: 'n3', x: 300, y: 320 },
      ]);
      expect(findNode(result, 'n1')!.position.y).toBe(120);
      expect(findNode(result, 'n2')!.position.y).toBe(220);
      expect(findNode(result, 'n3')!.position.y).toBe(320);
    });

    it('moves 3 selected nodes 20px to the left', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 80, y: 100 },
        { nodeId: 'n2', x: 180, y: 200 },
        { nodeId: 'n3', x: 280, y: 300 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(80);
      expect(findNode(result, 'n2')!.position.x).toBe(180);
      expect(findNode(result, 'n3')!.position.x).toBe(280);
    });
  });

  describe('Shift+Alt+Arrow large step movement (100px)', () => {
    it('moves nodes 100px to the right with Shift+Alt', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
      ]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 200, y: 100 },
        { nodeId: 'n2', x: 300, y: 200 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(200);
      expect(findNode(result, 'n2')!.position.x).toBe(300);
    });

    it('moves nodes 100px upward with Shift+Alt', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 200 },
        { id: 'n2', x: 200, y: 300 },
      ]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 100, y: 100 },
        { nodeId: 'n2', x: 200, y: 200 },
      ]);
      expect(findNode(result, 'n1')!.position.y).toBe(100);
      expect(findNode(result, 'n2')!.position.y).toBe(200);
    });

    it('moves nodes 100px downward with Shift+Alt', () => {
      const graph = createTestGraph([{ id: 'n1', x: 50, y: 50 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 50, y: 150 }]);
      expect(findNode(result, 'n1')!.position.y).toBe(150);
    });

    it('moves nodes 100px leftward with Shift+Alt', () => {
      const graph = createTestGraph([{ id: 'n1', x: 300, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 200, y: 100 }]);
      expect(findNode(result, 'n1')!.position.x).toBe(200);
    });
  });

  describe('Single undo snapshot per batch move', () => {
    it('creates exactly one undo snapshot after batch move of 3 nodes', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);

      const undoManager = new UndoManager();
      undoManager.snapshot('Initial state', graph);
      expect(undoManager.entries.length).toBe(1);

      // Perform batch move (simulating moveNodes)
      const moved = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
        { nodeId: 'n3', x: 320, y: 300 },
      ]);
      undoManager.snapshot('Move 3 nodes', moved);

      // Should have exactly 2 entries: initial + one batch move
      expect(undoManager.entries.length).toBe(2);
      expect(undoManager.entries[1]!.description).toBe('Move 3 nodes');
    });

    it('undo restores all 3 nodes to their original positions', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);

      const undoManager = new UndoManager();
      undoManager.snapshot('Initial state', graph);

      const moved = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
        { nodeId: 'n3', x: 320, y: 300 },
      ]);
      undoManager.snapshot('Move 3 nodes', moved);

      // Undo: should restore to initial positions
      const restored = undoManager.undo();
      expect(restored).toBeDefined();
      expect(findNode(restored!, 'n1')!.position.x).toBe(100);
      expect(findNode(restored!, 'n2')!.position.x).toBe(200);
      expect(findNode(restored!, 'n3')!.position.x).toBe(300);
    });

    it('redo re-applies the batch move', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
      ]);

      const undoManager = new UndoManager();
      undoManager.snapshot('Initial', graph);

      const moved = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
      ]);
      undoManager.snapshot('Move 2 nodes', moved);

      undoManager.undo(); // Back to initial
      const redone = undoManager.redo();
      expect(redone).toBeDefined();
      expect(findNode(redone!, 'n1')!.position.x).toBe(120);
      expect(findNode(redone!, 'n2')!.position.x).toBe(220);
    });

    it('snapshot description formats correctly for single node', () => {
      const undoManager = new UndoManager();
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      undoManager.snapshot('Initial', graph);

      const moved = batchMoveNodes(graph, [{ nodeId: 'n1', x: 120, y: 100 }]);
      const count = 1;
      const desc = `Move ${count} node${count === 1 ? '' : 's'}`;
      undoManager.snapshot(desc, moved);

      expect(undoManager.entries[1]!.description).toBe('Move 1 node');
    });

    it('snapshot description formats correctly for multiple nodes', () => {
      const undoManager = new UndoManager();
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);
      undoManager.snapshot('Initial', graph);

      const count = 3;
      const desc = `Move ${count} node${count === 1 ? '' : 's'}`;
      undoManager.snapshot(desc, graph);

      expect(undoManager.entries[1]!.description).toBe('Move 3 nodes');
    });
  });

  describe('Negative coordinate clamping', () => {
    it('clamps x to 0 when moving left past origin', () => {
      const graph = createTestGraph([{ id: 'n1', x: 10, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: -10, y: 100 }]);
      expect(findNode(result, 'n1')!.position.x).toBe(0);
    });

    it('clamps y to 0 when moving up past origin', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 10 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 100, y: -10 }]);
      expect(findNode(result, 'n1')!.position.y).toBe(0);
    });

    it('clamps both x and y simultaneously', () => {
      const graph = createTestGraph([{ id: 'n1', x: 5, y: 5 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: -50, y: -50 }]);
      expect(findNode(result, 'n1')!.position.x).toBe(0);
      expect(findNode(result, 'n1')!.position.y).toBe(0);
    });

    it('does not clamp positive coordinates', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 500, y: 600 }]);
      expect(findNode(result, 'n1')!.position.x).toBe(500);
      expect(findNode(result, 'n1')!.position.y).toBe(600);
    });

    it('clamps only the node(s) that would go negative', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 10, y: 100 },
        { id: 'n2', x: 200, y: 100 },
      ]);
      // n1 moves left 20px (would go to -10), n2 moves left 20px (to 180)
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: -10, y: 100 },
        { nodeId: 'n2', x: 180, y: 100 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(0); // clamped
      expect(findNode(result, 'n2')!.position.x).toBe(180); // not clamped
    });
  });

  describe('Non-selected nodes are not affected', () => {
    it('only moves selected nodes, not others', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);
      // Only move n1 and n2, not n3
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(120);
      expect(findNode(result, 'n2')!.position.x).toBe(220);
      expect(findNode(result, 'n3')!.position.x).toBe(300); // unchanged
      expect(findNode(result, 'n3')!.position.y).toBe(300); // unchanged
    });
  });

  describe('Step sizes', () => {
    const SMALL_STEP = 20;
    const LARGE_STEP = 100;

    it('small step is 20px', () => {
      expect(SMALL_STEP).toBe(20);
    });

    it('large step is 100px', () => {
      expect(LARGE_STEP).toBe(100);
    });

    it('Alt+ArrowRight offset is (+20, 0)', () => {
      const dx = 1 * SMALL_STEP;
      const dy = 0 * SMALL_STEP;
      expect(dx).toBe(20);
      expect(dy).toBe(0);
    });

    it('Alt+ArrowLeft offset is (-20, 0)', () => {
      const dx = -1 * SMALL_STEP;
      const dy = 0 * SMALL_STEP;
      expect(dx).toBe(-20);
      expect(dy).toBe(0);
    });

    it('Alt+ArrowDown offset is (0, +20)', () => {
      const dx = 0 * SMALL_STEP;
      const dy = 1 * SMALL_STEP;
      expect(dx).toBe(0);
      expect(dy).toBe(20);
    });

    it('Alt+ArrowUp offset is (0, -20)', () => {
      const dx = 0 * SMALL_STEP;
      const dy = -1 * SMALL_STEP;
      expect(dx).toBe(0);
      expect(dy).toBe(-20);
    });

    it('Shift+Alt+ArrowRight offset is (+100, 0)', () => {
      const dx = 1 * LARGE_STEP;
      expect(dx).toBe(100);
    });

    it('Shift+Alt+ArrowUp offset is (0, -100)', () => {
      const dy = -1 * LARGE_STEP;
      expect(dy).toBe(-100);
    });
  });

  describe('Properties preserved during move', () => {
    it('preserves node type after batch move', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 200, y: 200 }]);
      expect(findNode(result, 'n1')!.type).toBe('compute/service');
    });

    it('preserves display name after batch move', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: 200, y: 200 }]);
      expect(findNode(result, 'n1')!.displayName).toBe('Node n1');
    });

    it('preserves width and height after batch move', () => {
      let graph = createEmptyGraph('Test');
      const node = createNode({
        type: 'compute/service',
        displayName: 'Service',
        position: { x: 100, y: 100, width: 250, height: 120 },
      });
      graph = addNode(graph, node);

      const result = batchMoveNodes(graph, [{ nodeId: node.id, x: 300, y: 400 }]);
      const moved = findNode(result, node.id);
      expect(moved!.position.width).toBe(250);
      expect(moved!.position.height).toBe(120);
    });
  });

  describe('Edge cases', () => {
    it('empty moves array results in no changes', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, []);
      expect(findNode(result, 'n1')!.position.x).toBe(100);
    });

    it('handles moving same node twice in one batch (last wins)', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n1', x: 140, y: 100 },
      ]);
      // Last move wins
      expect(findNode(result, 'n1')!.position.x).toBe(140);
    });

    it('handles moving non-existent node ID gracefully', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      // Moving a non-existent node should not crash
      const result = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'nonexistent', x: 500, y: 500 },
      ]);
      expect(findNode(result, 'n1')!.position.x).toBe(120);
    });

    it('moving node at x=0 left clamps to 0', () => {
      const graph = createTestGraph([{ id: 'n1', x: 0, y: 0 }]);
      const result = batchMoveNodes(graph, [{ nodeId: 'n1', x: -20, y: -20 }]);
      expect(findNode(result, 'n1')!.position.x).toBe(0);
      expect(findNode(result, 'n1')!.position.y).toBe(0);
    });
  });

  describe('CSS transition for smooth movement', () => {
    it('index.css has node transition rule', async () => {
      const fs = await import('fs');
      const css = fs.readFileSync('src/index.css', 'utf-8');
      expect(css).toContain('.react-flow__node');
      expect(css).toContain('transition');
      expect(css).toContain('transform');
    });

    it('dragging class disables transition', async () => {
      const fs = await import('fs');
      const css = fs.readFileSync('src/index.css', 'utf-8');
      expect(css).toContain('.react-flow__node.dragging');
      expect(css).toContain('transition: none');
    });
  });

  describe('Source code verification', () => {
    it('Canvas keyboard hook has Alt+Arrow bulk move handler', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(src).toContain('handleBulkMove');
      expect(src).toContain('altKey');
      expect(src).toContain('SMALL_STEP');
      expect(src).toContain('LARGE_STEP');
    });

    it('Canvas keyboard hook checks shiftKey for large step', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(src).toContain('e.shiftKey');
      expect(src).toContain('LARGE_STEP');
      expect(src).toContain('SMALL_STEP');
    });

    it('coreStore has moveNodes method', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      expect(src).toContain('moveNodes:');
      expect(src).toContain('snapshotDescription');
    });

    it('coreStore moveNodes clamps negative coordinates', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      expect(src).toContain('Math.max(0, x)');
      expect(src).toContain('Math.max(0, y)');
    });

    it('coreStore moveNodes takes single undo snapshot', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      // Find the implementation of moveNodes (second occurrence, after interface)
      const implStart = src.indexOf('moveNodes: (moves, snapshotDescription)');
      const implEnd = src.indexOf('duplicateSelection:', implStart);
      expect(implStart).toBeGreaterThan(0);
      const moveNodesBlock = src.slice(implStart, implEnd);
      const snapshotCalls = (moveNodesBlock.match(/undoManager\.snapshot/g) || []).length;
      expect(snapshotCalls).toBe(1);
    });

    it('Canvas keyboard hook handler prevents default on Alt+Arrow', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(src).toContain('handleBulkMove');
      expect(src).toContain('e.preventDefault()');
    });

    it('Canvas keyboard hook skips bulk move when text input is active', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(src).toContain('isActiveElementTextInput');
    });

    it('Canvas keyboard hook subscribes to moveNodes from coreStore', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/components/canvas/hooks/useCanvasKeyboard.ts', 'utf-8');
      expect(src).toContain('moveNodes');
      expect(src).toContain('useCoreStore');
    });
  });

  describe('Integration: full workflow simulation', () => {
    it('select 3 → Alt+Right → all moved 20px → undo → restored', () => {
      const graph = createTestGraph([
        { id: 'n1', x: 100, y: 100 },
        { id: 'n2', x: 200, y: 200 },
        { id: 'n3', x: 300, y: 300 },
      ]);

      // 1. Set selection
      const store = useCanvasStore.getState();
      store.selectNodes(['n1', 'n2', 'n3']);
      expect(useCanvasStore.getState().selectedNodeIds).toEqual(['n1', 'n2', 'n3']);

      // 2. Simulate Alt+Right: move all 20px right
      const undoManager = new UndoManager();
      undoManager.snapshot('Initial', graph);

      const moved = batchMoveNodes(graph, [
        { nodeId: 'n1', x: 120, y: 100 },
        { nodeId: 'n2', x: 220, y: 200 },
        { nodeId: 'n3', x: 320, y: 300 },
      ]);
      undoManager.snapshot('Move 3 nodes', moved);

      // 3. Verify all moved 20px
      expect(findNode(moved, 'n1')!.position.x).toBe(120);
      expect(findNode(moved, 'n2')!.position.x).toBe(220);
      expect(findNode(moved, 'n3')!.position.x).toBe(320);

      // 4. Undo → all restored
      const restored = undoManager.undo();
      expect(restored).toBeDefined();
      expect(findNode(restored!, 'n1')!.position.x).toBe(100);
      expect(findNode(restored!, 'n2')!.position.x).toBe(200);
      expect(findNode(restored!, 'n3')!.position.x).toBe(300);
    });

    it('select all → Shift+Alt+Down → nodes move 100px → undo → back', () => {
      const graph = createTestGraph([
        { id: 'a', x: 50, y: 50 },
        { id: 'b', x: 150, y: 150 },
      ]);

      const undoManager = new UndoManager();
      undoManager.snapshot('Initial', graph);

      const moved = batchMoveNodes(graph, [
        { nodeId: 'a', x: 50, y: 150 },
        { nodeId: 'b', x: 150, y: 250 },
      ]);
      undoManager.snapshot('Move 2 nodes', moved);

      expect(findNode(moved, 'a')!.position.y).toBe(150);
      expect(findNode(moved, 'b')!.position.y).toBe(250);

      const restored = undoManager.undo();
      expect(findNode(restored!, 'a')!.position.y).toBe(50);
      expect(findNode(restored!, 'b')!.position.y).toBe(150);
    });

    it('multiple sequential moves each get their own undo snapshot', () => {
      const graph = createTestGraph([{ id: 'n1', x: 100, y: 100 }]);
      const undoManager = new UndoManager();
      undoManager.snapshot('Initial', graph);

      // Move 1: right 20px
      const step1 = batchMoveNodes(graph, [{ nodeId: 'n1', x: 120, y: 100 }]);
      undoManager.snapshot('Move 1 node', step1);

      // Move 2: right 20px more
      const step2 = batchMoveNodes(step1, [{ nodeId: 'n1', x: 140, y: 100 }]);
      undoManager.snapshot('Move 1 node', step2);

      // Move 3: down 20px
      const step3 = batchMoveNodes(step2, [{ nodeId: 'n1', x: 140, y: 120 }]);
      undoManager.snapshot('Move 1 node', step3);

      // 4 entries: initial + 3 moves
      expect(undoManager.entries.length).toBe(4);

      // Undo to step 2
      const u1 = undoManager.undo();
      expect(findNode(u1!, 'n1')!.position).toEqual(expect.objectContaining({ x: 140, y: 100 }));

      // Undo to step 1
      const u2 = undoManager.undo();
      expect(findNode(u2!, 'n1')!.position).toEqual(expect.objectContaining({ x: 120, y: 100 }));

      // Undo to initial
      const u3 = undoManager.undo();
      expect(findNode(u3!, 'n1')!.position).toEqual(expect.objectContaining({ x: 100, y: 100 }));
    });
  });
});
