/**
 * EdgeContextMenu - right-click context menu for edges on the canvas.
 * Shows edge-specific options: Edit, Add Note, Delete.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Pencil, StickyNote, Trash2 } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findEdge } from '@/core/graph/graphEngine';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  onClose: () => void;
}

export function EdgeContextMenu({ x, y, edgeId, onClose }: EdgeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const graph = useCoreStore((s) => s.graph);
  const removeEdge = useCoreStore((s) => s.removeEdge);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const openRightPanel = useUIStore((s) => s.openRightPanel);

  // Find the edge for display info
  const edge = findEdge(graph, edgeId);

  // Build a display label for the edge header
  const edgeLabel = edge?.label || `${edge?.fromNode ?? '?'} → ${edge?.toNode ?? '?'}`;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
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

  // Edit: select edge and open right panel
  const handleEdit = useCallback(() => {
    selectEdge(edgeId);
    openRightPanel('properties');
    onClose();
  }, [selectEdge, edgeId, openRightPanel, onClose]);

  // Add Note: select edge and open notes panel
  const handleAddNote = useCallback(() => {
    selectEdge(edgeId);
    openRightPanel('notes');
    onClose();
  }, [selectEdge, edgeId, openRightPanel, onClose]);

  // Delete: remove the edge directly (no confirmation needed for edges)
  const handleDelete = useCallback(() => {
    removeEdge(edgeId);
    onClose();
  }, [removeEdge, edgeId, onClose]);

  const menuItems = [
    { label: 'Edit', icon: Pencil, action: handleEdit, testId: 'ctx-edge-edit' },
    { label: 'Add Note', icon: StickyNote, action: handleAddNote, testId: 'ctx-edge-add-note' },
    { label: 'Delete', icon: Trash2, action: handleDelete, testId: 'ctx-edge-delete', isDanger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[100] min-w-[180px]"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="edge-context-menu"
    >
      {/* Edge label header */}
      <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 truncate font-medium">
        {edgeLabel}
      </div>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors
              ${item.isDanger
                ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
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
