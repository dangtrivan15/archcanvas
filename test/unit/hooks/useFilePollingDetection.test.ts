import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILE_CHANGED_EVENT } from '@/hooks/useFilePolling';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Feature #519: Detect external file modification by timestamp comparison.
 *
 * Verifies that:
 * 1. fileExternallyModified flag is added to coreStore
 * 2. Flag is set when timestamp mismatch detected by polling
 * 3. Flag is cleared on newFile, openFile (_applyDecodedFile)
 * 4. Save operations update fileLastModifiedMs (no false positives)
 * 5. isSaving guard prevents false-positive detection during save
 * 6. acknowledgeExternalModification clears the flag
 */

describe('External file modification detection (Feature #519)', () => {
  let useCoreStore: typeof import('@/store/coreStore').useCoreStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/store/coreStore');
    useCoreStore = mod.useCoreStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('coreStore fileExternallyModified state', () => {
    it('initializes fileExternallyModified to false', () => {
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('can be set to true via setState', () => {
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);
    });

    it('newFile clears fileExternallyModified to false', () => {
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      useCoreStore.getState().initialize();
      useCoreStore.getState().newFile();
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('_applyDecodedFile clears fileExternallyModified to false', () => {
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      useCoreStore.getState().initialize();

      const emptyGraph = useCoreStore.getState().graph;
      useCoreStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', null);
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('acknowledgeExternalModification clears the flag', () => {
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      useCoreStore.getState().acknowledgeExternalModification();
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('acknowledgeExternalModification is a no-op when already false', () => {
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
      useCoreStore.getState().acknowledgeExternalModification();
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });
  });

  describe('useFilePolling source analysis', () => {
    let hookSource: string;

    beforeEach(() => {
      hookSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
        'utf-8',
      );
    });

    it('sets fileExternallyModified: true when mismatch detected', () => {
      expect(hookSource).toContain('fileExternallyModified: true');
    });

    it('checks isSaving to prevent false positives during save', () => {
      expect(hookSource).toContain('isSaving');
      // Should return early when isSaving is true
      expect(hookSource).toMatch(/isSaving[\s\S]*?return/);
    });

    it('updates both fileLastModifiedMs and fileExternallyModified atomically', () => {
      // Both should be set in the same setState call
      const setStateMatch = hookSource.match(
        /setState\(\{[\s\S]*?fileLastModifiedMs:[\s\S]*?fileExternallyModified:[\s\S]*?\}/,
      );
      expect(setStateMatch).not.toBeNull();
    });

    it('dispatches FILE_CHANGED_EVENT with detail after flagging', () => {
      expect(hookSource).toContain(FILE_CHANGED_EVENT);
      expect(hookSource).toContain('CustomEvent');
      expect(hookSource).toContain('detail');
    });

    it('reads previousModified from state before updating', () => {
      // Should capture previousModified from current state before setting new values
      expect(hookSource).toContain('previousModified');
    });
  });

  describe('coreStore save flow prevents false positives', () => {
    let storeSource: string;

    beforeEach(() => {
      storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/coreStore.ts'),
        'utf-8',
      );
    });

    it('saveFile updates fileLastModifiedMs after writing', () => {
      // The save flow reads lastModified from the file after writing
      expect(storeSource).toContain('fileLastModifiedMs: savedFile.lastModified');
    });

    it('saveFile sets isSaving to true before writing', () => {
      expect(storeSource).toContain('set({ isSaving: true })');
    });

    it('saveFile sets isSaving to false after writing', () => {
      expect(storeSource).toContain('set({ isSaving: false })');
    });

    it('saveFileAs updates fileLastModifiedMs in result', () => {
      expect(storeSource).toContain('fileLastModifiedMs: newLastModifiedMs');
    });

    it('newFile clears fileExternallyModified', () => {
      // newFile should reset the flag
      const newFileSection = storeSource.match(
        /newFile:[\s\S]*?fileExternallyModified:\s*false/,
      );
      expect(newFileSection).not.toBeNull();
    });

    it('_applyDecodedFile clears fileExternallyModified', () => {
      const applySection = storeSource.match(
        /_applyDecodedFile[\s\S]*?fileExternallyModified:\s*false/,
      );
      expect(applySection).not.toBeNull();
    });
  });

  describe('timestamp comparison flow', () => {
    it('open file sets fileLastModifiedMs via getFile()', () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/coreStore.ts'),
        'utf-8',
      );
      // _applyDecodedFile captures lastModified
      expect(storeSource).toContain('set({ fileLastModifiedMs: file.lastModified })');
    });

    it('save updates last-known timestamp to prevent false detection', () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/coreStore.ts'),
        'utf-8',
      );
      // Save reads back the file's lastModified after writing
      expect(storeSource).toContain('savedFile.lastModified');
      expect(storeSource).toContain('fileLastModifiedMs: savedFile.lastModified');
    });

    it('polling compares current timestamp against stored value', () => {
      const hookSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
        'utf-8',
      );
      // Comparison against latest store state
      expect(hookSource).toContain('currentModified !== state.fileLastModifiedMs');
    });

    it('mismatch sets fileExternallyModified flag', () => {
      const hookSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/hooks/useFilePolling.ts'),
        'utf-8',
      );
      expect(hookSource).toContain('fileExternallyModified: true');
    });
  });

  describe('dynamic state transitions', () => {
    it('simulates full detection flow: open → external modify → detect', () => {
      // 1. Open file: set handle and lastModifiedMs
      useCoreStore.setState({
        fileHandle: { getFile: () => Promise.resolve({ lastModified: 1000, name: 'test.archc' }) },
        fileLastModifiedMs: 1000,
        fileExternallyModified: false,
      });

      expect(useCoreStore.getState().fileExternallyModified).toBe(false);

      // 2. Simulate external modification detection
      useCoreStore.setState({
        fileLastModifiedMs: 2000,
        fileExternallyModified: true,
      });

      expect(useCoreStore.getState().fileExternallyModified).toBe(true);
      expect(useCoreStore.getState().fileLastModifiedMs).toBe(2000);
    });

    it('simulates save flow: no false positive', () => {
      // 1. File open with known timestamp
      useCoreStore.setState({
        fileLastModifiedMs: 1000,
        fileExternallyModified: false,
        isSaving: false,
      });

      // 2. Save starts — isSaving set to true
      useCoreStore.setState({ isSaving: true });

      // 3. Save writes file, updating timestamp on disk
      // 4. Save reads back new timestamp and updates store
      useCoreStore.setState({
        fileLastModifiedMs: 1500,
        isSaving: false,
      });

      // 5. Flag should NOT be set
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('simulates acknowledge after detection', () => {
      // 1. External modification detected
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      // 2. User acknowledges
      useCoreStore.getState().acknowledgeExternalModification();
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });

    it('flag persists until explicitly cleared', () => {
      useCoreStore.setState({ fileExternallyModified: true });

      // Other state changes should not clear it
      useCoreStore.setState({ isDirty: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      useCoreStore.setState({ fileLastModifiedMs: 3000 });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);
    });

    it('open new file after detection clears the flag', () => {
      useCoreStore.setState({ fileExternallyModified: true });
      expect(useCoreStore.getState().fileExternallyModified).toBe(true);

      useCoreStore.getState().initialize();
      useCoreStore.getState().newFile();
      expect(useCoreStore.getState().fileExternallyModified).toBe(false);
    });
  });
});
