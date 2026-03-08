/**
 * Integration tests for the browser analysis pipeline UI flow.
 *
 * Tests the connection between EmptyProjectDialog → analysisStore → browserPipeline
 * including progress tracking, cancellation, error handling, and graph loading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore } from '@/store/projectStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the browser pipeline
const mockAnalyzeCodebaseBrowser = vi.fn();
vi.mock('@/analyze/browserPipeline', () => ({
  analyzeCodebaseBrowser: (...args: unknown[]) => mockAnalyzeCodebaseBrowser(...args),
}));

// Mock AI client
vi.mock('@/ai/client', () => ({
  sendMessage: vi.fn().mockResolvedValue({
    content: '{"nodes":[],"edges":[]}',
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 50 },
  }),
}));

// Mock AI config
vi.mock('@/ai/config', () => ({
  getAnthropicApiKey: vi.fn().mockReturnValue('test-api-key'),
}));

// Mock coreStore
const mockTextApi = {
  getGraph: vi.fn().mockReturnValue({ name: 'Test', nodes: [], edges: [] }),
  setGraph: vi.fn(),
};
const mockRegistry = { resolveType: vi.fn() };
const mockSetGraph = vi.fn();

vi.mock('@/store/coreStore', () => ({
  useCoreStore: {
    getState: () => ({
      textApi: mockTextApi,
      registry: mockRegistry,
      _setGraph: mockSetGraph,
    }),
  },
}));

// Mock TextApi constructor
vi.mock('@/api/textApi', () => ({
  TextApi: vi.fn().mockImplementation((graph: unknown) => ({
    getGraph: () => graph,
    setGraph: vi.fn(),
  })),
}));

// Mock file I/O
vi.mock('@/core/project/scanner', () => ({
  scanProjectFolder: vi.fn(),
  readProjectFile: vi.fn(),
  writeArchcToFolder: vi.fn().mockResolvedValue(undefined),
  writeManifestToFolder: vi.fn().mockResolvedValue(undefined),
  initArchcanvasDir: vi.fn().mockImplementation(async (dirHandle: unknown) => dirHandle),
}));

vi.mock('@/core/storage/fileIO', () => ({
  decodeArchcData: vi.fn(),
  graphToProto: vi.fn().mockReturnValue({}),
}));

vi.mock('@/core/storage/codec', () => ({
  encode: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock('@/core/graph/graphEngine', () => ({
  createEmptyGraph: vi.fn().mockImplementation((name: string) => ({
    name,
    description: '',
    nodes: [],
    edges: [],
    owners: [],
  })),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

function createMockDirHandle(name = 'test-project'): FileSystemDirectoryHandle {
  return {
    name,
    kind: 'directory' as const,
    isSameEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    entries: vi.fn(),
    [Symbol.asyncIterator]: vi.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

const mockResultGraph = {
  name: 'Analyzed Project',
  description: 'A test project',
  nodes: [{ id: 'n1', type: 'service', displayName: 'API Service' }],
  edges: [],
  owners: [],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Analysis Pipeline Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    useAnalysisStore.setState({
      dialogOpen: false,
      progress: null,
      error: null,
      isRunning: false,
      abortController: null,
    });
    useUIStore.getState().closeEmptyProjectDialog();
  });

  afterEach(() => {
    useAnalysisStore.getState().closeDialog();
  });

  describe('runAnalysisPipeline', () => {
    it('should open the analysis progress dialog', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      // Dialog should have been opened (isRunning may be false now since it completed)
      // But markComplete was called, so check the final state
      const state = useAnalysisStore.getState();
      expect(state.isRunning).toBe(false);
      // The dialog stays open for "View Architecture" button
      expect(state.dialogOpen).toBe(true);
    });

    it('should pass progress events from pipeline to analysis store', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      const progressEvents: Array<{ phase: string; percent: number }> = [];

      mockAnalyzeCodebaseBrowser.mockImplementation(async (_dh: unknown, options: { onProgress?: (e: { phase: string; percent: number; message: string }) => void }) => {
        // Simulate progress events
        options.onProgress?.({ phase: 'scanning', message: 'Scanning...', percent: 10 });
        options.onProgress?.({ phase: 'detecting', message: 'Detecting...', percent: 30 });
        options.onProgress?.({ phase: 'complete', message: 'Done', percent: 100 });

        return {
          graph: mockResultGraph,
          stats: { nodes: 1, edges: 0, codeRefs: 0 },
          projectProfile: {},
          warnings: [],
          duration: 500,
        };
      });

      // Spy on setProgress to capture all calls
      const originalSetProgress = useAnalysisStore.getState().setProgress;
      const setProgressSpy = vi.fn(originalSetProgress);
      useAnalysisStore.setState({ setProgress: setProgressSpy });

      await useProjectStore.getState().runAnalysisPipeline();

      expect(setProgressSpy).toHaveBeenCalledTimes(3);
      expect(setProgressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'scanning', percent: 10 }),
      );
      expect(setProgressSpy).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'complete', percent: 100 }),
      );
    });

    it('should load the resulting graph into the canvas on success', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      // Core store should have the new graph
      expect(mockTextApi.setGraph).toHaveBeenCalledWith(mockResultGraph);
      expect(mockSetGraph).toHaveBeenCalledWith(mockResultGraph);
    });

    it('should update the project manifest with the generated file', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      const { writeManifestToFolder } = await import('@/core/project/scanner');
      expect(writeManifestToFolder).toHaveBeenCalledWith(
        dirHandle,
        expect.objectContaining({
          rootFile: 'main.archc',
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'main.archc' }),
          ]),
        }),
      );

      // isEmpty should be cleared
      expect(useProjectStore.getState().isEmpty).toBe(false);
    });

    it('should set error state when pipeline fails', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockRejectedValue(new Error('Scan failed: permission denied'));

      await useProjectStore.getState().runAnalysisPipeline();

      const state = useAnalysisStore.getState();
      expect(state.error).toBe('Scan failed: permission denied');
      expect(state.isRunning).toBe(false);
    });

    it('should not show error when pipeline is aborted by user', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockRejectedValue(new Error('Pipeline aborted'));

      await useProjectStore.getState().runAnalysisPipeline();

      // Error should not be set for user cancellation
      const state = useAnalysisStore.getState();
      expect(state.error).toBeNull();
    });

    it('should pass the abort signal to the pipeline', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      expect(mockAnalyzeCodebaseBrowser).toHaveBeenCalledWith(
        dirHandle,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should pass aiSender when API key is configured', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      expect(mockAnalyzeCodebaseBrowser).toHaveBeenCalledWith(
        dirHandle,
        expect.objectContaining({
          aiSender: expect.objectContaining({
            sendMessage: expect.any(Function),
          }),
        }),
      );
    });

    it('should pass undefined aiSender when no API key is configured', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      // Clear the API key
      const { getAnthropicApiKey } = await import('@/ai/config');
      vi.mocked(getAnthropicApiKey).mockReturnValue(undefined);

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      expect(mockAnalyzeCodebaseBrowser).toHaveBeenCalledWith(
        dirHandle,
        expect.objectContaining({
          aiSender: undefined,
        }),
      );

      // Restore
      vi.mocked(getAnthropicApiKey).mockReturnValue('test-api-key');
    });

    it('should show toast when no project folder is open', async () => {
      useProjectStore.setState({
        directoryHandle: null,
        manifest: null,
      });

      const showToast = vi.spyOn(useUIStore.getState(), 'showToast');

      await useProjectStore.getState().runAnalysisPipeline();

      expect(showToast).toHaveBeenCalledWith('No project folder is open.');
      expect(mockAnalyzeCodebaseBrowser).not.toHaveBeenCalled();
    });

    it('should cache the generated graph in loadedFiles', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
        loadedFiles: new Map(),
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      const cached = useProjectStore.getState().loadedFiles.get('main.archc');
      expect(cached).toBeDefined();
      expect(cached?.graph).toEqual(mockResultGraph);
    });

    it('should use folder name as architecture name', async () => {
      const dirHandle = createMockDirHandle('my-awesome-project');
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'my-awesome-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      await useProjectStore.getState().runAnalysisPipeline();

      expect(mockAnalyzeCodebaseBrowser).toHaveBeenCalledWith(
        dirHandle,
        expect.objectContaining({
          architectureName: 'my-awesome-project',
        }),
      );
    });
  });

  describe('Analysis Store', () => {
    it('should open dialog and create abort controller', () => {
      const controller = useAnalysisStore.getState().openDialog();

      expect(controller).toBeInstanceOf(AbortController);
      expect(useAnalysisStore.getState().dialogOpen).toBe(true);
      expect(useAnalysisStore.getState().isRunning).toBe(true);
      expect(useAnalysisStore.getState().error).toBeNull();
    });

    it('should abort on cancel', () => {
      const controller = useAnalysisStore.getState().openDialog();
      const abortSpy = vi.spyOn(controller, 'abort');

      useAnalysisStore.getState().cancel();

      expect(abortSpy).toHaveBeenCalled();
      expect(useAnalysisStore.getState().isRunning).toBe(false);
      expect(useAnalysisStore.getState().error).toBe('Analysis cancelled by user');
    });

    it('should clean up on close', () => {
      useAnalysisStore.getState().openDialog();
      useAnalysisStore.getState().setProgress({ phase: 'scanning', message: 'test', percent: 50 });

      useAnalysisStore.getState().closeDialog();

      const state = useAnalysisStore.getState();
      expect(state.dialogOpen).toBe(false);
      expect(state.progress).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.abortController).toBeNull();
    });

    it('should track progress updates', () => {
      useAnalysisStore.getState().openDialog();

      useAnalysisStore.getState().setProgress({
        phase: 'inferring',
        message: 'AI inference running...',
        percent: 60,
      });

      const state = useAnalysisStore.getState();
      expect(state.progress?.phase).toBe('inferring');
      expect(state.progress?.percent).toBe(60);
    });

    it('should mark complete correctly', () => {
      useAnalysisStore.getState().openDialog();
      useAnalysisStore.getState().markComplete();

      expect(useAnalysisStore.getState().isRunning).toBe(false);
      // Dialog stays open for "View Architecture" button
      expect(useAnalysisStore.getState().dialogOpen).toBe(true);
    });
  });

  describe('onAnalyze callback integration', () => {
    it('should close the empty project dialog and start pipeline', async () => {
      const dirHandle = createMockDirHandle();
      useProjectStore.setState({
        directoryHandle: dirHandle,
        manifest: { name: 'test-project', rootFile: '', files: [], links: [] },
      });

      mockAnalyzeCodebaseBrowser.mockResolvedValue({
        graph: mockResultGraph,
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {},
        warnings: [],
        duration: 1000,
      });

      // Simulate what happens when user clicks "Analyze Codebase"
      useUIStore.getState().openEmptyProjectDialog({
        folderName: 'test-project',
        hasSourceFiles: true,
        onAnalyze: () => {
          useUIStore.getState().closeEmptyProjectDialog();
          useProjectStore.getState().runAnalysisPipeline();
        },
        onStartBlank: vi.fn(),
      });

      // Verify dialog is open
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(true);

      // Trigger the onAnalyze callback
      const info = useUIStore.getState().emptyProjectDialogInfo;
      info?.onAnalyze();

      // Empty project dialog should be closed
      expect(useUIStore.getState().emptyProjectDialogOpen).toBe(false);
    });
  });
});
