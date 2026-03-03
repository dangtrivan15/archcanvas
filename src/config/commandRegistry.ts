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

export type CommandCategory = 'File' | 'Edit' | 'View' | 'Canvas' | 'Navigation' | 'Node';

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

    // === Canvas ===
    {
      id: 'canvas:fit-view',
      label: 'Fit View',
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
 * Get all available commands (static + dynamic node navigation + node creation).
 */
export function getAllCommands(): Command[] {
  return [...getStaticCommands(), ...getNodeCreationCommands(), ...getNodeCommands()];
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
