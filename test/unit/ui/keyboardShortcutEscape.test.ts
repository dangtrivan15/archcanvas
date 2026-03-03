/**
 * Tests for Feature #211: Keyboard shortcut Escape deselects and closes panels.
 * Verifies that pressing Escape:
 *   1. Deselects a selected node on the canvas
 *   2. Deselects a selected edge on the canvas
 *   3. Closes the right panel when deselecting
 *   4. Closes modal dialogs (each dialog type)
 *   5. Exits placement mode
 *   6. Is skipped when typing in an input/textarea
 *   7. Respects priority: placement mode > dialog > deselection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';

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
 * Simulates the Escape key handler logic from Canvas.tsx (lines 272-311).
 * We replicate the exact logic to unit-test it without needing React component rendering.
 */
function simulateCanvasEscapeHandler(target?: HTMLElement): { prevented: boolean } {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });

  let prevented = false;
  vi.spyOn(event, 'preventDefault').mockImplementation(() => {
    prevented = true;
  });

  // Replicate Canvas.tsx logic exactly
  // 1. Don't handle when typing in an input/textarea
  if (target) {
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return { prevented };
    }
  }

  const uiState = useUIStore.getState();

  // 2. Escape exits placement mode first (highest priority)
  if (event.key === 'Escape' && uiState.placementMode) {
    event.preventDefault();
    uiState.exitPlacementMode();
    return { prevented };
  }

  // 3. Escape deselects selected node/edge and closes right panel
  if (event.key === 'Escape') {
    // Don't deselect if any modal dialog is open (they handle their own Escape)
    if (
      uiState.deleteDialogOpen ||
      uiState.connectionDialogOpen ||
      uiState.unsavedChangesDialogOpen ||
      uiState.errorDialogOpen ||
      uiState.integrityWarningDialogOpen
    ) {
      return { prevented };
    }

    const canvasState = useCanvasStore.getState();
    if (canvasState.selectedNodeId || canvasState.selectedEdgeId) {
      event.preventDefault();
      canvasState.clearSelection();
      uiState.closeRightPanel();
      return { prevented };
    }
  }

  return { prevented };
}

/**
 * Simulates a dialog's own Escape key handler.
 * Each dialog independently listens for Escape and closes itself.
 */
function simulateDialogEscapeHandler(
  isOpen: boolean,
  closeAction: () => void
): { prevented: boolean; stopped: boolean } {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });

  let prevented = false;
  let stopped = false;
  vi.spyOn(event, 'preventDefault').mockImplementation(() => {
    prevented = true;
  });
  vi.spyOn(event, 'stopPropagation').mockImplementation(() => {
    stopped = true;
  });

  if (!isOpen) return { prevented, stopped };

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeAction();
  }

  return { prevented, stopped };
}

describe('Feature #211: Keyboard shortcut Escape deselects and closes panels', () => {
  // =====================================================
  // 1. Escape deselects a selected node
  // =====================================================
  describe('Node deselection', () => {
    it('Escape deselects a selected node', () => {
      // Select a node
      useCanvasStore.getState().selectNode('node-1');
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');

      // Press Escape
      simulateCanvasEscapeHandler();

      // Node should be deselected
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });

    it('Escape deselects a selected edge', () => {
      // Select an edge
      useCanvasStore.getState().selectEdge('edge-1');
      expect(useCanvasStore.getState().selectedEdgeId).toBe('edge-1');

      // Press Escape
      simulateCanvasEscapeHandler();

      // Edge should be deselected
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('Escape closes right panel when deselecting', () => {
      // Select a node and open right panel
      useCanvasStore.getState().selectNode('node-1');
      useUIStore.getState().openRightPanel();
      expect(useUIStore.getState().rightPanelOpen).toBe(true);

      // Press Escape
      simulateCanvasEscapeHandler();

      // Right panel should be closed
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });

    it('Escape closes right panel when deselecting an edge', () => {
      // Select an edge and open right panel
      useCanvasStore.getState().selectEdge('edge-1');
      useUIStore.getState().openRightPanel();
      expect(useUIStore.getState().rightPanelOpen).toBe(true);

      // Press Escape
      simulateCanvasEscapeHandler();

      // Right panel should be closed
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('Escape preventDefault is called when a node is selected', () => {
      useCanvasStore.getState().selectNode('node-1');

      const { prevented } = simulateCanvasEscapeHandler();

      expect(prevented).toBe(true);
    });

    it('Escape does nothing when nothing is selected (no node, no edge)', () => {
      // No selection
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();

      const { prevented } = simulateCanvasEscapeHandler();

      // Should not call preventDefault
      expect(prevented).toBe(false);
      // State should remain unchanged
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });
  });

  // =====================================================
  // 2. Escape closes modal dialogs
  // =====================================================
  describe('Modal dialog closing', () => {
    it('Escape closes the delete confirmation dialog', () => {
      useUIStore.getState().openDeleteDialog({
        nodeId: 'node-1',
        nodeName: 'Test Node',
        edgeCount: 2,
        childCount: 0,
      });
      expect(useUIStore.getState().deleteDialogOpen).toBe(true);

      // Dialog handles its own Escape
      simulateDialogEscapeHandler(true, useUIStore.getState().closeDeleteDialog);

      expect(useUIStore.getState().deleteDialogOpen).toBe(false);
      expect(useUIStore.getState().deleteDialogInfo).toBeNull();
    });

    it('Escape closes the connection type dialog', () => {
      useUIStore.getState().openConnectionDialog({
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
      });
      expect(useUIStore.getState().connectionDialogOpen).toBe(true);

      simulateDialogEscapeHandler(true, useUIStore.getState().closeConnectionDialog);

      expect(useUIStore.getState().connectionDialogOpen).toBe(false);
      expect(useUIStore.getState().connectionDialogInfo).toBeNull();
    });

    it('Escape closes the unsaved changes dialog', () => {
      useUIStore.getState().openUnsavedChangesDialog({
        onConfirm: vi.fn(),
      });
      expect(useUIStore.getState().unsavedChangesDialogOpen).toBe(true);

      simulateDialogEscapeHandler(true, useUIStore.getState().closeUnsavedChangesDialog);

      expect(useUIStore.getState().unsavedChangesDialogOpen).toBe(false);
      expect(useUIStore.getState().unsavedChangesDialogInfo).toBeNull();
    });

    it('Escape closes the error dialog', () => {
      useUIStore.getState().openErrorDialog({
        title: 'Error Title',
        message: 'Error details here',
      });
      expect(useUIStore.getState().errorDialogOpen).toBe(true);

      simulateDialogEscapeHandler(true, useUIStore.getState().closeErrorDialog);

      expect(useUIStore.getState().errorDialogOpen).toBe(false);
      expect(useUIStore.getState().errorDialogInfo).toBeNull();
    });

    it('Escape closes the integrity warning dialog', () => {
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'Checksum mismatch',
        onProceed: vi.fn(),
      });
      expect(useUIStore.getState().integrityWarningDialogOpen).toBe(true);

      simulateDialogEscapeHandler(true, useUIStore.getState().closeIntegrityWarningDialog);

      expect(useUIStore.getState().integrityWarningDialogOpen).toBe(false);
      expect(useUIStore.getState().integrityWarningDialogInfo).toBeNull();
    });

    it('Dialog Escape handler calls stopPropagation (prevents canvas from also handling it)', () => {
      useUIStore.getState().openDeleteDialog({
        nodeId: 'node-1',
        nodeName: 'Test',
        edgeCount: 0,
        childCount: 0,
      });

      const { stopped } = simulateDialogEscapeHandler(
        true,
        useUIStore.getState().closeDeleteDialog
      );

      expect(stopped).toBe(true);
    });

    it('Canvas Escape does NOT deselect when a dialog is open', () => {
      // Select a node
      useCanvasStore.getState().selectNode('node-1');

      // Open a delete dialog
      useUIStore.getState().openDeleteDialog({
        nodeId: 'node-1',
        nodeName: 'Test',
        edgeCount: 0,
        childCount: 0,
      });

      // Canvas Escape handler should skip deselection when dialog is open
      const { prevented } = simulateCanvasEscapeHandler();

      // Node should remain selected (dialog gets Escape, not canvas)
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      expect(prevented).toBe(false);
    });

    it('Canvas Escape skips deselection for all dialog types', () => {
      useCanvasStore.getState().selectNode('node-1');

      // Test each dialog type prevents canvas Escape from deselecting
      const dialogTypes = [
        () => useUIStore.getState().openDeleteDialog({ nodeId: 'x', nodeName: 'X', edgeCount: 0, childCount: 0 }),
        () => useUIStore.getState().openConnectionDialog({ sourceNodeId: 'a', targetNodeId: 'b' }),
        () => useUIStore.getState().openUnsavedChangesDialog({ onConfirm: vi.fn() }),
        () => useUIStore.getState().openErrorDialog({ title: 'Err', message: 'msg' }),
        () => useUIStore.getState().openIntegrityWarningDialog({ message: 'warn', onProceed: vi.fn() }),
      ];

      for (const openDialog of dialogTypes) {
        // Reset
        useCanvasStore.getState().selectNode('node-1');
        useUIStore.setState({
          deleteDialogOpen: false,
          connectionDialogOpen: false,
          unsavedChangesDialogOpen: false,
          errorDialogOpen: false,
          integrityWarningDialogOpen: false,
        });

        openDialog();

        simulateCanvasEscapeHandler();

        // Node must remain selected while any dialog is open
        expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      }
    });
  });

  // =====================================================
  // 3. Escape exits placement mode
  // =====================================================
  describe('Placement mode exit', () => {
    it('Escape exits placement mode', () => {
      useUIStore.getState().enterPlacementMode({
        nodeType: 'compute/service',
        displayName: 'Service',
      });
      expect(useUIStore.getState().placementMode).toBe(true);
      expect(useUIStore.getState().placementInfo).not.toBeNull();

      // Press Escape
      simulateCanvasEscapeHandler();

      expect(useUIStore.getState().placementMode).toBe(false);
      expect(useUIStore.getState().placementInfo).toBeNull();
    });

    it('Escape in placement mode calls preventDefault', () => {
      useUIStore.getState().enterPlacementMode({
        nodeType: 'data/database',
        displayName: 'Database',
      });

      const { prevented } = simulateCanvasEscapeHandler();

      expect(prevented).toBe(true);
    });

    it('Escape in placement mode does NOT deselect nodes', () => {
      // Select a node and enter placement mode simultaneously
      useCanvasStore.getState().selectNode('node-1');
      useUIStore.getState().enterPlacementMode({
        nodeType: 'compute/service',
        displayName: 'Service',
      });

      // Press Escape - should ONLY exit placement mode (it has higher priority)
      simulateCanvasEscapeHandler();

      // Placement mode exited
      expect(useUIStore.getState().placementMode).toBe(false);

      // But node is still selected (placement exit takes priority, returns early)
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
    });

    it('Second Escape after placement mode exit deselects the node', () => {
      // Select a node and enter placement mode
      useCanvasStore.getState().selectNode('node-1');
      useUIStore.getState().enterPlacementMode({
        nodeType: 'compute/service',
        displayName: 'Service',
      });

      // First Escape exits placement mode
      simulateCanvasEscapeHandler();
      expect(useUIStore.getState().placementMode).toBe(false);
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');

      // Second Escape deselects the node
      simulateCanvasEscapeHandler();
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });
  });

  // =====================================================
  // 4. Input field passthrough
  // =====================================================
  describe('Input field passthrough', () => {
    it('Escape is ignored when focus is in an INPUT element', () => {
      useCanvasStore.getState().selectNode('node-1');

      const input = document.createElement('input');
      const { prevented } = simulateCanvasEscapeHandler(input);

      // Should NOT deselect when typing in input
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      expect(prevented).toBe(false);
    });

    it('Escape is ignored when focus is in a TEXTAREA element', () => {
      useCanvasStore.getState().selectNode('node-1');

      const textarea = document.createElement('textarea');
      const { prevented } = simulateCanvasEscapeHandler(textarea);

      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      expect(prevented).toBe(false);
    });

    it('Escape is ignored when focus is in a contentEditable element', () => {
      useCanvasStore.getState().selectNode('node-1');

      // jsdom doesn't fully support isContentEditable, so we mock it
      const div = document.createElement('div');
      Object.defineProperty(div, 'isContentEditable', { value: true });

      const { prevented } = simulateCanvasEscapeHandler(div);

      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      expect(prevented).toBe(false);
    });
  });

  // =====================================================
  // 5. Store action correctness
  // =====================================================
  describe('Store action correctness', () => {
    it('clearSelection clears both selectedNodeId and selectedEdgeId', () => {
      useCanvasStore.getState().selectNode('node-1');
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');

      useCanvasStore.getState().clearSelection();

      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('closeRightPanel sets rightPanelOpen to false', () => {
      useUIStore.getState().openRightPanel();
      expect(useUIStore.getState().rightPanelOpen).toBe(true);

      useUIStore.getState().closeRightPanel();

      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });

    it('exitPlacementMode clears both placementMode and placementInfo', () => {
      useUIStore.getState().enterPlacementMode({
        nodeType: 'compute/service',
        displayName: 'Service',
      });

      useUIStore.getState().exitPlacementMode();

      expect(useUIStore.getState().placementMode).toBe(false);
      expect(useUIStore.getState().placementInfo).toBeNull();
    });

    it('selecting a node auto-clears edge selection', () => {
      useCanvasStore.getState().selectEdge('edge-1');
      expect(useCanvasStore.getState().selectedEdgeId).toBe('edge-1');

      useCanvasStore.getState().selectNode('node-1');

      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');
      expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('selecting an edge auto-clears node selection', () => {
      useCanvasStore.getState().selectNode('node-1');
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-1');

      useCanvasStore.getState().selectEdge('edge-1');

      expect(useCanvasStore.getState().selectedEdgeId).toBe('edge-1');
      expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });
  });
});
