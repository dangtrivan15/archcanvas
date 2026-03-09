/**
 * SettingsDialog - modal for configuring application settings.
 *
 * Currently provides:
 * - Theme selection
 * - Haptic feedback toggle
 * - Layout reset
 *
 * Follows the existing dialog pattern (ErrorDialog, DeleteConfirmationDialog, etc.):
 * - Controlled via useUIStore (settingsDialogOpen)
 * - Focus trap, Escape to close
 * - Backdrop click to close
 */

import { useEffect, useCallback } from 'react';
import { Settings, X, RotateCcw, Palette, Vibrate } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { themes, themeIds } from '@/theme/themes';

export function SettingsDialog() {
  const open = useUIStore((s) => s.settingsDialogOpen);
  const closeDialog = useUIStore((s) => s.closeSettingsDialog);
  const showToast = useUIStore((s) => s.showToast);
  const resetBarSizes = useUIStore((s) => s.resetBarSizes);
  const themeId = useUIStore((s) => s.themeId);
  const setTheme = useUIStore((s) => s.setTheme);
  const hapticFeedbackEnabled = useUIStore((s) => s.hapticFeedbackEnabled);
  const setHapticFeedbackEnabled = useUIStore((s) => s.setHapticFeedbackEnabled);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(open);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 compact-dialog-overlay"
      onClick={handleBackdropClick}
      data-testid="settings-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        ref={focusTrapRef}
        className="bg-[hsl(var(--surface))] rounded-lg shadow-xl max-w-lg w-full mx-4 compact-dialog-sheet"
        data-testid="settings-dialog-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 id="settings-dialog-title" className="text-lg font-semibold text-gray-900">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close settings"
            data-testid="settings-close-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Theme Section */}
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--text))] mb-1 flex items-center gap-1.5">
              <Palette className="w-4 h-4" />
              Theme
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              Choose a color theme for the application.
            </p>
            <div className="flex gap-2 flex-wrap" data-testid="theme-selector">
              {themeIds.map((id) => {
                const t = themes[id]!;
                const isActive = id === themeId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTheme(id);
                      showToast(`Theme changed to ${t.name}`);
                    }}
                    className={`
                      inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors
                      ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300'
                          : 'border-gray-300 text-[hsl(var(--text))] hover:bg-[hsl(var(--highlight-low))]'
                      }
                    `}
                    data-testid={`theme-option-${id}`}
                    aria-pressed={isActive}
                  >
                    {/* Color swatch preview */}
                    <span
                      className="w-4 h-4 rounded-full border border-gray-400"
                      style={{ backgroundColor: `hsl(${t.colors.background})` }}
                    />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Haptic Feedback Section */}
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--text))] mb-1 flex items-center gap-1.5">
              <Vibrate className="w-4 h-4" />
              Haptic Feedback
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              Tactile feedback for touch interactions on iPad. No effect on desktop browsers.
            </p>
            <label
              className="inline-flex items-center gap-3 cursor-pointer select-none"
              data-testid="haptic-feedback-toggle"
            >
              <button
                type="button"
                role="switch"
                aria-checked={hapticFeedbackEnabled}
                onClick={() => {
                  const next = !hapticFeedbackEnabled;
                  setHapticFeedbackEnabled(next);
                  showToast(next ? 'Haptic feedback enabled' : 'Haptic feedback disabled');
                }}
                className={`
                  relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300
                  ${hapticFeedbackEnabled ? 'bg-blue-600' : 'bg-gray-300'}
                `}
                data-testid="haptic-feedback-switch"
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm
                    transform transition-transform duration-200 ease-in-out
                    ${hapticFeedbackEnabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
              <span className="text-sm text-[hsl(var(--text))]">
                {hapticFeedbackEnabled ? 'On' : 'Off'}
              </span>
            </label>
          </div>

          {/* Layout Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Layout</h3>
            <p className="text-xs text-gray-500 mb-3">
              Reset panel widths to their viewport-relative defaults. Any custom sizes you've set by
              dragging will be cleared. Toolbar and status bar use responsive CSS sizing
              automatically.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  resetBarSizes();
                  showToast('Layout sizes reset to defaults');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                data-testid="settings-reset-layout-sizes"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Layout Sizes
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={closeDialog}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            data-testid="settings-done-button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
