/**
 * CanvasContextMenu - touch-optimized context menu for the canvas background.
 * Uses TouchContextMenu for iOS-native styling with blur backdrop, spring animation,
 * cascading submenu for "Add Node" with node type categories.
 */

import { useCallback } from 'react';
import { Plus, Clipboard, LayoutGrid, Maximize, Server, Database, Radio, Globe, Activity } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useNavigationStore } from '@/store/navigationStore';
import { TouchContextMenu, type ContextMenuItem } from './TouchContextMenu';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function CanvasContextMenu({ x, y, onClose }: CanvasContextMenuProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const autoLayout = useCoreStore((s) => s.autoLayout);
  const addNode = useCoreStore((s) => s.addNode);
  const requestFitView = useCanvasStore((s) => s.requestFitView);
  const navigationPath = useNavigationStore((s) => s.path);

  const handleAddNodeType = useCallback(
    (type: string, displayName: string) => {
      addNode({ type, displayName });
      onClose();
    },
    [addNode, onClose],
  );

  const handleBrowseAll = useCallback(() => {
    if (!leftPanelOpen) toggleLeftPanel();
    onClose();
  }, [leftPanelOpen, toggleLeftPanel, onClose]);

  const handlePaste = useCallback(() => {
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

  const addNodeSubmenu: ContextMenuItem[] = [
    {
      label: 'Service',
      icon: Server,
      action: () => handleAddNodeType('compute/service', 'New Service'),
      testId: 'ctx-add-service',
    },
    {
      label: 'Database',
      icon: Database,
      action: () => handleAddNodeType('data/database', 'New Database'),
      testId: 'ctx-add-database',
    },
    {
      label: 'Message Queue',
      icon: Radio,
      action: () => handleAddNodeType('messaging/message-queue', 'New Queue'),
      testId: 'ctx-add-queue',
    },
    {
      label: 'Load Balancer',
      icon: Globe,
      action: () => handleAddNodeType('network/load-balancer', 'New LB'),
      testId: 'ctx-add-lb',
    },
    {
      label: 'Monitoring',
      icon: Activity,
      action: () => handleAddNodeType('observability/monitoring', 'New Monitor'),
      testId: 'ctx-add-monitoring',
    },
    {
      label: 'Browse All\u2026',
      icon: Plus,
      action: handleBrowseAll,
      testId: 'ctx-add-browse',
    },
  ];

  const menuItems: ContextMenuItem[] = [
    {
      label: 'Add Node',
      icon: Plus,
      testId: 'ctx-add-node',
      submenu: addNodeSubmenu,
    },
    { label: 'Paste', icon: Clipboard, action: handlePaste, testId: 'ctx-paste' },
    { label: 'Auto-Layout', icon: LayoutGrid, action: handleAutoLayout, testId: 'ctx-auto-layout' },
    { label: 'Fit View', icon: Maximize, action: handleFitView, testId: 'ctx-fit-view' },
  ];

  return (
    <TouchContextMenu
      x={x}
      y={y}
      onClose={onClose}
      items={menuItems}
    />
  );
}
