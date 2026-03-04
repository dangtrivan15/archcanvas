/**
 * CanvasContextMenu - right-click context menu for the canvas background.
 * Shows options: Add Node, Paste, Auto-Layout, Fit View.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Plus, Clipboard, LayoutGrid, Maximize } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const autoLayout = useCoreStore((s) => s.autoLayout);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const navigationPath = useNavigationStore((s) => s.path);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use timeout to avoid immediate dismissal from the same click
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddNode = useCallback(() => {
    // Open the NodeDef browser panel if not already open
    if (!leftPanelOpen) {
      toggleLeftPanel();
    }
    onClose();
  }, [leftPanelOpen, toggleLeftPanel, onClose]);

  const handlePaste = useCallback(() => {
    // Paste from clipboard (placeholder - reads clipboard if available)
    onClose();
  }, [onClose]);

  const handleAutoLayout = useCallback(async () => {
    onClose();
    await autoLayout('horizontal', navigationPath);
    requestFitView();
  }, [autoLayout, navigationPath, requestFitView, onClose]);

  const handleFitView = useCallback(() => {
    onClose();
    requestFitView();
  }, [requestFitView, onClose]);

  const menuItems = [
    { label: 'Add Node', icon: Plus, action: handleAddNode, testId: 'ctx-add-node' },
    { label: 'Paste', icon: Clipboard, action: handlePaste, testId: 'ctx-paste' },
    { label: 'Auto-Layout', icon: LayoutGrid, action: handleAutoLayout, testId: 'ctx-auto-layout' },
    { label: 'Fit View', icon: Maximize, action: handleFitView, testId: 'ctx-fit-view' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[100] min-w-[180px]"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="canvas-context-menu"
    >
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left touch-target-row"
            role="menuitem"
            data-testid={item.testId}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
