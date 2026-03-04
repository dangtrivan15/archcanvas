// @vitest-environment happy-dom
/**
 * Tests for useIPadExternalKeyboard hook.
 *
 * Feature #298: External keyboard shortcut support on iPad
 *
 * Tests cover:
 * 1. Capture-phase handler intercepts Cmd+key shortcuts on iPad/Mac
 * 2. Cmd+Shift+key combinations are intercepted
 * 3. Handler is no-op on Windows/Linux platforms
 * 4. Cmd+B/I/U are allowed through in text inputs
 * 5. Events are NOT stopPropagated (only preventDefault)
 * 6. Integration with platform detection (iPad uses Cmd, matches Mac)
 * 7. All app shortcuts are covered for WKWebView interception
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isCmdPlatform,
  _setPlatformForTesting,
  _resetPlatformDetection,
} from '@/core/input/platformDetector';
import { getModifierMap, formatBindingDisplay } from '@/core/input/modifierMap';
import { parseBinding, eventMatchesBinding } from '@/core/shortcuts/shortcutManager';
import { _capturePhaseHandlerForTesting as captureHandler } from '@/hooks/useIPadExternalKeyboard';

// ── Test Helpers ──────────────────────────────────────────────────

function makeKeyEvent(opts: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: opts.key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  return event;
}

// ── iPad / Mac Platform Tests ────────────────────────────────────

describe('useIPadExternalKeyboard - capture phase handler', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  describe('on iPad platform (Cmd-based)', () => {
    beforeEach(() => {
      _setPlatformForTesting('ipad');
    });

    it('prevents default for Cmd+S (save)', () => {
      const e = makeKeyEvent({ key: 's', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Z (undo)', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Shift+Z (redo)', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Y (redo alt)', () => {
      const e = makeKeyEvent({ key: 'y', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+N (new file)', () => {
      const e = makeKeyEvent({ key: 'n', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+O (open file)', () => {
      const e = makeKeyEvent({ key: 'o', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+K (command palette)', () => {
      const e = makeKeyEvent({ key: 'k', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+D (duplicate)', () => {
      const e = makeKeyEvent({ key: 'd', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+A (select all)', () => {
      const e = makeKeyEvent({ key: 'a', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Shift+S (save as)', () => {
      const e = makeKeyEvent({ key: 's', metaKey: true, shiftKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Shift+A (select all edges)', () => {
      const e = makeKeyEvent({ key: 'a', metaKey: true, shiftKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('zoom shortcuts on iPad', () => {
    beforeEach(() => {
      _setPlatformForTesting('ipad');
    });

    it('prevents default for Cmd+= (zoom in)', () => {
      const e = makeKeyEvent({ key: '=', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd++ (zoom in shifted)', () => {
      const e = makeKeyEvent({ key: '+', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+- (zoom out)', () => {
      const e = makeKeyEvent({ key: '-', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+0 (fit view)', () => {
      const e = makeKeyEvent({ key: '0', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+1 (zoom 100%)', () => {
      const e = makeKeyEvent({ key: '1', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Shift+= (zoom in alternate)', () => {
      const e = makeKeyEvent({ key: '=', metaKey: true, shiftKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('WKWebView text formatting shortcuts on iPad', () => {
    beforeEach(() => {
      _setPlatformForTesting('ipad');
    });

    it('prevents Cmd+B when NOT in text input', () => {
      const e = makeKeyEvent({ key: 'b', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents Cmd+I when NOT in text input', () => {
      const e = makeKeyEvent({ key: 'i', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents Cmd+U when NOT in text input', () => {
      const e = makeKeyEvent({ key: 'u', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('allows Cmd+B through when active element is a text input', () => {
      // Create and focus a text input
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const e = makeKeyEvent({ key: 'b', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('allows Cmd+I through when active element is a textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const e = makeKeyEvent({ key: 'i', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('allows Cmd+U through when active element is contentEditable', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      const e = makeKeyEvent({ key: 'u', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });
  });

  describe('on Mac platform (same Cmd behavior)', () => {
    beforeEach(() => {
      _setPlatformForTesting('mac');
    });

    it('prevents default for Cmd+Z (undo) on Mac', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+S (save) on Mac', () => {
      const e = makeKeyEvent({ key: 's', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+Shift+Z (redo) on Mac', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });

    it('prevents default for Cmd+K (command palette) on Mac', () => {
      const e = makeKeyEvent({ key: 'k', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('on Windows platform (no-op)', () => {
    beforeEach(() => {
      _setPlatformForTesting('windows');
    });

    it('does NOT prevent default for Ctrl+Z on Windows', () => {
      const e = makeKeyEvent({ key: 'z', ctrlKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for Ctrl+S on Windows', () => {
      const e = makeKeyEvent({ key: 's', ctrlKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for any key on Windows (no metaKey)', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('on Linux platform (no-op)', () => {
    beforeEach(() => {
      _setPlatformForTesting('linux');
    });

    it('does NOT prevent default for Ctrl+Z on Linux', () => {
      const e = makeKeyEvent({ key: 'z', ctrlKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('event propagation is preserved', () => {
    beforeEach(() => {
      _setPlatformForTesting('ipad');
    });

    it('does NOT call stopPropagation (event still bubbles)', () => {
      const e = makeKeyEvent({ key: 's', metaKey: true });
      const propagationSpy = vi.spyOn(e, 'stopPropagation');
      const immediateSpy = vi.spyOn(e, 'stopImmediatePropagation');
      captureHandler(e);
      expect(propagationSpy).not.toHaveBeenCalled();
      expect(immediateSpy).not.toHaveBeenCalled();
    });

    it('does NOT call stopPropagation for Cmd+Shift+Z', () => {
      const e = makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true });
      const propagationSpy = vi.spyOn(e, 'stopPropagation');
      captureHandler(e);
      expect(propagationSpy).not.toHaveBeenCalled();
    });
  });

  describe('non-intercepted keys pass through', () => {
    beforeEach(() => {
      _setPlatformForTesting('ipad');
    });

    it('does NOT prevent default for plain key without Cmd', () => {
      const e = makeKeyEvent({ key: 's' });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for Cmd+key not in intercepted set', () => {
      const e = makeKeyEvent({ key: 'x', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for Cmd+V (paste - let browser handle)', () => {
      const e = makeKeyEvent({ key: 'v', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for Cmd+C (copy - let browser handle)', () => {
      const e = makeKeyEvent({ key: 'c', metaKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for Alt+key', () => {
      const e = makeKeyEvent({ key: 's', altKey: true });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for plain Escape', () => {
      const e = makeKeyEvent({ key: 'Escape' });
      const spy = vi.spyOn(e, 'preventDefault');
      captureHandler(e);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT prevent default for plain letter keys (vim shortcuts)', () => {
      for (const key of ['s', 'd', 'c', 'i', 't', 'q', 'g', 'a', '/', '?']) {
        const e = makeKeyEvent({ key });
        const spy = vi.spyOn(e, 'preventDefault');
        captureHandler(e);
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });
});

// ── Platform Detection for iPad Keyboard ──────────────────────────

describe('iPad platform detection for keyboard shortcuts', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  it('iPad is recognized as a Cmd platform', () => {
    expect(isCmdPlatform('ipad')).toBe(true);
  });

  it('iPad modifier map matches Mac modifier map', () => {
    const ipad = getModifierMap('ipad');
    const mac = getModifierMap('mac');
    expect(ipad.primary.eventKey).toBe(mac.primary.eventKey);
    expect(ipad.primary.symbol).toBe(mac.primary.symbol);
    expect(ipad.secondary.eventKey).toBe(mac.secondary.eventKey);
    expect(ipad.tertiary.eventKey).toBe(mac.tertiary.eventKey);
  });

  it('iPad displays Cmd symbol for mod shortcuts', () => {
    expect(formatBindingDisplay('mod+s', 'ipad')).toBe('⌘ S');
    expect(formatBindingDisplay('mod+z', 'ipad')).toBe('⌘ Z');
    expect(formatBindingDisplay('mod+shift+z', 'ipad')).toBe('⌘ ⇧ Z');
    expect(formatBindingDisplay('mod+k', 'ipad')).toBe('⌘ K');
  });

  it('eventMatchesBinding works with iPad Cmd key (metaKey)', () => {
    _setPlatformForTesting('ipad');
    const binding = parseBinding('mod+s');
    const event = {
      metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: 's',
    } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('eventMatchesBinding rejects Ctrl+key on iPad (wrong modifier)', () => {
    _setPlatformForTesting('ipad');
    const binding = parseBinding('mod+s');
    const event = {
      metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, key: 's',
    } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(false);
  });
});

// ── Vim-style shortcuts on iPad (no modifier required) ───────────

describe('vim-style single-key shortcuts on iPad', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  beforeEach(() => {
    _setPlatformForTesting('ipad');
  });

  it('matches plain "s" for node:add-service', () => {
    const binding = parseBinding('s');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 's' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches plain "d" for node:add-database', () => {
    const binding = parseBinding('d');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 'd' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "c" for normal:enter-connect', () => {
    const binding = parseBinding('c');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 'c' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "i" for normal:enter-edit', () => {
    const binding = parseBinding('i');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 'i' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "escape"', () => {
    const binding = parseBinding('escape');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 'Escape' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "f2" for node:rename', () => {
    const binding = parseBinding('f2');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: 'f2' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "?" for shortcuts help', () => {
    const binding = parseBinding('?');
    const event = { metaKey: false, ctrlKey: false, shiftKey: true, altKey: false, key: '?' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });

  it('matches "/" for quick search', () => {
    const binding = parseBinding('/');
    const event = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, key: '/' } as KeyboardEvent;
    expect(eventMatchesBinding(event, binding)).toBe(true);
  });
});

// ── All registered Cmd shortcuts match on iPad ────────────────────

describe('all registered Cmd shortcuts work on iPad platform', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  beforeEach(() => {
    _setPlatformForTesting('ipad');
  });

  const CMD_SHORTCUTS = [
    { id: 'file:new', binding: 'mod+n', key: 'n', meta: true },
    { id: 'file:open', binding: 'mod+o', key: 'o', meta: true },
    { id: 'file:save', binding: 'mod+s', key: 's', meta: true },
    { id: 'file:save-as', binding: 'mod+shift+s', key: 's', meta: true, shift: true },
    { id: 'edit:undo', binding: 'mod+z', key: 'z', meta: true },
    { id: 'edit:redo', binding: 'mod+shift+z', key: 'z', meta: true, shift: true },
    { id: 'edit:redo-alt', binding: 'mod+y', key: 'y', meta: true },
    { id: 'edit:duplicate', binding: 'mod+d', key: 'd', meta: true },
    { id: 'select:all', binding: 'mod+a', key: 'a', meta: true },
    { id: 'select:all-edges', binding: 'mod+shift+a', key: 'a', meta: true, shift: true },
    { id: 'canvas:command-palette', binding: 'mod+k', key: 'k', meta: true },
    { id: 'view:fit-all', binding: 'mod+0', key: '0', meta: true },
    { id: 'view:zoom-100', binding: 'mod+1', key: '1', meta: true },
  ];

  CMD_SHORTCUTS.forEach(({ id, binding, key, meta, shift }) => {
    it(`${id} (${binding}) matches on iPad with Cmd key`, () => {
      const parsed = parseBinding(binding);
      const event = {
        metaKey: meta ?? false,
        ctrlKey: false,
        shiftKey: shift ?? false,
        altKey: false,
        key,
      } as KeyboardEvent;
      expect(eventMatchesBinding(event, parsed)).toBe(true);
    });
  });
});

// ── Hook structure and exports ───────────────────────────────────

describe('useIPadExternalKeyboard module', () => {
  it('exports the hook function', async () => {
    const mod = await import('@/hooks/useIPadExternalKeyboard');
    expect(mod).toHaveProperty('useIPadExternalKeyboard');
    expect(typeof mod.useIPadExternalKeyboard).toBe('function');
  });

  it('exports the capture handler for testing', async () => {
    const mod = await import('@/hooks/useIPadExternalKeyboard');
    expect(mod).toHaveProperty('_capturePhaseHandlerForTesting');
    expect(typeof mod._capturePhaseHandlerForTesting).toBe('function');
  });
});
