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

  it('exports markdown successfully with nodes and edges', async () => {
    // Mock the stores
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

    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: 'TestProject' } } } },
      getCanvas: () => mockCanvas,
    } as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    const result = await performExport({ format: 'markdown' });

    expect(result.filename).toBe('TestProject.md');
    expect(result.mimeType).toBe('text/markdown');
    expect(typeof result.data).toBe('string');
    expect(result.data as string).toContain('# TestProject');
    expect(result.data as string).toContain('API');
  });

  it('throws ExportError for empty canvas', async () => {
    const mockCanvas = {
      data: {
        nodes: [],
        edges: [],
      },
    };

    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: 'Test' } } } },
      getCanvas: () => mockCanvas,
    } as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    await expect(performExport({ format: 'markdown' })).rejects.toThrow(ExportError);
    await expect(performExport({ format: 'markdown' })).rejects.toThrow('empty');
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

    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: 'My Project / v2' } } } },
      getCanvas: () => mockCanvas,
    } as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    const result = await performExport({ format: 'markdown' });
    expect(result.filename).toBe('My_Project___v2.md');
    expect(result.filename).not.toContain('/');
    expect(result.filename).not.toContain(' ');
  });
});
