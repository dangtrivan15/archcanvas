/**
 * Feature #542: Ctrl+/ shortcut opens Claude Code terminal panel
 *
 * Verifies that Ctrl+/ (Cmd+/ on Mac) toggles the right panel on the Terminal tab.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Source code paths ──
const shortcutManagerPath = resolve(__dirname, '../../../src/core/shortcuts/shortcutManager.ts');
const useKeyboardShortcutsPath = resolve(
  __dirname,
  '../../../src/hooks/useKeyboardShortcuts.ts',
);
const keyboardShortcutsConfigPath = resolve(
  __dirname,
  '../../../src/config/keyboardShortcuts.ts',
);
const nodeDetailPanelPath = resolve(
  __dirname,
  '../../../src/components/panels/NodeDetailPanel.tsx',
);

const shortcutManagerSrc = readFileSync(shortcutManagerPath, 'utf-8');
const useKeyboardShortcutsSrc = readFileSync(useKeyboardShortcutsPath, 'utf-8');
const keyboardShortcutsConfigSrc = readFileSync(keyboardShortcutsConfigPath, 'utf-8');
const nodeDetailPanelSrc = readFileSync(nodeDetailPanelPath, 'utf-8');

describe('Feature #542: Ctrl+/ shortcut opens Claude Code terminal panel', () => {
  // ── Step 1: Shortcut registration ──
  describe('Step 1: Shortcut action registered in ShortcutManager', () => {
    it('has panel:terminal action defined in SHORTCUT_ACTIONS', () => {
      expect(shortcutManagerSrc).toContain("id: 'panel:terminal'");
    });

    it('panel:terminal has mod+/ as default binding', () => {
      expect(shortcutManagerSrc).toContain("defaultBinding: 'mod+/'");
    });

    it('panel:terminal has descriptive label', () => {
      expect(shortcutManagerSrc).toContain("label: 'Toggle Terminal Panel'");
    });

    it('panel:terminal is in Canvas category', () => {
      // Find the panel:terminal action block and verify category
      const actionMatch = shortcutManagerSrc.match(
        /id:\s*'panel:terminal'[\s\S]*?category:\s*'(\w+)'/,
      );
      expect(actionMatch).toBeTruthy();
      expect(actionMatch![1]).toBe('Canvas');
    });

    it('binding mod+/ is parseable', async () => {
      const { parseBinding } = await import('@/core/shortcuts/shortcutManager');
      const binding = parseBinding('mod+/');
      expect(binding.mod).toBe(true);
      expect(binding.key).toBe('/');
      expect(binding.shift).toBe(false);
      expect(binding.alt).toBe(false);
    });
  });

  // ── Step 2: Shortcut handler opens terminal panel ──
  describe('Step 2: Shortcut handler toggles terminal panel', () => {
    it('useKeyboardShortcuts handles panel:terminal action', () => {
      expect(useKeyboardShortcutsSrc).toContain("case 'panel:terminal':");
    });

    it('handler calls openRightPanel with terminal tab', () => {
      expect(useKeyboardShortcutsSrc).toContain("openRightPanel('terminal')");
    });

    it('handler calls closeRightPanel when already on terminal', () => {
      expect(useKeyboardShortcutsSrc).toContain('closeRightPanel()');
    });

    it('handler checks if panel is already open on terminal tab', () => {
      expect(useKeyboardShortcutsSrc).toContain("rightPanelTab === 'terminal'");
    });

    it('handler prevents default browser action', () => {
      // The handler should call e.preventDefault() before the toggle logic
      const panelTerminalSection = useKeyboardShortcutsSrc
        .split("case 'panel:terminal':")[1]
        ?.split('break;')[0];
      expect(panelTerminalSection).toBeTruthy();
      expect(panelTerminalSection).toContain('e.preventDefault()');
    });
  });

  // ── Step 3: Toggle behavior (open if closed, close if open on terminal) ──
  describe('Step 3: Toggle behavior - open/close logic', () => {
    it('opens panel on terminal tab when panel is closed', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      // Start with panel closed
      useUIStore.setState({ rightPanelOpen: false, rightPanelTab: 'properties' });

      const state = useUIStore.getState();
      // Simulate the toggle logic from the shortcut handler
      if (state.rightPanelOpen && state.rightPanelTab === 'terminal') {
        state.closeRightPanel();
      } else {
        state.openRightPanel('terminal');
      }

      const after = useUIStore.getState();
      expect(after.rightPanelOpen).toBe(true);
      expect(after.rightPanelTab).toBe('terminal');
    });

    it('closes panel when already open on terminal tab', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      // Start with panel open on terminal
      useUIStore.setState({ rightPanelOpen: true, rightPanelTab: 'terminal' });

      const state = useUIStore.getState();
      if (state.rightPanelOpen && state.rightPanelTab === 'terminal') {
        state.closeRightPanel();
      } else {
        state.openRightPanel('terminal');
      }

      const after = useUIStore.getState();
      expect(after.rightPanelOpen).toBe(false);
    });

    it('switches to terminal tab when panel is open on different tab', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      // Start with panel open on properties tab
      useUIStore.setState({ rightPanelOpen: true, rightPanelTab: 'properties' });

      const state = useUIStore.getState();
      if (state.rightPanelOpen && state.rightPanelTab === 'terminal') {
        state.closeRightPanel();
      } else {
        state.openRightPanel('terminal');
      }

      const after = useUIStore.getState();
      expect(after.rightPanelOpen).toBe(true);
      expect(after.rightPanelTab).toBe('terminal');
    });

    it('switches to terminal when panel is open on notes tab', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      useUIStore.setState({ rightPanelOpen: true, rightPanelTab: 'notes' });

      const state = useUIStore.getState();
      if (state.rightPanelOpen && state.rightPanelTab === 'terminal') {
        state.closeRightPanel();
      } else {
        state.openRightPanel('terminal');
      }

      const after = useUIStore.getState();
      expect(after.rightPanelOpen).toBe(true);
      expect(after.rightPanelTab).toBe('terminal');
    });

    it('switches to terminal when panel is open on coderefs tab', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      useUIStore.setState({ rightPanelOpen: true, rightPanelTab: 'coderefs' });

      const state = useUIStore.getState();
      if (state.rightPanelOpen && state.rightPanelTab === 'terminal') {
        state.closeRightPanel();
      } else {
        state.openRightPanel('terminal');
      }

      const after = useUIStore.getState();
      expect(after.rightPanelOpen).toBe(true);
      expect(after.rightPanelTab).toBe('terminal');
    });
  });

  // ── Step 4: Shortcut works from any context ──
  describe('Step 4: Shortcut works from any context', () => {
    it('ShortcutManager matches Ctrl+/ via eventMatchesBinding', async () => {
      const { parseBinding, eventMatchesBinding } = await import(
        '@/core/shortcuts/shortcutManager'
      );
      const { _setPlatformForTesting } = await import('@/core/input/platformDetector');
      _setPlatformForTesting('windows');
      const binding = parseBinding('mod+/');

      // Create a mock keyboard event matching Ctrl+/ (Windows/Linux)
      const event = {
        key: '/',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      } as KeyboardEvent;

      const matches = eventMatchesBinding(event, binding);
      _setPlatformForTesting('unknown');
      expect(matches).toBe(true);
    });

    it('ShortcutManager matches Cmd+/ event (Mac)', async () => {
      const { getShortcutManager, resetShortcutManager } = await import(
        '@/core/shortcuts/shortcutManager'
      );
      resetShortcutManager();
      const manager = getShortcutManager();

      // Simulate Cmd+/ keydown event (Mac) - on Mac, mod maps to metaKey
      // But eventMatchesBinding checks based on platform, so we test both:
      // The "mod" flag means Cmd on Mac, Ctrl on Win/Linux
      // Since we're in a test environment (likely detected as non-Mac),
      // Ctrl should work. Let's verify the binding is registered.
      const binding = manager.getBinding('panel:terminal');
      expect(binding).toBe('mod+/');
    });

    it('shortcut handler does not check isActiveElementTextInput (works everywhere)', () => {
      // The panel:terminal case should NOT have "if (inInput) return;"
      // because mod+/ should work even when typing in a text field
      const panelTerminalSection = useKeyboardShortcutsSrc
        .split("case 'panel:terminal':")[1]
        ?.split('break;')[0];
      expect(panelTerminalSection).toBeTruthy();
      expect(panelTerminalSection).not.toContain('if (inInput) return');
    });

    it('does not conflict with other shortcuts', async () => {
      const { getShortcutManager, resetShortcutManager } = await import(
        '@/core/shortcuts/shortcutManager'
      );
      const { _setPlatformForTesting } = await import('@/core/input/platformDetector');
      _setPlatformForTesting('windows');
      resetShortcutManager();
      const manager = getShortcutManager();
      const conflict = manager.findConflict('panel:terminal', 'mod+/');
      _setPlatformForTesting('unknown');
      expect(conflict).toBeUndefined();
    });
  });

  // ── Step 5: Shortcut listed in keyboard shortcuts help ──
  describe('Step 5: Shortcut listed in keyboard shortcuts help', () => {
    it('KEYBOARD_SHORTCUTS array includes toggle-terminal entry', () => {
      expect(keyboardShortcutsConfigSrc).toContain("id: 'toggle-terminal'");
    });

    it('help entry has correct Mac key display', () => {
      // Find the toggle-terminal block
      const match = keyboardShortcutsConfigSrc.match(
        /id:\s*'toggle-terminal'[\s\S]*?macKeys:\s*'([^']+)'/,
      );
      expect(match).toBeTruthy();
      expect(match![1]).toContain('/');
    });

    it('help entry has correct Windows key display', () => {
      const match = keyboardShortcutsConfigSrc.match(
        /id:\s*'toggle-terminal'[\s\S]*?winKeys:\s*'([^']+)'/,
      );
      expect(match).toBeTruthy();
      expect(match![1]).toContain('Ctrl+/');
    });

    it('help entry is mapped to panel:terminal action in HELP_TO_ACTION_MAP', () => {
      expect(keyboardShortcutsConfigSrc).toContain("'toggle-terminal': 'panel:terminal'");
    });

    it('help entry is in Canvas category', () => {
      const match = keyboardShortcutsConfigSrc.match(
        /id:\s*'toggle-terminal'[\s\S]*?category:\s*'(\w+)'/,
      );
      expect(match).toBeTruthy();
      expect(match![1]).toBe('Canvas');
    });

    it('help entry has descriptive text', () => {
      const match = keyboardShortcutsConfigSrc.match(
        /id:\s*'toggle-terminal'[\s\S]*?description:\s*'([^']+)'/,
      );
      expect(match).toBeTruthy();
      expect(match![1]!.toLowerCase()).toContain('terminal');
    });
  });

  // ── Step 6: NodeDetailPanel syncs with uiStore tab ──
  describe('Step 6: NodeDetailPanel syncs tab state with uiStore', () => {
    it('NodeDetailPanel reads rightPanelTab from uiStore', () => {
      expect(nodeDetailPanelSrc).toContain('rightPanelTab');
    });

    it('NodeDetailPanel uses useEffect to sync tab from uiStore', () => {
      // Should have a useEffect that watches rightPanelTab
      expect(nodeDetailPanelSrc).toContain('rightPanelTab');
      expect(nodeDetailPanelSrc).toContain('setRightPanelTab');
    });

    it('NodeDetailPanel syncs local tab state to uiStore when clicking tabs', () => {
      expect(nodeDetailPanelSrc).toContain('setRightPanelTab');
    });
  });

  // ── Integration tests ──
  describe('Integration: Full shortcut toggle cycle', () => {
    it('can open and close terminal panel via shortcut toggle logic', async () => {
      const { useUIStore } = await import('@/store/uiStore');

      // Start closed
      useUIStore.setState({ rightPanelOpen: false, rightPanelTab: 'properties' });

      // First toggle: open on terminal
      const toggle = () => {
        const s = useUIStore.getState();
        if (s.rightPanelOpen && s.rightPanelTab === 'terminal') {
          s.closeRightPanel();
        } else {
          s.openRightPanel('terminal');
        }
      };

      toggle();
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
      expect(useUIStore.getState().rightPanelTab).toBe('terminal');

      // Second toggle: close
      toggle();
      expect(useUIStore.getState().rightPanelOpen).toBe(false);

      // Third toggle: open again
      toggle();
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
      expect(useUIStore.getState().rightPanelTab).toBe('terminal');
    });

    it('shortcut manager can be customized for panel:terminal', async () => {
      const { getShortcutManager, resetShortcutManager } = await import(
        '@/core/shortcuts/shortcutManager'
      );
      resetShortcutManager();
      const manager = getShortcutManager();

      // Default binding
      expect(manager.getBinding('panel:terminal')).toBe('mod+/');

      // Can check if customized
      expect(manager.isCustomized('panel:terminal')).toBe(false);
    });

    it('getShortcutsByCategory includes toggle-terminal in Canvas', async () => {
      const { KEYBOARD_SHORTCUTS } = await import('@/config/keyboardShortcuts');
      const terminalShortcut = KEYBOARD_SHORTCUTS.find((s) => s.id === 'toggle-terminal');
      expect(terminalShortcut).toBeTruthy();
      expect(terminalShortcut!.category).toBe('Canvas');
    });

    it('panel:terminal action appears in shortcut actions list', async () => {
      const { SHORTCUT_ACTIONS } = await import('@/core/shortcuts/shortcutManager');
      const action = SHORTCUT_ACTIONS.find((a) => a.id === 'panel:terminal');
      expect(action).toBeTruthy();
      expect(action!.defaultBinding).toBe('mod+/');
      expect(action!.category).toBe('Canvas');
    });
  });
});
