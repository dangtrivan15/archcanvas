/**
 * Main Toolbar component - renders at the top of the app shell.
 * Contains File menu, Add Node button, Layout menu, filename display, and help button.
 *
 * Responsive:
 * - Compact (<600px): icon-only buttons, filename hidden, branding shortened
 * - Regular (600-1024px): normal layout with labels
 * - Wide (>1024px): normal layout with labels and keyboard hint
 *
 * Uses fixed responsive sizing via CSS clamp() — no resize handles.
 */

import { Keyboard, Settings, PenTool, LayoutGrid } from 'lucide-react';
import { FileMenu } from './FileMenu';
import { AddNodeButton } from './AddNodeButton';
import { ConnectNodesButton } from './ConnectNodesButton';
import { LayoutMenu } from './LayoutMenu';
import { ThemeSwitcher } from './ThemeSwitcher';
import { PencilIndicator } from './PencilIndicator';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportSize } from '@/hooks/useViewportSize';

export function Toolbar() {
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);
  const openShortcutsHelp = useUIStore((s) => s.openShortcutsHelp);
  const openSettingsDialog = useUIStore((s) => s.openSettingsDialog);
  const openTemplateGallery = useUIStore((s) => s.openTemplateGallery);
  const isDrawingMode = useAnnotationStore((s) => s.isDrawingMode);
  const enterDrawingMode = useAnnotationStore((s) => s.enterDrawingMode);
  const exitDrawingMode = useAnnotationStore((s) => s.exitDrawingMode);
  const { isCompact } = useViewportSize();

  return (
    <header
      className="border-b flex items-center gap-1 shrink-0 bg-[hsl(var(--background))] sticky top-0 z-50 safe-area-top safe-area-left safe-area-right touch-toolbar"
      style={{
        height: 'clamp(2.5rem, 3.5vh, 3.5rem)',
        padding: isCompact ? '0 0.5rem' : '0 0.75rem',
      }}
      role="toolbar"
      aria-label="Main toolbar"
      data-testid="toolbar"
    >
      {/* App branding */}
      <div className="flex items-center gap-2 ml-3 mr-2">
        <span
          className={`font-bold tracking-tight text-[hsl(var(--foreground))] ${isCompact ? 'text-xs' : 'text-sm'}`}
        >
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

      {/* Annotate button - toggles freeform drawing mode */}
      <button
        type="button"
        onClick={() => (isDrawingMode ? exitDrawingMode() : enterDrawingMode())}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target ${
          isDrawingMode
            ? 'bg-[hsl(var(--pine))] text-white'
            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
        } ${isCompact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'}`}
        title={isDrawingMode ? 'Exit annotation mode' : 'Annotate (draw on canvas)'}
        aria-label={isDrawingMode ? 'Exit annotation mode' : 'Annotate'}
        data-testid="annotate-button"
      >
        <PenTool className="w-4 h-4" />
        {!isCompact && <span>{isDrawingMode ? 'Drawing' : 'Annotate'}</span>}
      </button>

      {/* Templates button - opens template gallery */}
      <button
        type="button"
        onClick={openTemplateGallery}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 touch-target ${
          isCompact ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
        }`}
        title="Template Gallery"
        aria-label="Templates"
        data-testid="templates-button"
      >
        <LayoutGrid className="w-4 h-4" />
        {!isCompact && <span>Templates</span>}
      </button>

      {/* Divider - scales proportionally with toolbar height */}
      {!isCompact && (
        <div className="w-px bg-[hsl(var(--border))] mx-1" style={{ height: '60%' }} />
      )}

      {/* Filename display - hidden in compact mode */}
      {!isCompact && (
        <div className="flex items-center gap-1 ml-2 text-sm text-[hsl(var(--muted-foreground))]">
          <span data-testid="filename-display">{fileName}</span>
          {isDirty && (
            <span className="text-[hsl(var(--foreground))] font-medium" title="Unsaved changes">
              *
            </span>
          )}
        </div>
      )}

      {/* Dirty indicator in compact mode (just the asterisk) */}
      {isCompact && isDirty && (
        <span
          className="text-[hsl(var(--foreground))] font-medium text-sm ml-1"
          title="Unsaved changes"
          data-testid="compact-dirty-indicator"
        >
          *
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Apple Pencil indicator (only visible when detected) */}
      <PencilIndicator compact={isCompact} />

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
    </header>
  );
}
