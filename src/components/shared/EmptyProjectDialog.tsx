/**
 * EmptyProjectDialog - shown when a user opens a folder with no .archc files.
 *
 * Presents two choices:
 * 1. "Analyze Codebase" — run the AI analysis pipeline to generate an .archc
 * 2. "Start Blank" — create a new empty .archc file and open it
 *
 * If the folder contains recognizable source files, "Analyze Codebase" is highlighted
 * as the recommended option. Otherwise, "Start Blank" is the default.
 */

import { useEffect, useCallback } from 'react';
import { FolderOpen, ScanSearch, FilePlus2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function EmptyProjectDialog() {
  const open = useUIStore((s) => s.emptyProjectDialogOpen);
  const info = useUIStore((s) => s.emptyProjectDialogInfo);
  const closeDialog = useUIStore((s) => s.closeEmptyProjectDialog);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

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

  const { folderName, hasSourceFiles, onAnalyze, onStartBlank } = info;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid="empty-project-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="empty-project-dialog-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-md w-full mx-4 p-6 compact-dialog-sheet"
        data-testid="empty-project-dialog-content"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-iris/20 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-iris" />
          </div>
          <div>
            <h2
              id="empty-project-dialog-title"
              className="text-lg font-semibold text-foreground"
              data-testid="empty-project-dialog-title"
            >
              No Architecture Files Found
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              The folder <strong
                className="text-foreground"
                data-testid="empty-project-folder-name"
              >{folderName}</strong> doesn&apos;t contain any .archc files.
              How would you like to get started?
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Analyze Codebase option */}
          <button
            type="button"
            onClick={onAnalyze}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
              hasSourceFiles
                ? 'border-iris bg-iris/5 hover:bg-iris/10 ring-1 ring-iris/30'
                : 'border-border hover:bg-muted/50'
            }`}
            data-testid="empty-project-analyze-button"
          >
            <ScanSearch className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              hasSourceFiles ? 'text-iris' : 'text-muted-foreground'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Analyze Codebase</span>
                {hasSourceFiles && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full bg-iris/20 text-iris font-medium"
                    data-testid="empty-project-recommended-badge"
                  >
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {hasSourceFiles
                  ? 'Source files detected. Let AI analyze your codebase and generate an architecture diagram.'
                  : 'Run AI analysis to generate an architecture diagram from existing source code.'}
              </p>
            </div>
          </button>

          {/* Start Blank option */}
          <button
            type="button"
            onClick={onStartBlank}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
              !hasSourceFiles
                ? 'border-iris bg-iris/5 hover:bg-iris/10 ring-1 ring-iris/30'
                : 'border-border hover:bg-muted/50'
            }`}
            data-testid="empty-project-blank-button"
          >
            <FilePlus2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              !hasSourceFiles ? 'text-iris' : 'text-muted-foreground'
            }`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Start Blank</span>
                {!hasSourceFiles && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full bg-iris/20 text-iris font-medium"
                    data-testid="empty-project-recommended-badge"
                  >
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create a new empty architecture file and start designing from scratch.
              </p>
            </div>
          </button>
        </div>

        {/* Cancel button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeDialog}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="empty-project-cancel-button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
