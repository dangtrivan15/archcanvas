// @vitest-environment happy-dom
/**
 * Tests for Feature #212: Double-click save doesn't corrupt file.
 * Verifies that rapidly clicking Save twice (or pressing Ctrl+S twice)
 * doesn't produce a corrupted file. Only one save operation should run
 * at a time; the second click is silently ignored.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

// Mock the fileIO module before importing coreStore
vi.mock('@/core/storage/fileIO', async () => {
  const actual = await vi.importActual<typeof import('@/core/storage/fileIO')>('@/core/storage/fileIO');
  return {
    ...actual,
    saveArchcFile: vi.fn(),
    saveArchcFileAs: vi.fn(),
    openArchcFile: vi.fn(),
    pickArchcFile: vi.fn(),
    deriveSummaryFileName: actual.deriveSummaryFileName,
    saveSummaryMarkdown: vi.fn(),
    decodeArchcData: vi.fn(),
    protoToGraphFull: actual.protoToGraphFull,
    graphToProto: actual.graphToProto,
  };
});

// Mock canvasStore to avoid ReactFlow dependency
vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: null,
      setViewport: vi.fn(),
      requestFitView: vi.fn(),
    }),
  },
}));

// Mock navigationStore
vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: {
    getState: () => ({
      navigationPath: [],
    }),
  },
}));

// Mock aiStore
vi.mock('@/store/aiStore', () => ({
  useAIStore: {
    getState: () => ({
      conversations: [],
      clearConversations: vi.fn(),
      setConversations: vi.fn(),
    }),
  },
}));

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

// Now import the modules
import { useCoreStore } from '@/store/coreStore';
import { saveArchcFile, saveArchcFileAs } from '@/core/storage/fileIO';

const mockSaveArchcFile = vi.mocked(saveArchcFile);
const mockSaveArchcFileAs = vi.mocked(saveArchcFileAs);

describe('Feature #212: Double-click save does not corrupt file', () => {
  // Create a fake file handle for testing save-in-place
  const fakeFileHandle = { name: 'test.archc' } as any as FileSystemFileHandle;

  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      fileOperationLoading: false,
      fileOperationMessage: null,
    });

    // Reset mock implementations
    mockSaveArchcFile.mockReset();
    mockSaveArchcFileAs.mockReset();

    // Reset core store
    useCoreStore.setState({
      initialized: false,
      isDirty: false,
      isSaving: false,
      graph: { name: 'Test Architecture', description: '', owners: [], nodes: [], edges: [] },
      fileHandle: null,
      fileName: 'Untitled Architecture',
      fileCreatedAtMs: null,
      nodeCount: 0,
      edgeCount: 0,
      canUndo: false,
      canRedo: false,
    });
    useCoreStore.getState().initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSaving guard prevents concurrent saveFile() calls', () => {
    it('isSaving starts as false', () => {
      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('isSaving becomes true while save is in progress', async () => {
      // Make save take a while (never resolves in this test)
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);

      // Set up file handle so saveFile doesn't fall through to saveFileAs
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Start save (don't await)
      const saveResult = useCoreStore.getState().saveFile();

      // isSaving should be true while saving
      expect(useCoreStore.getState().isSaving).toBe(true);

      // Resolve to let it complete
      resolvePromise!(true);
      await saveResult;

      // isSaving should be false after saving completes
      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('second saveFile() call returns false while first is in progress', async () => {
      // Make save take a while
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);

      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Start first save
      const firstSave = useCoreStore.getState().saveFile();

      // Try second save immediately (should be rejected)
      const secondResult = await useCoreStore.getState().saveFile();
      expect(secondResult).toBe(false);

      // Resolve first save
      resolvePromise!(true);
      await firstSave;
    });

    it('saveArchcFile is called only once when save is triggered twice rapidly', async () => {
      // Make save resolve after a small delay
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);

      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Trigger two saves rapidly
      const firstSave = useCoreStore.getState().saveFile();
      const secondSave = useCoreStore.getState().saveFile();

      // Only one actual save call should have been made
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(1);

      resolvePromise!(true);
      await firstSave;
      await secondSave;

      // Still only one save call
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(1);
    });

    it('isSaving resets to false after successful save', async () => {
      mockSaveArchcFile.mockResolvedValue(true);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      await useCoreStore.getState().saveFile();

      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('isSaving resets to false after failed save', async () => {
      mockSaveArchcFile.mockRejectedValue(new Error('Disk full'));
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      await useCoreStore.getState().saveFile();

      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('can save again after first save completes', async () => {
      mockSaveArchcFile.mockResolvedValue(true);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // First save
      const first = await useCoreStore.getState().saveFile();
      expect(first).toBe(true);
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(1);

      // Second save after first completes should work
      useCoreStore.setState({ isDirty: true });
      const second = await useCoreStore.getState().saveFile();
      expect(second).toBe(true);
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(2);
    });

    it('can save again after first save fails', async () => {
      // First save fails
      mockSaveArchcFile.mockRejectedValueOnce(new Error('Disk full'));
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      const first = await useCoreStore.getState().saveFile();
      expect(first).toBe(false);

      // Second save should work
      mockSaveArchcFile.mockResolvedValueOnce(true);
      useCoreStore.setState({ isDirty: true });
      const second = await useCoreStore.getState().saveFile();
      expect(second).toBe(true);
    });
  });

  describe('isSaving guard prevents concurrent saveFileAs() calls', () => {
    it('second saveFileAs() call returns false while first is in progress', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFileAs.mockReturnValue(savePromise);

      // Start first save as
      const firstSave = useCoreStore.getState().saveFileAs();

      // Try second save as immediately (should be rejected)
      const secondResult = await useCoreStore.getState().saveFileAs();
      expect(secondResult).toBe(false);

      // Resolve first
      resolvePromise!({ fileHandle: fakeFileHandle, fileName: 'test.archc' });
      await firstSave;
    });

    it('saveArchcFileAs is called only once for rapid double-click', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFileAs.mockReturnValue(savePromise);

      // Trigger two saves rapidly
      const firstSave = useCoreStore.getState().saveFileAs();
      const secondSave = useCoreStore.getState().saveFileAs();

      // Only one actual save call
      expect(mockSaveArchcFileAs).toHaveBeenCalledTimes(1);

      resolvePromise!({ fileHandle: fakeFileHandle, fileName: 'test.archc' });
      await firstSave;
      await secondSave;

      expect(mockSaveArchcFileAs).toHaveBeenCalledTimes(1);
    });

    it('isSaving resets to false after saveFileAs user cancels', async () => {
      // User cancels the file picker
      mockSaveArchcFileAs.mockResolvedValue(null);

      await useCoreStore.getState().saveFileAs();

      expect(useCoreStore.getState().isSaving).toBe(false);
    });

    it('isSaving resets to false after saveFileAs error', async () => {
      mockSaveArchcFileAs.mockRejectedValue(new Error('Permission denied'));

      await useCoreStore.getState().saveFileAs();

      expect(useCoreStore.getState().isSaving).toBe(false);
    });
  });

  describe('cross-method save guard', () => {
    it('saveFileAs blocked while saveFile is in progress', async () => {
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Start saveFile
      const firstSave = useCoreStore.getState().saveFile();

      // Try saveFileAs while saveFile is running
      const secondResult = await useCoreStore.getState().saveFileAs();
      expect(secondResult).toBe(false);
      expect(mockSaveArchcFileAs).not.toHaveBeenCalled();

      resolvePromise!(true);
      await firstSave;
    });

    it('saveFile blocked while saveFileAs is in progress', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFileAs.mockReturnValue(savePromise);

      // Start saveFileAs
      const firstSave = useCoreStore.getState().saveFileAs();

      // Try saveFile while saveFileAs is running
      useCoreStore.setState({ fileHandle: fakeFileHandle });
      const secondResult = await useCoreStore.getState().saveFile();
      expect(secondResult).toBe(false);
      expect(mockSaveArchcFile).not.toHaveBeenCalled();

      resolvePromise!({ fileHandle: fakeFileHandle, fileName: 'test.archc' });
      await firstSave;
    });
  });

  describe('data integrity after save', () => {
    it('isDirty is correctly cleared after single save succeeds', async () => {
      mockSaveArchcFile.mockResolvedValue(true);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      await useCoreStore.getState().saveFile();

      expect(useCoreStore.getState().isDirty).toBe(false);
    });

    it('isDirty remains true when second save is rejected', async () => {
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // First save starts
      const firstSave = useCoreStore.getState().saveFile();

      // Second save is rejected (returns false, isDirty should still be true)
      const secondResult = await useCoreStore.getState().saveFile();
      expect(secondResult).toBe(false);
      expect(useCoreStore.getState().isDirty).toBe(true);

      // First save completes → isDirty cleared
      resolvePromise!(true);
      await firstSave;
      expect(useCoreStore.getState().isDirty).toBe(false);
    });

    it('graph state remains consistent after rapid save attempts', async () => {
      mockSaveArchcFile.mockResolvedValue(true);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      const graphBefore = useCoreStore.getState().graph;

      // Rapid saves
      await useCoreStore.getState().saveFile();

      const graphAfter = useCoreStore.getState().graph;
      // Graph should not be corrupted or modified by the save
      expect(graphAfter).toEqual(graphBefore);
    });

    it('three rapid saves only execute one save operation', async () => {
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Three rapid saves
      const save1 = useCoreStore.getState().saveFile();
      const save2 = useCoreStore.getState().saveFile();
      const save3 = useCoreStore.getState().saveFile();

      // Only one should actually call saveArchcFile
      expect(mockSaveArchcFile).toHaveBeenCalledTimes(1);

      // Save 2 and 3 should have returned false immediately
      expect(await save2).toBe(false);
      expect(await save3).toBe(false);

      resolvePromise!(true);
      expect(await save1).toBe(true);
    });
  });

  describe('console logging for rejected saves', () => {
    it('logs a message when duplicate save is rejected', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let resolvePromise: (value: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchcFile.mockReturnValue(savePromise);
      useCoreStore.setState({ fileHandle: fakeFileHandle, isDirty: true });

      // Start first save
      useCoreStore.getState().saveFile();

      // Try second save
      await useCoreStore.getState().saveFile();

      // Should have logged a rejection message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Save already in progress')
      );

      resolvePromise!(true);
      consoleSpy.mockRestore();
    });
  });
});
