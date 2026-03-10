// @vitest-environment happy-dom
/**
 * Tests for Feature #193: File save failure shows error toast.
 * Verifies that when saving fails, user sees an error notification,
 * isDirty remains true, and the error contains a meaningful message.
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
      selectedNodeIds: [],
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

// Create a fake StorageHandle
const fakeStorageHandle: StorageHandle = {
  backend: 'test',
  name: 'test.archc',
  _internal: {},
};

describe('Feature #193: File save failure shows error toast', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
    });

    // Reset mock implementations
    mockSaveArchitecture.mockReset();
    mockSaveArchitectureAs.mockReset();

    // Initialize engine and inject mock storageManager
    useEngineStore.setState({ initialized: false });
    useHistoryStore.setState({ canUndo: false, canRedo: false });
    useEngineStore.getState().initialize();
    useEngineStore.setState({ storageManager: mockStorageManager as any });
  });

  describe('saveFile() error handling', () => {
    it('shows error dialog when storageManager.saveArchitecture throws', async () => {
      // Set up coreStore with a file handle (so it doesn't fall back to saveFileAs)
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      // Mock saveArchitecture to throw a permission error
      mockSaveArchitecture.mockRejectedValue(new Error('Permission denied: cannot write to file'));

      // Attempt save
      const result = await useFileStore.getState().saveFile();

      // Should return false
      expect(result).toBe(false);

      // Error dialog should be open
      const uiState = useUIStore.getState();
      expect(uiState.errorDialogOpen).toBe(true);
      expect(uiState.errorDialogInfo).not.toBeNull();
      expect(uiState.errorDialogInfo?.title).toBe('Save Failed');
      expect(uiState.errorDialogInfo?.message).toContain('Permission denied');
    });

    it('keeps isDirty true when save fails', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      mockSaveArchitecture.mockRejectedValue(new Error('Disk full'));

      await useFileStore.getState().saveFile();

      // isDirty should remain true (changes not lost)
      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('error message includes the actual error description', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      mockSaveArchitecture.mockRejectedValue(new Error('Network error: file system unavailable'));

      await useFileStore.getState().saveFile();

      const info = useUIStore.getState().errorDialogInfo;
      expect(info?.message).toContain('Network error: file system unavailable');
    });

    it('handles non-Error thrown values gracefully', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      // Throw a string instead of an Error object
      mockSaveArchitecture.mockRejectedValue('unexpected failure');

      await useFileStore.getState().saveFile();

      const info = useUIStore.getState().errorDialogInfo;
      expect(info?.title).toBe('Save Failed');
      expect(info?.message).toContain('unexpected error');
    });
  });

  describe('saveFileAs() error handling', () => {
    it('shows error dialog when storageManager.saveArchitectureAs throws', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileName: 'test.archc'
      });

      mockSaveArchitectureAs.mockRejectedValue(new Error('Failed to create writable stream'));

      const result = await useFileStore.getState().saveFileAs();

      expect(result).toBe(false);

      const uiState = useUIStore.getState();
      expect(uiState.errorDialogOpen).toBe(true);
      expect(uiState.errorDialogInfo?.title).toBe('Save Failed');
      expect(uiState.errorDialogInfo?.message).toContain('Failed to create writable stream');
    });

    it('keeps isDirty true when save-as fails', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileName: 'test.archc'
      });

      mockSaveArchitectureAs.mockRejectedValue(new Error('Storage quota exceeded'));

      await useFileStore.getState().saveFileAs();

      expect(useGraphStore.getState().isDirty).toBe(true);
    });

    it('does NOT show error when user cancels save picker', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileName: 'test.archc'
      });

      // Returning null means user cancelled
      mockSaveArchitectureAs.mockResolvedValue(null);

      const result = await useFileStore.getState().saveFileAs();

      expect(result).toBe(false);

      // No error dialog should appear for cancel
      const uiState = useUIStore.getState();
      expect(uiState.errorDialogOpen).toBe(false);
      expect(uiState.errorDialogInfo).toBeNull();
    });
  });

  describe('user can retry save after failure', () => {
    it('subsequent save attempt succeeds after initial failure', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      // First call fails
      mockSaveArchitecture.mockRejectedValueOnce(new Error('Temporary lock'));

      const result1 = await useFileStore.getState().saveFile();
      expect(result1).toBe(false);
      expect(useUIStore.getState().errorDialogOpen).toBe(true);

      // Close the error dialog (user clicks OK)
      useUIStore.getState().closeErrorDialog();
      expect(useUIStore.getState().errorDialogOpen).toBe(false);

      // Second call succeeds
      mockSaveArchitecture.mockResolvedValueOnce(fakeStorageHandle);

      const result2 = await useFileStore.getState().saveFile();
      expect(result2).toBe(true);
      expect(useGraphStore.getState().isDirty).toBe(false);

      // No error dialog should be open
      expect(useUIStore.getState().errorDialogOpen).toBe(false);
    });
  });

  describe('error dialog content quality', () => {
    it('title is "Save Failed" for all save errors', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      mockSaveArchitecture.mockRejectedValue(new Error('any error'));
      await useFileStore.getState().saveFile();

      expect(useUIStore.getState().errorDialogInfo?.title).toBe('Save Failed');
    });

    it('message starts with "Could not save the file:" for Error objects', async () => {
      useGraphStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true
      });
      useFileStore.setState({
        fileHandle: fakeStorageHandle
      });

      mockSaveArchitecture.mockRejectedValue(new Error('permission denied'));
      await useFileStore.getState().saveFile();

      expect(useUIStore.getState().errorDialogInfo?.message).toMatch(/^Could not save the file:/);
    });
  });
});
