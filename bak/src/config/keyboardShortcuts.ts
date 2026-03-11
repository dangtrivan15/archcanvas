/**
 * Centralized keyboard shortcuts registry.
 * All keyboard shortcuts in the app are listed here for the help panel.
 */

import { getCurrentPlatform, isCmdPlatform } from '@/core/input';

export interface KeyboardShortcut {
  /** Unique identifier */
  id: string;
  /** Category for grouping in the help panel */
  category: ShortcutCategory;
  /** Human-readable description of what the shortcut does */
  description: string;
  /** Key combination for Mac (using ⌘, ⌥, ⇧ symbols) */
  macKeys: string;
  /** Key combination for Windows/Linux (using Ctrl, Alt, Shift) */
  winKeys: string;
}

export type ShortcutCategory = 'File' | 'Edit' | 'View' | 'Canvas' | 'Navigation' | 'Quick Create';

/**
 * All registered keyboard shortcuts, grouped by category.
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // === File ===
  {
    id: 'new-file',
    category: 'File',
    description: 'New file',
    macKeys: '⌘ N',
    winKeys: 'Ctrl+N',
  },
  {
    id: 'open-file',
    category: 'File',
    description: 'Open file',
    macKeys: '⌘ O',
    winKeys: 'Ctrl+O',
  },
  {
    id: 'save',
    category: 'File',
    description: 'Save',
    macKeys: '⌘ S',
    winKeys: 'Ctrl+S',
  },
  {
    id: 'save-as',
    category: 'File',
    description: 'Save As',
    macKeys: '⌘ ⇧ S',
    winKeys: 'Ctrl+Shift+S',
  },

  // === Edit ===
  {
    id: 'undo',
    category: 'Edit',
    description: 'Undo',
    macKeys: '⌘ Z',
    winKeys: 'Ctrl+Z',
  },
  {
    id: 'redo',
    category: 'Edit',
    description: 'Redo',
    macKeys: '⌘ ⇧ Z',
    winKeys: 'Ctrl+Shift+Z',
  },
  {
    id: 'redo-alt',
    category: 'Edit',
    description: 'Redo (alternative)',
    macKeys: '⌘ Y',
    winKeys: 'Ctrl+Y',
  },
  {
    id: 'delete-node',
    category: 'Edit',
    description: 'Delete selected node',
    macKeys: 'Delete',
    winKeys: 'Delete',
  },
  {
    id: 'quick-rename',
    category: 'Edit',
    description: 'Quick rename selected node',
    macKeys: 'F2',
    winKeys: 'F2',
  },
  {
    id: 'select-all',
    category: 'Edit',
    description: 'Select all nodes',
    macKeys: '⌘ A',
    winKeys: 'Ctrl+A',
  },
  {
    id: 'select-all-edges',
    category: 'Edit',
    description: 'Select all edges',
    macKeys: '⌘ ⇧ A',
    winKeys: 'Ctrl+Shift+A',
  },
  {
    id: 'duplicate',
    category: 'Edit',
    description: 'Duplicate selected node(s)',
    macKeys: '⌘ D',
    winKeys: 'Ctrl+D',
  },

  // === View / Zoom ===
  {
    id: 'view-zoom-in',
    category: 'View',
    description: 'Zoom in',
    macKeys: '= / ⌘ =',
    winKeys: '= / Ctrl+=',
  },
  {
    id: 'view-zoom-out',
    category: 'View',
    description: 'Zoom out',
    macKeys: '- / ⌘ -',
    winKeys: '- / Ctrl+-',
  },
  {
    id: 'view-fit-all',
    category: 'View',
    description: 'Fit view (show all)',
    macKeys: '⌘ 0',
    winKeys: 'Ctrl+0',
  },
  {
    id: 'view-zoom-100',
    category: 'View',
    description: 'Zoom to 100%',
    macKeys: '⌘ 1',
    winKeys: 'Ctrl+1',
  },

  // === Layout ===
  {
    id: 'auto-layout',
    category: 'View',
    description: 'Auto-Layout (Horizontal)',
    macKeys: '⌘ ⇧ L',
    winKeys: 'Ctrl+Shift+L',
  },

  // === Canvas ===
  {
    id: 'command-palette',
    category: 'Canvas',
    description: 'Open command palette',
    macKeys: '⌘ K',
    winKeys: 'Ctrl+K',
  },
  {
    id: 'deselect',
    category: 'Canvas',
    description: 'Deselect / close panel / cancel placement',
    macKeys: 'Esc',
    winKeys: 'Esc',
  },
  {
    id: 'shortcuts-help',
    category: 'Canvas',
    description: 'Show keyboard shortcuts',
    macKeys: '?',
    winKeys: '?',
  },
  {
    id: 'toggle-terminal',
    category: 'Canvas',
    description: 'Toggle terminal panel',
    macKeys: '⌘ /',
    winKeys: 'Ctrl+/',
  },

  // === Navigation ===
  {
    id: 'drill-into',
    category: 'Navigation',
    description: 'Drill into node (fractal zoom)',
    macKeys: 'Double-click',
    winKeys: 'Double-click',
  },
  {
    id: 'zoom-out',
    category: 'Navigation',
    description: 'Zoom out to parent',
    macKeys: 'Backspace',
    winKeys: 'Backspace',
  },
  {
    id: 'nav-arrow-up',
    category: 'Navigation',
    description: 'Navigate to node above',
    macKeys: '↑',
    winKeys: '↑',
  },
  {
    id: 'nav-arrow-down',
    category: 'Navigation',
    description: 'Navigate to node below',
    macKeys: '↓',
    winKeys: '↓',
  },
  {
    id: 'nav-arrow-left',
    category: 'Navigation',
    description: 'Navigate to node left',
    macKeys: '←',
    winKeys: '←',
  },
  {
    id: 'nav-arrow-right',
    category: 'Navigation',
    description: 'Navigate to node right',
    macKeys: '→',
    winKeys: '→',
  },

  // === Quick Create ===
  {
    id: 'quick-add-service',
    category: 'Quick Create',
    description: 'Quick add Service node',
    macKeys: 'S',
    winKeys: 'S',
  },
  {
    id: 'quick-add-database',
    category: 'Quick Create',
    description: 'Quick add Database node',
    macKeys: 'D',
    winKeys: 'D',
  },
  {
    id: 'quick-add-queue',
    category: 'Quick Create',
    description: 'Quick add Queue node',
    macKeys: 'Q',
    winKeys: 'Q',
  },
  {
    id: 'quick-add-gateway',
    category: 'Quick Create',
    description: 'Quick add Gateway node',
    macKeys: 'G',
    winKeys: 'G',
  },
  {
    id: 'quick-add-cache',
    category: 'Quick Create',
    description: 'Quick add Cache node',
    macKeys: 'A',
    winKeys: 'A',
  },
];

/**
 * Ordered list of categories for display.
 */
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  'File',
  'Edit',
  'View',
  'Canvas',
  'Navigation',
  'Quick Create',
];

/**
 * Returns true if the current platform is macOS (or iPad).
 * Delegates to centralized platform detection.
 */
export function isMacPlatform(): boolean {
  return isCmdPlatform(getCurrentPlatform());
}

/**
 * Map from help panel shortcut IDs to ShortcutManager action IDs.
 * Allows the help panel to show customized bindings.
 */
const HELP_TO_ACTION_MAP: Record<string, string> = {
  'new-file': 'file:new',
  'open-file': 'file:open',
  save: 'file:save',
  'save-as': 'file:save-as',
  undo: 'edit:undo',
  redo: 'edit:redo',
  'redo-alt': 'edit:redo-alt',
  'delete-node': 'edit:delete',
  'quick-rename': 'node:rename',
  'select-all': 'select:all',
  'select-all-edges': 'select:all-edges',
  duplicate: 'edit:duplicate',
  'auto-layout': 'layout:auto',
  'command-palette': 'canvas:command-palette',
  deselect: 'canvas:deselect',
  'shortcuts-help': 'canvas:shortcuts-help',
  'toggle-terminal': 'panel:terminal',
  'view-zoom-in': 'view:zoom-in',
  'view-zoom-out': 'view:zoom-out',
  'view-fit-all': 'view:fit-all',
  'view-zoom-100': 'view:zoom-100',
  'zoom-out': 'nav:zoom-out',
  'nav-arrow-up': 'nav:arrow-up',
  'nav-arrow-down': 'nav:arrow-down',
  'nav-arrow-left': 'nav:arrow-left',
  'nav-arrow-right': 'nav:arrow-right',
  'quick-add-service': 'node:add-service',
  'quick-add-database': 'node:add-database',
  'quick-add-queue': 'node:add-queue',
  'quick-add-gateway': 'node:add-gateway',
  'quick-add-cache': 'node:add-cache',
};

/**
 * Get the platform-appropriate key label for a shortcut.
 * If the ShortcutManager is available and the binding has been customized,
 * returns the customized display string instead of the default.
 */
export function getShortcutKeys(shortcut: KeyboardShortcut): string {
  // Try to use the ShortcutManager for customized bindings
  try {
    const actionId = HELP_TO_ACTION_MAP[shortcut.id];
    if (actionId) {
      const { getShortcutManager } = require('@/core/shortcuts/shortcutManager');
      const manager = getShortcutManager();
      if (manager.isCustomized(actionId)) {
        return manager.getDisplayBinding(actionId);
      }
    }
  } catch {
    // Fall through to defaults if manager isn't available
  }
  return isMacPlatform() ? shortcut.macKeys : shortcut.winKeys;
}

/**
 * Get shortcuts grouped by category, in display order.
 */
export function getShortcutsByCategory(): Map<ShortcutCategory, KeyboardShortcut[]> {
  const grouped = new Map<ShortcutCategory, KeyboardShortcut[]>();

  for (const category of SHORTCUT_CATEGORIES) {
    grouped.set(category, []);
  }

  for (const shortcut of KEYBOARD_SHORTCUTS) {
    const list = grouped.get(shortcut.category);
    if (list) {
      list.push(shortcut);
    }
  }

  return grouped;
}
