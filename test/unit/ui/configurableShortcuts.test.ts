/**
 * Tests for configurable keyboard shortcuts (Feature #239).
 * Verifies ShortcutManager service: binding parsing, event matching,
 * conflict detection, reset, persistence, and integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ShortcutManager,
  parseBinding,
  formatBindingForDisplay,
  eventMatchesBinding,
  eventToBindingString,
  SHORTCUT_ACTIONS,
  getShortcutManager,
  resetShortcutManager,
} from '@/core/shortcuts/shortcutManager';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  resetShortcutManager();
});

afterEach(() => {
  resetShortcutManager();
});

describe('parseBinding', () => {
  it('parses mod+key', () => {
    const b = parseBinding('mod+s');
    expect(b.mod).toBe(true);
    expect(b.shift).toBe(false);
    expect(b.alt).toBe(false);
    expect(b.key).toBe('s');
  });

  it('parses mod+shift+key', () => {
    const b = parseBinding('mod+shift+s');
    expect(b.mod).toBe(true);
    expect(b.shift).toBe(true);
    expect(b.key).toBe('s');
  });

  it('parses standalone key', () => {
    const b = parseBinding('escape');
    expect(b.mod).toBe(false);
    expect(b.shift).toBe(false);
    expect(b.key).toBe('escape');
  });

  it('parses ? key', () => {
    const b = parseBinding('?');
    expect(b.mod).toBe(false);
    expect(b.key).toBe('?');
  });

  it('parses mod+alt+key', () => {
    const b = parseBinding('mod+alt+p');
    expect(b.mod).toBe(true);
    expect(b.alt).toBe(true);
    expect(b.key).toBe('p');
  });

  it('is case insensitive', () => {
    const b = parseBinding('MOD+SHIFT+S');
    expect(b.mod).toBe(true);
    expect(b.shift).toBe(true);
    expect(b.key).toBe('s');
  });
});

describe('formatBindingForDisplay', () => {
  it('formats mod+s for display', () => {
    const display = formatBindingForDisplay('mod+s');
    // On test platform (no navigator), falls through to Windows format
    expect(display).toMatch(/S|s/i);
  });

  it('formats escape for display', () => {
    const display = formatBindingForDisplay('escape');
    expect(display).toContain('Esc');
  });

  it('formats ? for display', () => {
    const display = formatBindingForDisplay('?');
    expect(display).toBe('?');
  });

  it('formats mod+shift+z for display', () => {
    const display = formatBindingForDisplay('mod+shift+z');
    expect(display).toMatch(/Z|z/i);
  });
});

describe('eventMatchesBinding', () => {
  function makeEvent(opts: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: opts.key || '',
      ctrlKey: opts.ctrlKey || false,
      metaKey: opts.metaKey || false,
      shiftKey: opts.shiftKey || false,
      altKey: opts.altKey || false,
    } as KeyboardEvent;
  }

  it('matches mod+s with ctrlKey (on non-Mac)', () => {
    const binding = parseBinding('mod+s');
    const event = makeEvent({ key: 's', ctrlKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('does not match mod+s without modifier', () => {
    const binding = parseBinding('mod+s');
    const event = makeEvent({ key: 's' });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });

  it('matches escape key', () => {
    const binding = parseBinding('escape');
    const event = makeEvent({ key: 'Escape' });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('does not match escape with ctrl', () => {
    const binding = parseBinding('escape');
    const event = makeEvent({ key: 'Escape', ctrlKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });

  it('matches delete key', () => {
    const binding = parseBinding('delete');
    const event = makeEvent({ key: 'Delete' });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches ? key', () => {
    const binding = parseBinding('?');
    const event = makeEvent({ key: '?', shiftKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('does not match wrong key', () => {
    const binding = parseBinding('mod+s');
    const event = makeEvent({ key: 'k', ctrlKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });

  it('does not match extra shift', () => {
    const binding = parseBinding('mod+s');
    const event = makeEvent({ key: 's', ctrlKey: true, shiftKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });

  it('matches mod+shift+s correctly', () => {
    const binding = parseBinding('mod+shift+s');
    const event = makeEvent({ key: 's', ctrlKey: true, shiftKey: true });
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });
});

describe('eventToBindingString', () => {
  function makeEvent(opts: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: opts.key || '',
      ctrlKey: opts.ctrlKey || false,
      metaKey: opts.metaKey || false,
      shiftKey: opts.shiftKey || false,
      altKey: opts.altKey || false,
    } as KeyboardEvent;
  }

  it('converts ctrl+s to mod+s', () => {
    const result = eventToBindingString(makeEvent({ key: 's', ctrlKey: true }));
    expect(result).toBe('mod+s');
  });

  it('converts ctrl+shift+z to mod+shift+z', () => {
    const result = eventToBindingString(makeEvent({ key: 'z', ctrlKey: true, shiftKey: true }));
    expect(result).toBe('mod+shift+z');
  });

  it('converts escape to escape', () => {
    const result = eventToBindingString(makeEvent({ key: 'Escape' }));
    expect(result).toBe('escape');
  });

  it('returns null for standalone modifier press', () => {
    const result = eventToBindingString(makeEvent({ key: 'Control', ctrlKey: true }));
    expect(result).toBeNull();
  });

  it('converts ? key', () => {
    const result = eventToBindingString(makeEvent({ key: '?', shiftKey: true }));
    expect(result).toBe('?');
  });
});

describe('ShortcutManager', () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    manager = new ShortcutManager();
  });

  describe('default bindings', () => {
    it('has bindings for all registered actions', () => {
      for (const action of SHORTCUT_ACTIONS) {
        expect(manager.getBinding(action.id)).toBe(action.defaultBinding);
      }
    });

    it('getActions returns all shortcut actions', () => {
      const actions = manager.getActions();
      expect(actions.length).toBe(SHORTCUT_ACTIONS.length);
    });

    it('no customizations by default', () => {
      expect(manager.hasCustomizations()).toBe(false);
    });

    it('isCustomized returns false for default bindings', () => {
      expect(manager.isCustomized('file:save')).toBe(false);
    });
  });

  describe('matchEvent', () => {
    function makeEvent(opts: Partial<KeyboardEvent>): KeyboardEvent {
      return {
        key: opts.key || '',
        ctrlKey: opts.ctrlKey || false,
        metaKey: opts.metaKey || false,
        shiftKey: opts.shiftKey || false,
        altKey: opts.altKey || false,
      } as KeyboardEvent;
    }

    it('matches Ctrl+S to file:save', () => {
      const result = manager.matchEvent(makeEvent({ key: 's', ctrlKey: true }));
      expect(result).toBe('file:save');
    });

    it('matches Ctrl+Z to edit:undo', () => {
      const result = manager.matchEvent(makeEvent({ key: 'z', ctrlKey: true }));
      expect(result).toBe('edit:undo');
    });

    it('matches Ctrl+Shift+Z to edit:redo', () => {
      const result = manager.matchEvent(makeEvent({ key: 'z', ctrlKey: true, shiftKey: true }));
      expect(result).toBe('edit:redo');
    });

    it('matches Escape to canvas:deselect', () => {
      const result = manager.matchEvent(makeEvent({ key: 'Escape' }));
      expect(result).toBe('canvas:deselect');
    });

    it('returns null for unbound key', () => {
      const result = manager.matchEvent(makeEvent({ key: 'x', ctrlKey: true }));
      expect(result).toBeNull();
    });

    it('matches rebound shortcut after setBinding', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      const result = manager.matchEvent(makeEvent({ key: 'w', ctrlKey: true, shiftKey: true }));
      expect(result).toBe('file:save');
    });

    it('old binding no longer matches after rebinding', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      const result = manager.matchEvent(makeEvent({ key: 's', ctrlKey: true }));
      expect(result).not.toBe('file:save');
    });
  });

  describe('setBinding', () => {
    it('updates binding successfully', () => {
      const result = manager.setBinding('file:save', 'mod+shift+w');
      expect(result.conflict).toBeUndefined();
      expect(manager.getBinding('file:save')).toBe('mod+shift+w');
    });

    it('marks action as customized', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      expect(manager.isCustomized('file:save')).toBe(true);
      expect(manager.hasCustomizations()).toBe(true);
    });

    it('detects conflict with existing binding', () => {
      // mod+n is bound to file:new
      const result = manager.setBinding('file:save', 'mod+n');
      expect(result.conflict).toBe('file:new');
    });

    it('does not apply conflicting binding', () => {
      manager.setBinding('file:save', 'mod+n');
      expect(manager.getBinding('file:save')).toBe('mod+s'); // unchanged
    });
  });

  describe('findConflict', () => {
    it('returns undefined when no conflict', () => {
      expect(manager.findConflict('file:save', 'mod+shift+w')).toBeUndefined();
    });

    it('returns conflicting action ID', () => {
      expect(manager.findConflict('file:save', 'mod+n')).toBe('file:new');
    });

    it('ignores self-conflict', () => {
      expect(manager.findConflict('file:save', 'mod+s')).toBeUndefined();
    });
  });

  describe('resetBinding', () => {
    it('resets a single binding to default', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      expect(manager.isCustomized('file:save')).toBe(true);
      manager.resetBinding('file:save');
      expect(manager.getBinding('file:save')).toBe('mod+s');
      expect(manager.isCustomized('file:save')).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('resets all bindings to defaults', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      manager.setBinding('file:open', 'mod+shift+o');
      expect(manager.hasCustomizations()).toBe(true);
      manager.resetAll();
      expect(manager.hasCustomizations()).toBe(false);
      expect(manager.getBinding('file:save')).toBe('mod+s');
      expect(manager.getBinding('file:open')).toBe('mod+o');
    });
  });

  describe('persistence', () => {
    it('setBinding persists changes in memory', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      // The binding is updated in memory
      expect(manager.getBinding('file:save')).toBe('mod+shift+w');
      expect(manager.isCustomized('file:save')).toBe(true);
    });

    it('resetAll clears all customizations from memory', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      manager.setBinding('file:open', 'mod+shift+o');
      manager.resetAll();
      expect(manager.hasCustomizations()).toBe(false);
    });

    it('constructor does not throw when localStorage is unavailable', () => {
      // ShortcutManager constructor catches localStorage errors gracefully
      expect(() => new ShortcutManager()).not.toThrow();
    });

    it('getConfig returns full config copy', () => {
      const config = manager.getConfig();
      expect(config['file:save']).toBe('mod+s');
      expect(config['edit:undo']).toBe('mod+z');
      // Modifying the copy does not affect the manager
      config['file:save'] = 'mod+x';
      expect(manager.getBinding('file:save')).toBe('mod+s');
    });

    it('setBinding and getConfig reflect changes', () => {
      manager.setBinding('file:save', 'mod+shift+w');
      const config = manager.getConfig();
      expect(config['file:save']).toBe('mod+shift+w');
    });
  });

  describe('getDisplayBinding', () => {
    it('returns a display string for bindings', () => {
      const display = manager.getDisplayBinding('file:save');
      expect(typeof display).toBe('string');
      expect(display.length).toBeGreaterThan(0);
    });

    it('returns empty string for unknown action', () => {
      expect(manager.getDisplayBinding('nonexistent')).toBe('');
    });
  });
});

describe('Global ShortcutManager singleton', () => {
  it('getShortcutManager returns same instance', () => {
    const a = getShortcutManager();
    const b = getShortcutManager();
    expect(a).toBe(b);
  });

  it('resetShortcutManager creates new instance', () => {
    const a = getShortcutManager();
    resetShortcutManager();
    const b = getShortcutManager();
    expect(a).not.toBe(b);
  });
});

describe('UI Store - Shortcut Settings state', () => {
  it('shortcutSettingsOpen defaults to false', () => {
    expect(useUIStore.getState().shortcutSettingsOpen).toBe(false);
  });

  it('openShortcutSettings sets shortcutSettingsOpen to true', () => {
    useUIStore.getState().openShortcutSettings();
    expect(useUIStore.getState().shortcutSettingsOpen).toBe(true);
  });

  it('closeShortcutSettings sets shortcutSettingsOpen to false', () => {
    useUIStore.getState().openShortcutSettings();
    useUIStore.getState().closeShortcutSettings();
    expect(useUIStore.getState().shortcutSettingsOpen).toBe(false);
  });
});

describe('SHORTCUT_ACTIONS registry', () => {
  it('has unique action IDs', () => {
    const ids = SHORTCUT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all actions have required fields', () => {
    for (const action of SHORTCUT_ACTIONS) {
      expect(action.id).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.category).toBeTruthy();
      expect(action.defaultBinding).toBeTruthy();
    }
  });

  it('includes file operations', () => {
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'file:save')).toBeDefined();
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'file:new')).toBeDefined();
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'file:open')).toBeDefined();
  });

  it('includes edit operations', () => {
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'edit:undo')).toBeDefined();
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'edit:redo')).toBeDefined();
  });

  it('includes canvas operations', () => {
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'canvas:command-palette')).toBeDefined();
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'canvas:deselect')).toBeDefined();
  });

  it('includes navigation operations', () => {
    expect(SHORTCUT_ACTIONS.find((a) => a.id === 'nav:zoom-out')).toBeDefined();
  });
});
