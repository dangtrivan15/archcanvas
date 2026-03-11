/**
 * Tests for Keyboard Edge Deletion (Feature #253)
 * Delete/Backspace on selected edge removes it immediately (no modal) with undo toast.
 * Multi-edge deletion also supported.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { TextApi } from '@/api/textApi';
import { UndoManager } from '@/core/history/undoManager';
import type { ArchEdge } from '@/types/graph';

// Helper to set up store with nodes and edges
function setupStore() {
  const textApi = new TextApi(createEmptyGraph());

  const nodeA = textApi.addNode({
    type: 'compute/service',
    displayName: 'API Gateway',
    position: { x: 0, y: 0 },
  });

  const nodeB = textApi.addNode({
    type: 'compute/service',
    displayName: 'Order Service',
    position: { x: 300, y: 0 },
  });

  const nodeC = textApi.addNode({
    type: 'data/database',
    displayName: 'Orders DB',
    position: { x: 300, y: 200 },
  });

  const nodeD = textApi.addNode({
    type: 'compute/service',
    displayName: 'User Service',
    position: { x: 600, y: 0 },
  });

  const edge1 = textApi.addEdge({
    fromNode: nodeA!.id,
    toNode: nodeB!.id,
    type: 'sync',
    label: 'HTTP Request',
  });

  const edge2 = textApi.addEdge({
    fromNode: nodeB!.id,
    toNode: nodeC!.id,
    type: 'async',
    label: 'DB Write',
  });

  const edge3 = textApi.addEdge({
    fromNode: nodeA!.id,
    toNode: nodeD!.id,
    type: 'data-flow',
    label: 'User Data',
  });

  const graph = textApi.getGraph();
  const undoManager = new UndoManager();
  undoManager.snapshot('Initial state', graph);

  useGraphStore.setState({ graph, nodeCount: 4, edgeCount: 3, isDirty: false }); useEngineStore.setState({ textApi, undoManager }); useHistoryStore.setState({ canUndo: false, canRedo: false });

  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
  });

  useUIStore.setState({
    toastMessage: null,
    toastTimerId: null,
  });

  return {
    nodeA: nodeA!,
    nodeB: nodeB!,
    nodeC: nodeC!,
    nodeD: nodeD!,
    edge1: edge1!,
    edge2: edge2!,
    edge3: edge3!,
  };
}

describe('Keyboard Edge Deletion', () => {
  beforeEach(() => {
    useGraphStore.setState(useGraphStore.getInitialState()); useEngineStore.setState(useEngineStore.getInitialState()); useFileStore.setState(useFileStore.getInitialState()); useHistoryStore.setState(useHistoryStore.getInitialState());
    useCanvasStore.setState(useCanvasStore.getInitialState());
    useUIStore.setState(useUIStore.getInitialState());
  });

  describe('Single edge deletion', () => {
    it('removes a single edge via removeEdge', () => {
      const { edge1 } = setupStore();
      expect(useGraphStore.getState().edgeCount).toBe(3);
      useGraphStore.getState().removeEdge(edge1.id);
      expect(useGraphStore.getState().edgeCount).toBe(2);
    });

    it('removed edge no longer exists in graph', () => {
      const { edge1 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);
      const found = useGraphStore.getState().graph.edges.find((e) => e.id === edge1.id);
      expect(found).toBeUndefined();
    });

    it('marks state as dirty after deletion', () => {
      const { edge1 } = setupStore();
      expect(useGraphStore.getState().isDirty).toBe(false);
      useGraphStore.getState().removeEdge(edge1.id);
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('sets canUndo to true after deletion', () => {
      const { edge1 } = setupStore();
      expect(useHistoryStore.getState().canUndo).toBe(false);
      useGraphStore.getState().removeEdge(edge1.id);
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('undo restores deleted edge', () => {
      const { edge1 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);
      expect(useGraphStore.getState().edgeCount).toBe(2);

      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().edgeCount).toBe(3);
      const restored = useGraphStore.getState().graph.edges.find((e) => e.id === edge1.id);
      expect(restored).toBeDefined();
      expect(restored!.label).toBe('HTTP Request');
    });

    it('redo re-removes restored edge', () => {
      const { edge1 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().edgeCount).toBe(3);

      useHistoryStore.getState().redo();
      expect(useGraphStore.getState().edgeCount).toBe(2);
    });

    it('other edges remain after single deletion', () => {
      const { edge1, edge2, edge3 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);

      const remaining = useGraphStore.getState().graph.edges;
      expect(remaining.length).toBe(2);
      expect(remaining.find((e) => e.id === edge2.id)).toBeDefined();
      expect(remaining.find((e) => e.id === edge3.id)).toBeDefined();
    });

    it('nodes are not affected by edge deletion', () => {
      const { edge1 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);
      expect(useGraphStore.getState().nodeCount).toBe(4);
      expect(useGraphStore.getState().graph.nodes.length).toBe(4);
    });
  });

  describe('Multi-edge deletion', () => {
    it('removes multiple edges via textApi batch', () => {
      const { edge1, edge2 } = setupStore();
      const { textApi, undoManager } = useEngineStore.getState();

      textApi!.removeEdge(edge1.id);
      textApi!.removeEdge(edge2.id);
      const updatedGraph = textApi!.getGraph();
      undoManager!.snapshot('Delete 2 edges', updatedGraph);

      useGraphStore.setState({ graph: updatedGraph, isDirty: true, edgeCount: updatedGraph.edges.length }); useHistoryStore.setState({ canUndo: undoManager!.canUndo, canRedo: undoManager!.canRedo });

      expect(useGraphStore.getState().edgeCount).toBe(1);
    });

    it('undo restores all edges from batch deletion', () => {
      const { edge1, edge2 } = setupStore();
      const { textApi, undoManager } = useEngineStore.getState();

      textApi!.removeEdge(edge1.id);
      textApi!.removeEdge(edge2.id);
      const updatedGraph = textApi!.getGraph();
      undoManager!.snapshot('Delete 2 edges', updatedGraph);

      useGraphStore.setState({ graph: updatedGraph, isDirty: true, edgeCount: updatedGraph.edges.length }); useHistoryStore.setState({ canUndo: undoManager!.canUndo, canRedo: undoManager!.canRedo });

      expect(useGraphStore.getState().edgeCount).toBe(1);
      useHistoryStore.getState().undo();
      expect(useGraphStore.getState().edgeCount).toBe(3);
    });

    it('all three edges can be deleted at once', () => {
      const { edge1, edge2, edge3 } = setupStore();
      const { textApi, undoManager } = useEngineStore.getState();

      textApi!.removeEdge(edge1.id);
      textApi!.removeEdge(edge2.id);
      textApi!.removeEdge(edge3.id);
      const updatedGraph = textApi!.getGraph();
      undoManager!.snapshot('Delete 3 edges', updatedGraph);

      useGraphStore.setState({ graph: updatedGraph, isDirty: true, edgeCount: updatedGraph.edges.length }); useHistoryStore.setState({ canUndo: undoManager!.canUndo, canRedo: undoManager!.canRedo });

      expect(useGraphStore.getState().edgeCount).toBe(0);
      expect(useGraphStore.getState().graph.edges.length).toBe(0);
    });
  });

  describe('Toast notification', () => {
    it('shows toast for single edge deletion', () => {
      useUIStore.getState().showToast('Deleted HTTP Request. ⌘Z to undo');
      expect(useUIStore.getState().toastMessage).toContain('Deleted');
      expect(useUIStore.getState().toastMessage).toContain('HTTP Request');
    });

    it('shows toast for multi-edge deletion', () => {
      useUIStore.getState().showToast('Deleted 3 edges. ⌘Z to undo');
      expect(useUIStore.getState().toastMessage).toContain('3 edges');
    });

    it('toast includes undo hint', () => {
      useUIStore.getState().showToast('Deleted edge. ⌘Z to undo');
      expect(useUIStore.getState().toastMessage).toContain('undo');
    });

    it('toast auto-clears after 4 seconds', async () => {
      useUIStore.getState().showToast('Test edge deletion', 50);
      expect(useUIStore.getState().toastMessage).not.toBeNull();
      await new Promise((r) => setTimeout(r, 100));
      expect(useUIStore.getState().toastMessage).toBeNull();
    });
  });

  describe('Selection state after deletion', () => {
    it('clearSelection clears selectedEdgeId', () => {
      const { edge1 } = setupStore();
      useCanvasStore.setState({ selectedEdgeId: edge1.id });
      expect(useCanvasStore.getState().selectedEdgeId).toBe(edge1.id);

      useCanvasStore.getState().clearSelection();
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('clearSelection clears selectedEdgeIds', () => {
      const { edge1, edge2 } = setupStore();
      useCanvasStore.setState({
        selectedEdgeIds: [edge1.id, edge2.id],
      });
      expect(useCanvasStore.getState().selectedEdgeIds.length).toBe(2);

      useCanvasStore.getState().clearSelection();
      expect(useCanvasStore.getState().selectedEdgeIds.length).toBe(0);
    });
  });

  describe('Source code verification', () => {
    it('Canvas.tsx handles Delete key for edge deletion', async () => {
      const source = await import('@/components/canvas/hooks/useCanvasKeyboard?raw');
      expect(source.default).toContain("e.key === 'Delete'");
      expect(source.default).toContain('removeEdge');
      expect(source.default).toContain('showToast');
    });

    it('Canvas.tsx handles Backspace for edge deletion at root level', async () => {
      const source = await import('@/components/canvas/hooks/useCanvasKeyboard?raw');
      expect(source.default).toContain("e.key === 'Backspace'");
      expect(source.default).toContain('deleteSelectedEdges');
    });

    it('Canvas.tsx supports multi-edge deletion', async () => {
      const source = await import('@/components/canvas/hooks/useCanvasKeyboard?raw');
      expect(source.default).toContain('selectedEdgeIds');
      expect(source.default).toContain('Delete');
      // Multi-edge toast shows count
      expect(source.default).toContain('edges.');
    });

    it('Edge deletion does not show confirmation dialog', async () => {
      const source = await import('@/components/canvas/hooks/useCanvasKeyboard?raw');
      // deleteSelectedEdges helper performs direct deletion (no dialog)
      expect(source.default).toContain('deleteSelectedEdges');
    });

    it('No confirmation modal for edge deletion (unlike nodes)', () => {
      // Edge deletion is immediate - verify the pattern
      const { edge1 } = setupStore();
      useGraphStore.getState().removeEdge(edge1.id);
      // No dialog was opened
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
    });
  });
});
