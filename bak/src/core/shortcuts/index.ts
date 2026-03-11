/**
 * Shortcut manager barrel export.
 */

export type { KeyBinding, ShortcutAction, ShortcutConfig } from './shortcutManager';
export {
  SHORTCUT_ACTIONS,
  parseBinding,
  formatBindingForDisplay,
  eventMatchesBinding,
  eventToBindingString,
  ShortcutManager,
  getShortcutManager,
  resetShortcutManager,
} from './shortcutManager';
