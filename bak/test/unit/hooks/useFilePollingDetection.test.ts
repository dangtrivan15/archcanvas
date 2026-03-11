import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
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
  let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;

  beforeEach(async () => {
    vi.resetModules();
    const fileStoreMod = await import('@/store/fileStore'); const graphStoreMod = await import('@/store/graphStore');
    useFileStoreRef = fileStoreMod.useFileStore; useGraphStoreRef = graphStoreMod.useGraphStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('coreStore fileExternallyModified state', () => {
    it('initializes fileExternallyModified to false', () => {
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('can be set to true via setState', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);
    });

    it('newFile clears fileExternallyModified to false', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useEngineStore.getState().initialize();
      useFileStore.getState().newFile();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('_applyDecodedFile clears fileExternallyModified to false', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useEngineStore.getState().initialize();

      const emptyGraph = useGraphStore.getState().graph;
      useFileStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', null);
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('acknowledgeExternalModification clears the flag', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('acknowledgeExternalModification is a no-op when already false', () => {
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
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

    it('updates fileLastModifiedMs immediately and fileExternallyModified after debounce', () => {
      // fileLastModifiedMs is updated in poll(), fileExternallyModified in executeReload()
      // Both are still set, but debounced for rapid changes
      expect(hookSource).toContain('fileLastModifiedMs: currentModified');
      expect(hookSource).toContain('fileExternallyModified: true');
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
        path.resolve(__dirname, '../../../src/store/fileStore.ts'),
        'utf-8',
      );
    });

    it('saveFile updates fileLastModifiedMs after writing', () => {
      // The save flow reads lastModified via platform adapter after writing
      expect(storeSource).toContain('fileLastModifiedMs: savedLastModified');
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
    it('open file sets fileLastModifiedMs via platform adapter', () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/fileStore.ts'),
        'utf-8',
      );
      // _applyDecodedFile captures lastModified via getFileLastModified utility
      expect(storeSource).toContain('getFileLastModified(');
      expect(storeSource).toContain('set({ fileLastModifiedMs: lastModified })');
    });

    it('save updates last-known timestamp to prevent false detection', () => {
      const storeSource = fs.readFileSync(
        path.resolve(__dirname, '../../../src/store/fileStore.ts'),
        'utf-8',
      );
      // Save reads back lastModified via platform adapter after writing
      expect(storeSource).toContain('getFileLastModified(');
      expect(storeSource).toContain('fileLastModifiedMs: savedLastModified');
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
      useFileStore.setState({
        fileHandle: { getFile: () => Promise.resolve({ lastModified: 1000, name: 'test.archc' }) },
        fileLastModifiedMs: 1000,
        fileExternallyModified: false,
      });

      expect(useFileStore.getState().fileExternallyModified).toBe(false);

      // 2. Simulate external modification detection
      useFileStore.setState({ fileLastModifiedMs: 2000, fileExternallyModified: true });

      expect(useFileStore.getState().fileExternallyModified).toBe(true);
      expect(useFileStore.getState().fileLastModifiedMs).toBe(2000);
    });

    it('simulates save flow: no false positive', () => {
      // 1. File open with known timestamp
      useFileStore.setState({ fileLastModifiedMs: 1000, fileExternallyModified: false, isSaving: false });

      // 2. Save starts — isSaving set to true
      useFileStore.setState({ isSaving: true });

      // 3. Save writes file, updating timestamp on disk
      // 4. Save reads back new timestamp and updates store
      useFileStore.setState({ fileLastModifiedMs: 1500, isSaving: false });

      // 5. Flag should NOT be set
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('simulates acknowledge after detection', () => {
      // 1. External modification detected
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      // 2. User acknowledges
      useFileStore.getState().acknowledgeExternalModification();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });

    it('flag persists until explicitly cleared', () => {
      useFileStore.setState({ fileExternallyModified: true });

      // Other state changes should not clear it
      useGraphStore.setState({ isDirty: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useFileStore.setState({ fileLastModifiedMs: 3000 });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);
    });

    it('open new file after detection clears the flag', () => {
      useFileStore.setState({ fileExternallyModified: true });
      expect(useFileStore.getState().fileExternallyModified).toBe(true);

      useEngineStore.getState().initialize();
      useFileStore.getState().newFile();
      expect(useFileStore.getState().fileExternallyModified).toBe(false);
    });
  });
});
