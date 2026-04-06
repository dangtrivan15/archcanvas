import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock renderToCanvas module before importing the module under test
vi.mock('@/export/renderToCanvas', () => ({
  renderToSvgString: vi.fn(),
}));

// Mock prepareExportClone to avoid side effects in unit tests
vi.mock('@/export/prepareExportClone', () => ({
  prepareExportClone: vi.fn(),
}));

import { exportSvg } from '@/export/exportSvg';
import { ExportError } from '@/export/types';
import { renderToSvgString } from '@/export/renderToCanvas';
import { prepareExportClone } from '@/export/prepareExportClone';

describe('exportSvg', () => {
  let viewport: HTMLElement;
  let mockCloneViewport: HTMLElement;
  let mockWrapper: HTMLElement;
  let mockCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);

    mockCloneViewport = document.createElement('div');
    mockCloneViewport.className = 'react-flow__viewport';
    mockWrapper = document.createElement('div');
    mockCleanup = vi.fn();

    vi.mocked(prepareExportClone).mockResolvedValue({
      wrapper: mockWrapper,
      viewport: mockCloneViewport,
      cleanup: mockCleanup,
    });
  });

  afterEach(() => {
    if (viewport.parentNode) {
      viewport.parentNode.removeChild(viewport);
    }
  });

  it('calls prepareExportClone with the original viewport', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    vi.mocked(renderToSvgString).mockReturnValue(svgContent);

    await exportSvg();

    expect(prepareExportClone).toHaveBeenCalledTimes(1);
    expect(prepareExportClone).toHaveBeenCalledWith(viewport);
  });

  it('calls renderToSvgString with the cloned viewport and returns an SVG blob', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    vi.mocked(renderToSvgString).mockReturnValue(svgContent);

    const result = await exportSvg();

    expect(renderToSvgString).toHaveBeenCalledTimes(1);
    expect(renderToSvgString).toHaveBeenCalledWith(mockCloneViewport, expect.objectContaining({
      backgroundColor: expect.any(String),
    }));
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/svg+xml');

    // Verify the blob content is the SVG string
    const text = await result.text();
    expect(text).toBe(svgContent);
  });

  it('throws ExportError with NO_VIEWPORT when viewport is missing', async () => {
    document.body.removeChild(viewport);
    viewport = document.createElement('div'); // Prevent afterEach error

    try {
      await exportSvg();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('NO_VIEWPORT');
    }
  });

  it('throws ExportError with RENDER_FAILED when renderToSvgString fails', async () => {
    vi.mocked(renderToSvgString).mockImplementation(() => {
      throw new Error('Serialization failed');
    });

    try {
      await exportSvg();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('RENDER_FAILED');
      expect((err as ExportError).message).toContain('Serialization failed');
    }
  });

  it('calls cleanup after successful export', async () => {
    const svgContent = '<svg><rect/></svg>';
    vi.mocked(renderToSvgString).mockReturnValue(svgContent);

    await exportSvg();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup even when renderToSvgString fails', async () => {
    vi.mocked(renderToSvgString).mockImplementation(() => {
      throw new Error('Failed');
    });

    try {
      await exportSvg();
    } catch {
      // expected
    }

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
