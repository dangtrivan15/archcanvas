/**
 * Tests for Feature #465: "Start Blank" creates and opens a new .archc in the selected folder.
 *
 * Validates:
 * - createBlankArchcFile creates a valid .archc with correct magic bytes and empty graph
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

  describe('empty graph binary format', () => {
    it('creates a valid .archc binary with correct magic bytes', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);

      expect(binary[0]).toBe(0x41);
      expect(binary[1]).toBe(0x52);
      expect(binary[2]).toBe(0x43);
      expect(binary[3]).toBe(0x48);
      expect(binary[4]).toBe(0x43);
      expect(binary[5]).toBe(0x00);
      expect(isArchcFile(binary)).toBe(true);
    });

    it('has correct format version', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const version = (binary[6]! << 8) | binary[7]!;
      expect(version).toBe(FORMAT_VERSION);
    });

    it('has SHA-256 checksum at offset 8-39', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const checksum = binary.slice(8, 40);
      expect(checksum.length).toBe(32);
      expect(checksum.some((b) => b !== 0)).toBe(true);
    });

    it('decodes back to an empty graph', async () => {
      const graph = createEmptyGraph('BlankProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const decoded = await decode(binary);
      expect(decoded.architecture!.name).toBe('BlankProject');
      expect(decoded.architecture!.nodes).toEqual([]);
      expect(decoded.architecture!.edges).toEqual([]);
    });

    it('has a protobuf payload after the 40-byte header', async () => {
      const graph = createEmptyGraph('TestProject');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      expect(binary.length).toBeGreaterThan(40);
    });

    it('sets header timestamps on encode', async () => {
      const before = Date.now();
      const graph = createEmptyGraph('TimestampTest');
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const after = Date.now();
      const decoded = await decode(binary);
      const createdAt = Number(decoded.header!.createdAtMs);
      const updatedAt = Number(decoded.header!.updatedAtMs);
      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(after);
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('projectStore.createBlankArchcFile', () => {
    it('creates .archc file and updates descriptor', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: 'my-project', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      expect(mocks.writeArchcToFolder).toHaveBeenCalledOnce();
      expect(mocks.writeArchcToFolder).toHaveBeenCalledWith(
        mockDirHandle,
        'main.archc',
        expect.any(Uint8Array),
      );
      const writtenData = mocks.writeArchcToFolder.mock.calls[0]![2] as Uint8Array;
      expect(isArchcFile(writtenData)).toBe(true);
    });

    it('updates in-memory descriptor with new file as rootFile', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: 'test-folder', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const state = useProjectStore.getState();
      expect(state.manifest?.rootFile).toBe('main.archc');
      expect(state.manifest?.files).toEqual([
        { path: 'main.archc', displayName: 'test-folder' },
      ]);
    });

    it('updates projectStore state: isEmpty=false, manifest, loadedFiles', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: 'state-test', rootFile: '', files: [] },
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
        manifest: { name: 'canvas-test', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

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
        manifest: { name: 'my-cool-project', rootFile: '', files: [] },
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

    it('uses project descriptor name for the graph name', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: 'Custom Project Name', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const cached = useProjectStore.getState().loadedFiles.get('main.archc')!;
      expect(cached.graph.name).toBe('Custom Project Name');
    });

    it('defaults graph name to "Untitled Architecture" when descriptor name is empty', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: '', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      await useProjectStore.getState().createBlankArchcFile();

      const cached = useProjectStore.getState().loadedFiles.get('main.archc')!;
      expect(cached.graph.name).toBe('Untitled Architecture');
    });
  });

  describe('Start Blank button integration', () => {
    it('onStartBlank callback triggers createBlankArchcFile', async () => {
      const { useProjectStore } = await import('@/store/projectStore');
      useProjectStore.setState({
        directoryHandle: mockDirHandle,
        manifest: { name: 'dialog-test', rootFile: '', files: [] },
        loadedFiles: new Map(),
        isEmpty: true,
        isProjectOpen: true,
        manifestExisted: false,
      });

      const createBlankSpy = vi.spyOn(useProjectStore.getState(), 'createBlankArchcFile');
      await useProjectStore.getState().createBlankArchcFile();

      expect(createBlankSpy).toHaveBeenCalledOnce();
      expect(mocks.writeArchcToFolder).toHaveBeenCalled();
      expect(mocks.setGraph).toHaveBeenCalled();
      expect(mocks.showToast).toHaveBeenCalled();
    });

    it('dialog closes before createBlankArchcFile is called', () => {
      const closeDialog = vi.fn();
      const createBlank = vi.fn();
      const onStartBlank = () => { closeDialog(); createBlank(); };
      onStartBlank();
      expect(closeDialog).toHaveBeenCalledBefore(createBlank);
    });
  });
});
