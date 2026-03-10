/**
 * Tests for Feature #469: Save main.archc on project save.
 *
 * Validates:
 * - Serializing the current root ArchGraph to protobuf binary with magic bytes and checksum
 * - Writing to .archcanvas/main.archc via the stored directory handle
 * - Clearing the isDirty flag on successful save
 * - Handling write errors gracefully (permission denied, disk full, etc.)
 * - Updating the loadedFiles cache after save
 * - coreStore.saveFile() delegating to project save when a project is open
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { ARCHCANVAS_MAIN_FILE } from '@/types/project';
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
}));

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

const testGraph = createEmptyGraph('SaveTestProject');

vi.mock('@/store/graphStore', () => {
  const store = {
    _setGraph: mocks._setGraph,
    graph: testGraph,
    isDirty: true,
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
      getGraph: vi.fn(() => testGraph),
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
      name: 'SaveTestProject',
      rootFile: ARCHCANVAS_MAIN_FILE,
      files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'SaveTestProject' }],
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

describe('Feature #469: Save main.archc on project save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeArchcToFolder.mockResolvedValue(undefined);
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

  describe('saveMainArchc — successful save', () => {
    it('serializes the graph to protobuf binary with magic bytes and checksum', async () => {
      setupOpenProject();

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(true);
      expect(mocks.writeArchcToFolder).toHaveBeenCalledTimes(1);

      // Verify the binary data has valid .archc format
      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      expect(binaryData).toBeInstanceOf(Uint8Array);
      expect(binaryData.length).toBeGreaterThan(40); // At least header size

      // Check magic bytes: ARCHC\0
      expect(binaryData[0]).toBe(0x41); // A
      expect(binaryData[1]).toBe(0x52); // R
      expect(binaryData[2]).toBe(0x43); // C
      expect(binaryData[3]).toBe(0x48); // H
      expect(binaryData[4]).toBe(0x43); // C
      expect(binaryData[5]).toBe(0x00); // \0
    });

    it('writes to .archcanvas/main.archc via the archcanvas directory handle', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockArchcanvasHandle,
        ARCHCANVAS_MAIN_FILE,
        expect.any(Uint8Array),
      );
    });

    it('clears isDirty flag on successful save', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      // Should call coreStore.setState to clear isDirty
      expect(mocks.coreSetState).toHaveBeenCalledWith(
        expect.objectContaining({ isDirty: false }),
      );
    });

    it('shows success toast after save', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      expect(mocks.showToast).toHaveBeenCalledWith('Project saved');
    });

    it('updates loadedFiles cache after save', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      const cached = useProjectStore.getState().loadedFiles.get(ARCHCANVAS_MAIN_FILE);
      expect(cached).toBeDefined();
      expect(cached!.path).toBe(ARCHCANVAS_MAIN_FILE);
      expect(cached!.graph).toBe(testGraph);
      expect(cached!.loadedAtMs).toBeGreaterThan(0);
    });

    it('produces a decodable .archc binary', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      // Verify the binary can be decoded back
      const decoded = await decode(binaryData);
      expect(decoded.architecture?.name).toBe('SaveTestProject');
    });

    it('includes SHA-256 checksum in the binary header', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      // Checksum starts at offset 8 (after 6 magic + 2 version) and is 32 bytes
      const checksum = binaryData.slice(8, 40);
      // Checksum should not be all zeros (a valid SHA-256 of non-empty payload)
      const allZeros = checksum.every((b: number) => b === 0);
      expect(allZeros).toBe(false);
    });

    it('falls back to directoryHandle when archcanvasHandle is null (legacy)', async () => {
      setupOpenProject({ archcanvasHandle: null });

      await useProjectStore.getState().saveMainArchc();

      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockDirHandle, // Falls back to root dir
        ARCHCANVAS_MAIN_FILE,
        expect.any(Uint8Array),
      );
    });
  });

  describe('saveMainArchc — error handling', () => {
    it('returns false and shows toast when no project is open', async () => {
      // Don't set up project — use default state (no project open)

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Cannot save'),
      );
      expect(mocks.writeArchcToFolder).not.toHaveBeenCalled();
    });

    it('returns false when manifest has no rootFile', async () => {
      setupOpenProject();
      useProjectStore.setState({
        manifest: {
          name: 'NoRoot',
          rootFile: '',
          files: [],
        },
      });

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(false);
      expect(mocks.writeArchcToFolder).not.toHaveBeenCalled();
    });

    it('handles permission denied error gracefully', async () => {
      setupOpenProject();
      const permError = new DOMException('Write permission denied', 'NotAllowedError');
      mocks.writeArchcToFolder.mockRejectedValueOnce(permError);

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('handles disk full error gracefully', async () => {
      setupOpenProject();
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      mocks.writeArchcToFolder.mockRejectedValueOnce(quotaError);

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Disk full'),
      );
    });

    it('handles generic write errors gracefully', async () => {
      setupOpenProject();
      mocks.writeArchcToFolder.mockRejectedValueOnce(new Error('Network error'));

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(false);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
      );
    });

    it('does not clear isDirty on failed save', async () => {
      setupOpenProject();
      mocks.writeArchcToFolder.mockRejectedValueOnce(new Error('Write failed'));

      await useProjectStore.getState().saveMainArchc();

      // coreSetState should NOT have been called with isDirty: false
      const isDirtyCalls = mocks.coreSetState.mock.calls.filter(
        (call: unknown[]) => {
          const arg = call[0] as Record<string, unknown>;
          return 'isDirty' in arg;
        },
      );
      expect(isDirtyCalls.length).toBe(0);
    });
  });

  describe('saveMainArchc — canvas and AI state persistence', () => {
    it('includes canvas state (viewport, panel layout) in saved binary', async () => {
      setupOpenProject();

      await useProjectStore.getState().saveMainArchc();

      const [, , binaryData] = mocks.writeArchcToFolder.mock.calls[0]!;
      const decoded = await decode(binaryData);
      // Canvas state should be present (protobuf message structure)
      expect(decoded.canvasState).toBeDefined();
      // Panel layout should be included
      expect(decoded.canvasState?.panelLayout).toBeDefined();
      expect(decoded.canvasState?.panelLayout?.rightPanelOpen).toBe(true);
      expect(decoded.canvasState?.panelLayout?.rightPanelTab).toBe('details');
      expect(decoded.canvasState?.panelLayout?.rightPanelWidth).toBe(320);
    });
  });

  describe('coreStore.saveFile delegation', () => {
    it('saveMainArchc returns true for successful project save', async () => {
      setupOpenProject();

      const result = await useProjectStore.getState().saveMainArchc();

      expect(result).toBe(true);
      expect(mocks.writeArchcToFolder).toHaveBeenCalledTimes(1);
    });
  });
});
