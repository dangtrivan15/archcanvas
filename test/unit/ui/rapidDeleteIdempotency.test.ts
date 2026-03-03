/**
 * Tests for Feature #213: Rapid delete clicks don't remove extra nodes.
 * Verifies that pressing Delete rapidly on one node only removes that node,
 * and does not accidentally delete other nodes.
 *
 * Idempotency protections tested:
 *   1. While delete confirmation dialog is open, additional Delete presses are ignored
 *   2. After confirming deletion, selection is cleared so Delete has no target
 *   3. Calling removeNode with a non-existent node ID is harmless
 *   4. Multiple rapid confirm clicks on the delete button don't cascade
 *   5. Backspace key has the same idempotency protections
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import {
  createEmptyGraph,
  addNode,
  createNode,
  removeNode as engineRemoveNode,
  findNode,
  type ArchGraph,
} from '@/core/graph/graphEngine';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';

// Helper: creates a node with a specific ID (overrides generateId)
function makeNode(id: string, displayName: string) {
  const node = createNode({ type: 'compute/service', displayName });
  // Override the random ID with our test-specific one
  return { ...node, id };
}

// Helper: creates a graph with 3 nodes: A, B, C
function createThreeNodeGraph(): ArchGraph {
  let graph = createEmptyGraph();
  graph = addNode(graph, makeNode('node-a', 'Node A'));
  graph = addNode(graph, makeNode('node-b', 'Node B'));
  graph = addNode(graph, makeNode('node-c', 'Node C'));
  return graph;
}

// Reset stores before each test
beforeEach(() => {
  useCanvasStore.setState({
    selectedNodeId: null,
    selectedEdgeId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    fitViewCounter: 0,
  });
  useUIStore.setState({
    leftPanelOpen: true,
    rightPanelOpen: false,
    rightPanelTab: 'properties',
    deleteDialogOpen: false,
    deleteDialogInfo: null,
    connectionDialogOpen: false,
    connectionDialogInfo: null,
    unsavedChangesDialogOpen: false,
    unsavedChangesDialogInfo: null,
    errorDialogOpen: false,
    errorDialogInfo: null,
    integrityWarningDialogOpen: false,
    integrityWarningDialogInfo: null,
    placementMode: false,
    placementInfo: null,
  });
});

/**
 * Simulates the Delete/Backspace key handler logic from Canvas.tsx (lines 270-357).
 * Replicates the exact logic to unit-test it without needing React component rendering.
 */
function simulateDeleteKeyHandler(
  key: 'Delete' | 'Backspace',
  graph: ArchGraph,
  options?: { navigationPathLength?: number }
): { prevented: boolean; dialogOpened: boolean } {
  const navPathLength = options?.navigationPathLength ?? 0;

  let prevented = false;
  let dialogOpened = false;

  // Replicate Canvas.tsx logic exactly (lines 313-351)
  const { deleteDialogOpen } = useUIStore.getState();

  // "Don't handle if delete dialog is already open" (line 314)
  if (deleteDialogOpen) {
    return { prevented, dialogOpened };
  }

  const { selectedNodeId } = useCanvasStore.getState();

  if (key === 'Delete') {
    // Delete key always triggers node deletion if a node is selected (line 316-330)
    if (selectedNodeId) {
      prevented = true;
      const node = findNode(graph, selectedNodeId);
      if (node) {
        const impact = calculateDeletionImpact(graph, selectedNodeId);
        useUIStore.getState().openDeleteDialog({
          nodeId: selectedNodeId,
          nodeName: node.displayName,
          edgeCount: impact.edgeCount,
          childCount: impact.childCount,
        });
        dialogOpened = true;
      }
    }
  } else if (key === 'Backspace') {
    if (navPathLength > 0) {
      // Backspace with navigation path -> zoom out (not delete)
      prevented = true;
    } else if (selectedNodeId) {
      // Backspace at root level with selected node -> delete
      prevented = true;
      const node = findNode(graph, selectedNodeId);
      if (node) {
        const impact = calculateDeletionImpact(graph, selectedNodeId);
        useUIStore.getState().openDeleteDialog({
          nodeId: selectedNodeId,
          nodeName: node.displayName,
          edgeCount: impact.edgeCount,
          childCount: impact.childCount,
        });
        dialogOpened = true;
      }
    }
  }

  return { prevented, dialogOpened };
}

/**
 * Simulates the delete confirmation handler from DeleteConfirmationDialog.tsx (lines 47-52).
 * Calls removeNode, clearSelection, and closeDeleteDialog in the same order.
 */
function simulateDeleteConfirm(removeNodeFn: (nodeId: string) => void): void {
  const info = useUIStore.getState().deleteDialogInfo;
  if (!info) return;

  removeNodeFn(info.nodeId);
  useCanvasStore.getState().clearSelection();
  useUIStore.getState().closeDeleteDialog();
}

describe('Feature #213: Rapid delete clicks don\'t remove extra nodes', () => {
  // ==========================================================
  // 1. Delete dialog guard prevents multiple openings
  // ==========================================================
  describe('Delete dialog guards against rapid Delete presses', () => {
    it('first Delete press on selected node opens confirmation dialog', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      const result = simulateDeleteKeyHandler('Delete', graph);

      expect(result.dialogOpened).toBe(true);
      expect(result.prevented).toBe(true);
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-a');
      expect(useUIStore.getState().deleteDialogInfo?.nodeName).toBe('Node A');
    });

    it('second Delete press while dialog is open is completely ignored', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // First Delete opens dialog
      simulateDeleteKeyHandler('Delete', graph);
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);

      // Second Delete should be ignored (dialog guard on line 314)
      const result2 = simulateDeleteKeyHandler('Delete', graph);
      expect(result2.dialogOpened).toBe(false);
      expect(result2.prevented).toBe(false);

      // Dialog still shows same node
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-a');
    });

    it('five rapid Delete presses only open the dialog once', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      let dialogOpenedCount = 0;
      for (let i = 0; i < 5; i++) {
        const result = simulateDeleteKeyHandler('Delete', graph);
        if (result.dialogOpened) dialogOpenedCount++;
      }

      expect(dialogOpenedCount).toBe(1);
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-a');
    });

    it('ten rapid Delete presses only target node A, never B or C', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      for (let i = 0; i < 10; i++) {
        simulateDeleteKeyHandler('Delete', graph);
      }

      // Dialog should only reference node-a
      const info = useUIStore.getState().deleteDialogInfo;
      expect(info?.nodeId).toBe('node-a');
      expect(info?.nodeName).toBe('Node A');
    });
  });

  // ==========================================================
  // 2. After deletion, selection is cleared so Delete has no target
  // ==========================================================
  describe('After deletion, no node is selected for further deletes', () => {
    it('confirming deletion clears selection', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Open dialog
      simulateDeleteKeyHandler('Delete', graph);

      // Simulate confirm (using a mock removeNode since we test store integration separately)
      const mockRemoveNode = vi.fn();
      simulateDeleteConfirm(mockRemoveNode);

      // Selection should be cleared
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
      // Dialog should be closed
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
      expect(useUIStore.getState().deleteDialogInfo).toBeNull();
    });

    it('Delete press after confirming deletion does nothing (no selection)', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Open dialog and confirm
      simulateDeleteKeyHandler('Delete', graph);
      simulateDeleteConfirm(vi.fn());

      // Now press Delete again - should do nothing because no node is selected
      const result = simulateDeleteKeyHandler('Delete', graph);
      expect(result.dialogOpened).toBe(false);
      expect(result.prevented).toBe(false);
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
    });

    it('rapid deletes after confirming node A deletion do not affect B or C', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Delete node A
      simulateDeleteKeyHandler('Delete', graph);
      simulateDeleteConfirm(vi.fn());

      // Rapid deletes with no selection
      for (let i = 0; i < 10; i++) {
        simulateDeleteKeyHandler('Delete', graph);
      }

      // Dialog should not have reopened
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
      // No selection change
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });
  });

  // ==========================================================
  // 3. Engine removeNode is safe for non-existent IDs
  // ==========================================================
  describe('removeNode is safe for already-removed or non-existent nodes', () => {
    it('removeNode with non-existent ID returns graph unchanged', () => {
      const graph = createThreeNodeGraph();

      const result = engineRemoveNode(graph, 'non-existent-id');

      // All 3 nodes should still be present
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map(n => n.id)).toEqual(['node-a', 'node-b', 'node-c']);
    });

    it('removing node A then removing node A again does not affect B or C', () => {
      let graph = createThreeNodeGraph();

      // Remove A first time
      graph = engineRemoveNode(graph, 'node-a');
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.id)).toEqual(['node-b', 'node-c']);

      // Remove A second time (already gone) - should be harmless
      graph = engineRemoveNode(graph, 'node-a');
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.id)).toEqual(['node-b', 'node-c']);
    });

    it('five successive removeNode calls on same ID leave other nodes intact', () => {
      let graph = createThreeNodeGraph();

      for (let i = 0; i < 5; i++) {
        graph = engineRemoveNode(graph, 'node-a');
      }

      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.id)).toEqual(['node-b', 'node-c']);
    });
  });

  // ==========================================================
  // 4. Multiple confirm clicks are harmless
  // ==========================================================
  describe('Multiple rapid confirm clicks are harmless', () => {
    it('double confirm click only calls removeNode once effectively', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Open dialog
      simulateDeleteKeyHandler('Delete', graph);
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);

      // First confirm
      const mockRemoveNode = vi.fn();
      simulateDeleteConfirm(mockRemoveNode);
      expect(mockRemoveNode).toHaveBeenCalledWith('node-a');
      expect(mockRemoveNode).toHaveBeenCalledTimes(1);

      // Second confirm attempt - dialog is already closed, info is null
      simulateDeleteConfirm(mockRemoveNode);
      // Should NOT have been called again (deleteDialogInfo is null after first confirm)
      expect(mockRemoveNode).toHaveBeenCalledTimes(1);
    });

    it('rapid confirms after first confirm do not open new dialogs', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Delete and confirm
      simulateDeleteKeyHandler('Delete', graph);
      simulateDeleteConfirm(vi.fn());

      // Multiple subsequent confirm attempts (dialog is closed)
      for (let i = 0; i < 5; i++) {
        simulateDeleteConfirm(vi.fn());
      }

      // Dialog stays closed
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
    });
  });

  // ==========================================================
  // 5. Backspace has the same idempotency protections
  // ==========================================================
  describe('Backspace key has same idempotency protections', () => {
    it('Backspace at root with selected node opens delete dialog once', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-b');

      const result = simulateDeleteKeyHandler('Backspace', graph);

      expect(result.dialogOpened).toBe(true);
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-b');
    });

    it('rapid Backspace presses only open dialog once', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-b');

      let dialogOpenCount = 0;
      for (let i = 0; i < 5; i++) {
        const result = simulateDeleteKeyHandler('Backspace', graph);
        if (result.dialogOpened) dialogOpenCount++;
      }

      expect(dialogOpenCount).toBe(1);
    });

    it('rapid Backspace while dialog open does not change target node', () => {
      const graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-b');

      // Open dialog for node-b
      simulateDeleteKeyHandler('Backspace', graph);

      // Rapid Backspace presses
      for (let i = 0; i < 10; i++) {
        simulateDeleteKeyHandler('Backspace', graph);
      }

      // Still targeting node-b
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-b');
    });
  });

  // ==========================================================
  // 6. Complete workflow: Create 3 nodes, delete A, verify B+C remain
  // ==========================================================
  describe('Complete workflow: delete one node, verify others remain', () => {
    it('create 3 nodes, select A, rapid Delete, confirm once → only A removed', () => {
      let graph = createThreeNodeGraph();
      expect(graph.nodes).toHaveLength(3);

      // Select node A
      useCanvasStore.getState().selectNode('node-a');

      // Press Delete rapidly 5 times
      for (let i = 0; i < 5; i++) {
        simulateDeleteKeyHandler('Delete', graph);
      }

      // Dialog opened only for node A
      expect(useUIStore.getState().deleteDialogInfo?.nodeId).toBe('node-a');

      // Confirm deletion once (using engine removeNode)
      graph = engineRemoveNode(graph, 'node-a');

      // Clear selection and close dialog (as the dialog handler does)
      useCanvasStore.getState().clearSelection();
      useUIStore.getState().closeDeleteDialog();

      // Verify only A is removed
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.find(n => n.id === 'node-a')).toBeUndefined();

      // Verify B and C still exist
      expect(graph.nodes.find(n => n.id === 'node-b')).toBeDefined();
      expect(graph.nodes.find(n => n.id === 'node-c')).toBeDefined();
      expect(graph.nodes.map(n => n.displayName)).toEqual(['Node B', 'Node C']);
    });

    it('after deleting A, further Delete presses do not affect B or C', () => {
      let graph = createThreeNodeGraph();
      useCanvasStore.getState().selectNode('node-a');

      // Delete A with confirmation
      simulateDeleteKeyHandler('Delete', graph);
      graph = engineRemoveNode(graph, 'node-a');
      useCanvasStore.getState().clearSelection();
      useUIStore.getState().closeDeleteDialog();

      // Rapid Delete presses (no selection, dialog closed)
      for (let i = 0; i < 20; i++) {
        simulateDeleteKeyHandler('Delete', graph);
      }

      // B and C are still intact
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.map(n => n.id)).toEqual(['node-b', 'node-c']);
      // No dialog opened for any other node
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
    });
  });

  // ==========================================================
  // 7. Edge case: Delete without any selection does nothing
  // ==========================================================
  describe('Delete with no selection is a no-op', () => {
    it('Delete key with no selected node does nothing', () => {
      const graph = createThreeNodeGraph();
      // No node selected
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();

      const result = simulateDeleteKeyHandler('Delete', graph);

      expect(result.dialogOpened).toBe(false);
      expect(result.prevented).toBe(false);
      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
    });

    it('ten Delete presses with no selection never opens dialog', () => {
      const graph = createThreeNodeGraph();

      let dialogOpenCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = simulateDeleteKeyHandler('Delete', graph);
        if (result.dialogOpened) dialogOpenCount++;
      }

      expect(dialogOpenCount).toBe(0);
      expect(graph.nodes).toHaveLength(3);
    });
  });

  // ==========================================================
  // 8. findNode returns undefined for deleted nodes
  // ==========================================================
  describe('findNode returns undefined for deleted nodes', () => {
    it('findNode returns null for a removed node ID', () => {
      let graph = createThreeNodeGraph();

      // Remove node A
      graph = engineRemoveNode(graph, 'node-a');

      // findNode should return undefined for deleted node
      const found = findNode(graph, 'node-a');
      expect(found).toBeUndefined();
    });

    it('Delete key with selected but already-removed node does not open dialog', () => {
      let graph = createThreeNodeGraph();

      // Remove node A from graph but leave it "selected" in the store
      graph = engineRemoveNode(graph, 'node-a');
      useCanvasStore.setState({ selectedNodeId: 'node-a' });

      // Delete key press - selectedNodeId exists, but findNode returns undefined
      const result = simulateDeleteKeyHandler('Delete', graph);

      // Should NOT open dialog because the node doesn't exist in the graph
      expect(result.dialogOpened).toBe(false);
      // But prevented is still true because selectedNodeId was truthy
      expect(result.prevented).toBe(true);
    });
  });
});
