/**
 * Tests for Feature #215: Save button disabled during save operation.
 * Verifies that the Save and Save As buttons are disabled while a save
 * is in progress, show loading state, and re-enable after save completes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';

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

// Mock navigationStore as a Zustand-like hook (FileMenu calls it as a React hook)
vi.mock('@/store/navigationStore', () => {
  const state = {
    navigationPath: [],
    path: [],
    zoomToRoot: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomToLevel: vi.fn(),
  };
  const useNavigationStore = (selector?: any) => (selector ? selector(state) : state);
  useNavigationStore.getState = () => state;
  useNavigationStore.subscribe = vi.fn(() => vi.fn());
  return { useNavigationStore };
});

// Mock layout
vi.mock('@/core/layout/elkLayout', () => ({
  applyElkLayout: vi.fn(),
}));

// Now import the modules
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { useEngineStore } from '@/store/engineStore';
import { useHistoryStore } from '@/store/historyStore';
import { FileMenu } from '@/components/toolbar/FileMenu';
import { saveArchcFile, saveArchcFileAs } from '@/core/storage/fileIO';

const mockSaveArchcFile = vi.mocked(saveArchcFile);
const mockSaveArchcFileAs = vi.mocked(saveArchcFileAs);

describe('Feature #215: Save button disabled during save operation', () => {
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Helper to render FileMenu and open the dropdown
  function renderAndOpenMenu() {
    const result = render(<FileMenu />);
    const fileButton = screen.getByTestId('file-menu-button');
    fireEvent.click(fileButton);
    return result;
  }

  describe('Save button disabled state when isSaving is true', () => {
    it('Save button is enabled when isSaving is false', () => {
      useFileStore.setState({ isSaving: false });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).not.toBeDisabled();
    });

    it('Save button is disabled when isSaving is true', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeDisabled();
    });

    it('Save As button is enabled when isSaving is false', () => {
      useFileStore.setState({ isSaving: false });
      renderAndOpenMenu();

      const saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton).not.toBeDisabled();
    });

    it('Save As button is disabled when isSaving is true', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton).toBeDisabled();
    });
  });

  describe('Save button shows loading indicator when saving', () => {
    it('shows "Save" text when not saving', () => {
      useFileStore.setState({ isSaving: false });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton.textContent).toContain('Save');
      expect(saveButton.textContent).not.toContain('Saving...');
    });

    it('shows "Saving..." text when saving', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton.textContent).toContain('Saving...');
    });

    it('shows "Save As..." text when not saving', () => {
      useFileStore.setState({ isSaving: false });
      renderAndOpenMenu();

      const saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton.textContent).toContain('Save As...');
      expect(saveAsButton.textContent).not.toContain('Saving...');
    });

    it('shows "Saving..." text on Save As button when saving', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton.textContent).toContain('Saving...');
    });

    it('Save button has opacity-50 class when saving', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton.className).toContain('opacity-50');
    });

    it('Save button has cursor-not-allowed class when saving', () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton.className).toContain('cursor-not-allowed');
    });

    it('Save button does not have opacity-50 when not saving', () => {
      useFileStore.setState({ isSaving: false });
      renderAndOpenMenu();

      const saveButton = screen.getByTestId('save-button');
      expect(saveButton.className).not.toContain('opacity-50');
    });
  });

  describe('Clicking Save during save-in-progress has no effect', () => {
    it('clicking disabled Save button does not call saveFile', () => {
      // Set isSaving before rendering so button is disabled
      useFileStore.setState({ isSaving: true, fileHandle: fakeFileHandle });
      mockSaveArchcFile.mockResolvedValue(undefined);

      renderAndOpenMenu();
      const saveButton = screen.getByTestId('save-button');

      // Try clicking the disabled button
      fireEvent.click(saveButton);

      // saveArchcFile should not be called because the button is disabled
      // AND the store-level guard prevents concurrent saves
      expect(mockSaveArchcFile).not.toHaveBeenCalled();
    });

    it('clicking disabled Save As button does not call saveFileAs', () => {
      useFileStore.setState({ isSaving: true });
      mockSaveArchcFileAs.mockResolvedValue({ fileHandle: fakeFileHandle, fileName: 'test' });

      renderAndOpenMenu();
      const saveAsButton = screen.getByTestId('save-as-button');

      fireEvent.click(saveAsButton);

      expect(mockSaveArchcFileAs).not.toHaveBeenCalled();
    });
  });

  describe('Button re-enables after save completes', () => {
    it('Save button becomes enabled after isSaving changes to false', async () => {
      // Start with saving in progress
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      let saveButton = screen.getByTestId('save-button');
      expect(saveButton).toBeDisabled();

      // Simulate save completing
      await act(async () => {
        useFileStore.setState({ isSaving: false });
      });

      saveButton = screen.getByTestId('save-button');
      expect(saveButton).not.toBeDisabled();
    });

    it('Save As button becomes enabled after isSaving changes to false', async () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      let saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton).toBeDisabled();

      await act(async () => {
        useFileStore.setState({ isSaving: false });
      });

      saveAsButton = screen.getByTestId('save-as-button');
      expect(saveAsButton).not.toBeDisabled();
    });

    it('text changes back from "Saving..." to "Save" after completion', async () => {
      useFileStore.setState({ isSaving: true });
      renderAndOpenMenu();

      let saveButton = screen.getByTestId('save-button');
      expect(saveButton.textContent).toContain('Saving...');

      await act(async () => {
        useFileStore.setState({ isSaving: false });
      });

      saveButton = screen.getByTestId('save-button');
      expect(saveButton.textContent).toContain('Save');
      expect(saveButton.textContent).not.toContain('Saving...');
    });
  });

  describe('Full save lifecycle with disabled state', () => {
    it('Save button disables during save and re-enables after successful save', async () => {
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      mockSaveArchcFile.mockImplementation(async () => {
        await savePromise;
      });

      useGraphStore.setState({ isDirty: true }); useFileStore.setState({ fileHandle: fakeFileHandle, isSaving: false });

      renderAndOpenMenu();
      const saveButton = screen.getByTestId('save-button');

      // Button starts enabled
      expect(saveButton).not.toBeDisabled();
      expect(saveButton.textContent).toContain('Save');

      // Initiate save
      await act(async () => {
        fireEvent.click(saveButton);
      });

      // Button should now be disabled (isSaving became true in store)
      expect(useFileStore.getState().isSaving).toBe(true);

      // Complete the save
      await act(async () => {
        resolveSave!();
        // Small delay for store update
        await new Promise((r) => setTimeout(r, 0));
      });

      // After save completes, isSaving should be false
      expect(useFileStore.getState().isSaving).toBe(false);
    });

    it('Save button re-enables after failed save', async () => {
      mockSaveArchcFile.mockRejectedValue(new Error('Disk full'));

      useGraphStore.setState({ isDirty: true }); useFileStore.setState({ fileHandle: fakeFileHandle, isSaving: false });

      renderAndOpenMenu();

      // Initiate save that will fail
      await act(async () => {
        const saveButton = screen.getByTestId('save-button');
        fireEvent.click(saveButton);
        await new Promise((r) => setTimeout(r, 0));
      });

      // After error, isSaving should be false (re-enabled)
      expect(useFileStore.getState().isSaving).toBe(false);
    });
  });

  describe('Store-level isSaving guard integration', () => {
    it('saveFile returns false when isSaving is true', async () => {
      useFileStore.setState({ isSaving: true, fileHandle: fakeFileHandle });

      const result = await useFileStore.getState().saveFile();
      expect(result).toBe(false);
      expect(mockSaveArchcFile).not.toHaveBeenCalled();
    });

    it('saveFileAs returns false when isSaving is true', async () => {
      useFileStore.setState({ isSaving: true });

      const result = await useFileStore.getState().saveFileAs();
      expect(result).toBe(false);
      expect(mockSaveArchcFileAs).not.toHaveBeenCalled();
    });
  });
});
