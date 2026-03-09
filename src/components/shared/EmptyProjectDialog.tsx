/**
 * EmptyProjectDialog - shown when a user opens a folder with no .archc files.
 *
 * Presents two choices:
 * 1. "Use Claude Code" (recommended) - opens the Claude Code terminal panel
 * 2. "Quick Scan (basic)" - runs the structural scanner/inferEngine as a fallback
 */

import { useEffect, useCallback } from 'react';
import { FolderOpen, Sparkles, Zap } from 'lucide-react';
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

  const { folderName, hasSourceFiles, onUseAI, onQuickScan } = info;

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
              Initialize Architecture
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              The folder{' '}
              <strong
                className="text-foreground"
                data-testid="empty-project-folder-name"
              >
                {folderName}
              </strong>{' '}
              doesn&apos;t contain any .archc files. How would you like to get
              started?
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Use Claude Code option */}
          <button
            type="button"
            onClick={onUseAI}
            className="w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors border-iris bg-iris/5 hover:bg-iris/10 ring-1 ring-iris/30"
            data-testid="empty-project-ai-button"
          >
            <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 text-iris" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Use Claude Code
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full bg-iris/20 text-iris font-medium"
                  data-testid="empty-project-recommended-badge"
                >
                  Recommended
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {hasSourceFiles
                  ? 'Source files detected. Open Claude Code to analyze your codebase and generate a comprehensive architecture diagram.'
                  : 'Open Claude Code to analyze your project and generate an architecture diagram with smart component detection.'}
              </p>
            </div>
          </button>

          {/* Quick scan option */}
          <button
            type="button"
            onClick={onQuickScan}
            className="w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors border-border hover:bg-muted/50"
            data-testid="empty-project-quickscan-button"
          >
            <Zap className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  Quick scan
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                  Basic
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Fast structural scan using file patterns and heuristics. No AI
                required — works offline.
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
