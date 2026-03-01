/**
 * File menu component - New, Open, Save, Save As, Export sub-menu.
 */

import { useState, useRef, useEffect } from 'react';
import { File, FolderOpen, Save, Download, ChevronDown, FilePlus } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';

export function FileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const newFile = useCoreStore((s) => s.newFile);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleNew = () => {
    newFile();
    setIsOpen(false);
  };

  const handleOpen = () => {
    // File open will be implemented by file operations feature
    console.log('[FileMenu] Open file (not yet implemented)');
    setIsOpen(false);
  };

  const handleSave = () => {
    // Save will be implemented by file operations feature
    console.log('[FileMenu] Save file (not yet implemented)');
    setIsOpen(false);
  };

  const handleSaveAs = () => {
    // Save As will be implemented by file operations feature
    console.log('[FileMenu] Save As (not yet implemented)');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid="file-menu-button"
      >
        <File className="w-4 h-4" />
        <span>File</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg py-1 z-50"
          role="menu"
          data-testid="file-menu-dropdown"
        >
          <button
            onClick={handleNew}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <FilePlus className="w-4 h-4" />
            <span>New</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Ctrl+N</span>
          </button>
          <button
            onClick={handleOpen}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Open...</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Ctrl+O</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={handleSave}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Ctrl+S</span>
          </button>
          <button
            onClick={handleSaveAs}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <Save className="w-4 h-4" />
            <span>Save As...</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Ctrl+Shift+S</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}
