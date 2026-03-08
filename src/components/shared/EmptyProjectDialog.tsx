/**
 * EmptyProjectDialog - shown when a user opens a folder with no .archc files.
 *
 * Presents two choices:
 * 1. "Use AI (recommended)" - routes to built-in agentic loop, external agent, or setup prompt
 * 2. "Quick scan (basic)" - runs the structural scanner/inferEngine as a fallback
 *
 * When "Use AI" is selected:
 *   - If an API key is configured, starts the built-in agentic loop immediately
 *   - If no API key, shows a secondary "AI Setup Required" view with options:
 *     a) Configure API key (opens Settings)
 *     b) Use external agent (opens ExternalAgentDialog)
 *     c) Fall back to quick scan
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Sparkles,
  Zap,
  Settings,
  Bot,
  ArrowLeft,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/** View state within the dialog */
type DialogView = 'choose' | 'ai-setup';

export function EmptyProjectDialog() {
  const open = useUIStore((s) => s.emptyProjectDialogOpen);
  const info = useUIStore((s) => s.emptyProjectDialogInfo);
  const closeDialog = useUIStore((s) => s.closeEmptyProjectDialog);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);
  const [view, setView] = useState<DialogView>('choose');

  // Reset view when dialog opens/closes
  useEffect(() => {
    if (open) {
      setView('choose');
    }
  }, [open]);

  // Handle keyboard: Escape to cancel (or go back from ai-setup)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (view === 'ai-setup') {
          setView('choose');
        } else {
          closeDialog();
        }
      }
    },
    [open, closeDialog, view],
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

  const {
    folderName,
    hasSourceFiles,
    onUseAI,
    onQuickScan,
    onConfigureApiKey,
    onUseExternalAgent,
    hasApiKey,
  } = info;

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
        {view === 'choose' ? (
          <ChooseView
            folderName={folderName}
            hasSourceFiles={hasSourceFiles}
            hasApiKey={hasApiKey}
            onUseAI={onUseAI}
            onQuickScan={onQuickScan}
            onShowAISetup={() => setView('ai-setup')}
            onCancel={closeDialog}
          />
        ) : (
          <AISetupView
            folderName={folderName}
            onConfigureApiKey={onConfigureApiKey}
            onUseExternalAgent={onUseExternalAgent}
            onQuickScan={onQuickScan}
            onBack={() => setView('choose')}
          />
        )}
      </div>
    </div>
  );
}

// ── Choose View ──────────────────────────────────────────────────────────────

interface ChooseViewProps {
  folderName: string;
  hasSourceFiles: boolean;
  hasApiKey: boolean;
  onUseAI: () => void;
  onQuickScan: () => void;
  onShowAISetup: () => void;
  onCancel: () => void;
}

function ChooseView({
  folderName,
  hasSourceFiles,
  hasApiKey,
  onUseAI,
  onQuickScan,
  onShowAISetup,
  onCancel,
}: ChooseViewProps) {
  const handleUseAI = useCallback(() => {
    if (hasApiKey) {
      onUseAI();
    } else {
      onShowAISetup();
    }
  }, [hasApiKey, onUseAI, onShowAISetup]);

  return (
    <>
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
        {/* Use AI option */}
        <button
          type="button"
          onClick={handleUseAI}
          className="w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors border-iris bg-iris/5 hover:bg-iris/10 ring-1 ring-iris/30"
          data-testid="empty-project-ai-button"
        >
          <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0 text-iris" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                Use AI
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
                ? 'Source files detected. Let AI analyze your codebase and generate a comprehensive architecture diagram.'
                : 'Use AI to analyze your project and generate an architecture diagram with smart component detection.'}
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
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="empty-project-cancel-button"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

// ── AI Setup View ────────────────────────────────────────────────────────────

interface AISetupViewProps {
  folderName: string;
  onConfigureApiKey: () => void;
  onUseExternalAgent: () => void;
  onQuickScan: () => void;
  onBack: () => void;
}

function AISetupView({
  folderName,
  onConfigureApiKey,
  onUseExternalAgent,
  onQuickScan,
  onBack,
}: AISetupViewProps) {
  return (
    <>
      {/* Header with back button */}
      <div className="flex items-start gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          data-testid="empty-project-back-button"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h2
            id="empty-project-dialog-title"
            className="text-lg font-semibold text-foreground"
            data-testid="empty-project-ai-setup-title"
          >
            AI Setup Required
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            No AI configuration found. Choose how to connect AI for{' '}
            <strong className="text-foreground">{folderName}</strong>.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {/* Configure API Key option */}
        <button
          type="button"
          onClick={onConfigureApiKey}
          className="w-full flex items-start gap-3 p-4 rounded-lg border border-iris bg-iris/5 hover:bg-iris/10 ring-1 ring-iris/30 text-left transition-colors"
          data-testid="empty-project-configure-key-button"
        >
          <Settings className="w-5 h-5 mt-0.5 flex-shrink-0 text-iris" />
          <div>
            <span className="font-medium text-foreground">
              Configure API Key
            </span>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter your Anthropic API key in Settings. The built-in AI agent
              will analyze your codebase directly.
            </p>
          </div>
        </button>

        {/* Use External Agent option */}
        <button
          type="button"
          onClick={onUseExternalAgent}
          className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
          data-testid="empty-project-external-agent-button"
        >
          <Bot className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div>
            <span className="font-medium text-foreground">
              Use External Agent
            </span>
            <p className="text-sm text-muted-foreground mt-0.5">
              Get a copyable prompt for Claude Code or another MCP-connected
              agent to build the architecture graph.
            </p>
          </div>
        </button>

        {/* Fall back to quick scan */}
        <button
          type="button"
          onClick={onQuickScan}
          className="w-full flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
          data-testid="empty-project-fallback-quickscan-button"
        >
          <Zap className="w-5 h-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div>
            <span className="font-medium text-foreground">
              Fall back to Quick Scan
            </span>
            <p className="text-sm text-muted-foreground mt-0.5">
              Skip AI and run a fast structural scan instead.
            </p>
          </div>
        </button>
      </div>

      {/* Cancel button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="empty-project-ai-setup-cancel-button"
        >
          Back
        </button>
      </div>
    </>
  );
}
