import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';

// We need to mock the fileSaver module before importing exportAndSave
vi.mock('@/platform/fileSaver', () => ({
  createFileSaver: vi.fn(),
}));

import { exportAndSave, ExportError } from '@/export';
import { createFileSaver } from '@/platform/fileSaver';

describe('exportAndSave', () => {
  const origFileStoreGetState = useFileStore.getState;
  const origNavStoreGetState = useNavigationStore.getState;

  const mockSaver = {
    saveBlob: vi.fn().mockResolvedValue(true),
    saveText: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(createFileSaver).mockReturnValue(mockSaver);
    mockSaver.saveBlob.mockResolvedValue(true);
    mockSaver.saveText.mockResolvedValue(true);
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
    } as ReturnType<typeof useFileStore.getState>);

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
    } as ReturnType<typeof useFileStore.getState>);

    vi.spyOn(useNavigationStore, 'getState').mockReturnValue({
      ...origNavStoreGetState(),
      currentCanvasId: '__root__',
    } as ReturnType<typeof useNavigationStore.getState>);

    await expect(exportAndSave({ format: 'markdown' })).rejects.toThrow(ExportError);
  });
});
