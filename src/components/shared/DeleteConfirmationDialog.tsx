/**
 * DeleteConfirmationDialog - modal overlay showing deletion impact.
 * Displays the node name, affected edges, and child nodes.
 * User can Cancel or Confirm the deletion.
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePlatformModifier } from '@/hooks/usePlatformModifier';

export function DeleteConfirmationDialog() {
  const deleteDialogOpen = useUIStore((s) => s.deleteDialogOpen);
  const deleteDialogInfo = useUIStore((s) => s.deleteDialogInfo);
  const closeDeleteDialog = useUIStore((s) => s.closeDeleteDialog);
  const removeNode = useCoreStore((s) => s.removeNode);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(deleteDialogOpen);
  const { formatBinding } = usePlatformModifier();

  // Focus the Confirm button when dialog opens
  useEffect(() => {
    if (deleteDialogOpen && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [deleteDialogOpen]);

  // Handle keyboard: Escape to cancel, Enter to confirm
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!deleteDialogOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeDeleteDialog();
      }
    },
    [deleteDialogOpen, closeDeleteDialog],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleConfirm = useCallback(() => {
    if (!deleteDialogInfo) return;
    removeNode(deleteDialogInfo.nodeId);
    clearSelection();
    closeDeleteDialog();
  }, [deleteDialogInfo, removeNode, clearSelection, closeDeleteDialog]);

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

  const { nodeName, edgeCount, childCount } = deleteDialogInfo;
  const hasImpact = edgeCount > 0 || childCount > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="delete-confirmation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div ref={focusTrapRef} className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" data-testid="delete-dialog-content">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-gray-900">
              Delete Node
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to delete <strong data-testid="delete-node-name">{nodeName}</strong>?
            </p>
          </div>
        </div>

        {/* Impact details */}
        {hasImpact && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4" data-testid="delete-impact-info">
            <p className="text-sm font-medium text-amber-800 mb-2">
              This will also remove:
            </p>
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
        <p className="text-sm text-gray-500 mb-4">
          This action can be undone with {formatBinding('mod+z')}.
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="delete-cancel-button"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            data-testid="delete-confirm-button"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
