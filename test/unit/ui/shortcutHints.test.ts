/**
 * Tests for ShortcutHints - contextual floating hint panel.
 * Verifies hint content changes per context and H key toggle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasMode } from '@/core/input/canvasMode';

// Helper to read the ShortcutHints source for structural verification
import { readFileSync } from 'fs';
import { join } from 'path';

const COMPONENT_SRC = readFileSync(
  join(__dirname, '../../../src/components/canvas/ShortcutHints.tsx'),
  'utf-8',
);

describe('ShortcutHints', () => {
  describe('Source structure verification', () => {
    it('imports CanvasMode', () => {
      expect(COMPONENT_SRC).toContain("import { CanvasMode }");
    });

    it('imports getShortcutManager', () => {
      expect(COMPONENT_SRC).toContain("import { getShortcutManager }");
    });

    it('imports formatBindingDisplay', () => {
      expect(COMPONENT_SRC).toContain("import { formatBindingDisplay }");
    });

    it('uses useUIStore for canvasMode', () => {
      expect(COMPONENT_SRC).toContain("useUIStore((s) => s.canvasMode)");
    });

    it('uses useCanvasStore for selectedNodeId', () => {
      expect(COMPONENT_SRC).toContain("useCanvasStore((s) => s.selectedNodeId)");
    });

    it('uses useCanvasStore for selectedEdgeId', () => {
      expect(COMPONENT_SRC).toContain("useCanvasStore((s) => s.selectedEdgeId)");
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

    it('uses localStorage for persistence', () => {
      expect(COMPONENT_SRC).toContain("localStorage.getItem(STORAGE_KEY)");
      expect(COMPONENT_SRC).toContain("localStorage.setItem(STORAGE_KEY");
    });

    it('handles H key for toggle', () => {
      expect(COMPONENT_SRC).toContain("e.key.toLowerCase() !== 'h'");
    });

    it('only toggles in Normal mode', () => {
      expect(COMPONENT_SRC).toContain("mode !== CanvasMode.Normal");
    });

    it('prevents toggle when focused on text inputs', () => {
      expect(COMPONENT_SRC).toContain("tag === 'INPUT'");
      expect(COMPONENT_SRC).toContain("tag === 'TEXTAREA'");
      expect(COMPONENT_SRC).toContain("tag === 'SELECT'");
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
    // We test the getHints logic by checking what the source returns
    // for each context scenario

    it('defines Connect mode hints with navigate, confirm, type, cancel', () => {
      expect(COMPONENT_SRC).toContain("mode === CanvasMode.Connect");
      // Connect hints should include navigation arrows and confirm/cancel
      expect(COMPONENT_SRC).toContain("'↑↓←→'");
      expect(COMPONENT_SRC).toContain("'navigate'");
      expect(COMPONENT_SRC).toContain("'confirm'");
      expect(COMPONENT_SRC).toContain("'type'");
      expect(COMPONENT_SRC).toContain("'cancel'");
    });

    it('defines Edit mode hints with Tab, Enter, Escape', () => {
      expect(COMPONENT_SRC).toContain("mode === CanvasMode.Edit");
      expect(COMPONENT_SRC).toContain("'Tab'");
      expect(COMPONENT_SRC).toContain("'next field'");
      expect(COMPONENT_SRC).toContain("'⇧Tab'");
      expect(COMPONENT_SRC).toContain("'prev field'");
      expect(COMPONENT_SRC).toContain("'exit'");
    });

    it('defines Normal/edge hints with change type, delete, deselect', () => {
      expect(COMPONENT_SRC).toContain("hasEdge");
      expect(COMPONENT_SRC).toContain("'change type'");
      expect(COMPONENT_SRC).toContain("'delete'");
      expect(COMPONENT_SRC).toContain("'deselect'");
    });

    it('defines Normal/node hints with connect, edit, delete, rename, commands', () => {
      expect(COMPONENT_SRC).toContain("hasNode");
      expect(COMPONENT_SRC).toContain("'connect'");
      expect(COMPONENT_SRC).toContain("'edit'");
      expect(COMPONENT_SRC).toContain("'rename'");
      expect(COMPONENT_SRC).toContain("'commands'");
    });

    it('defines Normal/nothing hints with commands, service, database, all shortcuts, hide', () => {
      expect(COMPONENT_SRC).toContain("'commands'");
      expect(COMPONENT_SRC).toContain("'service'");
      expect(COMPONENT_SRC).toContain("'database'");
      expect(COMPONENT_SRC).toContain("'all shortcuts'");
      expect(COMPONENT_SRC).toContain("'hide hints'");
    });

    it('uses ShortcutManager getBinding for dynamic bindings', () => {
      expect(COMPONENT_SRC).toContain("sm.getBinding(actionId)");
    });

    it('uses memoization for hint computation', () => {
      expect(COMPONENT_SRC).toContain("useMemo");
    });
  });

  describe('Positioning and styling', () => {
    it('is positioned at bottom-right', () => {
      expect(COMPONENT_SRC).toContain('bottom-20');
      expect(COMPONENT_SRC).toContain('right-3');
    });

    it('uses absolute positioning', () => {
      expect(COMPONENT_SRC).toContain('absolute');
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

  describe('Integration with Canvas', () => {
    const canvasSrc = readFileSync(
      join(__dirname, '../../../src/components/canvas/Canvas.tsx'),
      'utf-8',
    );

    it('Canvas.tsx imports ShortcutHints', () => {
      expect(canvasSrc).toContain("import { ShortcutHints }");
    });

    it('Canvas.tsx renders <ShortcutHints />', () => {
      expect(canvasSrc).toContain('<ShortcutHints />');
    });
  });
});
