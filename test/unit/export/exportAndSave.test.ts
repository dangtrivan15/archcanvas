import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';

// We need to mock the fileSaver module before importing exportAndSave
vi.mock('@/platform/fileSaver', () => ({
  createFileSaver: vi.fn(),
}));

// Mock html-to-image for PNG/SVG tests
vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
  toSvg: vi.fn(),
}));

// Mock prepareExportClone to avoid DOM side effects
vi.mock('@/export/prepareExportClone', () => ({
  prepareExportClone: vi.fn(),
}));

import { exportAndSave, ExportError } from '@/export';
import { createFileSaver } from '@/platform/fileSaver';
import { toPng, toSvg } from 'html-to-image';
import { prepareExportClone } from '@/export/prepareExportClone';

describe('exportAndSave', () => {
  const origFileStoreGetState = useFileStore.getState;
  const origNavStoreGetState = useNavigationStore.getState;

  const mockSaver = {
    saveBlob: vi.fn().mockResolvedValue(true),
    saveText: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear call history on manual vi.fn() mocks (restoreAllMocks only resets implementations)
    mockSaver.saveBlob.mockClear();
    mockSaver.saveText.mockClear();
    vi.mocked(createFileSaver).mockReturnValue(mockSaver);
    mockSaver.saveBlob.mockResolvedValue(true);
    mockSaver.saveText.mockResolvedValue(true);

    // Set up prepareExportClone mock
    const mockCloneViewport = document.createElement('div');
    vi.mocked(prepareExportClone).mockResolvedValue({
      wrapper: document.createElement('div'),
      viewport: mockCloneViewport,
      cleanup: vi.fn(),
    });
  });

  afterEach(() => {
    if (useFileStore.getState !== origFileStoreGetState) {
      Object.defineProperty(useFileStore, 'getState', { value: origFileStoreGetState, writable: true });
    }
    if (useNavigationStore.getState !== origNavStoreGetState) {
      Object.defineProperty(useNavigationStore, 'getState', { value: origNavStoreGetState, writable: true });
    }
  });

  function mockStores(projectName: string = 'Test') {
    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: projectName } } } },
      getCanvas: () => ({
        data: {
          project: { name: projectName },
          nodes: [{ id: 'a', type: 'core/service' }],
          edges: [],
        },
      }),
    } as unknown as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);
  }

  it('saves markdown via saveText', async () => {
    mockStores();
    const result = await exportAndSave({ format: 'markdown' });

    expect(result).toBe(true);
    expect(mockSaver.saveText).toHaveBeenCalledTimes(1);
    expect(mockSaver.saveText).toHaveBeenCalledWith(
      expect.stringContaining('# Test'),
      expect.objectContaining({
        defaultName: 'Test.md',
        mimeType: 'text/markdown',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      }),
    );
  });

  it('saves PNG via saveBlob', async () => {
    mockStores();

    // Set up viewport element for exportPng
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);

    const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(toPng).mockResolvedValue(fakeDataUrl);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['png-data'], { type: 'image/png' })),
    );

    const result = await exportAndSave({ format: 'png', pngScale: 2 });

    expect(result).toBe(true);
    expect(mockSaver.saveBlob).toHaveBeenCalledTimes(1);
    expect(mockSaver.saveBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        defaultName: 'Test.png',
        mimeType: 'image/png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      }),
    );

    document.body.removeChild(viewport);
  });

  it('saves SVG via saveBlob', async () => {
    mockStores();

    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);

    const svgContent = '<svg><rect/></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    const result = await exportAndSave({ format: 'svg' });

    expect(result).toBe(true);
    expect(mockSaver.saveBlob).toHaveBeenCalledTimes(1);
    expect(mockSaver.saveBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        defaultName: 'Test.svg',
        mimeType: 'image/svg+xml',
        filters: [{ name: 'SVG Image', extensions: ['svg'] }],
      }),
    );

    document.body.removeChild(viewport);
  });

  it('returns false when user cancels save dialog', async () => {
    mockStores();
    mockSaver.saveText.mockResolvedValue(false);

    const result = await exportAndSave({ format: 'markdown' });
    expect(result).toBe(false);
  });

  it('propagates ExportError for empty canvas', async () => {
    vi.spyOn(useFileStore, 'getState').mockReturnValue({
      ...origFileStoreGetState(),
      project: { root: { data: { project: { name: 'Test' } } } },
      getCanvas: () => ({ data: { nodes: [], edges: [] } }),
    } as unknown as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    await expect(exportAndSave({ format: 'markdown' })).rejects.toThrow(ExportError);
  });
});
