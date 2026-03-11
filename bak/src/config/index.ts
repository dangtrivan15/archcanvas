/**
 * Configuration module barrel export.
 *
 * Command registry and keyboard shortcuts.
 */

export type { Command, CommandCategory } from './commandRegistry';
export {
  getStaticCommands,
  getNodeCommands,
  getNodeCreationCommands,
  getBulkOperationCommands,
  getAllCommands,
  searchCommands,
} from './commandRegistry';

export type { KeyboardShortcut, ShortcutCategory } from './keyboardShortcuts';
export {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  isMacPlatform,
  getShortcutKeys,
  getShortcutsByCategory,
} from './keyboardShortcuts';
