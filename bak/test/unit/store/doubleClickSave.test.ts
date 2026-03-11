// @vitest-environment happy-dom
/**
 * Tests for Feature #212: Double-click save doesn't corrupt file.
 * Verifies that rapidly clicking Save twice (or pressing Ctrl+S twice)
 * doesn't produce a corrupted file. Only one save operation should run
 * at a time; the second click is silently ignored.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import type { StorageHandle } from '@/core/storage/types';

// Mock the fileIO module before importing coreStore
vi.mock('@/core/storage/fileIO', async () => {
  const actual =
    await vi.importActual<typeof import('@/core/storage/fileIO')>('@/core/storage/fileIO');
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

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

// Now import the modules
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';

// Create mock StorageManager functions
const mockSaveArchitecture = vi.fn();
const mockSaveArchitectureAs = vi.fn();

const mockStorageManager = {
  saveArchitecture: mockSaveArchitecture,
  saveArchitectureAs: mockSaveArchitectureAs,
  openArchitecture: vi.fn(),
  backendType: 'test',
  capabilities: { supportsDirectWrite: true, supportsLastModified: false },
};

// Create a fake StorageHandle for testing save-in-place
const fakeStorageHandle: StorageHandle = {
  backend: 'test',
  name: 'test.archc',
  _internal: { name: 'test.archc' },
};

describe('Feature #212: Double-click save does not corrupt file', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      fileOperationLoading: false,
      fileOperationMessage: null,
    });

    // Reset mock implementations
    mockSaveArchitecture.mockReset();
    mockSaveArchitectureAs.mockReset();

    // Reset core store
    useGraphStore.setState({
      isDirty: false,
      graph: { name: 'Test Architecture', description: '', owners: [], nodes: [], edges: [] },
      nodeCount: 0,
      edgeCount: 0
    });
    useFileStore.setState({
      isSaving: false,
      fileHandle: null,
      fileName: 'Untitled Architecture',
      fileCreatedAtMs: null
    });
    useEngineStore.setState({
      initialized: false
    });
    useHistoryStore.setState({
      canUndo: false,
      canRedo: false
    });
    useEngineStore.getState().initialize();
    // Inject mock storageManager after initialization
    useEngineStore.setState({ storageManager: mockStorageManager as any });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSaving guard prevents concurrent saveFile() calls', () => {
    it('isSaving starts as false', () => {
      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('isSaving becomes true while save is in progress', async () => {
      // Make save take a while (never resolves in this test)
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);

      // Set up file handle so saveFile doesn't fall through to saveFileAs
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Start save (don't await)
      const saveResult = useFileStore.getState().saveFile();

      // isSaving should be true while saving
      expect(useFileStore.getState().isSaving).toBe(true);

      // Resolve to let it complete
      resolvePromise!(fakeStorageHandle);
      await saveResult;

      // isSaving should be false after saving completes
      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('second saveFile() call returns false while first is in progress', async () => {
      // Make save take a while
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);

      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Start first save
      const firstSave = useFileStore.getState().saveFile();

      // Try second save immediately (should be rejected)
      const secondResult = await useFileStore.getState().saveFile();
      expect(secondResult).toBe(false);

      // Resolve first save
      resolvePromise!(fakeStorageHandle);
      await firstSave;
    });

    it('storageManager.saveArchitecture is called only once when save is triggered twice rapidly', async () => {
      // Make save resolve after a small delay
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);

      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Trigger two saves rapidly
      const firstSave = useFileStore.getState().saveFile();
      const secondSave = useFileStore.getState().saveFile();

      // Only one actual save call should have been made
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(1);

      resolvePromise!(fakeStorageHandle);
      await firstSave;
      await secondSave;

      // Still only one save call
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(1);
    });

    it('isSaving resets to false after successful save', async () => {
      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      await useFileStore.getState().saveFile();

      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('isSaving resets to false after failed save', async () => {
      mockSaveArchitecture.mockRejectedValue(new Error('Disk full'));
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      await useFileStore.getState().saveFile();

      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('can save again after first save completes', async () => {
      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // First save
      const first = await useFileStore.getState().saveFile();
      expect(first).toBe(true);
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(1);

      // Second save after first completes should work
      useGraphStore.setState({ isDirty: true });
      const second = await useFileStore.getState().saveFile();
      expect(second).toBe(true);
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(2);
    });

    it('can save again after first save fails', async () => {
      // First save fails
      mockSaveArchitecture.mockRejectedValueOnce(new Error('Disk full'));
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      const first = await useFileStore.getState().saveFile();
      expect(first).toBe(false);

      // Second save should work
      mockSaveArchitecture.mockResolvedValueOnce(fakeStorageHandle);
      useGraphStore.setState({ isDirty: true });
      const second = await useFileStore.getState().saveFile();
      expect(second).toBe(true);
    });
  });

  describe('isSaving guard prevents concurrent saveFileAs() calls', () => {
    it('second saveFileAs() call returns false while first is in progress', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitectureAs.mockReturnValue(savePromise);

      // Start first save as
      const firstSave = useFileStore.getState().saveFileAs();

      // Try second save as immediately (should be rejected)
      const secondResult = await useFileStore.getState().saveFileAs();
      expect(secondResult).toBe(false);

      // Resolve first
      resolvePromise!({ handle: fakeStorageHandle });
      await firstSave;
    });

    it('storageManager.saveArchitectureAs is called only once for rapid double-click', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitectureAs.mockReturnValue(savePromise);

      // Trigger two saves rapidly
      const firstSave = useFileStore.getState().saveFileAs();
      const secondSave = useFileStore.getState().saveFileAs();

      // Only one actual save call
      expect(mockSaveArchitectureAs).toHaveBeenCalledTimes(1);

      resolvePromise!({ handle: fakeStorageHandle });
      await firstSave;
      await secondSave;

      expect(mockSaveArchitectureAs).toHaveBeenCalledTimes(1);
    });

    it('isSaving resets to false after saveFileAs user cancels', async () => {
      // User cancels the file picker
      mockSaveArchitectureAs.mockResolvedValue(null);

      await useFileStore.getState().saveFileAs();

      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('isSaving resets to false after saveFileAs error', async () => {
      mockSaveArchitectureAs.mockRejectedValue(new Error('Permission denied'));

      await useFileStore.getState().saveFileAs();

      expect(useFileStore.getState().isSaving).toBe(false);
    });
  });

  describe('cross-method save guard', () => {
    it('saveFileAs blocked while saveFile is in progress', async () => {
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Start saveFile
      const firstSave = useFileStore.getState().saveFile();

      // Try saveFileAs while saveFile is running
      const secondResult = await useFileStore.getState().saveFileAs();
      expect(secondResult).toBe(false);
      expect(mockSaveArchitectureAs).not.toHaveBeenCalled();

      resolvePromise!(fakeStorageHandle);
      await firstSave;
    });

    it('saveFile blocked while saveFileAs is in progress', async () => {
      let resolvePromise: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitectureAs.mockReturnValue(savePromise);

      // Start saveFileAs
      const firstSave = useFileStore.getState().saveFileAs();

      // Try saveFile while saveFileAs is running
      useFileStore.setState({ fileHandle: fakeStorageHandle });
      const secondResult = await useFileStore.getState().saveFile();
      expect(secondResult).toBe(false);
      expect(mockSaveArchitecture).not.toHaveBeenCalled();

      resolvePromise!({ handle: fakeStorageHandle });
      await firstSave;
    });
  });

  describe('data integrity after save', () => {
    it('isDirty is correctly cleared after single save succeeds', async () => {
      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      await useFileStore.getState().saveFile();

      expect(useGraphStore.getState().isDirty).toBe(false);
    });

    it('isDirty remains true when second save is rejected', async () => {
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // First save starts
      const firstSave = useFileStore.getState().saveFile();

      // Second save is rejected (returns false, isDirty should still be true)
      const secondResult = await useFileStore.getState().saveFile();
      expect(secondResult).toBe(false);
      expect(useGraphStore.getState().isDirty).toBe(true);

      // First save completes → isDirty cleared
      resolvePromise!(fakeStorageHandle);
      await firstSave;
      expect(useGraphStore.getState().isDirty).toBe(false);
    });

    it('graph state remains consistent after rapid save attempts', async () => {
      mockSaveArchitecture.mockResolvedValue(fakeStorageHandle);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      const graphBefore = useGraphStore.getState().graph;

      // Rapid saves
      await useFileStore.getState().saveFile();

      const graphAfter = useGraphStore.getState().graph;
      // Graph should not be corrupted or modified by the save
      expect(graphAfter).toEqual(graphBefore);
    });

    it('three rapid saves only execute one save operation', async () => {
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Three rapid saves
      const save1 = useFileStore.getState().saveFile();
      const save2 = useFileStore.getState().saveFile();
      const save3 = useFileStore.getState().saveFile();

      // Only one should actually call saveArchitecture
      expect(mockSaveArchitecture).toHaveBeenCalledTimes(1);

      // Save 2 and 3 should have returned false immediately
      expect(await save2).toBe(false);
      expect(await save3).toBe(false);

      resolvePromise!(fakeStorageHandle);
      expect(await save1).toBe(true);
    });
  });

  describe('console logging for rejected saves', () => {
    it('logs a message when duplicate save is rejected', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let resolvePromise: (value: StorageHandle) => void;
      const savePromise = new Promise<StorageHandle>((resolve) => {
        resolvePromise = resolve;
      });
      mockSaveArchitecture.mockReturnValue(savePromise);
      useFileStore.setState({ fileHandle: fakeStorageHandle }); useGraphStore.setState({ isDirty: true });

      // Start first save
      useFileStore.getState().saveFile();

      // Try second save
      await useFileStore.getState().saveFile();

      // Should have logged a rejection message
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Save already in progress'));

      resolvePromise!(fakeStorageHandle);
      consoleSpy.mockRestore();
    });
  });
});
