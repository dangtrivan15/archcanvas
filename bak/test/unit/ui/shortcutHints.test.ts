/**
 * Tests for ShortcutHints - contextual floating hint panel.
 * Verifies hint content changes per context and H key toggle.
 */

import { describe, it, expect } from 'vitest';

// Helper to read the ShortcutHints source for structural verification
import { readFileSync } from 'fs';
import { join } from 'path';

const COMPONENT_SRC = readFileSync(
  join(__dirname, '../../../src/components/canvas/ShortcutHints.tsx'),
  'utf-8',
);

describe('ShortcutHints', () => {
  describe('Source structure verification', () => {
    it('imports getShortcutManager', () => {
      expect(COMPONENT_SRC).toContain('import { getShortcutManager }');
    });

    it('imports formatBindingDisplay', () => {
      expect(COMPONENT_SRC).toContain('import { formatBindingDisplay }');
    });

    it('imports isActiveElementTextInput from focusZones', () => {
      expect(COMPONENT_SRC).toContain('import { isActiveElementTextInput }');
      expect(COMPONENT_SRC).toContain("from '@/core/input/focusZones'");
    });

    it('does not import CanvasMode', () => {
      expect(COMPONENT_SRC).not.toContain('import { CanvasMode }');
    });

    it('uses useCanvasStore for selectedNodeId', () => {
      expect(COMPONENT_SRC).toContain('useCanvasStore((s) => s.selectedNodeId)');
    });

    it('uses useCanvasStore for selectedEdgeId', () => {
      expect(COMPONENT_SRC).toContain('useCanvasStore((s) => s.selectedEdgeId)');
    });

    it('has data-testid for the hints container', () => {
      expect(COMPONENT_SRC).toContain('data-testid="shortcut-hints"');
    });

    it('has role="status" for accessibility', () => {
      expect(COMPONENT_SRC).toContain('role="status"');
    });

    it('has aria-label', () => {
      expect(COMPONENT_SRC).toContain('aria-label="Keyboard shortcut hints"');
    });

    it('uses preferences adapter for persistence', () => {
      expect(COMPONENT_SRC).toContain('preferences.getSync(PREFERENCES_KEY)');
      expect(COMPONENT_SRC).toContain('preferences.set(PREFERENCES_KEY');
    });

    it('handles H key for toggle', () => {
      expect(COMPONENT_SRC).toContain("e.key.toLowerCase() !== 'h'");
    });

    it('guards toggle with isActiveElementTextInput instead of mode check', () => {
      expect(COMPONENT_SRC).toContain('isActiveElementTextInput()');
      expect(COMPONENT_SRC).not.toContain('CanvasMode.Normal');
    });

    it('uses pointer-events-none so hints do not block clicks', () => {
      expect(COMPONENT_SRC).toContain('pointer-events-none');
    });

    it('uses semi-transparent dark background', () => {
      expect(COMPONENT_SRC).toContain('bg-black/50');
    });

    it('uses backdrop blur', () => {
      expect(COMPONENT_SRC).toContain('backdrop-blur-sm');
    });
  });

  describe('Hint context logic', () => {
    it('getHints takes hasNode and hasEdge params (no mode param)', () => {
      expect(COMPONENT_SRC).toContain('function getHints(hasNode: boolean, hasEdge: boolean)');
    });

    it('defines edge hints with change type, delete, deselect', () => {
      expect(COMPONENT_SRC).toContain('hasEdge');
      expect(COMPONENT_SRC).toContain("'change type'");
      expect(COMPONENT_SRC).toContain("'delete'");
      expect(COMPONENT_SRC).toContain("'deselect'");
    });

    it('defines node hints with delete, rename, commands', () => {
      expect(COMPONENT_SRC).toContain('hasNode');
      expect(COMPONENT_SRC).toContain("'delete'");
      expect(COMPONENT_SRC).toContain("'rename'");
      expect(COMPONENT_SRC).toContain("'commands'");
    });

    it('node hints do not include connect or edit labels', () => {
      // Extract the hasNode block: from "if (hasNode)" to the next "return ["
      // to check only node-related hints
      const hasNodeIndex = COMPONENT_SRC.indexOf('if (hasNode)');
      const nothingSelectedComment = COMPONENT_SRC.indexOf('// Nothing selected');
      const nodeBlock = COMPONENT_SRC.slice(hasNodeIndex, nothingSelectedComment);
      expect(nodeBlock).not.toContain("'connect'");
      expect(nodeBlock).not.toContain("'edit'");
    });

    it('defines nothing-selected hints with commands, service, database, all shortcuts, hide', () => {
      expect(COMPONENT_SRC).toContain("'commands'");
      expect(COMPONENT_SRC).toContain("'service'");
      expect(COMPONENT_SRC).toContain("'database'");
      expect(COMPONENT_SRC).toContain("'all shortcuts'");
      expect(COMPONENT_SRC).toContain("'hide hints'");
    });

    it('does not have Connect mode hints', () => {
      expect(COMPONENT_SRC).not.toContain('CanvasMode.Connect');
    });

    it('does not have Edit mode hints', () => {
      expect(COMPONENT_SRC).not.toContain('CanvasMode.Edit');
    });

    it('uses ShortcutManager getBinding for dynamic bindings', () => {
      expect(COMPONENT_SRC).toContain('sm.getBinding(actionId)');
    });

    it('uses memoization for hint computation', () => {
      expect(COMPONENT_SRC).toContain('useMemo');
    });
  });

  describe('Positioning and styling', () => {
    it('does not use absolute positioning (Panel handles placement)', () => {
      expect(COMPONENT_SRC).not.toContain('absolute');
      expect(COMPONENT_SRC).not.toContain('bottom-20');
      expect(COMPONENT_SRC).not.toContain('right-3');
    });

    it('uses z-40 (below mode indicator z-50)', () => {
      expect(COMPONENT_SRC).toContain('z-40');
    });

    it('renders kbd elements for key display', () => {
      expect(COMPONENT_SRC).toContain('<kbd');
    });

    it('uses pipe separators between hints', () => {
      expect(COMPONENT_SRC).toContain('|</span>');
    });

    it('uses monospace font', () => {
      expect(COMPONENT_SRC).toContain('font-mono');
    });
  });
});
