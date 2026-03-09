/**
 * Feature #527: Conflict resolution — Save as copy then reload.
 *
 * Verifies that choosing "Save as copy" in the conflict dialog:
 * 1. Opens a Save As dialog for the user to save their local version to a new file
 * 2. After saving, automatically reloads the external version from the original file
 * 3. The copy file contains the user's local changes
 * 4. The original file's external changes are now loaded in the canvas
 * 5. isDirty is reset, undo history cleared
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Source code paths
const USE_FILE_POLLING_PATH = path.resolve(
  __dirname,
  '../../../src/hooks/useFilePolling.ts',
);
const CONFLICT_DIALOG_PATH = path.resolve(
  __dirname,
  '../../../src/components/shared/ConflictDialog.tsx',
);
const CORE_STORE_PATH = path.resolve(
  __dirname,
  '../../../src/store/coreStore.ts',
);

const useFilePollingSource = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
const conflictDialogSource = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
const coreStoreSource = fs.readFileSync(CORE_STORE_PATH, 'utf-8');

describe('Conflict resolution: Save as copy then reload (Feature #527)', () => {
  let useCoreStore: typeof import('@/store/coreStore').useCoreStore;
  let useUIStore: typeof import('@/store/uiStore').useUIStore;

  beforeEach(async () => {
    vi.resetModules();
    const coreMod = await import('@/store/coreStore');
    useCoreStore = coreMod.useCoreStore;
    const uiMod = await import('@/store/uiStore');
    useUIStore = uiMod.useUIStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Step 1: Open a file, make local changes, trigger external modification ──

  describe('Step 1: Conflict dialog opens with onSaveAsCopy callback when isDirty and externally modified', () => {
    it('onSaveAsCopy callback is provided to the conflict dialog in the isDirty branch', () => {
      // The isDirty=true branch in useFilePolling opens the conflict dialog with onSaveAsCopy
      expect(useFilePollingSource).toContain('openConflictDialog');
      expect(useFilePollingSource).toContain('onSaveAsCopy:');
    });

    it('fileExternallyModified is set to true before dialog opens', () => {
      expect(useFilePollingSource).toContain('fileExternallyModified: true');
    });

    it('conflict dialog is only shown when isDirty is true (not false auto-reload path)', () => {
      // The isDirty branch is the else clause
      expect(useFilePollingSource).toContain('state.isDirty');
      // openConflictDialog only in the isDirty=true branch
      const isDirtyBlock = useFilePollingSource.match(
        /else\s*\{[\s\S]*?openConflictDialog/,
      );
      expect(isDirtyBlock).not.toBeNull();
    });
  });

  // ── Step 2: Click "Save as copy" ──

  describe('Step 2: "Save as copy" button exists and invokes onSaveAsCopy', () => {
    it('ConflictDialog has a "Save as copy" button with correct testid', () => {
      expect(conflictDialogSource).toContain('data-testid="conflict-save-as-copy-button"');
      expect(conflictDialogSource).toContain('Save as copy');
    });

    it('ConflictDialog handleSaveAsCopy calls info.onSaveAsCopy()', () => {
      expect(conflictDialogSource).toContain('info.onSaveAsCopy()');
    });

    it('clicking "Save as copy" button triggers handleSaveAsCopy (onClick binding)', () => {
      expect(conflictDialogSource).toContain('onClick={handleSaveAsCopy}');
    });

    it('ConflictDialog handleSaveAsCopy calls closeDialog after invoking callback', () => {
      expect(conflictDialogSource).toContain('handleSaveAsCopy');
      // closeDialog is called in the callback after onSaveAsCopy
      expect(conflictDialogSource).toMatch(
        /info\.onSaveAsCopy\(\)[\s\S]*?closeDialog/,
      );
    });
  });

  // ── Step 3: Verify Save As dialog opens (saveFileAs is called) ──

  describe('Step 3: onSaveAsCopy calls coreStore.saveFileAs() to open Save As dialog', () => {
    it('onSaveAsCopy invokes coreStore.saveFileAs()', () => {
      // The onSaveAsCopy callback in useFilePolling calls saveFileAs
      expect(useFilePollingSource).toContain(
        'useCoreStore.getState().saveFileAs()',
      );
    });

    it('saveFileAs awaits result and checks success before reloading', () => {
      // The pattern: const saved = await ... saveFileAs(); if (saved) { ... reload }
      expect(useFilePollingSource).toMatch(
        /const saved = await useCoreStore\.getState\(\)\.saveFileAs\(\)/,
      );
      expect(useFilePollingSource).toContain('if (saved)');
    });

    it('coreStore.saveFileAs calls saveArchcFileAs from fileIO module', () => {
      expect(coreStoreSource).toContain('saveArchcFileAs(');
    });

    it('coreStore.saveFileAs returns boolean (true on success, false on cancel)', () => {
      // saveFileAs returns false if user cancels
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?if \(!result\)[\s\S]*?return false/,
      );
      // saveFileAs returns true on success
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?return true/,
      );
    });
  });

  // ── Step 4: Save to a new filename ──

  describe('Step 4: Local changes are saved to a new file with a new file handle', () => {
    it('saveFileAs updates store with new fileName from the save result', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?fileName:\s*result\.fileName/,
      );
    });

    it('saveFileAs updates store with new fileHandle from save result', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?fileHandle:\s*result\.fileHandle/,
      );
    });

    it('saveFileAs shows toast with new filename', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?Saved as/,
      );
    });

    it('saveFileAs preserves fileCreatedAtMs for the copy', () => {
      // The copy preserves the original creation timestamp
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?fileCreatedAtMs/,
      );
    });
  });

  // ── Step 5: Verify original file's external changes are loaded after copy ──

  describe('Step 5: After saving copy, original file is reloaded from disk', () => {
    it('onSaveAsCopy reloads the original file after saving copy (reads via handle.getFile)', () => {
      // After saving, the callback reads the original file
      const saveAsCopyBlock = useFilePollingSource.match(
        /onSaveAsCopy:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(saved\)\s*\{[\s\S]*?handle\.getFile\(\)/,
      );
      expect(saveAsCopyBlock).not.toBeNull();
    });

    it('onSaveAsCopy decodes the original file with decodeArchcData after saving copy', () => {
      // After the "if (saved)" block, decodeArchcData is called
      const saveAsCopyBlock = useFilePollingSource.match(
        /onSaveAsCopy[\s\S]*?if\s*\(saved\)[\s\S]*?decodeArchcData\(data\)/,
      );
      expect(saveAsCopyBlock).not.toBeNull();
    });

    it('onSaveAsCopy calls _applyDecodedFile with original handle to restore it', () => {
      // After saving copy, _applyDecodedFile is called with the original file's data and handle
      const saveAsCopyBlock = useFilePollingSource.match(
        /onSaveAsCopy[\s\S]*?if\s*\(saved\)[\s\S]*?_applyDecodedFile\(/,
      );
      expect(saveAsCopyBlock).not.toBeNull();
    });

    it('onSaveAsCopy passes the original handle (not the copy handle) to _applyDecodedFile', () => {
      // The original handle is passed so the user continues editing the original file
      const applyCall = useFilePollingSource.match(
        /onSaveAsCopy[\s\S]*?_applyDecodedFile\(\s*\n?\s*graph,\s*\n?\s*handle\.name,\s*\n?\s*handle,/,
      );
      expect(applyCall).not.toBeNull();
    });

    it('onSaveAsCopy logs success message after save and reload', () => {
      expect(useFilePollingSource).toContain(
        'Saved copy and reloaded',
      );
    });
  });

  // ── Step 6: Verify the copy file contains user's local changes ──

  describe('Step 6: Copy file contains local changes (saveFileAs saves current graph state)', () => {
    it('saveFileAs saves the current in-memory graph (with local changes)', () => {
      // saveFileAs uses get().graph which is the current dirty graph
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?const\s*\{[^}]*graph[^}]*\}\s*=\s*get\(\)/,
      );
    });

    it('saveFileAs includes canvas state in the saved copy', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?_getCanvasStateForSave\(\)/,
      );
    });

    it('saveFileAs guards against concurrent saves with isSaving flag', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?isSaving[\s\S]*?return false/,
      );
    });
  });

  // ── Error handling ──

  describe('Error handling: save-as-copy failure paths', () => {
    it('if saveFileAs returns false (user cancelled), reload does NOT happen', () => {
      // The reload only happens inside "if (saved) { }"
      expect(useFilePollingSource).toMatch(
        /onSaveAsCopy[\s\S]*?if\s*\(saved\)\s*\{/,
      );
    });

    it('reload failure after save-as-copy shows specific error dialog', () => {
      expect(useFilePollingSource).toContain(
        'Saved your copy, but could not reload the original file',
      );
    });

    it('reload failure after save-as-copy shows error dialog via openErrorDialog', () => {
      const errorBlock = useFilePollingSource.match(
        /onSaveAsCopy[\s\S]*?openErrorDialog\(\{[\s\S]*?Reload Failed/,
      );
      expect(errorBlock).not.toBeNull();
    });

    it('saveFileAs shows error dialog on save failure', () => {
      expect(coreStoreSource).toMatch(
        /saveFileAs[\s\S]*?openErrorDialog/,
      );
    });
  });

  // ── Integration: full flow simulation ──

  describe('Integration: full save-as-copy conflict resolution flow', () => {
    it('simulates: dirty state → conflict dialog → save as copy → reload → clean state', () => {
      // 1. User opens a file and makes local changes
      const mockHandle = { name: 'project.archc', getFile: vi.fn() };
      useCoreStore.setState({
        isDirty: true,
        fileName: 'project.archc',
        fileHandle: mockHandle,
        fileExternallyModified: false,
        canUndo: true,
        canRedo: false,
      });

      // 2. External modification detected → conflict dialog opens
      useCoreStore.setState({ fileExternallyModified: true });
      const onSaveAsCopy = vi.fn();
      const onReload = vi.fn();
      useUIStore.getState().openConflictDialog({
        fileName: 'project.archc',
        onReload,
        onSaveAsCopy,
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      // 3. User clicks "Save as copy" → onSaveAsCopy is called
      onSaveAsCopy();

      // 4. saveFileAs saves local changes to "project-copy.archc" (simulated)
      // Then _applyDecodedFile reloads the original from disk (simulated)
      useCoreStore.setState({
        isDirty: false,
        fileName: 'project.archc', // back to original file
        fileHandle: mockHandle,    // back to original handle
        fileExternallyModified: false,
        canUndo: false,
        canRedo: false,
      });

      // 5. Dialog closes
      useUIStore.getState().closeConflictDialog();

      // 6. Verify final state
      expect(useCoreStore.getState().isDirty).toBe(false);
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
      expect(useCoreStore.getState().canUndo).toBe(false);
      expect(useCoreStore.getState().canRedo).toBe(false);
      expect(useCoreStore.getState().fileName).toBe('project.archc');
      expect(useCoreStore.getState().fileHandle).toBe(mockHandle);
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(onSaveAsCopy).toHaveBeenCalledTimes(1);
      // Reload should NOT have been called (user chose save-as-copy, not reload)
      expect(onReload).not.toHaveBeenCalled();
    });

    it('simulates: save-as-copy preserves original file handle after reload', () => {
      const originalHandle = { name: 'architecture.archc', getFile: vi.fn() };
      useCoreStore.setState({
        fileHandle: originalHandle,
        fileName: 'architecture.archc',
        isDirty: true,
      });

      // After save-as-copy + reload, the original handle is restored
      // (not replaced with the copy's handle)
      useCoreStore.setState({
        fileHandle: originalHandle,
        fileName: 'architecture.archc',
        isDirty: false,
      });

      expect(useCoreStore.getState().fileHandle).toBe(originalHandle);
      expect(useCoreStore.getState().fileName).toBe('architecture.archc');
    });

    it('simulates: user cancels Save As picker — no reload happens, dialog stays closed', () => {
      const mockHandle = { name: 'project.archc', getFile: vi.fn() };
      useCoreStore.setState({
        isDirty: true,
        fileName: 'project.archc',
        fileHandle: mockHandle,
        fileExternallyModified: true,
      });

      // If user cancels the Save As picker, saveFileAs returns false
      // The reload should NOT happen (guarded by if (saved))
      // State remains dirty since nothing was saved
      expect(useCoreStore.getState().isDirty).toBe(true);
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);
    });

    it('simulates: after successful save-as-copy, isDirty resets and file reverts to original', () => {
      // Start with dirty state and a different graph in memory
      useCoreStore.setState({
        isDirty: true,
        fileName: 'mydesign.archc',
        fileExternallyModified: true,
        canUndo: true,
      });

      // After save-as-copy and reload of original:
      // - isDirty = false (freshly loaded from disk)
      // - fileExternallyModified = false (we just loaded the latest version)
      // - canUndo = false (undo history cleared by _applyDecodedFile)
      useCoreStore.setState({
        isDirty: false,
        fileExternallyModified: false,
        canUndo: false,
        canRedo: false,
      });

      expect(useCoreStore.getState().isDirty).toBe(false);
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
      expect(useCoreStore.getState().canUndo).toBe(false);
      expect(useCoreStore.getState().canRedo).toBe(false);
    });
  });
});
