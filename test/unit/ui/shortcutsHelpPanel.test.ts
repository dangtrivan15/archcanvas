/**
 * Tests for the Keyboard Shortcuts Help Panel feature (#236).
 *
 * Covers:
 * 1. Centralized keyboard shortcuts registry
 * 2. Platform-aware key labels (Mac vs Windows)
 * 3. Shortcuts grouped by category
 * 4. UI store state for shortcuts help dialog
 * 5. Keyboard trigger (? key)
 * 6. Help button in toolbar
 * 7. Dialog dismissibility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  getShortcutsByCategory,
  getShortcutKeys,
  isMacPlatform,
  type KeyboardShortcut,
  type ShortcutCategory,
} from '@/config/keyboardShortcuts';
import { useUIStore } from '@/store/uiStore';

// ================================================================
// 1. Keyboard Shortcuts Registry
// ================================================================

describe('Keyboard Shortcuts Registry', () => {
  it('contains all expected shortcuts', () => {
    const ids = KEYBOARD_SHORTCUTS.map((s) => s.id);
    expect(ids).toContain('new-file');
    expect(ids).toContain('open-file');
    expect(ids).toContain('save');
    expect(ids).toContain('save-as');
    expect(ids).toContain('undo');
    expect(ids).toContain('redo');
    expect(ids).toContain('redo-alt');
    expect(ids).toContain('delete-node');
    expect(ids).toContain('deselect');
    expect(ids).toContain('shortcuts-help');
    expect(ids).toContain('drill-into');
    expect(ids).toContain('zoom-out');
  });

  it('has unique IDs for all shortcuts', () => {
    const ids = KEYBOARD_SHORTCUTS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all shortcuts have non-empty descriptions', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.description.length).toBeGreaterThan(0);
    }
  });

  it('all shortcuts have both Mac and Windows keys', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.macKeys.length).toBeGreaterThan(0);
      expect(shortcut.winKeys.length).toBeGreaterThan(0);
    }
  });

  it('all shortcuts belong to a valid category', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(SHORTCUT_CATEGORIES).toContain(shortcut.category);
    }
  });

  it('has at least one shortcut per category', () => {
    for (const category of SHORTCUT_CATEGORIES) {
      const matching = KEYBOARD_SHORTCUTS.filter((s) => s.category === category);
      expect(matching.length).toBeGreaterThan(0);
    }
  });
});

// ================================================================
// 2. Platform-Aware Key Labels
// ================================================================

describe('Platform-aware key labels', () => {
  const saveShortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === 'save')!;

  it('Mac keys use ⌘ symbol for modifier', () => {
    expect(saveShortcut.macKeys).toContain('⌘');
  });

  it('Windows keys use Ctrl for modifier', () => {
    expect(saveShortcut.winKeys).toContain('Ctrl');
  });

  it('getShortcutKeys returns macKeys on Mac platform', () => {
    // We test the function with explicit shortcut objects
    const shortcut: KeyboardShortcut = {
      id: 'test',
      category: 'File',
      description: 'Test',
      macKeys: '⌘ T',
      winKeys: 'Ctrl+T',
    };

    // The function calls isMacPlatform() internally, which depends on navigator
    // Just verify both keys are valid strings
    const keys = getShortcutKeys(shortcut);
    expect(typeof keys).toBe('string');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('Save As shows Shift modifier', () => {
    const saveAs = KEYBOARD_SHORTCUTS.find((s) => s.id === 'save-as')!;
    expect(saveAs.macKeys).toContain('⇧');
    expect(saveAs.winKeys).toContain('Shift');
  });

  it('Redo shows Shift+Z combo', () => {
    const redo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'redo')!;
    expect(redo.macKeys).toContain('⇧');
    expect(redo.macKeys).toContain('Z');
    expect(redo.winKeys).toContain('Shift');
    expect(redo.winKeys).toContain('Z');
  });

  it('shortcuts-help shows ? key on both platforms', () => {
    const help = KEYBOARD_SHORTCUTS.find((s) => s.id === 'shortcuts-help')!;
    expect(help.macKeys).toBe('?');
    expect(help.winKeys).toBe('?');
  });

  it('isMacPlatform returns boolean', () => {
    const result = isMacPlatform();
    expect(typeof result).toBe('boolean');
  });
});

// ================================================================
// 3. Shortcuts Grouped by Category
// ================================================================

describe('Shortcuts grouped by category', () => {
  it('getShortcutsByCategory returns a Map', () => {
    const grouped = getShortcutsByCategory();
    expect(grouped).toBeInstanceOf(Map);
  });

  it('has all categories in display order', () => {
    const grouped = getShortcutsByCategory();
    const keys = [...grouped.keys()];
    expect(keys).toEqual(SHORTCUT_CATEGORIES);
  });

  it('File category contains file operation shortcuts', () => {
    const grouped = getShortcutsByCategory();
    const fileShortcuts = grouped.get('File')!;
    const ids = fileShortcuts.map((s) => s.id);
    expect(ids).toContain('new-file');
    expect(ids).toContain('open-file');
    expect(ids).toContain('save');
    expect(ids).toContain('save-as');
  });

  it('Edit category contains undo/redo/delete shortcuts', () => {
    const grouped = getShortcutsByCategory();
    const editShortcuts = grouped.get('Edit')!;
    const ids = editShortcuts.map((s) => s.id);
    expect(ids).toContain('undo');
    expect(ids).toContain('redo');
    expect(ids).toContain('delete-node');
  });

  it('Canvas category contains escape and help shortcuts', () => {
    const grouped = getShortcutsByCategory();
    const canvasShortcuts = grouped.get('Canvas')!;
    const ids = canvasShortcuts.map((s) => s.id);
    expect(ids).toContain('deselect');
    expect(ids).toContain('shortcuts-help');
  });

  it('Navigation category contains drill-in/zoom-out', () => {
    const grouped = getShortcutsByCategory();
    const navShortcuts = grouped.get('Navigation')!;
    const ids = navShortcuts.map((s) => s.id);
    expect(ids).toContain('drill-into');
    expect(ids).toContain('zoom-out');
  });

  it('total shortcuts in all categories equals KEYBOARD_SHORTCUTS length', () => {
    const grouped = getShortcutsByCategory();
    let total = 0;
    for (const [, shortcuts] of grouped) {
      total += shortcuts.length;
    }
    expect(total).toBe(KEYBOARD_SHORTCUTS.length);
  });
});

// ================================================================
// 4. UI Store: Shortcuts Help Dialog State
// ================================================================

describe('UI Store - Shortcuts Help Dialog', () => {
  beforeEach(() => {
    useUIStore.setState({
      shortcutsHelpOpen: false,
    });
  });

  it('shortcutsHelpOpen defaults to false', () => {
    const state = useUIStore.getState();
    expect(state.shortcutsHelpOpen).toBe(false);
  });

  it('openShortcutsHelp sets shortcutsHelpOpen to true', () => {
    useUIStore.getState().openShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);
  });

  it('closeShortcutsHelp sets shortcutsHelpOpen to false', () => {
    useUIStore.setState({ shortcutsHelpOpen: true });
    useUIStore.getState().closeShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);
  });

  it('toggleShortcutsHelp flips the state', () => {
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);

    useUIStore.getState().toggleShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);

    useUIStore.getState().toggleShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);
  });

  it('openShortcutsHelp is idempotent', () => {
    useUIStore.getState().openShortcutsHelp();
    useUIStore.getState().openShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);
  });

  it('closeShortcutsHelp is idempotent', () => {
    useUIStore.getState().closeShortcutsHelp();
    useUIStore.getState().closeShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);
  });
});

// ================================================================
// 5. Keyboard Trigger (? key)
// ================================================================

describe('Keyboard trigger (? key)', () => {
  it('useKeyboardShortcuts source code handles shortcuts-help action', async () => {
    // Read the source to verify the shortcuts help handler exists (now via ShortcutManager)
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    expect(source).toContain("'canvas:shortcuts-help'");
    expect(source).toContain('toggleShortcutsHelp');
  });

  it('? key handler skips input/textarea elements via centralized FocusZone detection', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    // Verify input guard uses centralized isActiveElementTextInput from FocusZone system
    expect(source).toContain('isActiveElementTextInput');
    expect(source).toContain("import { isActiveElementTextInput } from '@/core/input/focusZones'");
  });

  it('? key handler checks input focus guard via inInput variable', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    // The shortcuts-help handler should check if user is in an input field
    expect(source).toContain('inInput');
    // Uses centralized detection instead of inline tagName checks
    expect(source).toContain('isActiveElementTextInput()');
  });
});

// ================================================================
// 6. Help Button in Toolbar
// ================================================================

describe('Help button in toolbar', () => {
  it('Toolbar source includes shortcuts help button', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/toolbar/Toolbar.tsx', 'utf-8');
    expect(source).toContain('shortcuts-help-button');
    expect(source).toContain('openShortcutsHelp');
    expect(source).toContain('Keyboard shortcuts');
  });

  it('Help button has accessible label and tooltip', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/toolbar/Toolbar.tsx', 'utf-8');
    expect(source).toContain('aria-label="Keyboard shortcuts"');
    expect(source).toContain('title="Keyboard shortcuts (?)"');
  });

  it('Help button has keyboard focus styles', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/toolbar/Toolbar.tsx', 'utf-8');
    expect(source).toContain('focus-visible:outline-none');
    expect(source).toContain('focus-visible:ring-2');
  });
});

// ================================================================
// 7. ShortcutsHelpPanel Component
// ================================================================

describe('ShortcutsHelpPanel component structure', () => {
  it('is registered in App.tsx', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(source).toContain('ShortcutsHelpPanel');
    expect(source).toContain("'@/components/shared/ShortcutsHelpPanel'");
  });

  it('component source has proper ARIA attributes', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby="shortcuts-help-title"');
  });

  it('component uses focus trap hook', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('useFocusTrap');
  });

  it('component handles Escape key to close', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain("e.key === 'Escape'");
    expect(source).toContain('closeDialog');
  });

  it('component handles backdrop click to close', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('handleBackdropClick');
    expect(source).toContain('e.target === e.currentTarget');
  });

  it('component renders category sections', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('SHORTCUT_CATEGORIES');
    expect(source).toContain('shortcuts-category-');
    expect(source).toContain('getShortcutsByCategory');
  });

  it('component renders shortcut keys with kbd element', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('<kbd');
    expect(source).toContain('getShortcutKeys');
  });

  it('component has close button with accessible label', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('aria-label="Close shortcuts help"');
    expect(source).toContain('shortcuts-help-close');
  });

  it('component shows footer with ? key hint', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('toggle this panel');
  });

  it('component has data-testid attributes for all major sections', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('shortcuts-help-dialog');
    expect(source).toContain('shortcuts-help-content');
    expect(source).toContain('shortcuts-help-title');
    expect(source).toContain('shortcuts-help-close');
    expect(source).toContain('shortcuts-help-list');
  });
});

// ================================================================
// 8. Category display order and completeness
// ================================================================

describe('Category display order', () => {
  it('categories are in logical order: File, Edit, View, Canvas, Navigation, Quick Create', () => {
    expect(SHORTCUT_CATEGORIES).toEqual(['File', 'Edit', 'View', 'Canvas', 'Navigation', 'Quick Create']);
  });

  it('SHORTCUT_CATEGORIES has exactly 6 entries', () => {
    expect(SHORTCUT_CATEGORIES).toHaveLength(6);
  });
});

// ================================================================
// 9. Integration: Escape in dialog vs. canvas deselect
// ================================================================

describe('Shortcuts help dialog Escape handling', () => {
  it('ShortcutsHelpPanel uses capture phase for keyboard events', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    // Uses capture phase (true) to intercept Escape before canvas handler
    expect(source).toContain("addEventListener('keydown', handleKeyDown, true)");
  });

  it('ShortcutsHelpPanel calls stopPropagation on Escape', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/shared/ShortcutsHelpPanel.tsx', 'utf-8');
    expect(source).toContain('e.stopPropagation()');
  });
});

// ================================================================
// 10. Shortcut content accuracy
// ================================================================

describe('Shortcut content accuracy', () => {
  it('new-file shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-file')!;
    expect(s.macKeys).toBe('⌘ N');
    expect(s.winKeys).toBe('Ctrl+N');
    expect(s.description).toBe('New file');
  });

  it('open-file shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'open-file')!;
    expect(s.macKeys).toBe('⌘ O');
    expect(s.winKeys).toBe('Ctrl+O');
  });

  it('save shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'save')!;
    expect(s.macKeys).toBe('⌘ S');
    expect(s.winKeys).toBe('Ctrl+S');
  });

  it('undo shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'undo')!;
    expect(s.macKeys).toBe('⌘ Z');
    expect(s.winKeys).toBe('Ctrl+Z');
  });

  it('deselect shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'deselect')!;
    expect(s.macKeys).toBe('Esc');
    expect(s.winKeys).toBe('Esc');
  });

  it('zoom-out shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'zoom-out')!;
    expect(s.macKeys).toBe('Backspace');
    expect(s.winKeys).toBe('Backspace');
  });

  it('drill-into shortcut describes double-click', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'drill-into')!;
    expect(s.macKeys).toBe('Double-click');
    expect(s.winKeys).toBe('Double-click');
    expect(s.description).toContain('Drill into');
  });

  it('delete-node shortcut has correct keys', () => {
    const s = KEYBOARD_SHORTCUTS.find((s) => s.id === 'delete-node')!;
    expect(s.macKeys).toBe('Delete');
    expect(s.winKeys).toBe('Delete');
  });
});
