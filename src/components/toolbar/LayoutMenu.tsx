/**
 * Layout menu - auto-layout options (horizontal/vertical) and fit view.
 */

import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, ChevronDown, ArrowRightFromLine, ArrowDownFromLine, Maximize } from 'lucide-react';

export function LayoutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleAutoLayoutHorizontal = () => {
    console.log('[LayoutMenu] Auto-layout horizontal');
    setIsOpen(false);
  };

  const handleAutoLayoutVertical = () => {
    console.log('[LayoutMenu] Auto-layout vertical');
    setIsOpen(false);
  };

  const handleFitView = () => {
    console.log('[LayoutMenu] Fit view');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-[hsl(var(--muted))] transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid="layout-menu-button"
      >
        <LayoutGrid className="w-4 h-4" />
        <span>Layout</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md shadow-lg py-1 z-50"
          role="menu"
          data-testid="layout-menu-dropdown"
        >
          <button
            onClick={handleAutoLayoutHorizontal}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <ArrowRightFromLine className="w-4 h-4" />
            <span>Auto-Layout (Horizontal)</span>
          </button>
          <button
            onClick={handleAutoLayoutVertical}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <ArrowDownFromLine className="w-4 h-4" />
            <span>Auto-Layout (Vertical)</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={handleFitView}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
          >
            <Maximize className="w-4 h-4" />
            <span>Fit View</span>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Ctrl+Shift+L</span>
          </button>
        </div>
      )}
    </div>
  );
}
