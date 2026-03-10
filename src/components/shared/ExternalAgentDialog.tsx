/**
 * ExternalAgentDialog — shown when the user chooses to use an external agent
 * (e.g., Claude Code) to analyze their codebase via MCP.
 *
 * Displays:
 * - A ready-made prompt the user can copy-paste into their agent
 * - A "Waiting for agent..." indicator
 * - Live progress: count of nodes and edges as the agent builds the graph
 * - Done and Cancel buttons
 *
 * The dialog monitors the coreStore graph state via Zustand subscription
 * and updates the node/edge counts in real-time as the external agent
 * adds items through the MCP server.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy,
  Check,
  Bot,
  Loader2,
  CheckCircle,
  Boxes,
  ArrowRightLeft,
} from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// ── Props ────────────────────────────────────────────────────────────────────

export interface ExternalAgentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** The copyable prompt text */
  prompt: string;
  /** Called when the user clicks "Done" */
  onDone: () => void;
  /** Called when the user clicks "Cancel" */
  onCancel: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExternalAgentDialog({
  open,
  prompt,
  onDone,
  onCancel,
}: ExternalAgentDialogProps) {
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor graph state for live progress
  const nodeCount = useGraphStore((s) => {
    // Count all nodes recursively
    let count = 0;
    const countNodes = (nodes: { children?: unknown[] }[]) => {
      for (const node of nodes) {
        count++;
        if (node.children && Array.isArray(node.children)) {
          countNodes(node.children as { children?: unknown[] }[]);
        }
      }
    };
    countNodes(s.graph.nodes);
    return count;
  });
  const edgeCount = useGraphStore((s) => s.graph.edges.length);

  const hasActivity = nodeCount > 0 || edgeCount > 0;

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = prompt;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [prompt]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    },
    [open, onCancel],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      data-testid="external-agent-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-agent-dialog-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-surface text-foreground rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[85vh] flex flex-col"
        data-testid="external-agent-dialog-content"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-iris/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-iris" />
          </div>
          <div>
            <h2
              id="external-agent-dialog-title"
              className="text-lg font-semibold"
              data-testid="external-agent-dialog-title"
            >
              External Agent Setup
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Copy the prompt below into your agent (e.g., Claude Code). The agent will
              use MCP tools to build the architecture graph.
            </p>
          </div>
        </div>

        {/* Copyable Prompt */}
        <div className="relative mb-4 flex-1 min-h-0">
          <div className="absolute top-2 right-2 z-10">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
              }`}
              data-testid="external-agent-copy-button"
              aria-label={copied ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre
            className="bg-muted/30 border border-border rounded-lg p-4 pr-24 text-xs font-mono text-muted-foreground overflow-auto max-h-[40vh] whitespace-pre-wrap break-words"
            data-testid="external-agent-prompt-text"
          >
            {prompt}
          </pre>
        </div>

        {/* Waiting State / Live Progress */}
        <div
          className="mb-4 p-3 rounded-lg border border-border bg-muted/10"
          data-testid="external-agent-status"
        >
          <div className="flex items-center gap-2 mb-2">
            {hasActivity ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-iris flex-shrink-0 animate-spin" />
            )}
            <span
              className="text-sm font-medium"
              data-testid="external-agent-status-text"
            >
              {hasActivity
                ? 'Agent is building the architecture...'
                : 'Waiting for agent...'}
            </span>
          </div>

          {/* Live counters */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5" data-testid="external-agent-node-count">
              <Boxes className="w-3.5 h-3.5" />
              <span>
                <strong className="text-foreground">{nodeCount}</strong> nodes
              </span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="external-agent-edge-count">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>
                <strong className="text-foreground">{edgeCount}</strong> edges
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-4 text-xs text-muted-foreground space-y-1">
          <p>1. Copy the prompt above and paste it into your agent</p>
          <p>2. Ensure the MCP server is connected to your agent</p>
          <p>3. The graph will update in real-time as the agent works</p>
          <p>4. Click <strong>Done</strong> when the agent has finished</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            data-testid="external-agent-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-iris text-white hover:bg-iris/90 transition-colors"
            data-testid="external-agent-done-button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
