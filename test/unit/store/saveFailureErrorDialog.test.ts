/**
 * Tests for Feature #193: File save failure shows error toast.
 * Verifies that when saving fails, user sees an error notification,
 * isDirty remains true, and the error contains a meaningful message.
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

// Mock aiStore
vi.mock('@/store/aiStore', () => ({
  useAIStore: {
    getState: () => ({
      conversations: [],
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

describe('Feature #193: File save failure shows error toast', () => {
  beforeEach(() => {
    // Reset UI store
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
    });

    // Reset mock implementations
    mockSaveArchcFile.mockReset();
    mockSaveArchcFileAs.mockReset();
  });

  describe('saveFile() error handling', () => {
    it('shows error dialog when saveArchcFile throws', async () => {
      // Set up coreStore with a file handle (so it doesn't fall back to saveFileAs)
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      // Mock saveArchcFile to throw a permission error
      mockSaveArchcFile.mockRejectedValue(new Error('Permission denied: cannot write to file'));

      // Attempt save
      const result = await useCoreStore.getState().saveFile();

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
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      mockSaveArchcFile.mockRejectedValue(new Error('Disk full'));

      await useCoreStore.getState().saveFile();

      // isDirty should remain true (changes not lost)
      expect(useCoreStore.getState().isDirty).toBe(true);
    });

    it('error message includes the actual error description', async () => {
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      mockSaveArchcFile.mockRejectedValue(new Error('Network error: file system unavailable'));

      await useCoreStore.getState().saveFile();

      const info = useUIStore.getState().errorDialogInfo;
      expect(info?.message).toContain('Network error: file system unavailable');
    });

    it('handles non-Error thrown values gracefully', async () => {
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      // Throw a string instead of an Error object
      mockSaveArchcFile.mockRejectedValue('unexpected failure');

      await useCoreStore.getState().saveFile();

      const info = useUIStore.getState().errorDialogInfo;
      expect(info?.title).toBe('Save Failed');
      expect(info?.message).toContain('unexpected error');
    });
  });

  describe('saveFileAs() error handling', () => {
    it('shows error dialog when saveArchcFileAs throws', async () => {
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true,
        fileName: 'test.archc',
      });

      mockSaveArchcFileAs.mockRejectedValue(new Error('Failed to create writable stream'));

      const result = await useCoreStore.getState().saveFileAs();

      expect(result).toBe(false);

      const uiState = useUIStore.getState();
      expect(uiState.errorDialogOpen).toBe(true);
      expect(uiState.errorDialogInfo?.title).toBe('Save Failed');
      expect(uiState.errorDialogInfo?.message).toContain('Failed to create writable stream');
    });

    it('keeps isDirty true when save-as fails', async () => {
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true,
        fileName: 'test.archc',
      });

      mockSaveArchcFileAs.mockRejectedValue(new Error('Storage quota exceeded'));

      await useCoreStore.getState().saveFileAs();

      expect(useCoreStore.getState().isDirty).toBe(true);
    });

    it('does NOT show error when user cancels save picker', async () => {
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        isDirty: true,
        fileName: 'test.archc',
      });

      // Returning null means user cancelled
      mockSaveArchcFileAs.mockResolvedValue(null);

      const result = await useCoreStore.getState().saveFileAs();

      expect(result).toBe(false);

      // No error dialog should appear for cancel
      const uiState = useUIStore.getState();
      expect(uiState.errorDialogOpen).toBe(false);
      expect(uiState.errorDialogInfo).toBeNull();
    });
  });

  describe('user can retry save after failure', () => {
    it('subsequent save attempt succeeds after initial failure', async () => {
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      // First call fails
      mockSaveArchcFile.mockRejectedValueOnce(new Error('Temporary lock'));

      const result1 = await useCoreStore.getState().saveFile();
      expect(result1).toBe(false);
      expect(useUIStore.getState().errorDialogOpen).toBe(true);

      // Close the error dialog (user clicks OK)
      useUIStore.getState().closeErrorDialog();
      expect(useUIStore.getState().errorDialogOpen).toBe(false);

      // Second call succeeds
      mockSaveArchcFile.mockResolvedValueOnce(true);

      const result2 = await useCoreStore.getState().saveFile();
      expect(result2).toBe(true);
      expect(useCoreStore.getState().isDirty).toBe(false);

      // No error dialog should be open
      expect(useUIStore.getState().errorDialogOpen).toBe(false);
    });
  });

  describe('error dialog content quality', () => {
    it('title is "Save Failed" for all save errors', async () => {
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      mockSaveArchcFile.mockRejectedValue(new Error('any error'));
      await useCoreStore.getState().saveFile();

      expect(useUIStore.getState().errorDialogInfo?.title).toBe('Save Failed');
    });

    it('message starts with "Could not save the file:" for Error objects', async () => {
      const fakeHandle = {} as FileSystemFileHandle;
      useCoreStore.setState({
        graph: { name: 'Test', description: '', owners: [], nodes: [], edges: [] },
        fileHandle: fakeHandle,
        isDirty: true,
      });

      mockSaveArchcFile.mockRejectedValue(new Error('permission denied'));
      await useCoreStore.getState().saveFile();

      expect(useUIStore.getState().errorDialogInfo?.message).toMatch(/^Could not save the file:/);
    });
  });
});
