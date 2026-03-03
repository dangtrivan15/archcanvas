/**
 * ShortcutManager - configurable keyboard shortcuts service.
 *
 * Manages a mapping from action IDs to key bindings.
 * Supports user customization, conflict detection, reset to defaults,
 * and persistence via localStorage.
 *
 * Binding format: "mod+s", "mod+shift+s", "escape", "delete", "?"
 * - "mod" = Ctrl on Windows/Linux, Cmd on Mac
 * - Modifier keys: "mod", "ctrl", "meta", "shift", "alt"
 * - Special keys: "escape", "delete", "backspace", "enter", "tab", "?"
 * - Regular keys: "s", "k", "n", etc.
 */

import { getCurrentPlatform, isCmdPlatform, formatBindingDisplay } from '@/core/input';

const STORAGE_KEY = 'archcanvas:keyboard-shortcuts';

export interface KeyBinding {
  /** Raw binding string (e.g., "mod+s") */
  raw: string;
  /** Whether Ctrl (Windows) / Cmd (Mac) is required */
  mod: boolean;
  /** Whether Ctrl specifically is required (regardless of platform) */
  ctrl: boolean;
  /** Whether Meta (Cmd on Mac) specifically is required */
  meta: boolean;
  /** Whether Shift is required */
  shift: boolean;
  /** Whether Alt/Option is required */
  alt: boolean;
  /** The main key (lowercase), e.g., "s", "escape", "?" */
  key: string;
}

export interface ShortcutAction {
  /** Unique action ID (e.g., "file:save", "edit:undo") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Category for grouping */
  category: string;
  /** Default key binding string */
  defaultBinding: string;
}

/** All configurable shortcut actions with their defaults */
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  // File
  { id: 'file:new', label: 'New File', category: 'File', defaultBinding: 'mod+n' },
  { id: 'file:open', label: 'Open File', category: 'File', defaultBinding: 'mod+o' },
  { id: 'file:save', label: 'Save', category: 'File', defaultBinding: 'mod+s' },
  { id: 'file:save-as', label: 'Save As', category: 'File', defaultBinding: 'mod+shift+s' },

  // Edit
  { id: 'edit:undo', label: 'Undo', category: 'Edit', defaultBinding: 'mod+z' },
  { id: 'edit:redo', label: 'Redo', category: 'Edit', defaultBinding: 'mod+shift+z' },
  { id: 'edit:redo-alt', label: 'Redo (Alt)', category: 'Edit', defaultBinding: 'mod+y' },
  { id: 'edit:delete', label: 'Delete Node', category: 'Edit', defaultBinding: 'delete' },
  { id: 'node:rename', label: 'Quick Rename', category: 'Edit', defaultBinding: 'f2' },

  // Selection
  { id: 'select:all', label: 'Select All Nodes', category: 'Edit', defaultBinding: 'mod+a' },
  { id: 'select:all-edges', label: 'Select All Edges', category: 'Edit', defaultBinding: 'mod+shift+a' },

  // Canvas
  { id: 'canvas:command-palette', label: 'Command Palette', category: 'Canvas', defaultBinding: 'mod+k' },
  { id: 'canvas:deselect', label: 'Deselect / Close', category: 'Canvas', defaultBinding: 'escape' },
  { id: 'canvas:shortcuts-help', label: 'Shortcuts Help', category: 'Canvas', defaultBinding: '?' },

  // View / Zoom
  { id: 'view:zoom-in', label: 'Zoom In', category: 'View', defaultBinding: '=' },
  { id: 'view:zoom-out', label: 'Zoom Out', category: 'View', defaultBinding: '-' },
  { id: 'view:fit-all', label: 'Fit View', category: 'View', defaultBinding: 'mod+0' },
  { id: 'view:zoom-100', label: 'Zoom to 100%', category: 'View', defaultBinding: 'mod+1' },

  // Navigation
  { id: 'nav:zoom-out', label: 'Zoom Out to Parent', category: 'Navigation', defaultBinding: 'backspace' },
  { id: 'nav:arrow-up', label: 'Navigate Up', category: 'Navigation', defaultBinding: 'arrowup' },
  { id: 'nav:arrow-down', label: 'Navigate Down', category: 'Navigation', defaultBinding: 'arrowdown' },
  { id: 'nav:arrow-left', label: 'Navigate Left', category: 'Navigation', defaultBinding: 'arrowleft' },
  { id: 'nav:arrow-right', label: 'Navigate Right', category: 'Navigation', defaultBinding: 'arrowright' },

  // Node Quick Create (Normal mode only)
  { id: 'node:add-service', label: 'Quick Add Service', category: 'Node', defaultBinding: 's' },
  { id: 'node:add-database', label: 'Quick Add Database', category: 'Node', defaultBinding: 'd' },
  { id: 'node:add-queue', label: 'Quick Add Queue', category: 'Node', defaultBinding: 'q' },
  { id: 'node:add-gateway', label: 'Quick Add Gateway', category: 'Node', defaultBinding: 'g' },
  { id: 'node:add-cache', label: 'Quick Add Cache', category: 'Node', defaultBinding: 'a' },

  // Mode transitions (Vim-style)
  { id: 'normal:enter-connect', label: 'Enter Connect Mode', category: 'Mode', defaultBinding: 'c' },
  { id: 'normal:enter-edit', label: 'Enter Edit Mode', category: 'Mode', defaultBinding: 'i' },
  { id: 'normal:enter-edit-alt', label: 'Enter Edit Mode (Alt)', category: 'Mode', defaultBinding: 'enter' },
  { id: 'connect:exit', label: 'Exit Connect Mode', category: 'Mode', defaultBinding: 'escape' },
  { id: 'edit:exit', label: 'Exit Edit Mode', category: 'Mode', defaultBinding: 'escape' },
];

/**
 * Parse a binding string into a KeyBinding object.
 */
export function parseBinding(raw: string): KeyBinding {
  const parts = raw.toLowerCase().split('+').map((p) => p.trim());
  const binding: KeyBinding = {
    raw,
    mod: false,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    key: '',
  };

  for (const part of parts) {
    switch (part) {
      case 'mod':
        binding.mod = true;
        break;
      case 'ctrl':
        binding.ctrl = true;
        break;
      case 'meta':
      case 'cmd':
        binding.meta = true;
        break;
      case 'shift':
        binding.shift = true;
        break;
      case 'alt':
      case 'option':
        binding.alt = true;
        break;
      default:
        binding.key = part;
    }
  }

  return binding;
}

/**
 * Format a binding to a display string for the current platform.
 * Delegates to the centralized formatBindingDisplay from input/modifierMap.
 */
export function formatBindingForDisplay(raw: string): string {
  return formatBindingDisplay(raw);
}

/**
 * Check if a keyboard event matches a binding.
 */
export function eventMatchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const isMac = isCmdPlatform(getCurrentPlatform());

  // Check modifier keys
  if (binding.mod) {
    // "mod" means Cmd on Mac, Ctrl on Windows/Linux
    if (isMac) {
      if (!event.metaKey) return false;
    } else {
      if (!event.ctrlKey) return false;
    }
  }

  if (binding.ctrl && !event.ctrlKey) return false;
  if (binding.meta && !event.metaKey) return false;
  if (binding.shift && !event.shiftKey) return false;
  if (binding.alt && !event.altKey) return false;

  // Check that unwanted modifiers are NOT pressed (unless binding uses them)
  if (!binding.mod && !binding.ctrl && !binding.meta) {
    if (event.ctrlKey || event.metaKey) return false;
  }
  if (!binding.shift && event.shiftKey) {
    // Special case: '?' requires shift on most keyboards
    if (binding.key !== '?') return false;
  }
  if (!binding.alt && event.altKey) return false;

  // Check the key
  const eventKey = event.key.toLowerCase();

  // Special key mappings
  switch (binding.key) {
    case 'escape': return eventKey === 'escape';
    case 'delete': return eventKey === 'delete';
    case 'backspace': return eventKey === 'backspace';
    case 'enter': return eventKey === 'enter';
    case 'tab': return eventKey === 'tab';
    case '?': return event.key === '?';
    default: return eventKey === binding.key;
  }
}

/**
 * Convert a key event to a binding string for recording.
 */
export function eventToBindingString(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();

  // Ignore standalone modifier key presses
  if (['control', 'meta', 'shift', 'alt'].includes(key)) {
    return null;
  }

  const parts: string[] = [];
  const isMac = isCmdPlatform(getCurrentPlatform());

  // Use "mod" for the platform modifier (Cmd on Mac, Ctrl on Windows)
  if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
    parts.push('mod');
  }
  if (event.shiftKey) {
    parts.push('shift');
  }
  if (event.altKey) {
    parts.push('alt');
  }

  // Map special keys
  switch (key) {
    case 'escape': parts.push('escape'); break;
    case 'delete': parts.push('delete'); break;
    case 'backspace': parts.push('backspace'); break;
    case 'enter': parts.push('enter'); break;
    case 'tab': parts.push('tab'); break;
    default:
      // For '?' key, record it directly
      if (event.key === '?') {
        // Remove shift if present (since ? implies shift)
        const shiftIdx = parts.indexOf('shift');
        if (shiftIdx !== -1) parts.splice(shiftIdx, 1);
        parts.push('?');
      } else {
        parts.push(key);
      }
  }

  return parts.join('+');
}

export type ShortcutConfig = Record<string, string>;

/**
 * ShortcutManager - central service for configurable keyboard shortcuts.
 */
export class ShortcutManager {
  private config: ShortcutConfig = {};
  private parsedBindings: Map<string, KeyBinding> = new Map();

  constructor() {
    this.loadDefaults();
    this.loadFromStorage();
  }

  /**
   * Load default bindings for all registered actions.
   */
  private loadDefaults(): void {
    this.config = {};
    for (const action of SHORTCUT_ACTIONS) {
      this.config[action.id] = action.defaultBinding;
    }
    this.rebuildParsedBindings();
  }

  /**
   * Load user overrides from localStorage.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const overrides = JSON.parse(stored) as ShortcutConfig;
        for (const [actionId, binding] of Object.entries(overrides)) {
          // Only apply if action exists
          if (SHORTCUT_ACTIONS.find((a) => a.id === actionId)) {
            this.config[actionId] = binding;
          }
        }
        this.rebuildParsedBindings();
      }
    } catch {
      // If localStorage is unavailable or data is corrupt, use defaults
      console.warn('[ShortcutManager] Failed to load shortcuts from storage, using defaults');
    }
  }

  /**
   * Save current overrides to localStorage.
   */
  private saveToStorage(): void {
    const overrides: ShortcutConfig = {};
    for (const action of SHORTCUT_ACTIONS) {
      if (this.config[action.id] !== action.defaultBinding) {
        overrides[action.id] = this.config[action.id] ?? action.defaultBinding;
      }
    }
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      }
    } catch {
      console.warn('[ShortcutManager] Failed to save shortcuts to storage');
    }
  }

  /**
   * Rebuild the parsed bindings cache.
   */
  private rebuildParsedBindings(): void {
    this.parsedBindings.clear();
    for (const [actionId, binding] of Object.entries(this.config)) {
      this.parsedBindings.set(actionId, parseBinding(binding));
    }
  }

  /**
   * Match a keyboard event to an action ID.
   * Returns the action ID if matched, null otherwise.
   */
  matchEvent(event: KeyboardEvent): string | null {
    for (const [actionId, binding] of this.parsedBindings) {
      if (eventMatchesBinding(event, binding)) {
        return actionId;
      }
    }
    return null;
  }

  /**
   * Get the current binding string for an action.
   */
  getBinding(actionId: string): string {
    return this.config[actionId] || '';
  }

  /**
   * Get the display string for an action's current binding.
   */
  getDisplayBinding(actionId: string): string {
    const raw = this.getBinding(actionId);
    return raw ? formatBindingForDisplay(raw) : '';
  }

  /**
   * Set a new binding for an action.
   * Returns conflict info if the binding is already in use.
   */
  setBinding(actionId: string, newBinding: string): { conflict?: string } {
    // Check for conflicts
    const conflict = this.findConflict(actionId, newBinding);
    if (conflict) {
      return { conflict };
    }

    this.config[actionId] = newBinding;
    this.rebuildParsedBindings();
    this.saveToStorage();
    return {};
  }

  /**
   * Find if a binding conflicts with another action.
   * Returns the conflicting action ID, or undefined.
   */
  findConflict(actionId: string, newBinding: string): string | undefined {
    const newParsed = parseBinding(newBinding);
    for (const [otherId, otherBinding] of this.parsedBindings) {
      if (otherId === actionId) continue;
      if (bindingsEqual(newParsed, otherBinding)) {
        return otherId;
      }
    }
    return undefined;
  }

  /**
   * Reset a single action to its default binding.
   */
  resetBinding(actionId: string): void {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
    if (action) {
      this.config[actionId] = action.defaultBinding;
      this.rebuildParsedBindings();
      this.saveToStorage();
    }
  }

  /**
   * Reset all bindings to defaults.
   */
  resetAll(): void {
    this.loadDefaults();
    this.saveToStorage();
  }

  /**
   * Check if an action has a custom (non-default) binding.
   */
  isCustomized(actionId: string): boolean {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
    if (!action) return false;
    return this.config[actionId] !== action.defaultBinding;
  }

  /**
   * Check if any bindings have been customized.
   */
  hasCustomizations(): boolean {
    return SHORTCUT_ACTIONS.some((a) => this.isCustomized(a.id));
  }

  /**
   * Get the full current config.
   */
  getConfig(): ShortcutConfig {
    return { ...this.config };
  }

  /**
   * Get all shortcut actions.
   */
  getActions(): ShortcutAction[] {
    return [...SHORTCUT_ACTIONS];
  }
}

/**
 * Check if two parsed bindings are equivalent.
 */
function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.mod === b.mod &&
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.shift === b.shift &&
    a.alt === b.alt &&
    a.key === b.key
  );
}

/**
 * Global singleton instance.
 */
let _instance: ShortcutManager | null = null;

/**
 * Get the global ShortcutManager instance.
 */
export function getShortcutManager(): ShortcutManager {
  if (!_instance) {
    _instance = new ShortcutManager();
  }
  return _instance;
}

/**
 * Reset the global instance (for testing).
 */
export function resetShortcutManager(): void {
  _instance = null;
}
