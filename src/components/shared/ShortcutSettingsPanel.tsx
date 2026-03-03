/**
 * ShortcutSettingsPanel - dialog for viewing and rebinding keyboard shortcuts.
 * Users can click on a shortcut binding to enter "recording mode", press a new
 * key combination, and the shortcut is updated with conflict detection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  getShortcutManager,
  SHORTCUT_ACTIONS,
  formatBindingForDisplay,
  eventToBindingString,
  type ShortcutAction,
} from '@/core/shortcuts/shortcutManager';

/** Category colors */
const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  File: { color: 'text-blue-700', bg: 'bg-blue-50' },
  Edit: { color: 'text-amber-700', bg: 'bg-amber-50' },
  Canvas: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Navigation: { color: 'text-purple-700', bg: 'bg-purple-50' },
};

export function ShortcutSettingsPanel() {
  const open = useUIStore((s) => s.shortcutSettingsOpen);
  const closeDialog = useUIStore((s) => s.closeShortcutSettings);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Recording state: which action is being rebound
  const [recordingActionId, setRecordingActionId] = useState<string | null>(null);
  // Conflict warning
  const [conflictInfo, setConflictInfo] = useState<{
    actionId: string;
    conflictWith: string;
    binding: string;
  } | null>(null);
  // Force re-render after binding changes
  const [, setUpdateCounter] = useState(0);

  const manager = getShortcutManager();

  // Focus close button when dialog opens
  useEffect(() => {
    if (open && closeRef.current) {
      closeRef.current.focus();
    }
    if (open) {
      setRecordingActionId(null);
      setConflictInfo(null);
    }
  }, [open]);

  // Handle Escape to close dialog (or cancel recording)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (recordingActionId) {
          setRecordingActionId(null);
          setConflictInfo(null);
        } else {
          closeDialog();
        }
        return;
      }

      // If recording, capture the key event as a new binding
      if (recordingActionId) {
        e.preventDefault();
        e.stopPropagation();

        const bindingStr = eventToBindingString(e);
        if (!bindingStr) return; // Ignore standalone modifier presses

        // Check for conflicts
        const conflict = manager.findConflict(recordingActionId, bindingStr);
        if (conflict) {
          const conflictAction = SHORTCUT_ACTIONS.find((a) => a.id === conflict);
          setConflictInfo({
            actionId: recordingActionId,
            conflictWith: conflictAction?.label || conflict,
            binding: bindingStr,
          });
          return;
        }

        // Apply the binding
        manager.setBinding(recordingActionId, bindingStr);
        setRecordingActionId(null);
        setConflictInfo(null);
        setUpdateCounter((c) => c + 1);
      }
    },
    [open, recordingActionId, manager, closeDialog]
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
    [closeDialog]
  );

  // Force-apply conflicting binding (overwrite the conflict)
  const applyConflictBinding = useCallback(() => {
    if (!conflictInfo) return;
    // Clear the conflicting action's binding first
    const conflict = manager.findConflict(conflictInfo.actionId, conflictInfo.binding);
    if (conflict) {
      manager.setBinding(conflict, ''); // Clear the old binding
    }
    manager.setBinding(conflictInfo.actionId, conflictInfo.binding);
    setRecordingActionId(null);
    setConflictInfo(null);
    setUpdateCounter((c) => c + 1);
  }, [conflictInfo, manager]);

  // Reset a single binding
  const resetBinding = useCallback(
    (actionId: string) => {
      manager.resetBinding(actionId);
      setRecordingActionId(null);
      setConflictInfo(null);
      setUpdateCounter((c) => c + 1);
    },
    [manager]
  );

  // Reset all bindings
  const resetAll = useCallback(() => {
    manager.resetAll();
    setRecordingActionId(null);
    setConflictInfo(null);
    setUpdateCounter((c) => c + 1);
  }, [manager]);

  if (!open) return null;

  // Group actions by category
  const categories = [...new Set(SHORTCUT_ACTIONS.map((a) => a.category))];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="shortcut-settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-settings-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        data-testid="shortcut-settings-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Settings className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <h2
              id="shortcut-settings-title"
              className="text-lg font-semibold text-gray-900"
              data-testid="shortcut-settings-title"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {manager.hasCustomizations() && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                title="Reset all shortcuts to defaults"
                data-testid="shortcut-settings-reset-all"
              >
                <RotateCcw className="w-3 h-3" />
                Reset All
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={closeDialog}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close shortcut settings"
              data-testid="shortcut-settings-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conflict Warning */}
        {conflictInfo && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-3" data-testid="shortcut-conflict-warning">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800 flex-1">
              <strong>{formatBindingForDisplay(conflictInfo.binding)}</strong> is already bound to <strong>{conflictInfo.conflictWith}</strong>.
            </span>
            <button
              type="button"
              onClick={applyConflictBinding}
              className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded transition-colors cursor-pointer"
              data-testid="shortcut-conflict-override"
            >
              Override
            </button>
            <button
              type="button"
              onClick={() => { setConflictInfo(null); setRecordingActionId(null); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
              data-testid="shortcut-conflict-cancel"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Scrollable shortcut list */}
        <div className="overflow-y-auto px-6 py-4 space-y-5" data-testid="shortcut-settings-list">
          {categories.map((category) => {
            const actions = SHORTCUT_ACTIONS.filter((a) => a.category === category);
            const style = CATEGORY_COLORS[category] || { color: 'text-gray-700', bg: 'bg-gray-50' };

            return (
              <div key={category} data-testid={`shortcut-settings-category-${category.toLowerCase()}`}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${style.color} ${style.bg}`}
                  >
                    {category}
                  </span>
                </div>

                {/* Action rows */}
                <div className="space-y-1">
                  {actions.map((action) => (
                    <ShortcutRow
                      key={action.id}
                      action={action}
                      isRecording={recordingActionId === action.id}
                      isCustomized={manager.isCustomized(action.id)}
                      currentBinding={manager.getDisplayBinding(action.id)}
                      onStartRecording={() => {
                        setRecordingActionId(action.id);
                        setConflictInfo(null);
                      }}
                      onReset={() => resetBinding(action.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-center shrink-0">
          <p className="text-xs text-gray-400">
            Click a shortcut to rebind it. Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded">Esc</kbd> to cancel.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Single shortcut row */
function ShortcutRow({
  action,
  isRecording,
  isCustomized,
  currentBinding,
  onStartRecording,
  onReset,
}: {
  action: ShortcutAction;
  isRecording: boolean;
  isCustomized: boolean;
  currentBinding: string;
  onStartRecording: () => void;
  onReset: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
      data-testid={`shortcut-setting-${action.id}`}
    >
      <span className="text-sm text-gray-700">{action.label}</span>
      <div className="flex items-center gap-2">
        {/* Binding button - click to start recording */}
        <button
          type="button"
          onClick={onStartRecording}
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded border cursor-pointer transition-colors
            ${isRecording
              ? 'bg-blue-100 text-blue-700 border-blue-300 ring-2 ring-blue-200 animate-pulse'
              : isCustomized
                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }
            min-w-[3rem] justify-center
          `}
          title={isRecording ? 'Press a key combination...' : 'Click to rebind'}
          data-testid={`shortcut-binding-${action.id}`}
          aria-label={`${action.label} shortcut: ${currentBinding}. Click to rebind.`}
        >
          {isRecording ? '...' : currentBinding || 'None'}
        </button>

        {/* Reset button (only shown if customized) */}
        {isCustomized && !isRecording && (
          <button
            type="button"
            onClick={onReset}
            className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors cursor-pointer"
            title="Reset to default"
            data-testid={`shortcut-reset-${action.id}`}
            aria-label={`Reset ${action.label} to default`}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
