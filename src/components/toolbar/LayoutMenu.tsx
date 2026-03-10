/**
 * Layout menu - auto-layout options (horizontal/vertical), spacing configuration, and fit view.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  ChevronDown,
  ArrowRightFromLine,
  ArrowDownFromLine,
  Maximize,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore, DEFAULT_LAYOUT_SPACING } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { usePlatformModifier } from '@/hooks/usePlatformModifier';

export function LayoutMenu({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSpacing, setShowSpacing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const autoLayout = useGraphStore((s) => s.autoLayout);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const layoutSpacing = useCanvasStore((s) => s.layoutSpacing);
  const setLayoutSpacing = useCanvasStore((s) => s.setLayoutSpacing);
  const resetLayoutSpacing = useCanvasStore((s) => s.resetLayoutSpacing);
  const navigationPath = useNavigationStore((s) => s.path);
  const { formatBinding } = usePlatformModifier();

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowSpacing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowSpacing(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleAutoLayoutHorizontal = useCallback(async () => {
    setIsOpen(false);
    setShowSpacing(false);
    await autoLayout('horizontal', navigationPath);
    // Fit view after layout so all repositioned nodes are visible
    requestFitView();
  }, [autoLayout, navigationPath, requestFitView]);

  const handleAutoLayoutVertical = useCallback(async () => {
    setIsOpen(false);
    setShowSpacing(false);
    await autoLayout('vertical', navigationPath);
    requestFitView();
  }, [autoLayout, navigationPath, requestFitView]);

  const handleFitView = useCallback(() => {
    setIsOpen(false);
    setShowSpacing(false);
    requestFitView();
  }, [requestFitView]);

  const handleToggleSpacing = useCallback(() => {
    setShowSpacing((prev) => !prev);
  }, []);

  const handleNodeSpacingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (!isNaN(value) && value >= 10 && value <= 300) {
        setLayoutSpacing({ nodeSpacing: value });
      }
    },
    [setLayoutSpacing],
  );

  const handleLayerSpacingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (!isNaN(value) && value >= 20 && value <= 500) {
        setLayoutSpacing({ layerSpacing: value });
      }
    },
    [setLayoutSpacing],
  );

  const handleResetSpacing = useCallback(() => {
    resetLayoutSpacing();
  }, [resetLayoutSpacing]);

  const isDefaultSpacing =
    layoutSpacing.nodeSpacing === DEFAULT_LAYOUT_SPACING.nodeSpacing &&
    layoutSpacing.layerSpacing === DEFAULT_LAYOUT_SPACING.layerSpacing;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 touch-target"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Layout menu"
        title={compact ? 'Layout' : undefined}
        data-testid="layout-menu-button"
      >
        <LayoutGrid className="w-4 h-4" />
        {!compact && <span>Layout</span>}
        {!compact && <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 bg-background border border-border rounded-md shadow-lg py-1 z-50"
          role="menu"
          data-testid="layout-menu-dropdown"
        >
          <button
            onClick={handleAutoLayoutHorizontal}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left touch-target-row"
            role="menuitem"
            data-testid="auto-layout-horizontal"
          >
            <ArrowRightFromLine className="w-4 h-4" />
            <span>Auto-Layout (Horizontal)</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatBinding('mod+shift+l')}
            </span>
          </button>
          <button
            onClick={handleAutoLayoutVertical}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left touch-target-row"
            role="menuitem"
            data-testid="auto-layout-vertical"
          >
            <ArrowDownFromLine className="w-4 h-4" />
            <span>Auto-Layout (Vertical)</span>
          </button>

          <div className="h-px bg-border my-1" />

          {/* Spacing Configuration Toggle */}
          <button
            onClick={handleToggleSpacing}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left touch-target-row"
            role="menuitem"
            data-testid="layout-spacing-toggle"
            aria-expanded={showSpacing}
          >
            <Settings2 className="w-4 h-4" />
            <span>Layout Spacing</span>
            <ChevronDown
              className={`w-3 h-3 ml-auto transition-transform ${showSpacing ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Spacing Configuration Panel */}
          {showSpacing && (
            <div
              className="px-3 py-2 space-y-3 border-t border-border"
              data-testid="layout-spacing-panel"
            >
              {/* Node Spacing */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="node-spacing"
                    className="text-xs text-muted-foreground"
                  >
                    Node Spacing
                  </label>
                  <span
                    className="text-xs font-mono text-foreground"
                    data-testid="node-spacing-value"
                  >
                    {layoutSpacing.nodeSpacing}px
                  </span>
                </div>
                <input
                  id="node-spacing"
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={layoutSpacing.nodeSpacing}
                  onChange={handleNodeSpacingChange}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-blue-600"
                  data-testid="node-spacing-slider"
                />
              </div>

              {/* Layer Spacing */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="layer-spacing"
                    className="text-xs text-muted-foreground"
                  >
                    Layer Spacing
                  </label>
                  <span
                    className="text-xs font-mono text-foreground"
                    data-testid="layer-spacing-value"
                  >
                    {layoutSpacing.layerSpacing}px
                  </span>
                </div>
                <input
                  id="layer-spacing"
                  type="range"
                  min="20"
                  max="500"
                  step="10"
                  value={layoutSpacing.layerSpacing}
                  onChange={handleLayerSpacingChange}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-blue-600"
                  data-testid="layer-spacing-slider"
                />
              </div>

              {/* Reset Button */}
              {!isDefaultSpacing && (
                <button
                  onClick={handleResetSpacing}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  data-testid="reset-spacing-button"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to defaults</span>
                </button>
              )}
            </div>
          )}

          <div className="h-px bg-border my-1" />
          <button
            onClick={handleFitView}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left touch-target-row"
            role="menuitem"
            data-testid="fit-view-button"
          >
            <Maximize className="w-4 h-4" />
            <span>Fit View</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatBinding('mod+0')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
