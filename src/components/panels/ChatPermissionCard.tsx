import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import type { PermissionSuggestion } from '@/core/ai/types';

interface Props {
  id: string;
  tool: string;
  command: string;
  blockedPath?: string;
  decisionReason?: string;
  permissionSuggestions?: PermissionSuggestion[];
}

type CardState =
  | 'pending'
  | 'selecting'
  | 'editing'
  | 'approved'
  | 'always'
  | 'denied'
  | 'interrupted';

/** Human-readable label for a permission suggestion chip. */
function suggestionLabel(suggestion: PermissionSuggestion): string {
  if (suggestion.type === 'addDirectories') {
    return suggestion.directories.join(', ') || '(no directories)';
  }
  // addRules
  const rule = suggestion.rules[0];
  if (!rule) return 'tool (any)';
  return rule.ruleContent ?? `${rule.toolName} (any)`;
}

/** Extract the editable text content from a suggestion (for the Custom input). */
function editableContent(suggestion: PermissionSuggestion): string {
  if (suggestion.type === 'addDirectories') {
    return suggestion.directories[0] ?? '';
  }
  return suggestion.rules[0]?.ruleContent ?? '';
}

/** Build a PermissionSuggestion from the custom-edited value. */
function buildCustomSuggestion(
  tool: string,
  baseSuggestion: PermissionSuggestion | undefined,
  customValue: string,
): PermissionSuggestion {
  if (baseSuggestion?.type === 'addDirectories') {
    return {
      type: 'addDirectories',
      directories: [customValue],
      destination: 'localSettings',
    };
  }
  // Default to addRules
  return {
    type: 'addRules',
    rules: [
      customValue
        ? { toolName: tool, ruleContent: customValue }
        : { toolName: tool },
    ],
    behavior: 'allow',
    destination: 'localSettings',
  };
}

/** Fallback suggestion when the SDK provides none. */
function fallbackSuggestion(tool: string): PermissionSuggestion {
  return {
    type: 'addRules',
    rules: [{ toolName: tool }],
    behavior: 'allow',
    destination: 'localSettings',
  };
}

export function ChatPermissionCard({
  id,
  tool,
  command,
  blockedPath,
  decisionReason,
  permissionSuggestions,
}: Props) {
  const [state, setState] = useState<CardState>('pending');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customValue, setCustomValue] = useState('');

  const suggestions = permissionSuggestions ?? [];

  const handleApprove = () => {
    useChatStore.getState().respondToPermission(id, true);
    setState('approved');
  };

  const handleAlwaysAllow = () => {
    if (suggestions.length === 0) {
      // No suggestions — send fallback immediately
      useChatStore.getState().respondToPermission(id, true, {
        updatedPermissions: [fallbackSuggestion(tool)],
      });
      setState('always');
    } else {
      // Show chip selector
      setSelectedIdx(0);
      setCustomValue(editableContent(suggestions[0]));
      setState('selecting');
    }
  };

  const handleDeny = () => {
    useChatStore.getState().respondToPermission(id, false);
    setState('denied');
  };

  const handleDenyAndStop = () => {
    useChatStore.getState().respondToPermission(id, false, { interrupt: true });
    setState('interrupted');
  };

  const handleChipClick = (idx: number) => {
    setSelectedIdx(idx);
    if (idx < suggestions.length) {
      setCustomValue(editableContent(suggestions[idx]));
      setState('selecting');
    } else {
      // "Custom..." chip
      setState('editing');
    }
  };

  const handleConfirm = () => {
    let chosen: PermissionSuggestion;
    if (state === 'editing' || selectedIdx >= suggestions.length) {
      // Custom value
      chosen = buildCustomSuggestion(tool, suggestions[0], customValue);
    } else {
      chosen = suggestions[selectedIdx];
    }
    useChatStore.getState().respondToPermission(id, true, {
      updatedPermissions: [chosen],
    });
    setState('always');
  };

  const handleCancel = () => {
    setState('pending');
  };

  // --- Status label for resolved states ---

  const statusLabel = (() => {
    switch (state) {
      case 'approved': return 'Approved';
      case 'always': return 'Always Allowed';
      case 'denied': return 'Denied';
      case 'interrupted': return 'Denied & Stopped';
      default: return '';
    }
  })();

  const statusColor =
    state === 'approved' || state === 'always'
      ? 'text-green-400'
      : 'text-red-400';

  const isResolved = state === 'approved' || state === 'always' || state === 'denied' || state === 'interrupted';

  return (
    <div className="my-1 rounded border-l-4 border-yellow-500 bg-card p-2">
      <p className="text-xs font-medium text-card-foreground">
        &#x26A0; Permission requested: <span className="font-mono">{tool}</span>
      </p>
      <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
        {command}
      </p>

      {blockedPath && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          File: <span className="font-mono">{blockedPath}</span>
        </p>
      )}

      {decisionReason && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Reason: {decisionReason}
        </p>
      )}

      {isResolved ? (
        <p className={`mt-1.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </p>
      ) : state === 'pending' ? (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            className="rounded bg-green-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600"
          >
            Approve
          </button>
          <button
            onClick={handleAlwaysAllow}
            className="rounded bg-blue-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-600"
          >
            Always Allow
          </button>
          <button
            onClick={handleDeny}
            className="rounded bg-red-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600"
          >
            Deny
          </button>
          <button
            onClick={handleDenyAndStop}
            className="rounded bg-red-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-800"
          >
            Deny &amp; Stop
          </button>
        </div>
      ) : (
        /* selecting or editing — chip selector */
        <div className="mt-1.5">
          <p className="mb-1 text-[11px] text-muted-foreground">
            Select a permission rule to always allow:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(idx)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-mono transition-colors ${
                  selectedIdx === idx && state === 'selecting'
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {suggestionLabel(s)}
              </button>
            ))}
            <button
              onClick={() => handleChipClick(suggestions.length)}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                state === 'editing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Custom...
            </button>
          </div>

          {state === 'editing' && (
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="mt-1.5 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-blue-500 focus:outline-none"
              placeholder="Enter custom rule pattern..."
              autoFocus
            />
          )}

          <div className="mt-2 flex gap-2">
            <button
              onClick={handleConfirm}
              className="rounded bg-blue-700 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-600"
            >
              Confirm
            </button>
            <button
              onClick={handleCancel}
              className="rounded bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
