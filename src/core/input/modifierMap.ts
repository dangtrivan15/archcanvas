/**
 * Modifier key mapping for abstract → platform-specific keys.
 *
 * Three abstract modifiers:
 *   - Primary: Cmd (Mac/iPad), Ctrl (Win/Linux) — used for most shortcuts
 *   - Secondary: Shift — used for "Save As" etc.
 *   - Tertiary: Alt/Option — used for alternate actions
 *
 * Also provides display symbols and key-name helpers for UI labels.
 */

import { type Platform, getCurrentPlatform, isCmdPlatform } from './platformDetector';

/** Abstract modifier levels */
export type AbstractModifier = 'primary' | 'secondary' | 'tertiary';

/** Modifier display info for a given platform */
export interface ModifierInfo {
  /** The DOM KeyboardEvent property to check (e.g., 'metaKey', 'ctrlKey') */
  eventKey: 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey';
  /** Display symbol for Mac-style UI (e.g., '⌘', '⇧', '⌥') */
  symbol: string;
  /** Display label for Windows/Linux-style UI (e.g., 'Ctrl', 'Shift', 'Alt') */
  label: string;
}

/** Full modifier map for a platform */
export interface PlatformModifierMap {
  primary: ModifierInfo;
  secondary: ModifierInfo;
  tertiary: ModifierInfo;
}

/**
 * Build the modifier map for a specific platform.
 */
export function getModifierMap(platform: Platform): PlatformModifierMap {
  const useCmd = isCmdPlatform(platform);

  return {
    primary: {
      eventKey: useCmd ? 'metaKey' : 'ctrlKey',
      symbol: useCmd ? '⌘' : 'Ctrl',
      label: useCmd ? 'Cmd' : 'Ctrl',
    },
    secondary: {
      eventKey: 'shiftKey',
      symbol: useCmd ? '⇧' : 'Shift',
      label: 'Shift',
    },
    tertiary: {
      eventKey: 'altKey',
      symbol: useCmd ? '⌥' : 'Alt',
      label: useCmd ? 'Option' : 'Alt',
    },
  };
}

/**
 * Get modifier map for the current detected platform.
 */
export function getCurrentModifierMap(): PlatformModifierMap {
  return getModifierMap(getCurrentPlatform());
}

// ── Display helpers ──────────────────────────────────────────────────

/** Special key display names per platform */
const MAC_SPECIAL_KEYS: Record<string, string> = {
  backspace: '⌫',
  delete: '⌦',
  enter: '↵',
  escape: 'Esc',
  tab: '⇥',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  space: 'Space',
};

const WIN_SPECIAL_KEYS: Record<string, string> = {
  backspace: 'Backspace',
  delete: 'Delete',
  enter: 'Enter',
  escape: 'Esc',
  tab: 'Tab',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  space: 'Space',
};

/**
 * Format a key name for display on the given platform.
 * Handles modifiers, special keys, and regular characters.
 */
export function formatKeyForDisplay(key: string, platform?: Platform): string {
  const p = platform ?? getCurrentPlatform();
  const useCmd = isCmdPlatform(p);
  const lower = key.toLowerCase();

  // Modifier keywords
  if (lower === 'mod' || lower === 'primary') {
    return useCmd ? '⌘' : 'Ctrl';
  }
  if (lower === 'shift' || lower === 'secondary') {
    return useCmd ? '⇧' : 'Shift';
  }
  if (lower === 'alt' || lower === 'option' || lower === 'tertiary') {
    return useCmd ? '⌥' : 'Alt';
  }
  if (lower === 'ctrl') return 'Ctrl';
  if (lower === 'meta' || lower === 'cmd') return useCmd ? '⌘' : 'Meta';

  // Special keys
  const specialMap = useCmd ? MAC_SPECIAL_KEYS : WIN_SPECIAL_KEYS;
  if (specialMap[lower]) return specialMap[lower];

  // Single character keys → uppercase
  if (key.length === 1) return key.toUpperCase();

  // Anything else → capitalize first letter
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Format a full binding string (e.g., "mod+shift+s") for display.
 * Returns platform-appropriate string like "⌘ ⇧ S" (Mac) or "Ctrl+Shift+S" (Win).
 */
export function formatBindingDisplay(binding: string, platform?: Platform): string {
  const p = platform ?? getCurrentPlatform();
  const useCmd = isCmdPlatform(p);
  const parts = binding.split('+').map((part) => formatKeyForDisplay(part.trim(), p));
  return useCmd ? parts.join(' ') : parts.join('+');
}

/**
 * Check if the primary modifier (Cmd on Mac, Ctrl on Win/Linux) is pressed in an event.
 */
export function isPrimaryModifier(event: KeyboardEvent | MouseEvent, platform?: Platform): boolean {
  const p = platform ?? getCurrentPlatform();
  return isCmdPlatform(p) ? event.metaKey : event.ctrlKey;
}

/**
 * Check if the secondary modifier (Shift) is pressed in an event.
 */
export function isSecondaryModifier(event: KeyboardEvent | MouseEvent): boolean {
  return event.shiftKey;
}

/**
 * Check if the tertiary modifier (Alt/Option) is pressed in an event.
 */
export function isTertiaryModifier(event: KeyboardEvent | MouseEvent): boolean {
  return event.altKey;
}
