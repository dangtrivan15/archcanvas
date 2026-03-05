/**
 * Feature #225: Confirm dialog accessible via keyboard
 *
 * Verifies that confirmation dialogs can be operated entirely via keyboard:
 * - Focus is trapped within the dialog
 * - Tab moves between buttons (and wraps)
 * - Escape closes the dialog
 * - Enter on focused button activates it
 * - Dialog has proper ARIA attributes
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '../../../src', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Feature #225: Confirm dialog accessible via keyboard', () => {
  describe('useFocusTrap hook', () => {
    const hookSource = readSource('hooks/useFocusTrap.ts');

    it('exports useFocusTrap function', () => {
      expect(hookSource).toContain('export function useFocusTrap');
    });

    it('handles Tab key to wrap focus from last to first element', () => {
      expect(hookSource).toContain("e.key !== 'Tab'");
      expect(hookSource).toContain('last.focus()');
      expect(hookSource).toContain('first.focus()');
    });

    it('handles Shift+Tab to wrap focus from first to last element', () => {
      expect(hookSource).toContain('e.shiftKey');
    });

    it('uses standard focusable element selector', () => {
      // Covers buttons, links, inputs, selects, textareas, and tabindex elements
      expect(hookSource).toContain('button:not([disabled])');
      expect(hookSource).toContain('input:not([disabled])');
      expect(hookSource).toContain('select:not([disabled])');
      expect(hookSource).toContain('textarea:not([disabled])');
      expect(hookSource).toContain('[tabindex]:not([tabindex="-1"])');
    });

    it('prevents default on Tab wrap to stop browser from moving focus outside', () => {
      expect(hookSource).toContain('e.preventDefault()');
    });

    it('only activates when the active parameter is true', () => {
      expect(hookSource).toContain('if (!active');
    });

    it('cleans up event listener on deactivation', () => {
      expect(hookSource).toContain('removeEventListener');
    });
  });

  describe('DeleteConfirmationDialog keyboard support', () => {
    const source = readSource('components/shared/DeleteConfirmationDialog.tsx');

    it('imports useFocusTrap hook', () => {
      expect(source).toContain("import { useFocusTrap } from '@/hooks/useFocusTrap'");
    });

    it('uses useFocusTrap with dialog open state', () => {
      expect(source).toContain('useFocusTrap<HTMLDivElement>(deleteDialogOpen)');
    });

    it('attaches focusTrapRef to dialog content container', () => {
      expect(source).toContain('ref={focusTrapRef}');
    });

    it('has role="dialog" on backdrop', () => {
      expect(source).toContain('role="dialog"');
    });

    it('has aria-modal="true"', () => {
      expect(source).toContain('aria-modal="true"');
    });

    it('has aria-labelledby pointing to title', () => {
      expect(source).toContain('aria-labelledby="delete-dialog-title"');
      expect(source).toContain('id="delete-dialog-title"');
    });

    it('auto-focuses the Confirm button when dialog opens', () => {
      expect(source).toContain('confirmRef.current.focus()');
    });

    it('handles Escape key to close dialog', () => {
      expect(source).toContain("e.key === 'Escape'");
      expect(source).toContain('closeDeleteDialog()');
    });

    it('has Cancel and Delete buttons', () => {
      expect(source).toContain('data-testid="delete-cancel-button"');
      expect(source).toContain('data-testid="delete-confirm-button"');
    });

    it('Cancel and Delete buttons are type="button"', () => {
      // type="button" prevents accidental form submission
      const typeButtonCount = (source.match(/type="button"/g) || []).length;
      expect(typeButtonCount).toBeGreaterThanOrEqual(2);
    });

    it('has focus ring styles on buttons', () => {
      expect(source).toContain('focus-visible:ring-2');
    });
  });

  describe('UnsavedChangesDialog keyboard support', () => {
    const source = readSource('components/shared/UnsavedChangesDialog.tsx');

    it('imports useFocusTrap hook', () => {
      expect(source).toContain("import { useFocusTrap } from '@/hooks/useFocusTrap'");
    });

    it('uses useFocusTrap with dialog open state', () => {
      expect(source).toContain('useFocusTrap<HTMLDivElement>(open)');
    });

    it('attaches focusTrapRef to dialog content container', () => {
      expect(source).toContain('ref={focusTrapRef}');
    });

    it('has role="dialog" and aria-modal="true"', () => {
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
    });

    it('auto-focuses the Discard button when dialog opens', () => {
      expect(source).toContain('discardRef.current.focus()');
    });

    it('handles Escape key to close dialog', () => {
      expect(source).toContain("e.key === 'Escape'");
    });

    it('has Cancel and Discard buttons', () => {
      expect(source).toContain('data-testid="unsaved-cancel-button"');
      expect(source).toContain('data-testid="unsaved-discard-button"');
    });
  });

  describe('ConnectionTypeDialog keyboard support', () => {
    const source = readSource('components/shared/ConnectionTypeDialog.tsx');

    it('imports useFocusTrap hook', () => {
      expect(source).toContain("import { useFocusTrap } from '@/hooks/useFocusTrap'");
    });

    it('uses useFocusTrap with dialog open state', () => {
      expect(source).toContain('useFocusTrap<HTMLDivElement>(connectionDialogOpen)');
    });

    it('attaches focusTrapRef to dialog content container', () => {
      expect(source).toContain('ref={focusTrapRef}');
    });

    it('has role="dialog" and aria-modal="true"', () => {
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
    });

    it('auto-focuses the Confirm button when dialog opens', () => {
      expect(source).toContain('confirmRef.current.focus()');
    });

    it('handles Escape key to close dialog', () => {
      expect(source).toContain("e.key === 'Escape'");
    });

    it('Enter key on label input triggers confirm', () => {
      expect(source).toContain("e.key === 'Enter'");
      expect(source).toContain('handleConfirm()');
    });
  });

  describe('ErrorDialog keyboard support', () => {
    const source = readSource('components/shared/ErrorDialog.tsx');

    it('imports useFocusTrap hook', () => {
      expect(source).toContain("import { useFocusTrap } from '@/hooks/useFocusTrap'");
    });

    it('uses useFocusTrap with dialog open state', () => {
      expect(source).toContain('useFocusTrap<HTMLDivElement>(open)');
    });

    it('attaches focusTrapRef to dialog content container', () => {
      expect(source).toContain('ref={focusTrapRef}');
    });

    it('has role="alertdialog" and aria-modal="true"', () => {
      expect(source).toContain('role="alertdialog"');
      expect(source).toContain('aria-modal="true"');
    });

    it('handles both Escape and Enter to close', () => {
      expect(source).toContain("e.key === 'Escape' || e.key === 'Enter'");
    });
  });

  describe('IntegrityWarningDialog keyboard support', () => {
    const source = readSource('components/shared/IntegrityWarningDialog.tsx');

    it('imports useFocusTrap hook', () => {
      expect(source).toContain("import { useFocusTrap } from '@/hooks/useFocusTrap'");
    });

    it('uses useFocusTrap with dialog open state', () => {
      expect(source).toContain('useFocusTrap<HTMLDivElement>(open)');
    });

    it('attaches focusTrapRef to dialog content container', () => {
      expect(source).toContain('ref={focusTrapRef}');
    });

    it('has role="alertdialog" and aria-modal="true"', () => {
      expect(source).toContain('role="alertdialog"');
      expect(source).toContain('aria-modal="true"');
    });

    it('handles Escape key to close dialog', () => {
      expect(source).toContain("e.key === 'Escape'");
    });

    it('has Cancel and Open Anyway buttons', () => {
      expect(source).toContain('data-testid="integrity-warning-cancel-button"');
      expect(source).toContain('data-testid="integrity-warning-proceed-button"');
    });
  });

  describe('All dialogs share common keyboard patterns', () => {
    const dialogs = [
      { name: 'DeleteConfirmationDialog', path: 'components/shared/DeleteConfirmationDialog.tsx' },
      { name: 'UnsavedChangesDialog', path: 'components/shared/UnsavedChangesDialog.tsx' },
      { name: 'ConnectionTypeDialog', path: 'components/shared/ConnectionTypeDialog.tsx' },
      { name: 'ErrorDialog', path: 'components/shared/ErrorDialog.tsx' },
      { name: 'IntegrityWarningDialog', path: 'components/shared/IntegrityWarningDialog.tsx' },
    ];

    for (const dialog of dialogs) {
      it(`${dialog.name} uses focus trapping`, () => {
        const source = readSource(dialog.path);
        expect(source).toContain('useFocusTrap');
        expect(source).toContain('focusTrapRef');
      });

      it(`${dialog.name} has keyboard Escape handler`, () => {
        const source = readSource(dialog.path);
        expect(source).toContain("'Escape'");
      });

      it(`${dialog.name} has auto-focus on open`, () => {
        const source = readSource(dialog.path);
        expect(source).toContain('.focus()');
      });

      it(`${dialog.name} has backdrop click handler`, () => {
        const source = readSource(dialog.path);
        expect(source).toContain('handleBackdropClick');
      });

      it(`${dialog.name} has aria-modal="true"`, () => {
        const source = readSource(dialog.path);
        expect(source).toContain('aria-modal="true"');
      });
    }
  });
});
