/**
 * Main Toolbar component - renders at the top of the app shell.
 * Contains File menu, Add Node button, Layout menu, filename display, and help button.
 *
 * Responsive:
 * - Compact (<600px): icon-only buttons, filename hidden, branding shortened
 * - Regular (600-1024px): normal layout with labels
 * - Wide (>1024px): normal layout with labels and keyboard hint
 */

import { useRef, useCallback, useEffect } from 'react';
import { Keyboard, Settings } from 'lucide-react';
import { FileMenu } from './FileMenu';
import { AddNodeButton } from './AddNodeButton';
import { ConnectNodesButton } from './ConnectNodesButton';
import { LayoutMenu } from './LayoutMenu';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore, TOOLBAR_MIN_HEIGHT, TOOLBAR_MAX_HEIGHT } from '@/store/uiStore';
import { useViewportSize } from '@/hooks/useViewportSize';

export function Toolbar() {
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);
  const openShortcutsHelp = useUIStore((s) => s.openShortcutsHelp);
  const openSettingsDialog = useUIStore((s) => s.openSettingsDialog);
  const toolbarHeight = useUIStore((s) => s.toolbarHeight);
  const setToolbarHeight = useUIStore((s) => s.setToolbarHeight);
  const updateToolbarHeightFromViewport = useUIStore((s) => s.updateToolbarHeightFromViewport);
  const { isCompact, height: viewportHeight } = useViewportSize();

  // Update toolbar height when viewport changes (only if user hasn't customized)
  useEffect(() => {
    updateToolbarHeightFromViewport(viewportHeight);
  }, [viewportHeight, updateToolbarHeightFromViewport]);

  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const delta = e.clientY - dragStartY.current;
    const newHeight = dragStartHeight.current + delta;
    setToolbarHeight(Math.max(TOOLBAR_MIN_HEIGHT, Math.min(TOOLBAR_MAX_HEIGHT, newHeight)));
  }, [setToolbarHeight]);

  const onMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onMouseMove]);

  const onResizeHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = toolbarHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [toolbarHeight, onMouseMove, onMouseUp]);

  return (
    <header
      className="border-b flex items-center gap-1 shrink-0 bg-[hsl(var(--background))] sticky top-0 z-50 safe-area-top safe-area-left safe-area-right touch-toolbar relative overflow-hidden"
      style={{ height: `${toolbarHeight}px`, padding: isCompact ? '0 0.5rem' : '0 0.75rem' }}
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

      {/* Divider - scales proportionally with toolbar height */}
      <div className="w-px bg-[hsl(var(--border))] mx-1" style={{ height: '60%' }} />

      {/* Menu buttons - pass compact prop for icon-only mode */}
      <FileMenu compact={isCompact} />
      <AddNodeButton compact={isCompact} />
      <ConnectNodesButton compact={isCompact} />
      <LayoutMenu compact={isCompact} />

      {/* Divider - scales proportionally with toolbar height */}
      {!isCompact && <div className="w-px bg-[hsl(var(--border))] mx-1" style={{ height: '60%' }} />}

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

      {/* Theme switcher dropdown */}
      <ThemeSwitcher compact={isCompact} />

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

      {/* Draggable resize handle at bottom edge */}
      <div
        data-testid="toolbar-resize-handle"
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group/resize z-[51] hover:bg-[hsl(var(--primary)/0.15)] transition-colors"
        onMouseDown={onResizeHandleMouseDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize toolbar"
        aria-valuenow={toolbarHeight}
        aria-valuemin={TOOLBAR_MIN_HEIGHT}
        aria-valuemax={TOOLBAR_MAX_HEIGHT}
      >
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[hsl(var(--muted-foreground)/0.3)] group-hover/resize:bg-[hsl(var(--primary)/0.5)] transition-colors" />
      </div>
    </header>
  );
}
