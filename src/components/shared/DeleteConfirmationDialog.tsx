/**
 * DeleteConfirmationDialog - modal overlay showing deletion impact.
 * Displays the node name (or count for multi-select), affected edges, and child nodes.
 * User can Cancel or Confirm the deletion.
 * Fully keyboard accessible: Enter=confirm, Escape=cancel, Tab between buttons.
 * Shows undo hint toast after successful deletion.
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePlatformModifier } from '@/hooks/usePlatformModifier';
import { useHaptics } from '@/hooks/useHaptics';

export function DeleteConfirmationDialog() {
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const deleteDialogInfo = useUIStore((s) => s.deleteDialogInfo);
  const closeDeleteDialog = useUIStore((s) => s.closeDeleteDialog);
  const showToast = useUIStore((s) => s.showToast);
  const removeNode = useCoreStore((s) => s.removeNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(deleteDialogOpen);
  const { formatBinding } = usePlatformModifier();
  const hapticActions = useHaptics();

  // Focus the Confirm button when dialog opens
  useEffect(() => {
    if (deleteDialogOpen && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [deleteDialogOpen]);

  const handleConfirm = useCallback(() => {
    if (!deleteDialogInfo) return;

    const isMulti = deleteDialogInfo.nodeIds && deleteDialogInfo.nodeIds.length > 1;

    if (isMulti) {
      // Multi-node deletion: remove all nodes, single undo snapshot
      const { textApi, undoManager } = useCoreStore.getState();
      if (textApi && undoManager) {
        const nodeIds = deleteDialogInfo.nodeIds!;
        for (const nodeId of nodeIds) {
          textApi.removeNode(nodeId);
        }
        const updatedGraph = textApi.getGraph();
        undoManager.snapshot(`Delete ${nodeIds.length} nodes`, updatedGraph);

        // Helper to count all nodes recursively
        const countAllNodes = (graph: typeof updatedGraph): number => {
          let count = 0;
          const countRecursive = (nodes: typeof graph.nodes) => {
            for (const node of nodes) {
              count++;
              if (node.children.length > 0) countRecursive(node.children);
            }
          };
          countRecursive(graph.nodes);
          return count;
        };

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          nodeCount: countAllNodes(updatedGraph),
          edgeCount: updatedGraph.edges.length,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });
      }
      clearSelection();
      closeDeleteDialog();
      hapticActions.notification('Warning');
      showToast(
        `Deleted ${deleteDialogInfo.nodeIds!.length} nodes. ${formatBinding('mod+z')} to undo`,
      );
    } else {
      // Single node deletion (original behavior)
      const deletedName = deleteDialogInfo.nodeName;
      removeNode(deleteDialogInfo.nodeId);
      clearSelection();
      closeDeleteDialog();
      hapticActions.notification('Warning');
      showToast(`Deleted ${deletedName}. ${formatBinding('mod+z')} to undo`);
    }
  }, [
    deleteDialogInfo,
    removeNode,
    clearSelection,
    closeDeleteDialog,
    showToast,
    formatBinding,
    hapticActions,
  ]);

  // Handle keyboard: Escape to cancel, Enter to confirm
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!deleteDialogOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeDeleteDialog();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    },
    [deleteDialogOpen, closeDeleteDialog, handleConfirm],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleCancel = useCallback(() => {
    closeDeleteDialog();
  }, [closeDeleteDialog]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeDeleteDialog();
      }
    },
    [closeDeleteDialog],
  );

  if (!deleteDialogOpen || !deleteDialogInfo) return null;

  const { nodeName, edgeCount, childCount, nodeCount } = deleteDialogInfo;
  const isMulti = (nodeCount ?? 1) > 1;
  const hasImpact = edgeCount > 0 || childCount > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid="delete-confirmation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-md w-full mx-4 p-6 compact-dialog-sheet"
        data-testid="delete-dialog-content"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-foreground">
              {isMulti ? `Delete ${nodeCount} Nodes` : 'Delete Node'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isMulti ? (
                <>
                  Are you sure you want to delete{' '}
                  <strong data-testid="delete-node-name">{nodeCount} selected nodes</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <strong data-testid="delete-node-name">{nodeName}</strong>?
                </>
              )}
            </p>
          </div>
        </div>

        {/* Impact details */}
        {hasImpact && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4"
            data-testid="delete-impact-info"
          >
            <p className="text-sm font-medium text-amber-800 mb-2">This will also remove:</p>
            <ul className="text-sm text-amber-700 space-y-1">
              {edgeCount > 0 && (
                <li data-testid="delete-edge-count">
                  {edgeCount} connected {edgeCount === 1 ? 'edge' : 'edges'}
                </li>
              )}
              {childCount > 0 && (
                <li data-testid="delete-child-count">
                  {childCount} child {childCount === 1 ? 'node' : 'nodes'}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Action text */}
        <p className="text-sm text-muted-foreground mb-4">
          This action can be undone with {formatBinding('mod+z')}.
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-foreground bg-surface border border-border rounded-md hover:bg-highlight-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="delete-cancel-button"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-love border border-transparent rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-love"
            data-testid="delete-confirm-button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
