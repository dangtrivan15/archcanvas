/**
 * EdgeContextMenu - touch-optimized context menu for edges on the canvas.
 * Uses TouchContextMenu for iOS-native styling.
 */

import { useCallback } from 'react';
import { Pencil, StickyNote, Trash2 } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findEdge } from '@/core/graph/graphEngine';
import { TouchContextMenu, type ContextMenuItem } from './TouchContextMenu';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  onClose: () => void;
}

export function EdgeContextMenu({ x, y, edgeId, onClose }: EdgeContextMenuProps) {
  const graph = useCoreStore((s) => s.graph);
  const removeEdge = useCoreStore((s) => s.removeEdge);
  const selectEdge = useCanvasStore((s) => s.selectEdge);
  const openRightPanel = useUIStore((s) => s.openRightPanel);

  const edge = findEdge(graph, edgeId);
  const edgeLabel = edge?.label || `${edge?.fromNode ?? '?'} \u2192 ${edge?.toNode ?? '?'}`;

  const handleEdit = useCallback(() => {
    selectEdge(edgeId);
    openRightPanel('properties');
    onClose();
  }, [selectEdge, edgeId, openRightPanel, onClose]);

  const handleAddNote = useCallback(() => {
    selectEdge(edgeId);
    openRightPanel('notes');
    onClose();
  }, [selectEdge, edgeId, openRightPanel, onClose]);

  const handleDelete = useCallback(() => {
    removeEdge(edgeId);
    onClose();
  }, [removeEdge, edgeId, onClose]);

  const menuItems: ContextMenuItem[] = [
    { label: 'Edit', icon: Pencil, action: handleEdit, testId: 'ctx-edge-edit' },
    { label: 'Add Note', icon: StickyNote, action: handleAddNote, testId: 'ctx-edge-add-note' },
    { label: 'Delete', icon: Trash2, action: handleDelete, testId: 'ctx-edge-delete', isDanger: true },
  ];

  return (
    <TouchContextMenu
      x={x}
      y={y}
      onClose={onClose}
      header={edgeLabel}
      items={menuItems}
    />
  );
}
