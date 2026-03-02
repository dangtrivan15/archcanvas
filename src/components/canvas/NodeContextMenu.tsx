/**
 * NodeContextMenu - right-click context menu for nodes on the canvas.
 * Shows node-specific options: Edit, Add Note, Add Child, Zoom In, Delete.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Pencil, StickyNote, Plus, ZoomIn, Trash2 } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { findNode } from '@/core/graph/graphEngine';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}

export function NodeContextMenu({ x, y, nodeId, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const graph = useCoreStore((s) => s.graph);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openDeleteDialog = useUIStore((s) => s.openDeleteDialog);

  // Find the node to check if it has children
  const node = findNode(graph, nodeId);
  const hasChildren = node ? node.children.length > 0 : false;

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

  // Edit: select node and open properties panel
  const handleEdit = useCallback(() => {
    selectNode(nodeId);
    openRightPanel('properties');
    onClose();
  }, [selectNode, nodeId, openRightPanel, onClose]);

  // Add Note: select node and open notes panel
  const handleAddNote = useCallback(() => {
    selectNode(nodeId);
    openRightPanel('notes');
    onClose();
  }, [selectNode, nodeId, openRightPanel, onClose]);

  // Add Child: add a child node under this node
  const handleAddChild = useCallback(() => {
    const { addNode } = useCoreStore.getState();
    addNode({
      type: 'compute/service',
      displayName: 'New Child',
      parentId: nodeId,
    });
    onClose();
  }, [nodeId, onClose]);

  // Zoom In: fractal zoom into the node (navigate into its children)
  const handleZoomIn = useCallback(() => {
    zoomIn(nodeId);
    onClose();
  }, [zoomIn, nodeId, onClose]);

  // Delete: open confirmation dialog
  const handleDelete = useCallback(() => {
    if (node) {
      const impact = calculateDeletionImpact(graph, nodeId);
      openDeleteDialog({
        nodeId,
        nodeName: node.displayName,
        edgeCount: impact.edgeCount,
        childCount: impact.childCount,
      });
    }
    onClose();
  }, [graph, node, nodeId, openDeleteDialog, onClose]);

  const menuItems = [
    { label: 'Edit', icon: Pencil, action: handleEdit, testId: 'ctx-node-edit', disabled: false },
    { label: 'Add Note', icon: StickyNote, action: handleAddNote, testId: 'ctx-node-add-note', disabled: false },
    { label: 'Add Child', icon: Plus, action: handleAddChild, testId: 'ctx-node-add-child', disabled: false },
    { label: 'Zoom In', icon: ZoomIn, action: handleZoomIn, testId: 'ctx-node-zoom-in', disabled: !hasChildren },
    { label: 'Delete', icon: Trash2, action: handleDelete, testId: 'ctx-node-delete', disabled: false },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-[100] min-w-[180px]"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="node-context-menu"
    >
      {/* Node name header */}
      {node && (
        <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 truncate font-medium">
          {node.displayName}
        </div>
      )}
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.disabled ? undefined : item.action}
            disabled={item.disabled}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors
              ${item.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : item.label === 'Delete'
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
