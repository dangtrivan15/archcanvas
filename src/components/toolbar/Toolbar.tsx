/**
 * Main Toolbar component - renders at the top of the app shell.
 * Contains File menu, Add Node button, Layout menu, filename display, and help button.
 *
 * Responsive:
 * - Compact (<600px): icon-only buttons, filename hidden, branding shortened
 * - Regular (600-1024px): normal layout with labels
 * - Wide (>1024px): normal layout with labels and keyboard hint
 */

import { Keyboard, Settings } from 'lucide-react';
import { FileMenu } from './FileMenu';
import { AddNodeButton } from './AddNodeButton';
import { ConnectNodesButton } from './ConnectNodesButton';
import { LayoutMenu } from './LayoutMenu';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { useViewportSize } from '@/hooks/useViewportSize';

export function Toolbar() {
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);
  const openShortcutsHelp = useUIStore((s) => s.openShortcutsHelp);
  const openSettingsDialog = useUIStore((s) => s.openSettingsDialog);
  const { isCompact } = useViewportSize();

  return (
    <header
      className={`border-b flex items-center gap-1 shrink-0 bg-[hsl(var(--background))] sticky top-0 z-50 safe-area-top safe-area-left safe-area-right touch-toolbar ${
        isCompact ? 'h-10 px-2' : 'h-12 px-3'
      }`}
      role="toolbar"
      aria-label="Main toolbar"
      data-testid="toolbar"
    >
      {/* App branding */}
      <div className="flex items-center gap-2 ml-3 mr-2">
        <span className={`font-bold tracking-tight text-[hsl(var(--foreground))] ${isCompact ? 'text-xs' : 'text-sm'}`}>
          {isCompact ? 'AC' : 'ArchCanvas'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />

      {/* Menu buttons - pass compact prop for icon-only mode */}
      <FileMenu compact={isCompact} />
      <AddNodeButton compact={isCompact} />
      <ConnectNodesButton compact={isCompact} />
      <LayoutMenu compact={isCompact} />

      {/* Divider */}
      {!isCompact && <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />}

      {/* Filename display - hidden in compact mode */}
      {!isCompact && (
        <div className="flex items-center gap-1 ml-2 text-sm text-[hsl(var(--muted-foreground))]">
          <span data-testid="filename-display">
            {fileName}
          </span>
          {isDirty && (
            <span className="text-[hsl(var(--foreground))] font-medium" title="Unsaved changes">
              *
            </span>
          )}
        </div>
      )}

      {/* Dirty indicator in compact mode (just the asterisk) */}
      {isCompact && isDirty && (
        <span className="text-[hsl(var(--foreground))] font-medium text-sm ml-1" title="Unsaved changes" data-testid="compact-dirty-indicator">
          *
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings button */}
      <button
        type="button"
        onClick={openSettingsDialog}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target ${
          isCompact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
        }`}
        title="Settings"
        aria-label="Settings"
        data-testid="settings-button"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Help button - keyboard shortcuts (icon-only in compact mode) */}
      <button
        type="button"
        onClick={openShortcutsHelp}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target ${
          isCompact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
        }`}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        data-testid="shortcuts-help-button"
      >
        <Keyboard className="w-4 h-4" />
        {!isCompact && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-100 border border-gray-200 rounded">
            ?
          </kbd>
        )}
      </button>
    </header>
  );
}
