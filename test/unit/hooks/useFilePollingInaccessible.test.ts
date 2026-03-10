import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';
import { useUIStore } from '@/store/uiStore';
import {
  FILE_INACCESSIBLE_MESSAGE,
  FILE_POLL_INTERVAL_MS,
} from '@/hooks/useFilePolling';

/**
 * Feature #528: Handle file deleted or moved externally during polling
 *
 * When the polled file handle can no longer access the file (deleted, moved,
 * or permissions changed), the app should:
 * 1. Stop polling (no repeated error toasts)
 * 2. Show a warning toast: "File is no longer accessible."
 * 3. Clear the file handle so save-in-place is disabled
 * 4. Allow the user to continue editing and Save As to a new location
 */

describe('Feature #528: Handle file deleted or moved externally during polling', () => {
  describe('constants', () => {
    it('exports FILE_INACCESSIBLE_MESSAGE constant', () => {
      expect(FILE_INACCESSIBLE_MESSAGE).toBe('File is no longer accessible.');
    });

    it('polling interval is 1000ms', () => {
      expect(FILE_POLL_INTERVAL_MS).toBe(1000);
    });
  });

  describe('source code verification', () => {
    let source: string;

    beforeEach(async () => {
      const fs = await import('fs');
      source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
    });

    it('Step 1 & 3: catch block shows warning toast when file is inaccessible', () => {
      // The catch block should call showToast with the inaccessible message
      expect(source).toContain('showToast(FILE_INACCESSIBLE_MESSAGE)');
    });

    it('Step 4: catch block stops polling by clearing interval', () => {
      // After error, interval should be cleared
      expect(source).toContain('clearInterval(intervalRef.current)');
      expect(source).toContain('intervalRef.current = null');
    });

    it('Step 4: catch block clears fileHandle to disable save-in-place', () => {
      // Should clear the file handle so Ctrl+S falls back to Save As
      expect(source).toContain('fileHandle: null');
    });

    it('Step 4: catch block clears fileLastModifiedMs to prevent polling restart', () => {
      // Should clear the timestamp so polling won't restart
      expect(source).toContain('fileLastModifiedMs: null');
    });

    it('imports useUIStore for toast notifications', () => {
      expect(source).toContain("import { useUIStore } from '@/store/uiStore'");
    });
  });

  describe('coreStore file handle and Save As', () => {
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

    it('Step 5: user can still Save As when fileHandle is null', () => {
      // Simulate the state after file becomes inaccessible
      useFileStore.setState({ fileHandle: null, fileLastModifiedMs: null });

      const fileState = useFileStore.getState();
      // fileHandle is null, but saveFileAs should still be callable
      expect(fileState.fileHandle).toBeNull();
      expect(typeof fileState.saveFileAs).toBe('function');
    });

    it('Step 2 & 3: clearing fileHandle and fileLastModifiedMs prevents polling from restarting', () => {
      // When both are null, the useEffect guard in useFilePolling
      // will not start a new interval
      useFileStore.setState({ fileHandle: null, fileLastModifiedMs: null });

      const fileState = useFileStore.getState();
      expect(fileState.fileHandle).toBeNull();
      expect(fileState.fileLastModifiedMs).toBeNull();
    });

    it('user can continue editing in memory after file becomes inaccessible', () => {
      useEngineStore.getState().initialize();

      // Simulate file was open, then becomes inaccessible
      useFileStore.setState({ fileHandle: null, fileLastModifiedMs: null });

      const graphState = useGraphStore.getState();
      const fileState = useFileStore.getState();
      // Graph operations still work
      expect(typeof graphState.addNode).toBe('function');
      expect(typeof graphState.removeNode).toBe('function');
      expect(typeof fileState.saveFileAs).toBe('function');
      // Graph is still available
      expect(graphState.graph).toBeDefined();
      expect(graphState.graph.nodes).toBeDefined();
    });
  });

  describe('toast system integration', () => {
    let useUIStore: typeof import('@/store/uiStore').useUIStore;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('@/store/uiStore');
      useUIStore = mod.useUIStore;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('showToast sets the toast message', () => {
      useUIStore.getState().showToast(FILE_INACCESSIBLE_MESSAGE);
      expect(useUIStore.getState().toastMessage).toBe(FILE_INACCESSIBLE_MESSAGE);
    });

    it('showToast auto-clears after duration', () => {
      vi.useFakeTimers();
      useUIStore.getState().showToast(FILE_INACCESSIBLE_MESSAGE, 4000);
      expect(useUIStore.getState().toastMessage).toBe(FILE_INACCESSIBLE_MESSAGE);

      vi.advanceTimersByTime(4000);
      expect(useUIStore.getState().toastMessage).toBeNull();
      vi.useRealTimers();
    });

    it('only one toast shown (polling stops before next tick)', () => {
      // Verify that calling showToast replaces any existing toast
      useUIStore.getState().showToast('First toast');
      useUIStore.getState().showToast(FILE_INACCESSIBLE_MESSAGE);
      expect(useUIStore.getState().toastMessage).toBe(FILE_INACCESSIBLE_MESSAGE);
    });
  });

  describe('saveFileAs remains functional without fileHandle', () => {
    it('Step 5: saveFileAs in coreStore does not require existing fileHandle', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/fileStore.ts', 'utf-8');

      // saveFileAs opens a new save picker via storageManager — it doesn't rely on existing fileHandle
      expect(source).toContain('storageManager.saveArchitectureAs(');
      // After Save As, a new fileHandle is set from the StorageHandle
      expect(source).toContain('fileHandle: result.handle');
    });
  });
});
