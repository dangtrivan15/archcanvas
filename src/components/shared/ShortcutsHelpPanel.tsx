/**
 * ShortcutsHelpPanel - modal dialog showing all available keyboard shortcuts.
 * Triggered by pressing '?' key or clicking the help button in the toolbar.
 * Shortcuts are grouped by category and display platform-appropriate key labels.
 */

import { useEffect, useCallback, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  SHORTCUT_CATEGORIES,
  getShortcutsByCategory,
  getShortcutKeys,
  type ShortcutCategory,
} from '@/config/keyboardShortcuts';

/** Category icon/color mapping */
const CATEGORY_STYLES: Record<ShortcutCategory, { color: string; bg: string }> = {
  File: { color: 'text-blue-700', bg: 'bg-blue-50' },
  Edit: { color: 'text-amber-700', bg: 'bg-amber-50' },
  Canvas: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Navigation: { color: 'text-purple-700', bg: 'bg-purple-50' },
};

export function ShortcutsHelpPanel() {
  const open = useUIStore((s) => s.shortcutsHelpOpen);
  const closeDialog = useUIStore((s) => s.closeShortcutsHelp);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

  // Focus the close button when dialog opens
  useEffect(() => {
    if (open && closeRef.current) {
      closeRef.current.focus();
    }
  }, [open]);

  // Handle keyboard: Escape to close
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

  if (!open) return null;

  const groupedShortcuts = getShortcutsByCategory();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="shortcuts-help-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        data-testid="shortcuts-help-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Keyboard className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <h2
              id="shortcuts-help-title"
              className="text-lg font-semibold text-gray-900"
              data-testid="shortcuts-help-title"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeDialog}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close shortcuts help"
            data-testid="shortcuts-help-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable shortcut list */}
        <div className="overflow-y-auto px-6 py-4 space-y-5" data-testid="shortcuts-help-list">
          {SHORTCUT_CATEGORIES.map((category) => {
            const shortcuts = groupedShortcuts.get(category);
            if (!shortcuts || shortcuts.length === 0) return null;

            const style = CATEGORY_STYLES[category];

            return (
              <div key={category} data-testid={`shortcuts-category-${category.toLowerCase()}`}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${style.color} ${style.bg}`}
                  >
                    {category}
                  </span>
                </div>

                {/* Shortcut rows */}
                <div className="space-y-1">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
                      data-testid={`shortcut-${shortcut.id}`}
                    >
                      <span className="text-sm text-gray-700">
                        {shortcut.description}
                      </span>
                      <kbd
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded shadow-sm min-w-[2.5rem] justify-center"
                        data-testid={`shortcut-keys-${shortcut.id}`}
                      >
                        {getShortcutKeys(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-center shrink-0">
          <p className="text-xs text-gray-400">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
