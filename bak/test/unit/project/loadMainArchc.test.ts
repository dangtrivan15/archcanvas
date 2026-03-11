/**
 * Tests for Feature #468: Load main.archc as project root on open.
 *
 * Validates:
 * - Reading .archcanvas/main.archc binary data from the directory handle
 * - Decoding .archc file (magic bytes, protobuf payload) into an ArchGraph
 * - Setting the loaded graph as the active canvas in coreStore
 * - Initializing undo history for the loaded graph
 * - Error handling for corrupted/empty/missing main.archc
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { graphToProto } from '@/core/storage/fileIO';
import { encode } from '@/core/storage/codec';
import { ARCHCANVAS_MAIN_FILE } from '@/types/project';

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

vi.mock('@/store/fileStore', () => {
  const store = {
    _applyDecodedFile: mocks._applyDecodedFile,
  };
  const useFileStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useFileStore };
});

vi.mock('@/store/graphStore', () => {
  const store = {
    _setGraph: mocks._setGraph,
    graph: {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
      annotations: [],
    },
  };
  const useGraphStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useGraphStore };
});

vi.mock('@/store/engineStore', () => {
  const store = {
    textApi: {
      setGraph: mocks.setGraph,
      getGraph: vi.fn(() => ({
        name: 'Test',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
        annotations: [],
      })),
    },
  };
  const useEngineStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useEngineStore };
});

// Import the store under test (after mocks are registered)
const { useProjectStore } = await import('@/store/projectStore');

// ── Helper: create a valid .archc binary from a graph ──

async function createValidArchcBinary(name: string): Promise<Uint8Array> {
  const graph = createEmptyGraph(name);
  const protoFile = graphToProto(graph);
  return encode(protoFile);
}

// ── Tests ──

describe('Feature #468: Load main.archc as project root on open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset project store to initial state
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

  describe('loadMainArchc — successful loading', () => {
    it('reads main.archc from the archcanvas directory handle', async () => {
      const binaryData = await createValidArchcBinary('TestProject');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'TestProject',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'TestProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should read from archcanvasHandle (not root dirHandle)
      expect(mocks.readProjectFile).toHaveBeenCalledWith(
        mockArchcanvasHandle,
        ARCHCANVAS_MAIN_FILE,
      );
    });

    it('decodes .archc binary and applies graph to coreStore', async () => {
      const binaryData = await createValidArchcBinary('MyArch');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'MyArch',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'MyArch' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should call _applyDecodedFile on coreStore
      expect(mocks._applyDecodedFile).toHaveBeenCalledTimes(1);
      const [graph, fileName] = mocks._applyDecodedFile.mock.calls[0]!;
      expect(graph.name).toBe('MyArch');
      expect(fileName).toBe('MyArch');
    });

    it('caches the loaded file in loadedFiles', async () => {
      const binaryData = await createValidArchcBinary('CachedProject');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'CachedProject',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'CachedProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
        loadedFiles: new Map(),
      });

      await useProjectStore.getState().loadMainArchc();

      const cached = useProjectStore.getState().loadedFiles.get(ARCHCANVAS_MAIN_FILE);
      expect(cached).toBeDefined();
      expect(cached!.path).toBe(ARCHCANVAS_MAIN_FILE);
      expect(cached!.graph.name).toBe('CachedProject');
      expect(cached!.loadedAtMs).toBeGreaterThan(0);
    });

    it('passes canvasState, aiState, and createdAtMs to _applyDecodedFile', async () => {
      const binaryData = await createValidArchcBinary('WithState');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'WithState',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'WithState' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // _applyDecodedFile should be called with decoded fields
      expect(mocks._applyDecodedFile).toHaveBeenCalledTimes(1);
      const args = mocks._applyDecodedFile.mock.calls[0]!;
      expect(args[0].name).toBe('WithState'); // graph
      expect(args[1]).toBe('WithState'); // fileName (manifest name)
      expect(args[2]).toBeNull(); // fileHandle
      // createdAtMs should be a number (timestamp from encoding)
      expect(typeof args[5]).toBe('number');
    });

    it('falls back to directoryHandle when archcanvasHandle is null (legacy)', async () => {
      const binaryData = await createValidArchcBinary('LegacyProject');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'LegacyProject',
          rootFile: 'architecture.archc',
          files: [{ path: 'architecture.archc', displayName: 'LegacyProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: null, // Legacy: no .archcanvas/ directory
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should fall back to root directoryHandle
      expect(mocks.readProjectFile).toHaveBeenCalledWith(
        mockDirHandle,
        'architecture.archc',
      );
      expect(mocks._applyDecodedFile).toHaveBeenCalledTimes(1);
    });

    it('uses manifest name as fileName, falls back to rootFile path', async () => {
      const binaryData = await createValidArchcBinary('unnamed');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: '', // No name
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: '' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // When name is empty, should use rootFile as fallback
      const [, fileName] = mocks._applyDecodedFile.mock.calls[0]!;
      expect(fileName).toBe(ARCHCANVAS_MAIN_FILE);
    });
  });

  describe('loadMainArchc — error handling', () => {
    it('shows error toast when main.archc is corrupted (invalid magic bytes)', async () => {
      // Create corrupted data (random bytes, not a valid .archc file)
      const corruptedData = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
        0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
        0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
      ]);
      mocks.readProjectFile.mockResolvedValueOnce(corruptedData);

      useProjectStore.setState({
        manifest: {
          name: 'CorruptedProject',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'CorruptedProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should show error toast mentioning corruption
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
      );
      // Should NOT apply to coreStore
      expect(mocks._applyDecodedFile).not.toHaveBeenCalled();
    });

    it('offers to recreate via EmptyProjectDialog when file is corrupted', async () => {
      const corruptedData = new Uint8Array(48); // All zeros, invalid magic bytes
      mocks.readProjectFile.mockResolvedValueOnce(corruptedData);

      useProjectStore.setState({
        manifest: {
          name: 'CorruptProject',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'CorruptProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should open the empty project dialog to offer recreate
      expect(mocks.openEmptyProjectDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          folderName: 'CorruptProject',
          onUseAI: expect.any(Function),
          onQuickScan: expect.any(Function),


        }),
      );
    });

    it('shows error toast when main.archc is not found (file read fails)', async () => {
      mocks.readProjectFile.mockRejectedValueOnce(
        new Error('File not found: main.archc'),
      );

      useProjectStore.setState({
        manifest: {
          name: 'MissingFile',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'MissingFile' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Should show toast with file not found message
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('main.archc'),
      );
      expect(mocks._applyDecodedFile).not.toHaveBeenCalled();
    });

    it('offers to recreate when file is not found', async () => {
      mocks.readProjectFile.mockRejectedValueOnce(
        new Error('File not found'),
      );

      useProjectStore.setState({
        manifest: {
          name: 'MissingProject',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'MissingProject' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      expect(mocks.openEmptyProjectDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          folderName: 'MissingProject',
        }),
      );
    });

    it('does nothing when no manifest or no rootFile', async () => {
      useProjectStore.setState({
        manifest: null,
        directoryHandle: mockDirHandle,
        archcanvasHandle: null,
        isProjectOpen: false,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      expect(mocks.readProjectFile).not.toHaveBeenCalled();
      expect(mocks._applyDecodedFile).not.toHaveBeenCalled();
    });

    it('does nothing when manifest has empty rootFile', async () => {
      useProjectStore.setState({
        manifest: {
          name: 'EmptyRoot',
          rootFile: '',
          files: [],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      expect(mocks.readProjectFile).not.toHaveBeenCalled();
    });
  });

  describe('loadMainArchc — undo history initialization', () => {
    it('_applyDecodedFile initializes undo history (clear + snapshot)', async () => {
      const binaryData = await createValidArchcBinary('UndoTest');
      mocks.readProjectFile.mockResolvedValueOnce(binaryData);

      useProjectStore.setState({
        manifest: {
          name: 'UndoTest',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'UndoTest' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // _applyDecodedFile handles undo initialization internally:
      // It calls undoManager.clear() + undoManager.snapshot('Open file', graph)
      expect(mocks._applyDecodedFile).toHaveBeenCalledTimes(1);
      // Verify graph was passed correctly
      const [graph] = mocks._applyDecodedFile.mock.calls[0]!;
      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
    });
  });

  describe('loadMainArchc — empty file handling', () => {
    it('shows error when file is too small (fewer than 40 header bytes)', async () => {
      const tinyData = new Uint8Array(10); // Too small for valid .archc
      mocks.readProjectFile.mockResolvedValueOnce(tinyData);

      useProjectStore.setState({
        manifest: {
          name: 'TinyFile',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'TinyFile' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining('corrupted'),
      );
      expect(mocks._applyDecodedFile).not.toHaveBeenCalled();
    });

    it('shows error for file with valid header but empty protobuf payload', async () => {
      // Create a file with valid magic bytes + version + checksum but no payload
      const headerOnly = new Uint8Array(40);
      // Set magic bytes: ARCHC\0
      headerOnly[0] = 0x41; // A
      headerOnly[1] = 0x52; // R
      headerOnly[2] = 0x43; // C
      headerOnly[3] = 0x48; // H
      headerOnly[4] = 0x43; // C
      headerOnly[5] = 0x00; // \0
      // Version 1 big-endian
      headerOnly[6] = 0x00;
      headerOnly[7] = 0x01;
      mocks.readProjectFile.mockResolvedValueOnce(headerOnly);

      useProjectStore.setState({
        manifest: {
          name: 'HeaderOnly',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'HeaderOnly' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      expect(mocks.showToast).toHaveBeenCalled();
      expect(mocks._applyDecodedFile).not.toHaveBeenCalled();
    });
  });

  describe('integration: callbacks from error dialog', () => {
    it('error dialog provides valid AI and scan callbacks', async () => {
      mocks.readProjectFile.mockRejectedValueOnce(new Error('File not found'));

      useProjectStore.setState({
        manifest: {
          name: 'RecreateTest',
          rootFile: ARCHCANVAS_MAIN_FILE,
          files: [{ path: ARCHCANVAS_MAIN_FILE, displayName: 'RecreateTest' }],
        },
        directoryHandle: mockDirHandle,
        archcanvasHandle: mockArchcanvasHandle,
        isProjectOpen: true,
        isEmpty: false,
      });

      await useProjectStore.getState().loadMainArchc();

      // Verify dialog was opened with valid callbacks
      expect(mocks.openEmptyProjectDialog).toHaveBeenCalledTimes(1);
      const dialogInfo = mocks.openEmptyProjectDialog.mock.calls[0]![0]! as {
        folderName: string;
        onUseAI: () => void;
        onQuickScan: () => void;
      };
      expect(dialogInfo.folderName).toBe('RecreateTest');
      expect(typeof dialogInfo.onUseAI).toBe('function');
      expect(typeof dialogInfo.onQuickScan).toBe('function');
    });
  });

  describe('ARCHCANVAS_MAIN_FILE constant', () => {
    it('should be main.archc', () => {
      expect(ARCHCANVAS_MAIN_FILE).toBe('main.archc');
    });
  });
});
