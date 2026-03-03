/**
 * Central command registry for the Command Palette.
 * All available commands/actions are registered here with metadata
 * for searching, display, and execution.
 */

import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { useNavigationStore } from '@/store/navigationStore';

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
  /** Execute the command */
  execute: () => void;
  /** Whether the command is currently available (optional, defaults to true) */
  isEnabled?: () => boolean;
}

export type CommandCategory = 'File' | 'Edit' | 'View' | 'Canvas' | 'Navigation' | 'Node';

/**
 * Returns true if the current platform is macOS.
 */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Platform-aware shortcut string.
 */
function shortcut(mac: string, win: string): string {
  return isMac() ? mac : win;
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
      shortcut: shortcut('⌘ N', 'Ctrl+N'),
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
      shortcut: shortcut('⌘ O', 'Ctrl+O'),
      keywords: ['load', 'browse', 'import'],
      execute: () => {
        useCoreStore.getState().openFile();
      },
    },
    {
      id: 'file:save',
      label: 'Save',
      category: 'File',
      shortcut: shortcut('⌘ S', 'Ctrl+S'),
      keywords: ['persist', 'write', 'store'],
      execute: () => {
        useCoreStore.getState().saveFile();
      },
    },
    {
      id: 'file:save-as',
      label: 'Save As...',
      category: 'File',
      shortcut: shortcut('⌘ ⇧ S', 'Ctrl+Shift+S'),
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
      shortcut: shortcut('⌘ Z', 'Ctrl+Z'),
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
      shortcut: shortcut('⌘ ⇧ Z', 'Ctrl+Shift+Z'),
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
 * Get all available commands (static + dynamic node commands).
 */
export function getAllCommands(): Command[] {
  return [...getStaticCommands(), ...getNodeCommands()];
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
