/**
 * ErrorDialog - modal showing error messages to the user.
 * Used when file operations fail (e.g., corrupt .archc file, invalid format).
 */

import { useEffect, useCallback, useRef } from 'react';
import { XCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function ErrorDialog() {
  const open = useUIStore((s) => s.errorDialogOpen);
  const info = useUIStore((s) => s.errorDialogInfo);
  const closeDialog = useUIStore((s) => s.closeErrorDialog);
  const okRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Focus the OK button when dialog opens
  useEffect(() => {
    if (open && okRef.current) {
      okRef.current.focus();
    }
  }, [open]);

  // Handle keyboard: Escape or Enter to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape' || e.key === 'Enter') {
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid="error-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-message"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-md w-full mx-4 p-6 compact-dialog-sheet"
        data-testid="error-dialog-content"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="error-dialog-title"
              className="text-lg font-semibold text-foreground"
              data-testid="error-dialog-title"
            >
              {info.title}
            </h2>
            <p
              id="error-dialog-message"
              className="text-sm text-muted-foreground mt-1"
              data-testid="error-dialog-message"
            >
              {info.message}
            </p>
          </div>
        </div>

        {/* Button */}
        <div className="flex justify-end">
          <button
            ref={okRef}
            type="button"
            onClick={closeDialog}
            className="px-4 py-2 text-sm font-medium text-white bg-love border border-transparent rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-love"
            data-testid="error-dialog-ok-button"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
