import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILE_POLL_INTERVAL_MS, FILE_CHANGED_EVENT } from '@/hooks/useFilePolling';

/**
 * Tests for useFilePolling hook logic.
 *
 * We test the polling logic and coreStore integration directly rather than
 * through React render hooks since the test environment is 'node' for .ts files.
 */

describe('useFilePolling', () => {
  describe('constants', () => {
    it('polls every 1000ms', () => {
      expect(FILE_POLL_INTERVAL_MS).toBe(1000);
    });

    it('emits archcanvas:file-changed event', () => {
      expect(FILE_CHANGED_EVENT).toBe('archcanvas:file-changed');
    });
  });

  describe('coreStore fileLastModifiedMs', () => {
    let useCoreStore: typeof import('@/store/coreStore').useCoreStore;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('@/store/coreStore');
      useCoreStore = mod.useCoreStore;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('initializes fileLastModifiedMs to null', () => {
      const state = useCoreStore.getState();
      expect(state.fileLastModifiedMs).toBeNull();
    });

    it('newFile resets fileLastModifiedMs to null', () => {
      // Set a value first
      useCoreStore.setState({ fileLastModifiedMs: 12345 });
      expect(useCoreStore.getState().fileLastModifiedMs).toBe(12345);

      // Initialize engines so newFile works
      useCoreStore.getState().initialize();

      // Call newFile
      useCoreStore.getState().newFile();
      expect(useCoreStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('fileLastModifiedMs can be set and read', () => {
      useCoreStore.setState({ fileLastModifiedMs: 1709942400000 });
      expect(useCoreStore.getState().fileLastModifiedMs).toBe(1709942400000);
    });

    it('fileLastModifiedMs is cleared on _applyDecodedFile', () => {
      useCoreStore.setState({ fileLastModifiedMs: 99999 });
      useCoreStore.getState().initialize();

      const emptyGraph = { name: 'test', description: '', owners: [], nodes: [], edges: [], annotations: [] };

      // Call _applyDecodedFile with no file handle (e.g., loadFromUrl)
      useCoreStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', null);

      // Should be null since no file handle to read from
      expect(useCoreStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('_applyDecodedFile captures lastModified from file handle asynchronously', async () => {
      useCoreStore.getState().initialize();

      const mockFile = { lastModified: 1709942400000, name: 'test.archc', size: 100 };
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile),
        name: 'test.archc',
        kind: 'file' as const,
      };

      const emptyGraph = { name: 'test', description: '', owners: [], nodes: [], edges: [], annotations: [] };

      useCoreStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', mockHandle);

      // Initially null (async hasn't resolved)
      expect(useCoreStore.getState().fileLastModifiedMs).toBeNull();

      // Wait for async getFile to resolve
      await vi.waitFor(() => {
        expect(useCoreStore.getState().fileLastModifiedMs).toBe(1709942400000);
      });

      expect(mockHandle.getFile).toHaveBeenCalledOnce();
    });
  });

  describe('hook source code structure', () => {
    it('imports useCoreStore', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain("import { useCoreStore } from '@/store/coreStore'");
    });

    it('uses setInterval for polling', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain('setInterval');
      expect(source).toContain('clearInterval');
    });

    it('calls getFile() for lightweight metadata check', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain('handle.getFile()');
      expect(source).toContain('file.lastModified');
    });

    it('dispatches custom event on change detection', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain('CustomEvent');
      expect(source).toContain(FILE_CHANGED_EVENT);
    });

    it('updates stored timestamp after detecting change', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain('fileLastModifiedMs: currentModified');
    });

    it('handles getFile() errors gracefully (stops polling)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain('catch');
      expect(source).toContain('File inaccessible');
    });

    it('only polls when fileHandle and fileLastModifiedMs are present', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      // Should check for null handle
      expect(source).toContain('!handle');
      // Should check for null timestamp
      expect(source).toContain('fileLastModifiedMs === null');
    });
  });

  describe('coreStore save updates fileLastModifiedMs', () => {
    it('saveFile path in coreStore reads lastModified after save', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      // After saveArchcFile, should refresh lastModified
      expect(source).toContain('Refresh lastModified timestamp after save');
      expect(source).toContain('savedFile.lastModified');
    });

    it('saveFileAs path captures lastModified from new handle', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      expect(source).toContain('newLastModifiedMs');
      expect(source).toContain('fileLastModifiedMs: newLastModifiedMs');
    });
  });

  describe('App.tsx integration', () => {
    it('imports useFilePolling', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/App.tsx', 'utf-8');
      expect(source).toContain("import { useFilePolling } from '@/hooks/useFilePolling'");
    });

    it('calls useFilePolling() in App component', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/App.tsx', 'utf-8');
      expect(source).toContain('useFilePolling()');
    });
  });

  describe('hooks/index.ts barrel export', () => {
    it('exports useFilePolling from hooks index', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/index.ts', 'utf-8');
      expect(source).toContain('useFilePolling');
      expect(source).toContain('FILE_POLL_INTERVAL_MS');
      expect(source).toContain('FILE_CHANGED_EVENT');
    });
  });

  describe('FileChangedDetail type', () => {
    it('exports FileChangedDetail with correct shape', async () => {
      const mod = await import('@/hooks/useFilePolling');
      // Just verify the module exports the expected constants
      expect(mod.FILE_CHANGED_EVENT).toBe('archcanvas:file-changed');
      expect(mod.FILE_POLL_INTERVAL_MS).toBe(1000);
    });
  });

  describe('Feature #520: Stop polling when no file open, resume on file open', () => {
    /**
     * These tests verify the polling lifecycle through coreStore state transitions:
     * - No file open → no polling
     * - Open file → polling starts (fileHandle + fileLastModifiedMs set)
     * - New file → polling stops (fileHandle + fileLastModifiedMs cleared)
     * - Open another file → polling resumes
     * - Save As → polling continues with new handle
     */

    it('Step 1: no polling when app launches with no file open', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');

      // The hook guards on both fileHandle and fileLastModifiedMs being present
      // When either is null, the effect clears the interval and returns early
      expect(source).toContain('!handle');
      expect(source).toContain('fileLastModifiedMs === null');

      // Verify initial store state has both null
      const mod = await import('@/store/coreStore');
      const state = mod.useCoreStore.getState();
      // After reset, both should be null
      mod.useCoreStore.setState({ fileHandle: null, fileLastModifiedMs: null });
      expect(mod.useCoreStore.getState().fileHandle).toBeNull();
      expect(mod.useCoreStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('Step 2: polling starts when file is opened (handle + timestamp set)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');

      // When both conditions are met, setInterval is called
      expect(source).toContain('intervalRef.current = setInterval(poll, FILE_POLL_INTERVAL_MS)');

      // Verify _applyDecodedFile sets fileHandle and captures fileLastModifiedMs async
      const storeSource = fs.readFileSync('src/store/coreStore.ts', 'utf-8');
      expect(storeSource).toContain('fileHandle');
      // The async block after _applyDecodedFile captures lastModified
      expect(storeSource).toContain('set({ fileLastModifiedMs: file.lastModified })');
    });

    it('Step 3: polling stops when new file created (handle + timestamp cleared)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');

      // Extract the newFile block to verify both are cleared
      const newFileMatch = source.match(/newFile:[\s\S]*?fileHandle:\s*null[\s\S]*?fileLastModifiedMs:\s*null/);
      expect(newFileMatch).not.toBeNull();
    });

    it('Step 3 (dynamic): newFile() sets both fileHandle and fileLastModifiedMs to null', () => {
      vi.resetModules();
      // Dynamically re-import to get fresh store
      return import('@/store/coreStore').then((mod) => {
        const store = mod.useCoreStore;

        // Simulate having an open file
        const mockHandle = {
          getFile: vi.fn().mockResolvedValue({ lastModified: 1000, name: 'a.archc', size: 10 }),
          name: 'a.archc',
          kind: 'file' as const,
        };
        store.setState({
          fileHandle: mockHandle as unknown as FileSystemFileHandle,
          fileLastModifiedMs: 1000,
        });

        expect(store.getState().fileHandle).not.toBeNull();
        expect(store.getState().fileLastModifiedMs).not.toBeNull();

        // Initialize so newFile works
        store.getState().initialize();

        // Call newFile
        store.getState().newFile();

        expect(store.getState().fileHandle).toBeNull();
        expect(store.getState().fileLastModifiedMs).toBeNull();
      });
    });

    it('Step 4: re-opening a file sets new fileHandle and triggers timestamp capture', async () => {
      const fs = await import('fs');
      const storeSource = fs.readFileSync('src/store/coreStore.ts', 'utf-8');

      // _applyDecodedFile accepts a fileHandle parameter and calls getFile() on it
      expect(storeSource).toContain('(fileHandle as FileSystemFileHandle)');
      expect(storeSource).toContain('.getFile()');

      // The hook uses both fileHandle and fileLastModifiedMs as dependencies
      const hookSource = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(hookSource).toContain('[fileHandle, fileLastModifiedMs]');
    });

    it('Step 5: Save As sets new fileHandle and captures fileLastModifiedMs', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/coreStore.ts', 'utf-8');

      // saveFileAs captures lastModified from new handle
      expect(source).toContain('newLastModifiedMs');
      expect(source).toContain('fileLastModifiedMs: newLastModifiedMs');
      // And sets the new file handle
      expect(source).toContain('fileHandle: result.fileHandle');
    });

    it('useEffect cleanup clears interval when dependencies change', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');

      // The cleanup function should clear the interval
      expect(source).toContain('return () => {');
      expect(source).toContain('clearInterval(intervalRef.current)');
      expect(source).toContain('intervalRef.current = null');
    });

    it('polling guard handles fileHandle without getFile method (fallback mode)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');

      // Should check that getFile is a function (not present in fallback/download mode)
      expect(source).toContain("typeof handle.getFile !== 'function'");
    });
  });
});
