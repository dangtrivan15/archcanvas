/**
 * UnsavedChangesDialog - modal asking user to confirm discarding unsaved changes.
 * Displayed when user attempts File > New or similar destructive actions while isDirty.
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function UnsavedChangesDialog() {
  const open = useUIStore((s) => s.unsavedChangesDialogOpen);
  const info = useUIStore((s) => s.unsavedChangesDialogInfo);
  const closeDialog = useUIStore((s) => s.closeUnsavedChangesDialog);
  const discardRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Focus the Discard button when dialog opens
  useEffect(() => {
    if (open && discardRef.current) {
      discardRef.current.focus();
    }
  }, [open]);

  // Handle keyboard: Escape to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeDialog();
      }
    },
    [open, closeDialog],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleDiscard = useCallback(() => {
    if (!info) return;
    info.onConfirm();
    closeDialog();
  }, [info, closeDialog]);

  const handleCancel = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeDialog();
      }
    },
    [closeDialog],
  );

  if (!open || !info) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="unsaved-changes-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
    >
      <div ref={focusTrapRef} className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" data-testid="unsaved-dialog-content">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 id="unsaved-dialog-title" className="text-lg font-semibold text-gray-900">
              Unsaved Changes
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              You have unsaved changes that will be lost. Do you want to continue?
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="unsaved-cancel-button"
          >
            Cancel
          </button>
          <button
            ref={discardRef}
            type="button"
            onClick={handleDiscard}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            data-testid="unsaved-discard-button"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
