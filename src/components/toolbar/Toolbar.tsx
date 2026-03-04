/**
 * Main Toolbar component - renders at the top of the app shell.
 * Contains File menu, Add Node button, Layout menu, filename display, and help button.
 */

import { Keyboard } from 'lucide-react';
import { FileMenu } from './FileMenu';
import { AddNodeButton } from './AddNodeButton';
import { ConnectNodesButton } from './ConnectNodesButton';
import { LayoutMenu } from './LayoutMenu';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';

export function Toolbar() {
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);
  const openShortcutsHelp = useUIStore((s) => s.openShortcutsHelp);

  return (
    <header
      className="h-12 border-b flex items-center px-3 gap-1 shrink-0 bg-[hsl(var(--background))] sticky top-0 z-50 safe-area-top safe-area-left safe-area-right"
      role="toolbar"
      aria-label="Main toolbar"
      data-testid="toolbar"
    >
      {/* App branding */}
      <div className="flex items-center gap-2 mr-2">
        <span className="text-sm font-bold tracking-tight text-[hsl(var(--foreground))]">
          ArchCanvas
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />

      {/* Menu buttons */}
      <FileMenu />
      <AddNodeButton />
      <ConnectNodesButton />
      <LayoutMenu />

      {/* Divider */}
      <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />

      {/* Filename display */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help button - keyboard shortcuts */}
      <button
        type="button"
        onClick={openShortcutsHelp}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        data-testid="shortcuts-help-button"
      >
        <Keyboard className="w-4 h-4" />
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-100 border border-gray-200 rounded">
          ?
        </kbd>
      </button>
    </header>
  );
}
