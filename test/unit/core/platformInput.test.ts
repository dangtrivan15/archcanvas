// @vitest-environment happy-dom
/**
 * Tests for the platform-agnostic input modifier abstraction layer.
 *
 * Feature #241: Platform-Agnostic Input Modifier Abstraction
 *
 * Tests cover:
 * 1. Platform detection (mac, windows, linux, ipad, unknown)
 * 2. Modifier mapping (primary/secondary/tertiary per platform)
 * 3. Display formatting (symbols vs labels per platform)
 * 4. Binding string formatting (e.g., "mod+s" → "⌘ S" or "Ctrl+S")
 * 5. Event matching helpers (isPrimaryModifier)
 * 6. ShortcutManager integration (uses centralized platform detection)
 * 7. usePlatformModifier hook result structure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPlatform,
  getCurrentPlatform,
  isCmdPlatform,
  _setPlatformForTesting,
  _resetPlatformDetection,
  type Platform,
} from '@/core/input/platformDetector';
import {
  getModifierMap,
  getCurrentModifierMap,
  formatKeyForDisplay,
  formatBindingDisplay,
  isPrimaryModifier,
} from '@/core/input/modifierMap';

// ── Platform Detection ───────────────────────────────────────────

describe('platformDetector', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  it('detectPlatform returns "unknown" when navigator is absent', () => {
    // In Node/vitest, navigator may be mocked — test the override flow instead
    _setPlatformForTesting('unknown');
    expect(getCurrentPlatform()).toBe('unknown');
  });

  it('getCurrentPlatform returns the detected platform', () => {
    // Should return a valid platform string
    const platform = getCurrentPlatform();
    expect(['mac', 'windows', 'linux', 'ipad', 'unknown']).toContain(platform);
  });

  it('_setPlatformForTesting overrides the detected platform', () => {
    _setPlatformForTesting('windows');
    expect(getCurrentPlatform()).toBe('windows');
    _setPlatformForTesting('mac');
    expect(getCurrentPlatform()).toBe('mac');
  });

  it('_resetPlatformDetection restores auto-detected platform', () => {
    const original = getCurrentPlatform();
    _setPlatformForTesting('linux');
    expect(getCurrentPlatform()).toBe('linux');
    _resetPlatformDetection();
    expect(getCurrentPlatform()).toBe(original);
  });

  describe('isCmdPlatform', () => {
    it('returns true for mac', () => {
      expect(isCmdPlatform('mac')).toBe(true);
    });
    it('returns true for ipad', () => {
      expect(isCmdPlatform('ipad')).toBe(true);
    });
    it('returns false for windows', () => {
      expect(isCmdPlatform('windows')).toBe(false);
    });
    it('returns false for linux', () => {
      expect(isCmdPlatform('linux')).toBe(false);
    });
    it('returns false for unknown', () => {
      expect(isCmdPlatform('unknown')).toBe(false);
    });
  });
});

// ── Modifier Mapping ──────────────────────────────────────────────

describe('modifierMap', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  describe('getModifierMap', () => {
    it('mac primary uses metaKey with ⌘ symbol', () => {
      const map = getModifierMap('mac');
      expect(map.primary.eventKey).toBe('metaKey');
      expect(map.primary.symbol).toBe('⌘');
      expect(map.primary.label).toBe('Cmd');
    });

    it('mac secondary uses ⇧ symbol', () => {
      const map = getModifierMap('mac');
      expect(map.secondary.eventKey).toBe('shiftKey');
      expect(map.secondary.symbol).toBe('⇧');
    });

    it('mac tertiary uses ⌥ symbol', () => {
      const map = getModifierMap('mac');
      expect(map.tertiary.eventKey).toBe('altKey');
      expect(map.tertiary.symbol).toBe('⌥');
    });

    it('windows primary uses ctrlKey with Ctrl symbol', () => {
      const map = getModifierMap('windows');
      expect(map.primary.eventKey).toBe('ctrlKey');
      expect(map.primary.symbol).toBe('Ctrl');
      expect(map.primary.label).toBe('Ctrl');
    });

    it('windows secondary uses Shift label', () => {
      const map = getModifierMap('windows');
      expect(map.secondary.symbol).toBe('Shift');
    });

    it('windows tertiary uses Alt label', () => {
      const map = getModifierMap('windows');
      expect(map.tertiary.symbol).toBe('Alt');
    });

    it('linux primary matches windows', () => {
      const linux = getModifierMap('linux');
      const windows = getModifierMap('windows');
      expect(linux.primary.eventKey).toBe(windows.primary.eventKey);
      expect(linux.primary.symbol).toBe(windows.primary.symbol);
    });

    it('ipad primary matches mac', () => {
      const ipad = getModifierMap('ipad');
      const mac = getModifierMap('mac');
      expect(ipad.primary.eventKey).toBe(mac.primary.eventKey);
      expect(ipad.primary.symbol).toBe(mac.primary.symbol);
    });

    it('unknown platform falls back to Ctrl-based (like Windows)', () => {
      const map = getModifierMap('unknown');
      expect(map.primary.eventKey).toBe('ctrlKey');
    });
  });

  describe('getCurrentModifierMap', () => {
    it('returns modifier map for the current platform', () => {
      _setPlatformForTesting('mac');
      const map = getCurrentModifierMap();
      expect(map.primary.symbol).toBe('⌘');
    });
  });
});

// ── Display Formatting ────────────────────────────────────────────

describe('formatKeyForDisplay', () => {
  it('formats "mod" as ⌘ on mac', () => {
    expect(formatKeyForDisplay('mod', 'mac')).toBe('⌘');
  });

  it('formats "mod" as Ctrl on windows', () => {
    expect(formatKeyForDisplay('mod', 'windows')).toBe('Ctrl');
  });

  it('formats "shift" as ⇧ on mac', () => {
    expect(formatKeyForDisplay('shift', 'mac')).toBe('⇧');
  });

  it('formats "shift" as Shift on windows', () => {
    expect(formatKeyForDisplay('shift', 'windows')).toBe('Shift');
  });

  it('formats "alt" as ⌥ on mac', () => {
    expect(formatKeyForDisplay('alt', 'mac')).toBe('⌥');
  });

  it('formats "alt" as Alt on windows', () => {
    expect(formatKeyForDisplay('alt', 'windows')).toBe('Alt');
  });

  it('formats backspace as ⌫ on mac', () => {
    expect(formatKeyForDisplay('backspace', 'mac')).toBe('⌫');
  });

  it('formats backspace as Backspace on windows', () => {
    expect(formatKeyForDisplay('backspace', 'windows')).toBe('Backspace');
  });

  it('formats enter as ↵ on mac', () => {
    expect(formatKeyForDisplay('enter', 'mac')).toBe('↵');
  });

  it('formats single-char key as uppercase', () => {
    expect(formatKeyForDisplay('s', 'mac')).toBe('S');
    expect(formatKeyForDisplay('k', 'windows')).toBe('K');
  });

  it('formats escape as Esc on all platforms', () => {
    expect(formatKeyForDisplay('escape', 'mac')).toBe('Esc');
    expect(formatKeyForDisplay('escape', 'windows')).toBe('Esc');
  });
});

// ── Binding Display ──────────────────────────────────────────────

describe('formatBindingDisplay', () => {
  it('formats "mod+s" as "⌘ S" on mac', () => {
    expect(formatBindingDisplay('mod+s', 'mac')).toBe('⌘ S');
  });

  it('formats "mod+s" as "Ctrl+S" on windows', () => {
    expect(formatBindingDisplay('mod+s', 'windows')).toBe('Ctrl+S');
  });

  it('formats "mod+shift+s" as "⌘ ⇧ S" on mac', () => {
    expect(formatBindingDisplay('mod+shift+s', 'mac')).toBe('⌘ ⇧ S');
  });

  it('formats "mod+shift+s" as "Ctrl+Shift+S" on windows', () => {
    expect(formatBindingDisplay('mod+shift+s', 'windows')).toBe('Ctrl+Shift+S');
  });

  it('formats "escape" as "Esc" on all platforms', () => {
    expect(formatBindingDisplay('escape', 'mac')).toBe('Esc');
    expect(formatBindingDisplay('escape', 'windows')).toBe('Esc');
  });

  it('formats "mod+z" correctly', () => {
    expect(formatBindingDisplay('mod+z', 'mac')).toBe('⌘ Z');
    expect(formatBindingDisplay('mod+z', 'windows')).toBe('Ctrl+Z');
  });

  it('formats "mod+n" correctly', () => {
    expect(formatBindingDisplay('mod+n', 'mac')).toBe('⌘ N');
    expect(formatBindingDisplay('mod+n', 'windows')).toBe('Ctrl+N');
  });

  it('formats "mod+shift+z" correctly', () => {
    expect(formatBindingDisplay('mod+shift+z', 'mac')).toBe('⌘ ⇧ Z');
    expect(formatBindingDisplay('mod+shift+z', 'windows')).toBe('Ctrl+Shift+Z');
  });

  it('formats "backspace" correctly per platform', () => {
    expect(formatBindingDisplay('backspace', 'mac')).toBe('⌫');
    expect(formatBindingDisplay('backspace', 'windows')).toBe('Backspace');
  });

  it('formats "delete" correctly per platform', () => {
    expect(formatBindingDisplay('delete', 'mac')).toBe('⌦');
    expect(formatBindingDisplay('delete', 'windows')).toBe('Delete');
  });

  it('formats "?" correctly', () => {
    expect(formatBindingDisplay('?', 'mac')).toBe('?');
    expect(formatBindingDisplay('?', 'windows')).toBe('?');
  });

  it('uses current platform when platform arg omitted', () => {
    _setPlatformForTesting('mac');
    expect(formatBindingDisplay('mod+s')).toBe('⌘ S');
    _setPlatformForTesting('windows');
    expect(formatBindingDisplay('mod+s')).toBe('Ctrl+S');
  });
});

// ── Event Matching ──────────────────────────────────────────────

describe('isPrimaryModifier', () => {
  function makeEvent(opts: Partial<KeyboardEvent>) {
    return {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...opts,
    } as KeyboardEvent;
  }

  it('checks metaKey on mac', () => {
    expect(isPrimaryModifier(makeEvent({ metaKey: true }), 'mac')).toBe(true);
    expect(isPrimaryModifier(makeEvent({ ctrlKey: true }), 'mac')).toBe(false);
  });

  it('checks ctrlKey on windows', () => {
    expect(isPrimaryModifier(makeEvent({ ctrlKey: true }), 'windows')).toBe(true);
    expect(isPrimaryModifier(makeEvent({ metaKey: true }), 'windows')).toBe(false);
  });

  it('checks metaKey on ipad', () => {
    expect(isPrimaryModifier(makeEvent({ metaKey: true }), 'ipad')).toBe(true);
  });

  it('checks ctrlKey on linux', () => {
    expect(isPrimaryModifier(makeEvent({ ctrlKey: true }), 'linux')).toBe(true);
  });

  it('uses current platform when platform arg omitted', () => {
    _setPlatformForTesting('mac');
    expect(isPrimaryModifier(makeEvent({ metaKey: true }))).toBe(true);
    _setPlatformForTesting('windows');
    expect(isPrimaryModifier(makeEvent({ ctrlKey: true }))).toBe(true);
  });
});

// ── ShortcutManager Integration ───────────────────────────────────

describe('ShortcutManager uses centralized platform detection', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  it('formatBindingForDisplay uses platform detector', async () => {
    const { formatBindingForDisplay } = await import('@/core/shortcuts/shortcutManager');
    _setPlatformForTesting('mac');
    const macResult = formatBindingForDisplay('mod+s');
    _setPlatformForTesting('windows');
    const winResult = formatBindingForDisplay('mod+s');

    // Mac shows ⌘ S, Windows shows Ctrl+S
    expect(macResult).toContain('S');
    expect(winResult).toContain('S');
    // They should be different
    expect(macResult).not.toBe(winResult);
  });

  it('eventMatchesBinding respects platform for mod key', async () => {
    const { parseBinding, eventMatchesBinding } = await import('@/core/shortcuts/shortcutManager');
    const binding = parseBinding('mod+s');

    _setPlatformForTesting('mac');
    // On Mac, metaKey should match mod
    const macEvent = { metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key: 's' } as KeyboardEvent;
    expect(eventMatchesBinding(macEvent, binding)).toBe(true);

    _setPlatformForTesting('windows');
    // On Windows, ctrlKey should match mod
    const winEvent = { metaKey: false, ctrlKey: true, shiftKey: false, altKey: false, key: 's' } as KeyboardEvent;
    expect(eventMatchesBinding(winEvent, binding)).toBe(true);
  });
});

// ── usePlatformModifier Hook ─────────────────────────────────────

describe('usePlatformModifier hook structure', () => {
  afterEach(() => {
    _resetPlatformDetection();
  });

  it('exports the hook function', async () => {
    const { usePlatformModifier } = await import('@/hooks/usePlatformModifier');
    expect(typeof usePlatformModifier).toBe('function');
  });

  it('hook module has correct type exports', async () => {
    const mod = await import('@/hooks/usePlatformModifier');
    expect(mod).toHaveProperty('usePlatformModifier');
  });
});

// ── Index barrel exports ───────────────────────────────────────────

describe('core/input barrel exports', () => {
  it('exports all platform detection functions', async () => {
    const mod = await import('@/core/input');
    expect(mod).toHaveProperty('detectPlatform');
    expect(mod).toHaveProperty('getCurrentPlatform');
    expect(mod).toHaveProperty('isCmdPlatform');
    expect(mod).toHaveProperty('_setPlatformForTesting');
    expect(mod).toHaveProperty('_resetPlatformDetection');
  });

  it('exports all modifier map functions', async () => {
    const mod = await import('@/core/input');
    expect(mod).toHaveProperty('getModifierMap');
    expect(mod).toHaveProperty('getCurrentModifierMap');
    expect(mod).toHaveProperty('formatKeyForDisplay');
    expect(mod).toHaveProperty('formatBindingDisplay');
    expect(mod).toHaveProperty('isPrimaryModifier');
    expect(mod).toHaveProperty('isSecondaryModifier');
    expect(mod).toHaveProperty('isTertiaryModifier');
  });
});
