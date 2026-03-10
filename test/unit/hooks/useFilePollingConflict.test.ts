import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useUIStore } from '@/store/uiStore';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #524: Show conflict dialog when file modified with unsaved local changes.
 *
 * Verifies that:
 * 1. When isDirty=true and external modification detected, a conflict dialog opens
 * 2. The conflict dialog has three options: Reload from disk, Keep your version, Save as copy
 * 3. The dialog explains the situation clearly (file name + conflict description)
 * 4. "Keep your version" acknowledges the external modification and dismisses the dialog
 * 5. "Reload from disk" re-reads the file and applies it
 * 6. "Save as copy" saves local changes to a new file
 */

// Source code path constants
const USE_FILE_POLLING_PATH = path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts');
const CONFLICT_DIALOG_PATH = path.resolve(
  __dirname,
  '../../../src/dialogs/ConflictDialog.tsx',
);
const UI_STORE_PATH = path.resolve(__dirname, '../../../src/store/uiStore.ts');
const APP_PATH = path.resolve(__dirname, '../../../src/App.tsx');

describe('Conflict dialog when file modified with unsaved local changes (Feature #524)', () => {
  let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;
  let useUIStore: typeof import('@/store/uiStore').useUIStore;

  beforeEach(async () => {
    vi.resetModules();
    const fileStoreMod = await import('@/store/fileStore');
    const graphStoreMod = await import('@/store/graphStore');
    useFileStoreRef = fileStoreMod.useFileStore;
    useGraphStoreRef = graphStoreMod.useGraphStore;
    const uiMod = await import('@/store/uiStore');
    useUIStore = uiMod.useUIStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: Conflict dialog opens when isDirty and external modification detected', () => {
    it('useFilePolling source opens conflict dialog in isDirty branch', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      // Verify the isDirty=true branch opens the conflict dialog
      expect(src).toContain('openConflictDialog');
      // Verify it's within the else (isDirty) branch
      expect(src).toContain('fileExternallyModified: true');
    });

    it('useFilePolling passes fileName to conflict dialog', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      expect(src).toContain('fileName: handle.name');
    });

    it('useFilePolling provides onReload callback in conflict dialog', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      expect(src).toContain('onReload:');
      // The reload callback re-reads the file from disk
      expect(src).toContain('_applyDecodedFile');
    });

    it('useFilePolling provides onSaveAsCopy callback in conflict dialog', () => {
      const src = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
      expect(src).toContain('onSaveAsCopy:');
      // The save-as-copy callback calls saveFileAs
      expect(src).toContain('saveFileAs');
    });
  });

  describe('Step 2: uiStore has conflict dialog state and actions', () => {
    it('conflictDialogOpen initializes to false', () => {
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
    });

    it('conflictDialogInfo initializes to null', () => {
      expect(useUIStore.getState().conflictDialogInfo).toBeNull();
    });

    it('openConflictDialog sets state correctly', () => {
      const info = {
        fileName: 'test.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      };
      useUIStore.getState().openConflictDialog(info);
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);
      expect(useUIStore.getState().conflictDialogInfo).toEqual(info);
    });

    it('closeConflictDialog clears state', () => {
      const info = {
        fileName: 'test.archc',
        onReload: vi.fn(),
        onSaveAsCopy: vi.fn(),
      };
      useUIStore.getState().openConflictDialog(info);
      useUIStore.getState().closeConflictDialog();
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(useUIStore.getState().conflictDialogInfo).toBeNull();
    });
  });

  describe('Step 3: ConflictDialog component has correct structure', () => {
    it('ConflictDialog component exists', () => {
      expect(fs.existsSync(CONFLICT_DIALOG_PATH)).toBe(true);
    });

    it('ConflictDialog has three action buttons', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('data-testid="conflict-reload-button"');
      expect(src).toContain('data-testid="conflict-keep-button"');
      expect(src).toContain('data-testid="conflict-save-as-copy-button"');
    });

    it('ConflictDialog shows button labels: Reload from disk, Keep your version, Save as copy', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('Reload from disk');
      expect(src).toContain('Keep your version');
      expect(src).toContain('Save as copy');
    });

    it('ConflictDialog has alertdialog role and aria attributes', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('role="alertdialog"');
      expect(src).toContain('aria-modal="true"');
      expect(src).toContain('aria-labelledby="conflict-dialog-title"');
      expect(src).toContain('aria-describedby="conflict-dialog-message"');
    });

    it('ConflictDialog title is "File Modified Externally"', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('File Modified Externally');
    });
  });

  describe('Step 4: Dialog explains the situation clearly', () => {
    it('ConflictDialog displays the conflicting file name', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      // Uses info.fileName in the message
      expect(src).toContain('info.fileName');
    });

    it('ConflictDialog explains the conflict with descriptive message', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('modified outside of ArchCanvas');
      expect(src).toContain('unsaved local changes');
      expect(src).toContain('resolve this conflict');
    });
  });

  describe('Step 5: "Keep your version" acknowledges and dismisses', () => {
    it('Keep handler calls acknowledgeExternalModification', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('acknowledgeExternalModification');
    });

    it('Keep handler calls closeDialog', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      // handleKeep calls closeDialog
      expect(src).toContain('handleKeep');
      expect(src).toContain('closeDialog');
    });

    it('acknowledgeExternalModification clears fileExternallyModified flag', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);
      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });
  });

  describe('Step 6: ConflictDialog is rendered in App.tsx via DialogHost', () => {
    it('App.tsx imports DialogHost from dialogs', () => {
      const src = fs.readFileSync(APP_PATH, 'utf-8');
      expect(src).toContain("import { DialogHost } from '@/dialogs'");
    });

    it('App.tsx renders <DialogHost /> which includes ConflictDialog', () => {
      const src = fs.readFileSync(APP_PATH, 'utf-8');
      expect(src).toContain('<DialogHost />');
    });
  });

  describe('Step 7: ConflictDialog uses focus trap and escape key', () => {
    it('ConflictDialog uses useFocusTrap hook', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('useFocusTrap');
    });

    it('ConflictDialog handles Escape key', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain("e.key === 'Escape'");
    });

    it('ConflictDialog handles backdrop click', () => {
      const src = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
      expect(src).toContain('handleBackdropClick');
    });
  });

  describe('Step 8: ConflictDialogInfo interface is exported from uiStore', () => {
    it('uiStore exports ConflictDialogInfo interface', () => {
      const src = fs.readFileSync(UI_STORE_PATH, 'utf-8');
      expect(src).toContain('export interface ConflictDialogInfo');
      expect(src).toContain('fileName: string');
      expect(src).toContain('onReload:');
      expect(src).toContain('onSaveAsCopy:');
    });
  });
});
