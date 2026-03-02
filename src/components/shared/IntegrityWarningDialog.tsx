/**
 * IntegrityWarningDialog - modal warning about file integrity issues.
 * Shown when a .archc file's SHA-256 checksum doesn't match its payload.
 * User can cancel (don't open) or proceed anyway (skip checksum verification).
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function IntegrityWarningDialog() {
  const open = useUIStore((s) => s.integrityWarningDialogOpen);
  const info = useUIStore((s) => s.integrityWarningDialogInfo);
  const closeDialog = useUIStore((s) => s.closeIntegrityWarningDialog);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the Cancel button when dialog opens (safer default)
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
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

  const handleProceed = useCallback(() => {
    if (!info) return;
    info.onProceed();
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
      data-testid="integrity-warning-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="integrity-warning-title"
      aria-describedby="integrity-warning-message"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" data-testid="integrity-warning-content">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 id="integrity-warning-title" className="text-lg font-semibold text-gray-900" data-testid="integrity-warning-title">
              File Integrity Warning
            </h2>
            <p id="integrity-warning-message" className="text-sm text-gray-500 mt-1" data-testid="integrity-warning-message">
              {info.message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="integrity-warning-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            data-testid="integrity-warning-proceed-button"
          >
            Open Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
