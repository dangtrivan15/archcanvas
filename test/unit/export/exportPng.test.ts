import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock renderToCanvas before importing the module under test
vi.mock('@/export/renderToCanvas', () => ({
  renderToCanvas: vi.fn(),
}));

// Mock prepareExportClone to avoid side effects in unit tests
vi.mock('@/export/prepareExportClone', () => ({
  prepareExportClone: vi.fn(),
}));

import { exportPng } from '@/export/exportPng';
import { ExportError } from '@/export/types';
import { renderToCanvas } from '@/export/renderToCanvas';
import { prepareExportClone } from '@/export/prepareExportClone';

describe('exportPng', () => {
  let viewport: HTMLElement;
  let mockCloneViewport: HTMLElement;
  let mockWrapper: HTMLElement;
  let mockCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    // Create a mock .react-flow__viewport element
    viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);

    // Set up the mock clone
    mockCloneViewport = document.createElement('div');
    mockCloneViewport.className = 'react-flow__viewport';
    mockWrapper = document.createElement('div');
    mockCleanup = vi.fn();

    vi.mocked(prepareExportClone).mockResolvedValue({
      wrapper: mockWrapper,
      viewport: mockCloneViewport,
      cleanup: mockCleanup,
    });

    // Default renderToCanvas mock: returns a canvas that can toBlob
    const mockCanvas = document.createElement('canvas');
    // Override toBlob to return a fake PNG blob
    mockCanvas.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(['png-data'], { type: 'image/png' }));
    });
    vi.mocked(renderToCanvas).mockResolvedValue(mockCanvas);
  });

  afterEach(() => {
    if (viewport.parentNode) {
      viewport.parentNode.removeChild(viewport);
    }
  });

  it('calls prepareExportClone with the original viewport', async () => {
    await exportPng(2);

    expect(prepareExportClone).toHaveBeenCalledTimes(1);
    expect(prepareExportClone).toHaveBeenCalledWith(viewport);
  });

  it('calls renderToCanvas with the cloned viewport element and correct options', async () => {
    const result = await exportPng(2);

    expect(renderToCanvas).toHaveBeenCalledTimes(1);
    expect(renderToCanvas).toHaveBeenCalledWith(mockCloneViewport, expect.objectContaining({
      pixelRatio: 2,
      backgroundColor: expect.any(String),
    }));
    expect(result).toBeInstanceOf(Blob);
  });

  it('respects the scale parameter', async () => {
    await exportPng(3);

    expect(renderToCanvas).toHaveBeenCalledWith(mockCloneViewport, expect.objectContaining({
      pixelRatio: 3,
    }));
  });

  it('defaults to scale 2', async () => {
    await exportPng();

    expect(renderToCanvas).toHaveBeenCalledWith(mockCloneViewport, expect.objectContaining({
      pixelRatio: 2,
    }));
  });

  it('throws ExportError with NO_VIEWPORT when viewport element is missing', async () => {
    document.body.removeChild(viewport);
    // Prevent afterEach from trying to remove again
    viewport = document.createElement('div');

    try {
      await exportPng();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('NO_VIEWPORT');
    }
  });

  it('throws ExportError with RENDER_FAILED when renderToCanvas fails', async () => {
    vi.mocked(renderToCanvas).mockRejectedValue(new Error('Canvas tainted'));

    try {
      await exportPng();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('RENDER_FAILED');
      expect((err as ExportError).message).toContain('Canvas tainted');
    }
  });

  it('calls cleanup after successful export', async () => {
    await exportPng();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup even when renderToCanvas fails', async () => {
    vi.mocked(renderToCanvas).mockRejectedValue(new Error('Failed'));

    try {
      await exportPng();
    } catch {
      // expected
    }

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
