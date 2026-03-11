/**
 * NodeContextMenu - touch-optimized context menu for nodes on the canvas.
 * Uses TouchContextMenu for iOS-native styling.
 */

import { useCallback } from 'react';
import { Pencil, StickyNote, Plus, ZoomIn, Trash2 } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useUIStore } from '@/store/uiStore';
import { findNode } from '@/core/graph/graphEngine';
import { calculateDeletionImpact } from '@/core/graph/deletionImpact';
import { TouchContextMenu, type ContextMenuItem } from './TouchContextMenu';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
}

export function NodeContextMenu({ x, y, nodeId, onClose }: NodeContextMenuProps) {
  const graph = useGraphStore((s) => s.graph);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const zoomIn = useNavigationStore((s) => s.zoomIn);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const openDeleteDialog = useUIStore((s) => s.openDeleteDialog);

  const node = findNode(graph, nodeId);
  const hasChildren = node ? node.children.length > 0 : false;

  const handleEdit = useCallback(() => {
    selectNode(nodeId);
    openRightPanel('properties');
    onClose();
  }, [selectNode, nodeId, openRightPanel, onClose]);

  const handleAddNote = useCallback(() => {
    selectNode(nodeId);
    openRightPanel('notes');
    onClose();
  }, [selectNode, nodeId, openRightPanel, onClose]);

  const handleAddChild = useCallback(() => {
    const { addNode } = useGraphStore.getState();
    addNode({
      type: 'compute/service',
      displayName: 'New Child',
      parentId: nodeId,
    });
    onClose();
  }, [nodeId, onClose]);

  const handleZoomIn = useCallback(() => {
    zoomIn(nodeId);
    onClose();
  }, [zoomIn, nodeId, onClose]);

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

  const menuItems: ContextMenuItem[] = [
    { label: 'Edit', icon: Pencil, action: handleEdit, testId: 'ctx-node-edit' },
    { label: 'Add Note', icon: StickyNote, action: handleAddNote, testId: 'ctx-node-add-note' },
    { label: 'Add Child', icon: Plus, action: handleAddChild, testId: 'ctx-node-add-child' },
    {
      label: 'Zoom In',
      icon: ZoomIn,
      action: handleZoomIn,
      testId: 'ctx-node-zoom-in',
      disabled: !hasChildren,
    },
    {
      label: 'Delete',
      icon: Trash2,
      action: handleDelete,
      testId: 'ctx-node-delete',
      isDanger: true,
    },
  ];

  return (
    <TouchContextMenu x={x} y={y} onClose={onClose} header={node?.displayName} items={menuItems} />
  );
}
