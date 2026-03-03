/**
 * Central command registry for the Command Palette.
 * All available commands/actions are registered here with metadata
 * for searching, display, and execution.
 */

import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';
import { formatBindingDisplay } from '@/core/input';

export interface Command {
  /** Unique identifier */
  id: string;
  /** Display label shown in the palette */
  label: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Optional keyboard shortcut hint (platform-aware display string) */
  shortcut?: string;
  /** Keywords for fuzzy matching (searched alongside label) */
  keywords?: string[];
  /** Optional icon name (matches lucide-react icon in iconMap) */
  iconName?: string;
  /** Execute the command */
  execute: () => void;
  /** Whether the command is currently available (optional, defaults to true) */
  isEnabled?: () => boolean;
}

export type CommandCategory = 'File' | 'Edit' | 'View' | 'Canvas' | 'Navigation' | 'Node' | 'Edge';

/**
 * Platform-aware shortcut display string.
 * Uses the centralized formatBindingDisplay to avoid duplicated platform detection.
 */
function shortcut(binding: string): string {
  return formatBindingDisplay(binding);
}

/**
 * Get all static commands (actions that are always available).
 */
export function getStaticCommands(): Command[] {
  return [
    // === File ===
    {
      id: 'file:new',
      label: 'New File',
      category: 'File',
      shortcut: shortcut('mod+n'),
      keywords: ['create', 'blank', 'empty'],
      execute: () => {
        const { newFile } = useCoreStore.getState();
        const { zoomToRoot } = useNavigationStore.getState();
        const { isDirty } = useCoreStore.getState();
        const { openUnsavedChangesDialog } = useUIStore.getState();
        const doNew = () => { newFile(); zoomToRoot(); };
        if (isDirty) {
          openUnsavedChangesDialog({ onConfirm: doNew });
        } else {
          doNew();
        }
      },
    },
    {
      id: 'file:open',
      label: 'Open File',
      category: 'File',
      shortcut: shortcut('mod+o'),
      keywords: ['load', 'browse', 'import'],
      execute: () => {
        useCoreStore.getState().openFile();
      },
    },
    {
      id: 'file:save',
      label: 'Save',
      category: 'File',
      shortcut: shortcut('mod+s'),
      keywords: ['persist', 'write', 'store'],
      execute: () => {
        useCoreStore.getState().saveFile();
      },
    },
    {
      id: 'file:save-as',
      label: 'Save As...',
      category: 'File',
      shortcut: shortcut('mod+shift+s'),
      keywords: ['export', 'download', 'copy'],
      execute: () => {
        useCoreStore.getState().saveFileAs();
      },
    },

    // === Edit ===
    {
      id: 'edit:undo',
      label: 'Undo',
      category: 'Edit',
      shortcut: shortcut('mod+z'),
      keywords: ['revert', 'back'],
      execute: () => {
        useCoreStore.getState().undo();
      },
      isEnabled: () => useCoreStore.getState().canUndo,
    },
    {
      id: 'edit:redo',
      label: 'Redo',
      category: 'Edit',
      shortcut: shortcut('mod+shift+z'),
      keywords: ['forward', 'repeat'],
      execute: () => {
        useCoreStore.getState().redo();
      },
      isEnabled: () => useCoreStore.getState().canRedo,
    },

    {
      id: 'node:rename',
      label: 'Rename Node',
      category: 'Edit',
      shortcut: shortcut('f2'),
      keywords: ['rename', 'name', 'edit', 'f2', 'display name', 'inline'],
      iconName: 'Pencil',
      execute: () => {
        const { selectedNodeId } = useCanvasStore.getState();
        if (selectedNodeId) {
          // Activate inline edit directly on the canvas node
          useUIStore.getState().setInlineEditNodeId(selectedNodeId);
        }
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeId !== null,
    },

    {
      id: 'edit:duplicate',
      label: 'Duplicate Selected',
      category: 'Edit',
      shortcut: shortcut('mod+d'),
      keywords: ['duplicate', 'copy', 'clone', 'replicate'],
      iconName: 'Copy',
      execute: () => {
        const { selectedNodeId, selectedNodeIds, selectNode, selectNodes } = useCanvasStore.getState();
        const { duplicateSelection } = useCoreStore.getState();

        let nodeIds: string[] = [];
        if (selectedNodeIds.length > 0) {
          nodeIds = selectedNodeIds;
        } else if (selectedNodeId) {
          nodeIds = [selectedNodeId];
        }

        if (nodeIds.length > 0) {
          const newIds = duplicateSelection(nodeIds);
          if (newIds.length === 1) {
            selectNode(newIds[0]!);
          } else if (newIds.length > 1) {
            selectNodes(newIds);
          }
        }
      },
      isEnabled: () => {
        const { selectedNodeId, selectedNodeIds } = useCanvasStore.getState();
        return selectedNodeIds.length > 0 || selectedNodeId !== null;
      },
    },

    // === View ===
    {
      id: 'view:toggle-left-panel',
      label: 'Toggle Node Types Panel',
      category: 'View',
      keywords: ['sidebar', 'left', 'nodedef', 'browser', 'panel'],
      execute: () => {
        useUIStore.getState().toggleLeftPanel();
      },
    },
    {
      id: 'view:toggle-right-panel',
      label: 'Toggle Detail Panel',
      category: 'View',
      keywords: ['sidebar', 'right', 'properties', 'panel', 'inspector'],
      execute: () => {
        useUIStore.getState().toggleRightPanel();
      },
    },
    {
      id: 'view:keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      category: 'View',
      shortcut: '?',
      keywords: ['help', 'hotkeys', 'bindings'],
      execute: () => {
        useUIStore.getState().openShortcutsHelp();
      },
    },
    {
      id: 'view:customize-shortcuts',
      label: 'Customize Keyboard Shortcuts',
      category: 'View',
      keywords: ['rebind', 'keybindings', 'configure', 'settings', 'remap'],
      execute: () => {
        useUIStore.getState().openShortcutSettings();
      },
    },

    // === View / Zoom ===
    {
      id: 'view:zoom-in',
      label: 'Zoom In',
      category: 'View',
      shortcut: shortcut('='),
      keywords: ['magnify', 'enlarge', 'bigger', 'plus'],
      execute: () => {
        useCanvasStore.getState().requestZoomIn();
      },
    },
    {
      id: 'view:zoom-out',
      label: 'Zoom Out',
      category: 'View',
      shortcut: shortcut('-'),
      keywords: ['shrink', 'smaller', 'minus'],
      execute: () => {
        useCanvasStore.getState().requestZoomOut();
      },
    },
    {
      id: 'view:fit-all',
      label: 'Fit View',
      category: 'View',
      shortcut: shortcut('mod+0'),
      keywords: ['zoom', 'fit', 'center', 'reset view', 'all'],
      execute: () => {
        useCanvasStore.getState().requestFitView();
      },
    },
    {
      id: 'view:zoom-100',
      label: 'Zoom to 100%',
      category: 'View',
      shortcut: shortcut('mod+1'),
      keywords: ['actual', 'real', 'reset zoom', 'original'],
      execute: () => {
        useCanvasStore.getState().requestZoom100();
      },
    },

    // === Navigation / Search ===
    {
      id: 'nav:quick-search',
      label: 'Quick Search Nodes',
      category: 'Navigation',
      shortcut: '/',
      keywords: ['search', 'find', 'jump', 'go to', 'navigate', 'node'],
      execute: () => {
        useUIStore.getState().openQuickSearch();
      },
    },

    // === Canvas ===
    {
      id: 'canvas:fit-view',
      label: 'Fit View (Canvas)',
      category: 'Canvas',
      keywords: ['zoom', 'fit', 'center', 'reset view'],
      execute: () => {
        useCanvasStore.getState().requestFitView();
      },
    },
    {
      id: 'canvas:deselect',
      label: 'Deselect All',
      category: 'Canvas',
      shortcut: 'Esc',
      keywords: ['clear', 'selection', 'unselect'],
      execute: () => {
        useCanvasStore.getState().clearSelection();
        useUIStore.getState().closeRightPanel();
      },
    },
    {
      id: 'canvas:layout-horizontal',
      label: 'Auto Layout (Horizontal)',
      category: 'Canvas',
      keywords: ['arrange', 'organize', 'elk', 'left-right'],
      execute: () => {
        useCoreStore.getState().autoLayout('horizontal');
      },
    },
    {
      id: 'canvas:layout-vertical',
      label: 'Auto Layout (Vertical)',
      category: 'Canvas',
      keywords: ['arrange', 'organize', 'elk', 'top-bottom'],
      execute: () => {
        useCoreStore.getState().autoLayout('vertical');
      },
    },

    // === Navigation ===
    {
      id: 'nav:zoom-to-root',
      label: 'Navigate to Root',
      category: 'Navigation',
      keywords: ['home', 'top', 'root', 'back'],
      execute: () => {
        useNavigationStore.getState().zoomToRoot();
      },
    },
    {
      id: 'nav:zoom-out',
      label: 'Navigate Up (Parent)',
      category: 'Navigation',
      shortcut: 'Backspace',
      keywords: ['parent', 'up', 'back', 'out'],
      execute: () => {
        useNavigationStore.getState().zoomOut();
      },
      isEnabled: () => useNavigationStore.getState().path.length > 0,
    },

    // === Edge Operations ===
    {
      id: 'connect:wizard',
      label: 'Connect Nodes...',
      category: 'Edge',
      keywords: ['connect', 'edge', 'link', 'wire', 'join', 'relation'],
      iconName: 'ArrowRight',
      execute: () => {
        // Handled by CommandPalette wizard mode — no-op here
      },
      isEnabled: () => useCoreStore.getState().graph.nodes.length >= 2,
    },

    // === Edge Type Operations ===
    {
      id: 'edge:cycle-type',
      label: 'Cycle Edge Type',
      category: 'Edge',
      shortcut: shortcut('t'),
      keywords: ['cycle', 'type', 'edge', 'toggle', 'change'],
      execute: () => {
        const { graph, updateEdge } = useCoreStore.getState();
        const { selectedEdgeId } = useCanvasStore.getState();
        const { showToast } = useUIStore.getState();
        if (!selectedEdgeId) return;
        const edge = graph.edges.find((e) => e.id === selectedEdgeId);
        if (!edge) return;
        const types: Array<'sync' | 'async' | 'data-flow'> = ['sync', 'async', 'data-flow'];
        const typeLabels: Record<string, string> = { sync: 'Sync', async: 'Async', 'data-flow': 'Data Flow' };
        const currentIdx = types.indexOf(edge.type);
        const nextType = types[(currentIdx + 1) % types.length]!;
        updateEdge(selectedEdgeId, { type: nextType }, `Change edge type to ${typeLabels[nextType]}`);
        showToast(`Changed to ${typeLabels[nextType]}`);
      },
      isEnabled: () => useCanvasStore.getState().selectedEdgeId !== null,
    },
    {
      id: 'edge:set-sync',
      label: 'Set Edge Type: Sync',
      category: 'Edge',
      keywords: ['sync', 'type', 'edge', 'set', 'request', 'response'],
      execute: () => {
        const { updateEdge } = useCoreStore.getState();
        const { selectedEdgeId } = useCanvasStore.getState();
        const { showToast } = useUIStore.getState();
        if (!selectedEdgeId) return;
        updateEdge(selectedEdgeId, { type: 'sync' }, 'Change edge type to Sync');
        showToast('Changed to Sync');
      },
      isEnabled: () => useCanvasStore.getState().selectedEdgeId !== null,
    },
    {
      id: 'edge:set-async',
      label: 'Set Edge Type: Async',
      category: 'Edge',
      keywords: ['async', 'type', 'edge', 'set', 'event', 'message'],
      execute: () => {
        const { updateEdge } = useCoreStore.getState();
        const { selectedEdgeId } = useCanvasStore.getState();
        const { showToast } = useUIStore.getState();
        if (!selectedEdgeId) return;
        updateEdge(selectedEdgeId, { type: 'async' }, 'Change edge type to Async');
        showToast('Changed to Async');
      },
      isEnabled: () => useCanvasStore.getState().selectedEdgeId !== null,
    },
    {
      id: 'edge:set-data-flow',
      label: 'Set Edge Type: Data Flow',
      category: 'Edge',
      keywords: ['data', 'flow', 'type', 'edge', 'set', 'pipeline', 'etl'],
      execute: () => {
        const { updateEdge } = useCoreStore.getState();
        const { selectedEdgeId } = useCanvasStore.getState();
        const { showToast } = useUIStore.getState();
        if (!selectedEdgeId) return;
        updateEdge(selectedEdgeId, { type: 'data-flow' }, 'Change edge type to Data Flow');
        showToast('Changed to Data Flow');
      },
      isEnabled: () => useCanvasStore.getState().selectedEdgeId !== null,
    },
  ];
}

/**
 * Get node commands - allows navigating to/selecting specific nodes.
 */
export function getNodeCommands(): Command[] {
  const { graph } = useCoreStore.getState();
  const commands: Command[] = [];

  function collectNodes(nodes: import('@/types/graph').ArchNode[], depth: number) {
    for (const node of nodes) {
      commands.push({
        id: `node:${node.id}`,
        label: `Go to: ${node.displayName}`,
        category: 'Node',
        keywords: [node.type, node.displayName.toLowerCase(), 'navigate', 'select', 'find'],
        execute: () => {
          const { selectNode } = useCanvasStore.getState();
          const { openRightPanel } = useUIStore.getState();
          selectNode(node.id);
          openRightPanel('properties');
        },
      });

      // Recurse into children
      if (node.children.length > 0) {
        collectNodes(node.children, depth + 1);
      }
    }
  }

  collectNodes(graph.nodes, 0);
  return commands;
}

/**
 * Get node creation commands — one "Add {displayName}" command per NodeDef type.
 * Iterates the NodeDef registry and creates a command for each type.
 * Node is placed at viewport center (or offset from selected node).
 * After creation, the node is selected and rename mode activates.
 */
export function getNodeCreationCommands(): Command[] {
  const { registry } = useCoreStore.getState();
  if (!registry) return [];

  const commands: Command[] = [];

  for (const nodeDef of registry.listAll()) {
    const typeKey = `${nodeDef.metadata.namespace}/${nodeDef.metadata.name}`;
    const displayName = nodeDef.metadata.displayName;
    const iconName = nodeDef.metadata.icon;
    const tags = nodeDef.metadata.tags || [];

    commands.push({
      id: `create:${typeKey}`,
      label: `Add ${displayName}`,
      category: 'Node',
      iconName,
      keywords: [
        'add', 'new', 'create', 'node',
        displayName.toLowerCase(),
        typeKey,
        nodeDef.metadata.namespace,
        ...tags.map((t) => t.toLowerCase()),
      ],
      execute: () => {
        const { addNode } = useCoreStore.getState();
        const { viewport, selectedNodeId } = useCanvasStore.getState();
        const { selectNode } = useCanvasStore.getState();
        const { openRightPanel, setPendingRenameNodeId } = useUIStore.getState();
        const { path } = useNavigationStore.getState();
        const { graph } = useCoreStore.getState();

        // Calculate placement position:
        // If a node is selected, offset from it; otherwise use viewport center
        let x: number;
        let y: number;

        if (selectedNodeId) {
          // Find the selected node to offset from it
          const selectedNode = _findNodeById(graph.nodes, selectedNodeId);
          if (selectedNode) {
            x = selectedNode.position.x + 300;
            y = selectedNode.position.y;
          } else {
            // Fallback to viewport center
            const center = _viewportCenter(viewport);
            x = center.x;
            y = center.y;
          }
        } else {
          // Place at viewport center
          const center = _viewportCenter(viewport);
          x = center.x;
          y = center.y;
        }

        // Determine parent if inside a group (nested navigation)
        const parentId = path.length > 0 ? path[path.length - 1] : undefined;

        // Create the node
        const node = addNode({
          type: typeKey,
          displayName,
          position: { x, y },
          parentId,
        });

        if (node) {
          // Select the new node and open properties panel
          selectNode(node.id);
          openRightPanel('properties');
          // Trigger rename mode (auto-focus display name input)
          setPendingRenameNodeId(node.id);
          console.log(`[CommandPalette] Created ${typeKey} node: ${node.displayName} at (${x}, ${y})`);
        }
      },
    });
  }

  return commands;
}

/**
 * Calculate viewport center in graph coordinates.
 */
function _viewportCenter(viewport: { x: number; y: number; zoom: number }): { x: number; y: number } {
  // Convert viewport offset to graph coordinates.
  // React Flow viewport: panX = -x*zoom, panY = -y*zoom
  // The center of the window in graph coords is:
  //   centerX = (-viewport.x + windowWidth/2) / viewport.zoom
  //   centerY = (-viewport.y + windowHeight/2) / viewport.zoom
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.round((-viewport.x + windowWidth / 2) / viewport.zoom),
    y: Math.round((-viewport.y + windowHeight / 2) / viewport.zoom),
  };
}

/**
 * Find a node by ID, recursively searching children.
 */
function _findNodeById(nodes: import('@/types/graph').ArchNode[], id: string): import('@/types/graph').ArchNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = _findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get bulk operation commands — selection-aware commands for multi-node actions.
 * These commands are enabled only when appropriate selection exists.
 */
export function getBulkOperationCommands(): Command[] {
  return [
    // === Delete Selected ===
    {
      id: 'bulk:delete-selected',
      label: _bulkLabel('Delete', 'Selected Nodes'),
      category: 'Edit',
      keywords: ['delete', 'remove', 'bulk', 'selected', 'multi'],
      iconName: 'Trash2',
      execute: () => {
        const { textApi, undoManager } = useCoreStore.getState();
        const { selectedNodeIds, clearSelection } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length === 0) return;

        // Batch delete: remove all selected nodes, single undo snapshot
        for (const nodeId of selectedNodeIds) {
          textApi.removeNode(nodeId);
        }
        const updatedGraph = textApi.getGraph();
        undoManager.snapshot(`Delete ${selectedNodeIds.length} nodes`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          nodeCount: _countAllNodes(updatedGraph),
          edgeCount: updatedGraph.edges.length,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });

        clearSelection();
        useUIStore.getState().closeRightPanel();
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 2,
    },

    // === Duplicate Selected ===
    {
      id: 'bulk:duplicate-selected',
      label: _bulkLabel('Duplicate', 'Selected Nodes'),
      category: 'Edit',
      keywords: ['duplicate', 'copy', 'clone', 'bulk', 'selected', 'multi'],
      iconName: 'Copy',
      execute: () => {
        const coreState = useCoreStore.getState();
        const { textApi, undoManager, graph } = coreState;
        const { selectedNodeIds, selectNodes } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length === 0) return;

        // Calculate center of selected nodes for offset
        const OFFSET = 50; // pixels offset for duplicated nodes
        const newNodeIds: string[] = [];

        for (const nodeId of selectedNodeIds) {
          const node = _findNodeById(graph.nodes, nodeId);
          if (!node) continue;

          const newNode = textApi.addNode({
            type: node.type,
            displayName: `${node.displayName} (copy)`,
            position: {
              x: node.position.x + OFFSET,
              y: node.position.y + OFFSET,
            },
            args: { ...node.args },
          });
          if (newNode) {
            newNodeIds.push(newNode.id);
          }
        }

        const updatedGraph = textApi.getGraph();
        undoManager.snapshot(`Duplicate ${selectedNodeIds.length} nodes`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          nodeCount: _countAllNodes(updatedGraph),
          edgeCount: updatedGraph.edges.length,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });

        // Select the new duplicated nodes
        if (newNodeIds.length > 0) {
          selectNodes(newNodeIds);
        }
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 2,
    },

    // === Align Horizontally (same Y) ===
    {
      id: 'bulk:align-horizontal',
      label: 'Align Horizontally',
      category: 'Canvas',
      keywords: ['align', 'horizontal', 'same', 'row', 'y', 'line up'],
      iconName: 'AlignVerticalJustifyCenter',
      execute: () => {
        const { graph, textApi, undoManager } = useCoreStore.getState();
        const { selectedNodeIds } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length < 2) return;

        // Calculate average Y position
        const nodes = selectedNodeIds
          .map((id) => _findNodeById(graph.nodes, id))
          .filter((n): n is import('@/types/graph').ArchNode => n !== undefined);

        if (nodes.length < 2) return;

        const avgY = nodes.reduce((sum, n) => sum + n.position.y, 0) / nodes.length;

        // Move all selected nodes to average Y
        let updatedGraph = graph;
        for (const node of nodes) {
          updatedGraph = _moveNodeInGraph(updatedGraph, node.id, node.position.x, Math.round(avgY));
        }

        textApi.setGraph(updatedGraph);
        undoManager.snapshot(`Align ${nodes.length} nodes horizontally`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 2,
    },

    // === Align Vertically (same X) ===
    {
      id: 'bulk:align-vertical',
      label: 'Align Vertically',
      category: 'Canvas',
      keywords: ['align', 'vertical', 'same', 'column', 'x', 'line up'],
      iconName: 'AlignHorizontalJustifyCenter',
      execute: () => {
        const { graph, textApi, undoManager } = useCoreStore.getState();
        const { selectedNodeIds } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length < 2) return;

        const nodes = selectedNodeIds
          .map((id) => _findNodeById(graph.nodes, id))
          .filter((n): n is import('@/types/graph').ArchNode => n !== undefined);

        if (nodes.length < 2) return;

        const avgX = nodes.reduce((sum, n) => sum + n.position.x, 0) / nodes.length;

        let updatedGraph = graph;
        for (const node of nodes) {
          updatedGraph = _moveNodeInGraph(updatedGraph, node.id, Math.round(avgX), node.position.y);
        }

        textApi.setGraph(updatedGraph);
        undoManager.snapshot(`Align ${nodes.length} nodes vertically`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 2,
    },

    // === Distribute Evenly Horizontally ===
    {
      id: 'bulk:distribute-horizontal',
      label: 'Distribute Evenly Horizontally',
      category: 'Canvas',
      keywords: ['distribute', 'horizontal', 'even', 'space', 'spread'],
      iconName: 'MoveHorizontal',
      execute: () => {
        const { graph, textApi, undoManager } = useCoreStore.getState();
        const { selectedNodeIds } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length < 3) return;

        const nodes = selectedNodeIds
          .map((id) => _findNodeById(graph.nodes, id))
          .filter((n): n is import('@/types/graph').ArchNode => n !== undefined);

        if (nodes.length < 3) return;

        // Sort by X position
        const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
        const minX = sorted[0]!.position.x;
        const maxX = sorted[sorted.length - 1]!.position.x;
        const step = (maxX - minX) / (sorted.length - 1);

        let updatedGraph = graph;
        for (let i = 0; i < sorted.length; i++) {
          const node = sorted[i]!;
          const newX = Math.round(minX + step * i);
          updatedGraph = _moveNodeInGraph(updatedGraph, node.id, newX, node.position.y);
        }

        textApi.setGraph(updatedGraph);
        undoManager.snapshot(`Distribute ${nodes.length} nodes horizontally`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 3,
    },

    // === Distribute Evenly Vertically ===
    {
      id: 'bulk:distribute-vertical',
      label: 'Distribute Evenly Vertically',
      category: 'Canvas',
      keywords: ['distribute', 'vertical', 'even', 'space', 'spread'],
      iconName: 'MoveVertical',
      execute: () => {
        const { graph, textApi, undoManager } = useCoreStore.getState();
        const { selectedNodeIds } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length < 3) return;

        const nodes = selectedNodeIds
          .map((id) => _findNodeById(graph.nodes, id))
          .filter((n): n is import('@/types/graph').ArchNode => n !== undefined);

        if (nodes.length < 3) return;

        // Sort by Y position
        const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
        const minY = sorted[0]!.position.y;
        const maxY = sorted[sorted.length - 1]!.position.y;
        const step = (maxY - minY) / (sorted.length - 1);

        let updatedGraph = graph;
        for (let i = 0; i < sorted.length; i++) {
          const node = sorted[i]!;
          const newY = Math.round(minY + step * i);
          updatedGraph = _moveNodeInGraph(updatedGraph, node.id, node.position.x, newY);
        }

        textApi.setGraph(updatedGraph);
        undoManager.snapshot(`Distribute ${nodes.length} nodes vertically`, updatedGraph);

        useCoreStore.setState({
          graph: updatedGraph,
          isDirty: true,
          canUndo: undoManager.canUndo,
          canRedo: undoManager.canRedo,
        });
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 3,
    },

    // === Group Selected ===
    {
      id: 'bulk:group-selected',
      label: _bulkLabel('Group', 'Selected Nodes'),
      category: 'Edit',
      keywords: ['group', 'nest', 'parent', 'container', 'wrap', 'combine'],
      iconName: 'Group',
      execute: () => {
        const { textApi, undoManager, graph } = useCoreStore.getState();
        const { selectedNodeIds, selectNode } = useCanvasStore.getState();
        if (!textApi || !undoManager || selectedNodeIds.length < 2) return;

        const nodes = selectedNodeIds
          .map((id) => _findNodeById(graph.nodes, id))
          .filter((n): n is import('@/types/graph').ArchNode => n !== undefined);

        if (nodes.length < 2) return;

        // Calculate bounding box for group placement
        const minX = Math.min(...nodes.map((n) => n.position.x));
        const minY = Math.min(...nodes.map((n) => n.position.y));
        const maxX = Math.max(...nodes.map((n) => n.position.x + (n.position.width || 200)));
        const maxY = Math.max(...nodes.map((n) => n.position.y + (n.position.height || 100)));

        // Create a container node centered above the group
        const groupNode = textApi.addNode({
          type: 'compute/service',
          displayName: `Group (${nodes.length} nodes)`,
          position: {
            x: Math.round((minX + maxX) / 2 - 100),
            y: Math.round(minY - 80),
          },
        });

        if (groupNode) {
          // Add children to the group node by creating copies inside it
          for (const node of nodes) {
            textApi.addNode({
              type: node.type,
              displayName: node.displayName,
              position: { x: node.position.x - minX, y: node.position.y - minY },
              args: { ...node.args },
              parentId: groupNode.id,
            });
          }

          // Remove original nodes
          for (const node of nodes) {
            textApi.removeNode(node.id);
          }

          const updatedGraph = textApi.getGraph();
          undoManager.snapshot(`Group ${nodes.length} nodes`, updatedGraph);

          useCoreStore.setState({
            graph: updatedGraph,
            isDirty: true,
            nodeCount: _countAllNodes(updatedGraph),
            edgeCount: updatedGraph.edges.length,
            canUndo: undoManager.canUndo,
            canRedo: undoManager.canRedo,
          });

          selectNode(groupNode.id);
        }
      },
      isEnabled: () => useCanvasStore.getState().selectedNodeIds.length >= 2,
    },
  ];
}

/**
 * Generate a dynamic label with selection count.
 */
function _bulkLabel(action: string, suffix: string): string {
  const count = useCanvasStore.getState().selectedNodeIds.length;
  return count > 0 ? `${action} ${count} ${suffix}` : `${action} ${suffix}`;
}

/**
 * Count all nodes recursively (including children).
 */
function _countAllNodes(graph: import('@/types/graph').ArchGraph): number {
  let count = 0;
  function walk(nodes: import('@/types/graph').ArchNode[]) {
    for (const node of nodes) {
      count++;
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(graph.nodes);
  return count;
}

/**
 * Move a node in the graph (pure function, returns new graph).
 * Replicates moveNode from graphEngine for bulk operations.
 */
function _moveNodeInGraph(
  graph: import('@/types/graph').ArchGraph,
  nodeId: string,
  x: number,
  y: number,
): import('@/types/graph').ArchGraph {
  function updateNodes(nodes: import('@/types/graph').ArchNode[]): import('@/types/graph').ArchNode[] {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, position: { ...node.position, x, y } };
      }
      if (node.children.length > 0) {
        return { ...node, children: updateNodes(node.children) };
      }
      return node;
    });
  }
  return { ...graph, nodes: updateNodes(graph.nodes) };
}

/**
 * Get all available commands (static + dynamic node navigation + node creation + bulk ops).
 */
export function getAllCommands(): Command[] {
  return [...getStaticCommands(), ...getBulkOperationCommands(), ...getNodeCreationCommands(), ...getNodeCommands()];
}

/**
 * Fuzzy search commands by query string.
 * Matches against label, keywords, and category.
 */
export function searchCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;

  const lowerQuery = query.toLowerCase().trim();
  const queryParts = lowerQuery.split(/\s+/);

  return commands
    .map((cmd) => {
      const searchable = [
        cmd.label.toLowerCase(),
        cmd.category.toLowerCase(),
        ...(cmd.keywords || []).map((k) => k.toLowerCase()),
      ].join(' ');

      // All query parts must match somewhere in the searchable text
      const allMatch = queryParts.every((part) => searchable.includes(part));
      if (!allMatch) return null;

      // Score: exact label match > label contains > keyword match
      let score = 0;
      if (cmd.label.toLowerCase() === lowerQuery) score = 100;
      else if (cmd.label.toLowerCase().startsWith(lowerQuery)) score = 80;
      else if (cmd.label.toLowerCase().includes(lowerQuery)) score = 60;
      else score = 40;

      return { cmd, score };
    })
    .filter((result): result is { cmd: Command; score: number } => result !== null)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.cmd);
}
