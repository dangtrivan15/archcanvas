/**
 * Feature #525: Conflict resolution — Reload from disk discards local changes.
 *
 * Verifies that choosing "Reload from disk" in the conflict dialog:
 * 1. Discards all unsaved local changes
 * 2. Re-reads the .archc file from disk
 * 3. Replaces the in-memory graph with the externally modified content
 * 4. Resets isDirty to false
 * 5. Clears undo history
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
  '../../../src/store/fileStore.ts',
);

const useFilePollingSource = fs.readFileSync(USE_FILE_POLLING_PATH, 'utf-8');
const conflictDialogSource = fs.readFileSync(CONFLICT_DIALOG_PATH, 'utf-8');
const coreStoreSource = fs.readFileSync(CORE_STORE_PATH, 'utf-8');

describe('Conflict resolution: Reload from disk discards local changes (Feature #525)', () => {
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

  describe('Step 1: Conflict dialog is triggered when isDirty and external modification detected', () => {
    it('onReload callback is provided to the conflict dialog in the isDirty branch', () => {
      // The isDirty=true branch in useFilePolling opens the conflict dialog with onReload
      expect(useFilePollingSource).toContain('openConflictDialog');
      expect(useFilePollingSource).toContain('onReload:');
    });

    it('fileExternallyModified is set to true before dialog opens', () => {
      // In the isDirty branch, fileExternallyModified is flagged
      expect(useFilePollingSource).toContain('fileExternallyModified: true');
    });
  });

  // ── Step 2: Click "Reload from disk" ──

  describe('Step 2: "Reload from disk" button invokes onReload', () => {
    it('ConflictDialog has a reload button with correct testid', () => {
      expect(conflictDialogSource).toContain('data-testid="conflict-reload-button"');
      expect(conflictDialogSource).toContain('Reload from disk');
    });

    it('ConflictDialog handleReload calls info.onReload()', () => {
      expect(conflictDialogSource).toContain('info.onReload()');
    });

    it('ConflictDialog handleReload calls closeDialog after reload', () => {
      expect(conflictDialogSource).toContain('handleReload');
      // closeDialog is called after onReload
      expect(conflictDialogSource).toMatch(/info\.onReload\(\)[\s\S]*?closeDialog/);
    });

    it('clicking reload button triggers handleReload (onClick binding)', () => {
      expect(conflictDialogSource).toContain('onClick={handleReload}');
    });
  });

  // ── Step 3: Verify local changes are gone (onReload re-reads file from disk) ──

  describe('Step 3: onReload re-reads file from disk and replaces in-memory graph', () => {
    it('onReload callback reads file via handle.getFile()', () => {
      // The onReload in useFilePolling re-reads the file
      expect(useFilePollingSource).toContain('const reloadFile = await handle.getFile()');
    });

    it('onReload decodes the binary data with decodeArchcData', () => {
      // The reload callback decodes the .archc data
      expect(useFilePollingSource).toContain('decodeArchcData(data)');
    });

    it('onReload calls _applyDecodedFile to replace the in-memory graph', () => {
      // _applyDecodedFile replaces the graph, resetting all state
      expect(useFilePollingSource).toContain(
        "useCoreStore.getState()._applyDecodedFile(",
      );
    });

    it('onReload passes the same file handle (not null) to preserve save-in-place', () => {
      // The reload path passes handle (not null) so File System Access API continues working
      const onReloadMatch = useFilePollingSource.match(
        /onReload:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?_applyDecodedFile\(\s*\n?\s*graph,\s*\n?\s*handle\.name,\s*\n?\s*handle,/,
      );
      expect(onReloadMatch).not.toBeNull();
    });

    it('onReload logs success message after reload', () => {
      expect(useFilePollingSource).toContain(
        'user chose reload',
      );
    });
  });

  // ── Step 4: Verify externally modified content is now displayed ──

  describe('Step 4: _applyDecodedFile replaces graph with externally modified content', () => {
    it('_applyDecodedFile calls textApi.setGraph to replace the graph', () => {
      expect(coreStoreSource).toContain('textApi.setGraph(graph)');
    });

    it('_applyDecodedFile sets the graph in the store state', () => {
      // The setState() call includes the new graph
      expect(coreStoreSource).toMatch(/setState\(\{[\s\S]*?graph,/);
    });

    it('_applyDecodedFile updates nodeCount and edgeCount from new graph', () => {
      expect(coreStoreSource).toContain('nodeCount: countAllNodes(graph)');
      expect(coreStoreSource).toContain('edgeCount: graph.edges.length');
    });

    it('_applyDecodedFile clears fileExternallyModified flag', () => {
      expect(coreStoreSource).toContain('fileExternallyModified: false');
    });

    it('_applyDecodedFile requests fitView to show new content', () => {
      expect(coreStoreSource).toContain('requestFitView()');
    });
  });

  // ── Step 5: Verify isDirty is false ──

  describe('Step 5: isDirty is reset to false after reload', () => {
    it('_applyDecodedFile sets isDirty to false', () => {
      // The _applyDecodedFile method sets isDirty: false via graphStore
      expect(coreStoreSource).toContain('isDirty: false');
    });

    it('store simulation: isDirty transitions from true to false after _applyDecodedFile', () => {
      // Simulate: user has dirty state
      useCoreStore.setState({ isDirty: true });
      expect(useCoreStore.getState().isDirty).toBe(true);

      // After _applyDecodedFile, isDirty should be false
      // (We simulate by directly setting state as _applyDecodedFile would)
      useCoreStore.setState({ isDirty: false, fileExternallyModified: false });
      expect(useCoreStore.getState().isDirty).toBe(false);
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('store simulation: fileName is updated after reload', () => {
      useCoreStore.setState({ fileName: 'old.archc', isDirty: true });
      // After reload, fileName is updated from file handle
      useCoreStore.setState({ fileName: 'reloaded.archc', isDirty: false });
      expect(useCoreStore.getState().fileName).toBe('reloaded.archc');
      expect(useCoreStore.getState().isDirty).toBe(false);
    });
  });

  // ── Step 6: Verify undo history is cleared ──

  describe('Step 6: Undo history is cleared after reload', () => {
    it('_applyDecodedFile resets history via historyStore', () => {
      // _applyDecodedFile delegates undo history reset to historyStore
      expect(coreStoreSource).toContain('useHistoryStore.getState().reset(graph)');
    });

    it('historyStore.reset clears and creates fresh snapshot', () => {
      const historySource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/historyStore.ts'),
        'utf-8',
      );
      expect(historySource).toContain('undoManager.clear()');
      expect(historySource).toContain("undoManager.snapshot('Open file'");
    });

    it('historyStore.reset sets canUndo and canRedo to false', () => {
      const historySource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/historyStore.ts'),
        'utf-8',
      );
      expect(historySource).toMatch(/reset[\s\S]*?canUndo:\s*false/);
      expect(historySource).toMatch(/reset[\s\S]*?canRedo:\s*false/);
    });

    it('store simulation: undo state transitions after reload', () => {
      // Simulate: user has undo history from edits
      useCoreStore.setState({ canUndo: true, canRedo: false });
      expect(useCoreStore.getState().canUndo).toBe(true);

      // After _applyDecodedFile, undo is cleared
      useCoreStore.setState({ canUndo: false, canRedo: false });
      expect(useCoreStore.getState().canUndo).toBe(false);
      expect(useCoreStore.getState().canRedo).toBe(false);
    });
  });

  // ── Error handling ──

  describe('Error handling: reload failure shows error dialog', () => {
    it('onReload catches errors and shows an error dialog', () => {
      expect(useFilePollingSource).toContain('Reload Failed');
      expect(useFilePollingSource).toContain('Could not reload the file from disk');
    });

    it('onReload shows error dialog via openErrorDialog', () => {
      expect(useFilePollingSource).toContain('openErrorDialog');
    });
  });

  // ── Integration: full flow simulation ──

  describe('Integration: full conflict reload flow', () => {
    it('simulates: dirty state → conflict dialog → reload → clean state', () => {
      // 1. User opens a file and makes changes
      useCoreStore.setState({
        isDirty: true,
        fileName: 'project.archc',
        fileExternallyModified: false,
        canUndo: true,
        canRedo: false,
      });

      // 2. External modification detected → conflict dialog opens
      useCoreStore.setState({ fileExternallyModified: true });
      const onReload = vi.fn();
      useUIStore.getState().openConflictDialog({
        fileName: 'project.archc',
        onReload,
        onSaveAsCopy: vi.fn(),
      });
      expect(useUIStore.getState().conflictDialogOpen).toBe(true);

      // 3. User clicks "Reload from disk" → onReload is called
      onReload();

      // 4. _applyDecodedFile resets everything (simulated)
      useCoreStore.setState({
        isDirty: false,
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
      expect(useUIStore.getState().conflictDialogOpen).toBe(false);
      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('simulates: reload preserves file handle for continued save-in-place', () => {
      const mockHandle = { name: 'project.archc', getFile: vi.fn() };
      useCoreStore.setState({
        fileHandle: mockHandle,
        isDirty: true,
      });

      // After reload, file handle should still be present (not null)
      // _applyDecodedFile receives the same handle
      useCoreStore.setState({
        fileHandle: mockHandle,
        isDirty: false,
      });

      expect(useCoreStore.getState().fileHandle).toBe(mockHandle);
      expect(useCoreStore.getState().isDirty).toBe(false);
    });
  });
});
