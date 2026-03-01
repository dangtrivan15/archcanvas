/**
 * Main Toolbar component - renders at the top of the app shell.
 * Contains File menu, Add Node button, Layout menu, and filename display.
 */

import { FileMenu } from './FileMenu';
import { AddNodeButton } from './AddNodeButton';
import { ConnectNodesButton } from './ConnectNodesButton';
import { LayoutMenu } from './LayoutMenu';
import { useCoreStore } from '@/store/coreStore';

export function Toolbar() {
  const fileName = useCoreStore((s) => s.fileName);
  const isDirty = useCoreStore((s) => s.isDirty);

  return (
    <header
      className="h-12 border-b flex items-center px-3 gap-1 shrink-0 bg-[hsl(var(--background))] sticky top-0 z-50"
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
    </header>
  );
}
