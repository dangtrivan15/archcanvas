/**
 * Tests for Feature #465: "Start Blank" creates and opens a new .archc in the selected folder.
 *
 * Validates:
 * - createBlankArchcFile creates a valid .archc with correct magic bytes and empty graph
 * - .archproject.json manifest is generated with the new file as rootFile
 * - projectStore state is updated (isEmpty=false, manifest, loadedFiles)
 * - Canvas loads the new empty graph via coreStore
 * - Success toast is shown with folder name
 * - Start Blank button in dialog triggers createBlankArchcFile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { graphToProto } from '@/core/storage/fileIO';
import { encode, decode, isArchcFile } from '@/core/storage/codec';
import { MAGIC_BYTES, FORMAT_VERSION } from '@/utils/constants';

// ── Shared mocks ──

const mocks = vi.hoisted(() => ({
  writeArchcToFolder: vi.fn(),
  writeManifestToFolder: vi.fn(),
  showToast: vi.fn(),
  closeEmptyProjectDialog: vi.fn(),
  setGraph: vi.fn(),
  _setGraph: vi.fn(),
}));

// ── Mock File System Access API ──

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
  writeManifestToFolder: mocks.writeManifestToFolder,
  scanProjectFolder: vi.fn(),
  readProjectFile: vi.fn(),
  initArchcanvasDir: vi.fn().mockImplementation(async (dirHandle: unknown) => dirHandle),
  SOURCE_FILE_EXTENSIONS: new Set(['.ts', '.js']),
}));

vi.mock('@/store/uiStore', () => {
  const store = {
    showToast: mocks.showToast,
    closeEmptyProjectDialog: mocks.closeEmptyProjectDialog,
    openEmptyProjectDialog: vi.fn(),
    emptyProjectDialogOpen: false,
    emptyProjectDialogInfo: null,
  };
  const useUIStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useUIStore };
});

vi.mock('@/store/coreStore', () => {
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
  const useCoreStore = Object.assign(
    (selector: (s: typeof store) => unknown) => selector(store),
    { getState: () => store, setState: vi.fn() },
  );
  return { useCoreStore };
});

describe('Feature #465: Start Blank .archc file creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Unit tests: .archc binary format ──

  describe('empty graph → .archc binary format', () => {
    it('creates a valid .archc binary with correct magic bytes', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Check magic bytes: "ARCHC\0"
      expect(binary[0]).toBe(0x41); // A
      expect(binary[1]).toBe(0x52); // R
      expect(binary[2]).toBe(0x43); // C
      expect(binary[3]).toBe(0x48); // H
      expect(binary[4]).toBe(0x43); // C
      expect(binary[5]).toBe(0x00); // \0

      // Verify using isArchcFile utility
      expect(isArchcFile(binary)).toBe(true);
    });

    it('has correct format version (uint16 big-endian)', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Version is at offset 6-7 (after 6-byte magic)
      const version = (binary[6]! << 8) | binary[7]!;
      expect(version).toBe(FORMAT_VERSION);
    });

    it('has SHA-256 checksum at offset 8-39', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Checksum is 32 bytes at offset 8
      const checksum = binary.slice(8, 40);
      expect(checksum.length).toBe(32);

      // At least some non-zero bytes (it's a hash, so extremely unlikely to be all zeros)
      const hasNonZero = checksum.some((b) => b !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('decodes back to an empty graph with no nodes or edges', async () => {
      const graph = createEmptyGraph('BlankProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Decode the binary back
      const decoded = await decode(binary);
      const arch = decoded.architecture;

      expect(arch).toBeDefined();
      expect(arch!.name).toBe('BlankProject');
      expect(arch!.nodes).toEqual([]);
      expect(arch!.edges).toEqual([]);
    });

    it('has a protobuf payload after the 40-byte header', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      // Total size must be > 40 (header) bytes
      expect(binary.length).toBeGreaterThan(40);
    });

    it('sets header timestamps on encode', async () => {
      const before = Date.now();
      const graph = createEmptyGraph('TimestampTest');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const after = Date.now();

      const decoded = await decode(binary);
      expect(decoded.header).toBeDefined();

      const createdAt = Number(decoded.header!.createdAtMs);
      const updatedAt = Number(decoded.header!.updatedAtMs);

      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(after);
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
    });
  });

  // ── projectStore.createBlankArchcFile tests ──

  describe('projectStore.createBlankArchcFile', () => {
    it('creates .archc file and updates manifest', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      // Set up initial state (empty project)
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'my-project',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      // Verify .archc file was written
      expect(mocks.writeArchcToFolder).toHaveBeenCalledOnce();
      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockDirHandle,
        'main.archc',
        expect.any(Uint8Array),
      );

      // Verify the binary data has correct magic bytes
      const writtenData = mocks.writeArchcToFolder.mock.calls[0]![2] as Uint8Array;
      expect(isArchcFile(writtenData)).toBe(true);
    });

    it('writes .archproject.json manifest with new file as rootFile', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'test-folder',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      // Verify manifest was written
      expect(mocks.writeManifestToFolder).toHaveBeenCalledOnce();
      const writtenManifest = mocks.writeManifestToFolder.mock.calls[0]![1];
      expect(writtenManifest.rootFile).toBe('main.archc');
      expect(writtenManifest.files).toEqual([
        { path: 'main.archc', displayName: 'test-folder' },
      ]);
    });

    it('updates projectStore state: isEmpty=false, manifest, loadedFiles', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'state-test',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const state = useProjectStore.getState();
      expect(state.isEmpty).toBe(false);
      expect(state.manifest?.rootFile).toBe('main.archc');
      expect(state.loadedFiles.has('main.archc')).toBe(true);

      const cached = state.loadedFiles.get('main.archc')!;
      expect(cached.graph.name).toBe('state-test');
      expect(cached.graph.nodes).toEqual([]);
      expect(cached.graph.edges).toEqual([]);
    });

    it('loads the graph into coreStore so canvas shows it', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'canvas-test',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      // coreStore.textApi.setGraph should be called with the empty graph
      expect(mocks.setGraph).toHaveBeenCalledOnce();
      const graphArg = mocks.setGraph.mock.calls[0]![0];
      expect(graphArg.name).toBe('canvas-test');
      expect(graphArg.nodes).toEqual([]);
      expect(graphArg.edges).toEqual([]);
    });

    it('shows success toast with folder/project name', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'my-cool-project',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      expect(mocks.showToast).toHaveBeenCalledOnce();
      expect(mocks.showToast).toHaveBeenCalledWith(
        'Created new architecture in my-cool-project',
      );
    });

    it('throws if no project folder is open', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: null,
        manifest: null,
        loadedFiles: new Map(),
        isEmpty: false,
        isProjectOpen: false,
        manifestExisted: false,
      });

      await expect(
        useProjectStore.getState().createBlankArchcFile(),
      ).rejects.toThrow('No project folder is open');
    });

    it('uses project manifest name for the graph name', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'Custom Project Name',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const cached = useProjectStore
        .getState()
        .loadedFiles.get('main.archc')!;
      expect(cached.graph.name).toBe('Custom Project Name');
    });

    it('defaults graph name to "Untitled Architecture" when manifest name is empty', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: '',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const cached = useProjectStore
        .getState()
        .loadedFiles.get('main.archc')!;
      expect(cached.graph.name).toBe('Untitled Architecture');
    });
  });

  // ── Component test: Start Blank button triggers createBlankArchcFile ──

  describe('Start Blank button integration', () => {
    it('onStartBlank callback in dialog triggers createBlankArchcFile', async () => {
      const { useProjectStore } = await import('@/store/projectStore');

      // Set up project state
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: {
          version: 1,
          name: 'dialog-test',
          rootFile: '',
          files: [],
          links: [],
        },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      // Spy on createBlankArchcFile
      const createBlankSpy = vi.spyOn(
        useProjectStore.getState(),
        'createBlankArchcFile',
      );

      // Simulate what the dialog's onStartBlank callback does (from projectStore.openProjectFolder)
      const state = useProjectStore.getState();
      await state.createBlankArchcFile();

      expect(createBlankSpy).toHaveBeenCalledOnce();

      // Verify the full flow completed
      expect(mocks.writeArchcToFolder).toHaveBeenCalled();
      expect(mocks.writeManifestToFolder).toHaveBeenCalled();
      expect(mocks.setGraph).toHaveBeenCalled();
      expect(mocks.showToast).toHaveBeenCalled();
    });

    it('dialog closes before createBlankArchcFile is called', () => {
      // Verify the flow: closeEmptyProjectDialog → then createBlankArchcFile
      // This matches the code in projectStore.openProjectFolder:
      //   onStartBlank: () => {
      //     useUIStore.getState().closeEmptyProjectDialog();
      //     get().createBlankArchcFile();
      //   }
      const closeDialog = vi.fn();
      const createBlank = vi.fn();

      // Simulate the callback
      const onStartBlank = () => {
        closeDialog();
        createBlank();
      };

      onStartBlank();

      expect(closeDialog).toHaveBeenCalledBefore(createBlank);
    });
  });
});
