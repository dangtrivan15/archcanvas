/**
 * AnalysisProgressDialog — shown during codebase analysis.
 *
 * Displays a modal with:
 * - Current phase (scanning, detecting, selecting, inferring, building, saving)
 * - Progress bar (0-100%)
 * - Phase-specific status message
 * - Cancel button (triggers AbortController)
 * - Error state with retry option
 *
 * This is a self-contained connected component that reads directly from
 * the analysisStore (not from uiStore). Previously, App.tsx held a
 * `AnalysisProgressDialogConnected` wrapper — that logic is now inlined here.
 */

import { useCallback, useEffect } from 'react';
import {
  FolderSearch,
  Search,
  FileText,
  Brain,
  Hammer,
  Save,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { PipelinePhase } from '@/analyze/browserPipeline';
import { useAnalysisStore } from '@/store/analysisStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { registerDialog } from './registry';

// ── Phase metadata ──────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<PipelinePhase, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  scanning: { icon: FolderSearch, label: 'Scanning Files' },
  detecting: { icon: Search, label: 'Detecting Project Type' },
  selecting: { icon: FileText, label: 'Selecting Key Files' },
  inferring: { icon: Brain, label: 'AI Inference' },
  building: { icon: Hammer, label: 'Building Graph' },
  saving: { icon: Save, label: 'Saving' },
  complete: { icon: CheckCircle, label: 'Complete' },
};

const PHASE_ORDER: PipelinePhase[] = [
  'scanning', 'detecting', 'selecting', 'inferring', 'building', 'saving', 'complete',
];

// ── Component ───────────────────────────────────────────────────────────────

export function AnalysisProgressDialog() {
  // Read directly from analysisStore (no props needed)
  const open = useAnalysisStore((s) => s.dialogOpen);
  const progress = useAnalysisStore((s) => s.progress);
  const error = useAnalysisStore((s) => s.error);
  const onCancel = useAnalysisStore((s) => s.cancel);
  const onClose = useAnalysisStore((s) => s.closeDialog);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  const isComplete = progress?.phase === 'complete';
  const isRunning = !isComplete && !error;

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isRunning) {
          onCancel();
        } else {
          onClose();
        }
      }
    },
    [open, isRunning, onCancel, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!open) return null;

  const percent = progress?.percent ?? 0;
  const currentPhase = progress?.phase ?? 'scanning';
  const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      data-testid="analysis-progress-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-progress-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
        data-testid="analysis-progress-content"
      >
        {/* Header */}
        <h2
          id="analysis-progress-title"
          className="text-lg font-semibold mb-4"
          data-testid="analysis-progress-title"
        >
          {error
            ? 'Analysis Failed'
            : isComplete
              ? 'Analysis Complete'
              : 'Analyzing Codebase...'}
        </h2>

        {/* Error state */}
        {error && (
          <div className="mb-4" data-testid="analysis-progress-error">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {!error && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span data-testid="analysis-progress-message">
                {progress?.message ?? 'Starting analysis...'}
              </span>
              <span data-testid="analysis-progress-percent">{Math.round(percent)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isComplete ? 'bg-green-500' : 'bg-iris'
                }`}
                style={{ width: `${percent}%` }}
                data-testid="analysis-progress-bar"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* Phase steps */}
        {!error && (
          <div className="space-y-1.5 mb-4" data-testid="analysis-progress-phases">
            {PHASE_ORDER.filter(p => p !== 'complete').map((phase, index) => {
              const config = PHASE_CONFIG[phase];
              const Icon = config.icon;
              const isDone = index < currentPhaseIndex || isComplete;
              const isCurrent = phase === currentPhase && !isComplete;
              const isPending = index > currentPhaseIndex && !isComplete;

              return (
                <div
                  key={phase}
                  className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                    isCurrent ? 'bg-iris/10 text-foreground' : ''
                  }`}
                  data-testid={`analysis-phase-${phase}`}
                >
                  {isDone && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {isCurrent && <Loader2 className="w-4 h-4 text-iris flex-shrink-0 animate-spin" />}
                  {isPending && <Icon className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
                  <span
                    className={
                      isDone
                        ? 'text-green-500'
                        : isCurrent
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground/40'
                    }
                  >
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Complete state details */}
        {isComplete && progress?.detail && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-400">Success</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="analysis-progress-summary">
              {progress.message}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="analysis-cancel-button"
            >
              Cancel
            </button>
          )}
          {(isComplete || error) && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-iris text-white hover:bg-iris/90 transition-colors"
              data-testid="analysis-close-button"
            >
              {isComplete ? 'View Architecture' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Self-registration ────────────────────────────────────────────────────────
registerDialog({ id: 'analysis-progress', component: AnalysisProgressDialog });
