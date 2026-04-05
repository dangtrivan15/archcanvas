import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { performExport, ExportError } from '@/export';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';

describe('performExport — markdown', () => {
  const origFileStoreGetState = useFileStore.getState;
  const origNavStoreGetState = useNavigationStore.getState;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore if overridden
    if (useFileStore.getState !== origFileStoreGetState) {
      Object.defineProperty(useFileStore, 'getState', { value: origFileStoreGetState, writable: true });
    }
    if (useNavigationStore.getState !== origNavStoreGetState) {
      Object.defineProperty(useNavigationStore, 'getState', { value: origNavStoreGetState, writable: true });
    }
  });

  function mockStoresWithCanvas(projectName: string, canvas: unknown) {
    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: projectName } } } },
      getCanvas: () => canvas,
    } as unknown as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);
  }

  it('exports markdown successfully with nodes and edges', async () => {
    const mockCanvas = {
      data: {
        project: { name: 'TestProject' },
        nodes: [
          { id: 'api', type: 'core/service', displayName: 'API' },
          { id: 'db', type: 'core/database', displayName: 'DB' },
        ],
        edges: [
          { from: { node: 'api' }, to: { node: 'db' } },
        ],
      },
    };

    mockStoresWithCanvas('TestProject', mockCanvas);

    const result = await performExport({ format: 'markdown' });

    expect(result.filename).toBe('TestProject.md');
    expect(result.mimeType).toBe('text/markdown');
    expect(typeof result.data).toBe('string');
    expect(result.data as string).toContain('# TestProject');
    expect(result.data as string).toContain('API');
  });

  it('throws ExportError for empty canvas with correct code and message', async () => {
    const mockCanvas = {
      data: {
        nodes: [],
        edges: [],
      },
    };

    mockStoresWithCanvas('Test', mockCanvas);

    // Single invocation — check both type and message
    try {
      await performExport({ format: 'markdown' });
      // Should not reach here
      expect.unreachable('Expected ExportError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).message).toContain('empty');
      expect((err as ExportError).code).toBe('EMPTY_CANVAS');
    }
  });

  it('throws ExportError when no canvas is loaded', async () => {
    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: null,
      getCanvas: () => undefined,
    } as unknown as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    await expect(performExport({ format: 'markdown' })).rejects.toThrow(ExportError);
  });

  it('sanitizes project name for filename', async () => {
    const mockCanvas = {
      data: {
        project: { name: 'My Project / v2' },
        nodes: [{ id: 'a', type: 'x' }],
        edges: [],
      },
    };

    mockStoresWithCanvas('My Project / v2', mockCanvas);

    const result = await performExport({ format: 'markdown' });
    expect(result.filename).toBe('My_Project___v2.md');
    expect(result.filename).not.toContain('/');
    expect(result.filename).not.toContain(' ');
  });

  it('throws ExportError for unsupported format', async () => {
    mockStoresWithCanvas('Test', {
      data: { nodes: [{ id: 'a', type: 'x' }], edges: [] },
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await performExport({ format: 'pdf' as any });
      expect.unreachable('Expected ExportError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('UNKNOWN');
      expect((err as ExportError).message).toContain('Unsupported format');
    }
  });

  it('uses "architecture" as default project name when none is set', async () => {
    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: {} } },
      getCanvas: () => ({
        data: {
          nodes: [{ id: 'a', type: 'x' }],
          edges: [],
        },
      }),
    } as unknown as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    const result = await performExport({ format: 'markdown' });
    expect(result.filename).toBe('architecture.md');
  });
});
