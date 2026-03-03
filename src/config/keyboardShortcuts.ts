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

export type ShortcutCategory = 'File' | 'Edit' | 'View' | 'Canvas' | 'Navigation';

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
  'save': 'file:save',
  'save-as': 'file:save-as',
  'undo': 'edit:undo',
  'redo': 'edit:redo',
  'redo-alt': 'edit:redo-alt',
  'delete-node': 'edit:delete',
  'quick-rename': 'node:rename',
  'select-all': 'select:all',
  'select-all-edges': 'select:all-edges',
  'command-palette': 'canvas:command-palette',
  'deselect': 'canvas:deselect',
  'shortcuts-help': 'canvas:shortcuts-help',
  'view-zoom-in': 'view:zoom-in',
  'view-zoom-out': 'view:zoom-out',
  'view-fit-all': 'view:fit-all',
  'view-zoom-100': 'view:zoom-100',
  'zoom-out': 'nav:zoom-out',
  'nav-arrow-up': 'nav:arrow-up',
  'nav-arrow-down': 'nav:arrow-down',
  'nav-arrow-left': 'nav:arrow-left',
  'nav-arrow-right': 'nav:arrow-right',
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
