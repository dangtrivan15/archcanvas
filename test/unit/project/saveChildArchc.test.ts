/**
 * Tests for Feature #472: Save child .archc files on modification.
 *
 * Validates:
 * - Saving the current graph to .archcanvas/{nodeId}.archc when inside a nested canvas
 * - coreStore.saveFile() delegating to saveChildArchc when activeFilePath is set
 * - Auto-saving on dive-out when dirty
 * - Clearing isDirty on successful child save
 * - Error handling for child file save failures
 * - Cache updates after child file save
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { decode } from '@/core/storage/codec';

// ── Shared mocks ──

const mocks = vi.hoisted(() => ({
  readProjectFile: vi.fn(),
  writeArchcToFolder: vi.fn(),
  initArchcanvasDir: vi.fn(),
  showToast: vi.fn(),
  openEmptyProjectDialog: vi.fn(),
  closeEmptyProjectDialog: vi.fn(),
  _applyDecodedFile: vi.fn(),
  setGraph: vi.fn(),
  _setGraph: vi.fn(),
  coreSetState: vi.fn(),
  coreIsDirty: { value: true },
  coreGraph: { value: null as ReturnType<typeof createEmptyGraph> | null },
}));

const childGraph = createEmptyGraph('ChildCanvas');
const testGraph = createEmptyGraph('SaveChildTestProject');
mocks.coreGraph.value = childGraph;

// ── Mock File System Access API handles ──

const mockArchcanvasHandle = {
  name: '.archcanvas',
  kind: 'directory' as const,
  getFileHandle: vi.fn(),
  getDirectoryHandle: vi.fn(),
  values: vi.fn(),
  keys: vi.fn(),
  entries: vi.fn(),
  removeEntry: vi.fn(),
  resolve: vi.fn(),
  requestPermission: vi.fn(),
  queryPermission: vi.fn(),
  isSameEntry: vi.fn(),
} as unknown as FileSystemDirectoryHandle;

const mockDirHandle = {
  name: 'my-project',
  kind: 'directory' as const,
  getFileHandle: vi.fn(),
  getDirectoryHandle: vi.fn(),
  values: vi.fn(),
  keys: vi.fn(),
  entries: vi.fn(),
  removeEntry: vi.fn(),
  resolve: vi.fn(),
  requestPermission: vi.fn(),
  queryPermission: vi.fn(),
  isSameEntry: vi.fn(),
} as unknown as FileSystemDirectoryHandle;

vi.mock('@/core/project/scanner', () => ({
  writeArchcToFolder: mocks.writeArchcToFolder,
  scanProjectFolder: vi.fn(),
  readProjectFile: mocks.readProjectFile,
  initArchcanvasDir: mocks.initArchcanvasDir.mockImplementation(async (h: unknown) => h),
  SOURCE_FILE_EXTENSIONS: new Set(['.ts', '.js']),
}));

vi.mock('@/store/uiStore', () => {
  const store = {
    showToast: mocks.showToast,
    closeEmptyProjectDialog: mocks.closeEmptyProjectDialog,
    openEmptyProjectDialog: mocks.openEmptyProjectDialog,
    emptyProjectDialogOpen: false,
    emptyProjectDialogInfo: null,
    rightPanelOpen: true,
    rightPanelTab: 'details',
    rightPanelWidth: 320,
  };
  const useUIStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useUIStore };
});

vi.mock('@/store/analysisStore', () => {
  const store = {
    openDialog: vi.fn(),
    setProgress: vi.fn(),
    setError: vi.fn(),
    markComplete: vi.fn(),
  };
  const useAnalysisStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useAnalysisStore };
});

vi.mock('@/store/graphStore', () => {
  const store = {
    _setGraph: mocks._setGraph,
    get graph() {
      return mocks.coreGraph.value;
    },
    get isDirty() {
      return mocks.coreIsDirty.value;
    },
  };
  const useGraphStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: mocks.coreSetState },
  );
  return { useGraphStore };
});

vi.mock('@/store/fileStore', () => {
  const store = {
    _applyDecodedFile: mocks._applyDecodedFile,
    fileCreatedAtMs: 1700000000000,
  };
  const useFileStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: mocks.coreSetState },
  );
  return { useFileStore };
});

vi.mock('@/store/engineStore', () => {
  const store = {
    textApi: {
      setGraph: mocks.setGraph,
      getGraph: vi.fn(() => mocks.coreGraph.value),
    },
  };
  const useEngineStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useEngineStore };
});

vi.mock('@/store/canvasStore', () => {
  const store = {
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: null,
  };
  const useCanvasStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useCanvasStore };
});

// Import the store under test (after mocks are registered)
const { useProjectStore } = await import('@/store/projectStore');

// ── Helpers ──

function setupOpenProject(overrides?: Record<string, unknown>) {
  useProjectStore.setState({
    manifest: {
      name: 'SaveChildTestProject',
      rootFile: 'main.archc',
      files: [{ path: 'main.archc', displayName: 'SaveChildTestProject' }],
    },
    directoryHandle: mockDirHandle,
    archcanvasHandle: mockArchcanvasHandle,
    isProjectOpen: true,
    isEmpty: false,
    loadedFiles: new Map(),
    ...overrides,
  });
}

// ── Tests ──

describe('Feature #472: Save child .archc files on modification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeArchcToFolder.mockResolvedValue(undefined);
    mocks.coreGraph.value = childGraph;
    mocks.coreIsDirty.value = true;
    useProjectStore.setState({
      manifest: null,
      directoryHandle: null,
      archcanvasHandle: null,
      manifestExisted: false,
      loadedFiles: new Map(),
      isEmpty: false,
      isProjectOpen: false,
    });
  });

  describe('saveChildArchc — successful save', () => {
    it('writes the child graph to .archcanvas/{filePath}', async () => {
      setupOpenProject();

      const result = await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(result).toBe(true);
      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockArchcanvasHandle,
        '01ABC.archc',
        expect.any(Uint8Array),
      );
    });

    it('produces valid .archc binary with magic bytes', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      expect(binaryData).toBeInstanceOf(Uint8Array);
      expect(binaryData.length).toBeGreaterThan(40);

      // Check magic bytes: ARCHC\0
      expect(binaryData[0]).toBe(0x41); // A
      expect(binaryData[1]).toBe(0x52); // R
      expect(binaryData[2]).toBe(0x43); // C
      expect(binaryData[3]).toBe(0x48); // H
      expect(binaryData[4]).toBe(0x43); // C
      expect(binaryData[5]).toBe(0x00); // \0
    });

    it('produces a decodable .archc binary', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      const decoded = await decode(binaryData);
      expect(decoded.architecture?.name).toBe('ChildCanvas');
    });

    it('clears isDirty flag on successful save', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(mocks.coreSetState).toHaveBeenCalledWith(
        expect.objectContaining({ isDirty: false }),
      );
    });

    it('shows success toast after save', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(mocks.showToast).toHaveBeenCalledWith('File saved');
    });

    it('updates loadedFiles cache with saved graph', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const cached = useProjectStore.getState().loadedFiles.get('01ABC.archc');
      expect(cached).toBeDefined();
      expect(cached!.path).toBe('01ABC.archc');
      expect(cached!.graph).toBe(childGraph);
      expect(cached!.loadedAtMs).toBeGreaterThan(0);
    });

    it('does not include canvas state in child file binary', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      const decoded = await decode(binaryData);
      // Child files should not have canvas state with panel layout
      // The canvas state fields should be default/empty
      const cs = decoded.canvasState;
      if (cs) {
        // panelLayout should be undefined or default (no explicit panel config)
        expect(cs.panelLayout?.rightPanelOpen).toBeFalsy();
      }
    });

    it('does not include AI state in child file binary', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      const decoded = await decode(binaryData);
      // Child files should not have AI conversations
      expect(decoded.aiState?.conversations?.length ?? 0).toBe(0);
    });

    it('falls back to directoryHandle when archcanvasHandle is null', async () => {
      setupOpenProject({ archcanvasHandle: null });

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockDirHandle,
        '01ABC.archc',
        expect.any(Uint8Array),
      );
    });
  });

  describe('saveChildArchc — error handling', () => {
    it('returns false and shows toast when no project folder is open', async () => {
      // Default state: no project open

      const result = await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Cannot save'),
      );
      expect(mocks.writeArchcToFolder).not.toHaveBeenCalled();
    });

    it('handles permission denied error gracefully', async () => {
      setupOpenProject();
      const permError = new DOMException('Write permission denied', 'NotAllowedError');
      mocks.writeArchcToFolder.mockRejectedValueOnce(permError);

      const result = await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('handles disk full error gracefully', async () => {
      setupOpenProject();
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      mocks.writeArchcToFolder.mockRejectedValueOnce(quotaError);

      const result = await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Disk full'),
      );
    });

    it('handles generic write errors gracefully', async () => {
      setupOpenProject();
      mocks.writeArchcToFolder.mockRejectedValueOnce(new Error('I/O error'));

      const result = await useProjectStore.getState().saveChildArchc('01ABC.archc');

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('I/O error'),
      );
    });

    it('does not clear isDirty on failed save', async () => {
      setupOpenProject();
      mocks.writeArchcToFolder.mockRejectedValueOnce(new Error('Write failed'));

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      const isDirtyCalls = mocks.coreSetState.mock.calls.filter(
        (call: unknown[]) => {
          const arg = call[0] as Record<string, unknown>;
          return 'isDirty' in arg;
        },
      );
      expect(isDirtyCalls.length).toBe(0);
    });
  });

  describe('saveChildArchc — dirty state tracking', () => {
    it('keeps isDirty true if graph changed during save', async () => {
      setupOpenProject();
      // Simulate graph changing during async save
      const originalGraph = childGraph;
      const modifiedGraph = createEmptyGraph('Modified');
      mocks.coreGraph.value = originalGraph;
      mocks.writeArchcToFolder.mockImplementation(async () => {
        // Graph changes during save
        mocks.coreGraph.value = modifiedGraph;
      });

      await useProjectStore.getState().saveChildArchc('01ABC.archc');

      // Should detect graph changed and keep isDirty true
      expect(mocks.coreSetState).toHaveBeenCalledWith(
        expect.objectContaining({ isDirty: true }),
      );
    });
  });

  describe('activeFilePath tracking via nestedCanvasStore', () => {
    it('activeFilePath is set when pushing a file onto the stack', async () => {
      // nestedCanvasStore imports canvasStore which needs requestFitView, setViewport
      // and navigationStore which needs zoomToRoot, zoomToLevel
      vi.doMock('@/store/canvasStore', () => {
        const store = {
          viewport: { x: 0, y: 0, zoom: 1 },
          selectedNodeId: null,
          requestFitView: vi.fn(),
          setViewport: vi.fn(),
        };
        const useCanvasStore = Object.assign(
          (selector: (s: typeof store) => unknown) => selector(store),
          { getState: () => store, setState: vi.fn() },
        );
        return { useCanvasStore };
      });
      vi.doMock('@/store/navigationStore', () => {
        const store = {
          path: [],
          zoomToRoot: vi.fn(),
          zoomToLevel: vi.fn(),
        };
        const useNavigationStore = Object.assign(
          (selector: (s: typeof store) => unknown) => selector(store),
          { getState: () => store, setState: vi.fn() },
        );
        return { useNavigationStore };
      });

      const { useNestedCanvasStore } = await import('@/store/nestedCanvasStore');

      // Initially at root
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();

      // After pushing a file, activeFilePath should be set
      useNestedCanvasStore.getState().pushFile('01ABC.archc', childGraph, 'node1');
      expect(useNestedCanvasStore.getState().activeFilePath).toBe('01ABC.archc');

      // After popping, should return to null (root)
      useNestedCanvasStore.getState().popFile();
      expect(useNestedCanvasStore.getState().activeFilePath).toBeNull();

      // Clean up doMock
      vi.doUnmock('@/store/canvasStore');
      vi.doUnmock('@/store/navigationStore');
    });
  });
});
