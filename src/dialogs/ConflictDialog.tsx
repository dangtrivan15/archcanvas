/**
 * ConflictDialog - modal shown when an external modification is detected
 * while the user has unsaved local changes (isDirty is true).
 *
 * Presents three options:
 * 1. "Reload from disk" - discard local changes and reload the externally modified file
 * 2. "Keep your version" - dismiss the dialog, keep working with local changes
 * 3. "Save as copy" - save local changes to a new file, then reload from disk
 */

import { useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFileStore } from '@/store/fileStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { registerDialog } from './registry';

export function ConflictDialog() {
  const open = useUIStore((s) => s.conflictDialogOpen);
  const info = useUIStore((s) => s.conflictDialogInfo);
  const closeDialog = useUIStore((s) => s.closeConflictDialog);
  const keepRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Focus the "Keep your version" button when dialog opens (safest default)
  useEffect(() => {
    if (open && keepRef.current) {
      keepRef.current.focus();
    }
  }, [open]);

  // Handle keyboard: Escape to dismiss (keep local version)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleKeep();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, info],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleReload = useCallback(() => {
    if (!info) return;
    info.onReload();
    closeDialog();
  }, [info, closeDialog]);

  const handleKeep = useCallback(() => {
    // Acknowledge the external modification and dismiss
    useFileStore.getState().acknowledgeExternalModification();
    closeDialog();
  }, [closeDialog]);

  const handleSaveAsCopy = useCallback(() => {
    if (!info) return;
    info.onSaveAsCopy();
    closeDialog();
  }, [info, closeDialog]);

  // Handle backdrop click (keep local version)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleKeep();
      }
    },
    [handleKeep],
  );

  if (!open || !info) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid="conflict-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      aria-describedby="conflict-dialog-message"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-md w-full mx-4 p-6 compact-dialog-sheet"
        data-testid="conflict-dialog-content"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2
              id="conflict-dialog-title"
              className="text-lg font-semibold text-foreground"
              data-testid="conflict-dialog-title"
            >
              File Modified Externally
            </h2>
            <p
              id="conflict-dialog-message"
              className="text-sm text-muted-foreground mt-1"
              data-testid="conflict-dialog-message"
            >
              The file &quot;{info.fileName}&quot; has been modified outside of ArchCanvas while you
              have unsaved local changes. How would you like to resolve this conflict?
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={handleSaveAsCopy}
            className="px-4 py-2 text-sm font-medium text-foreground bg-surface border border-border rounded-md hover:bg-highlight-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="conflict-save-as-copy-button"
          >
            Save as copy
          </button>
          <button
            ref={keepRef}
            type="button"
            onClick={handleKeep}
            className="px-4 py-2 text-sm font-medium text-foreground bg-surface border border-border rounded-md hover:bg-highlight-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="conflict-keep-button"
          >
            Keep your version
          </button>
          <button
            type="button"
            onClick={handleReload}
            className="px-4 py-2 text-sm font-medium text-white bg-gold border border-transparent rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            data-testid="conflict-reload-button"
          >
            Reload from disk
          </button>
        </div>
      </div>
    </div>
  );
}

// Self-register with the dialog registry
registerDialog({ id: 'conflict', component: ConflictDialog });
