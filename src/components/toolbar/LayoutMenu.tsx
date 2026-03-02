/**
 * Layout menu - auto-layout options (horizontal/vertical) and fit view.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid, ChevronDown, ArrowRightFromLine, ArrowDownFromLine, Maximize } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';

export function LayoutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const autoLayout = useCoreStore((s) => s.autoLayout);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const navigationPath = useNavigationStore((s) => s.path);

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

  const handleAutoLayoutHorizontal = useCallback(async () => {
    setIsOpen(false);
    await autoLayout('horizontal', navigationPath);
    // Fit view after layout so all repositioned nodes are visible
    requestFitView();
  }, [autoLayout, navigationPath, requestFitView]);

  const handleAutoLayoutVertical = useCallback(async () => {
    setIsOpen(false);
    await autoLayout('vertical', navigationPath);
    requestFitView();
  }, [autoLayout, navigationPath, requestFitView]);

  const handleFitView = useCallback(() => {
    setIsOpen(false);
    requestFitView();
  }, [requestFitView]);

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
            data-testid="auto-layout-horizontal"
          >
            <ArrowRightFromLine className="w-4 h-4" />
            <span>Auto-Layout (Horizontal)</span>
          </button>
          <button
            onClick={handleAutoLayoutVertical}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
            data-testid="auto-layout-vertical"
          >
            <ArrowDownFromLine className="w-4 h-4" />
            <span>Auto-Layout (Vertical)</span>
          </button>
          <div className="h-px bg-[hsl(var(--border))] my-1" />
          <button
            onClick={handleFitView}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors text-left"
            role="menuitem"
            data-testid="fit-view-button"
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
