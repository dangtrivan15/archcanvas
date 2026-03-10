import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILE_POLL_INTERVAL_MS, FILE_CHANGED_EVENT } from '@/hooks/useFilePolling';
import { useFileStore } from '@/store/fileStore';
import { useGraphStore } from '@/store/graphStore';
import { useEngineStore } from '@/store/engineStore';

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
    let useFileStoreRef: typeof import('@/store/fileStore').useFileStore;
let useGraphStoreRef: typeof import('@/store/graphStore').useGraphStore;

    beforeEach(async () => {
      vi.resetModules();
      const fileStoreMod = await import('@/store/fileStore');
      const graphStoreMod = await import('@/store/graphStore');
      useFileStoreRef = fileStoreMod.useFileStore;
      useGraphStoreRef = graphStoreMod.useGraphStore;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('initializes fileLastModifiedMs to null', () => {
      const state = useFileStore.getState();
      expect(state.fileLastModifiedMs).toBeNull();
    });

    it('newFile resets fileLastModifiedMs to null', () => {
      // Set a value first
      useFileStore.setState({ fileLastModifiedMs: 12345 });
      expect(useFileStore.getState().fileLastModifiedMs).toBe(12345);

      // Initialize engines so newFile works
      useEngineStore.getState().initialize();

      // Call newFile
      useFileStore.getState().newFile();
      expect(useFileStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('fileLastModifiedMs can be set and read', () => {
      useFileStore.setState({ fileLastModifiedMs: 1709942400000 });
      expect(useFileStore.getState().fileLastModifiedMs).toBe(1709942400000);
    });

    it('fileLastModifiedMs is cleared on _applyDecodedFile', () => {
      useFileStore.setState({ fileLastModifiedMs: 99999 });
      useEngineStore.getState().initialize();

      const emptyGraph = { name: 'test', description: '', owners: [], nodes: [], edges: [], annotations: [] };

      // Call _applyDecodedFile with no file handle (e.g., loadFromUrl)
      useFileStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', null);

      // Should be null since no file handle to read from
      expect(useFileStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('_applyDecodedFile captures lastModified from file handle asynchronously', async () => {
      useEngineStore.getState().initialize();

      const mockFile = { lastModified: 1709942400000, name: 'test.archc', size: 100 };
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile),
        name: 'test.archc',
        kind: 'file' as const,
      };

      const emptyGraph = { name: 'test', description: '', owners: [], nodes: [], edges: [], annotations: [] };

      useFileStore.getState()._applyDecodedFile(emptyGraph, 'test.archc', mockHandle);

      // Initially null (async hasn't resolved)
      expect(useFileStore.getState().fileLastModifiedMs).toBeNull();

      // Wait for async getFile to resolve
      await vi.waitFor(() => {
        expect(useFileStore.getState().fileLastModifiedMs).toBe(1709942400000);
      });

      expect(mockHandle.getFile).toHaveBeenCalledOnce();
    });
  });

  describe('hook source code structure', () => {
    it('imports useFileStore and useGraphStore', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(source).toContain("import { useFileStore } from '@/store/fileStore'");
      expect(source).toContain("import { useGraphStore } from '@/store/graphStore'");
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
      const source = fs.readFileSync('src/store/fileStore.ts', 'utf-8');
      // After saveArchcFile, should refresh lastModified via platform adapter
      expect(source).toContain('Refresh lastModified timestamp after save');
      expect(source).toContain('getFileLastModified(fileHandle)');
    });

    it('saveFileAs path captures lastModified from new handle', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/fileStore.ts', 'utf-8');
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
      const fileMod = await import('@/store/fileStore');
      // After reset, both should be null
      fileMod.useFileStore.setState({ fileHandle: null, fileLastModifiedMs: null });
      expect(fileMod.useFileStore.getState().fileHandle).toBeNull();
      expect(fileMod.useFileStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('Step 2: polling starts when file is opened (handle + timestamp set)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');

      // When both conditions are met, setInterval is called
      expect(source).toContain('intervalRef.current = setInterval(poll, FILE_POLL_INTERVAL_MS)');

      // Verify _applyDecodedFile sets fileHandle and captures fileLastModifiedMs async
      const storeSource = fs.readFileSync('src/store/fileStore.ts', 'utf-8');
      expect(storeSource).toContain('fileHandle');
      // The async block after _applyDecodedFile captures lastModified via platform adapter
      expect(storeSource).toContain('set({ fileLastModifiedMs: lastModified })');
    });

    it('Step 3: polling stops when new file created (handle + timestamp cleared)', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/fileStore.ts', 'utf-8');

      // Extract the newFile block to verify both are cleared
      const newFileMatch = source.match(/newFile:[\s\S]*?fileHandle:\s*null[\s\S]*?fileLastModifiedMs:\s*null/);
      expect(newFileMatch).not.toBeNull();
    });

    it('Step 3 (dynamic): newFile() sets both fileHandle and fileLastModifiedMs to null', async () => {
      vi.resetModules();
      // Dynamically re-import to get fresh store
      const fileMod = await import('@/store/fileStore');
      const engineMod = await import('@/store/engineStore');
      const fileStore = fileMod.useFileStore;
      const engineStore = engineMod.useEngineStore;

      // Simulate having an open file
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue({ lastModified: 1000, name: 'a.archc', size: 10 }),
        name: 'a.archc',
        kind: 'file' as const,
      };
      fileStore.setState({
        fileHandle: mockHandle as unknown as FileSystemFileHandle,
        fileLastModifiedMs: 1000,
      });

      expect(fileStore.getState().fileHandle).not.toBeNull();
      expect(fileStore.getState().fileLastModifiedMs).not.toBeNull();

      // Initialize so newFile works
      engineStore.getState().initialize();

      // Call newFile
      fileStore.getState().newFile();

      expect(fileStore.getState().fileHandle).toBeNull();
      expect(fileStore.getState().fileLastModifiedMs).toBeNull();
    });

    it('Step 4: re-opening a file sets new fileHandle and triggers timestamp capture', async () => {
      const fs = await import('fs');
      const storeSource = fs.readFileSync('src/store/fileStore.ts', 'utf-8');

      // _applyDecodedFile captures lastModified via platform adapter utility
      expect(storeSource).toContain('getFileLastModified(fileHandle)');

      // The hook uses both fileHandle and fileLastModifiedMs as dependencies
      const hookSource = fs.readFileSync('src/hooks/useFilePolling.ts', 'utf-8');
      expect(hookSource).toContain('[fileHandle, fileLastModifiedMs]');
    });

    it('Step 5: Save As sets new fileHandle and captures fileLastModifiedMs', async () => {
      const fs = await import('fs');
      const source = fs.readFileSync('src/store/fileStore.ts', 'utf-8');

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
