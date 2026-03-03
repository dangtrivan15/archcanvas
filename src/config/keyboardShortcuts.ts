/**
 * Centralized keyboard shortcuts registry.
 * All keyboard shortcuts in the app are listed here for the help panel.
 */

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

export type ShortcutCategory = 'File' | 'Edit' | 'Canvas' | 'Navigation';

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

  // === Canvas ===
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
];

/**
 * Ordered list of categories for display.
 */
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  'File',
  'Edit',
  'Canvas',
  'Navigation',
];

/**
 * Returns true if the current platform is macOS.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Get the platform-appropriate key label for a shortcut.
 */
export function getShortcutKeys(shortcut: KeyboardShortcut): string {
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
