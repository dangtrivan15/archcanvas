import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock html-to-image before importing the module under test
vi.mock('html-to-image', () => ({
  toSvg: vi.fn(),
}));

// Mock prepareExportClone to avoid side effects in unit tests
vi.mock('@/export/prepareExportClone', () => ({
  prepareExportClone: vi.fn(),
}));

import { exportSvg } from '@/export/exportSvg';
import { ExportError } from '@/export/types';
import { toSvg } from 'html-to-image';
import { prepareExportClone } from '@/export/prepareExportClone';

describe('exportSvg', () => {
  let viewport: HTMLElement;
  let mockCloneViewport: HTMLElement;
  let mockCleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);

    mockCloneViewport = document.createElement('div');
    mockCloneViewport.className = 'react-flow__viewport';
    mockCleanup = vi.fn();

    vi.mocked(prepareExportClone).mockResolvedValue({
      wrapper: document.createElement('div'),
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
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    await exportSvg();

    expect(prepareExportClone).toHaveBeenCalledTimes(1);
    expect(prepareExportClone).toHaveBeenCalledWith(viewport);
  });

  it('calls toSvg with the cloned viewport element and returns an SVG blob', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    const result = await exportSvg();

    expect(toSvg).toHaveBeenCalledTimes(1);
    expect(toSvg).toHaveBeenCalledWith(mockCloneViewport, expect.objectContaining({
      backgroundColor: expect.any(String),
    }));
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/svg+xml');

    // Verify the blob content is the decoded SVG
    const text = await result.text();
    expect(text).toBe(svgContent);
  });

  it('handles base64-encoded SVG data URLs', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>';
    const b64 = btoa(svgContent);
    const dataUrl = `data:image/svg+xml;base64,${b64}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    const result = await exportSvg();
    const text = await result.text();
    expect(text).toBe(svgContent);
  });

  it('handles SVG content containing commas (no truncation)', async () => {
    const svgContent = '<svg><path d="M0,0 L10,20 C30,40 50,60 70,80"/></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    const result = await exportSvg();
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

  it('throws ExportError with RENDER_FAILED when toSvg fails', async () => {
    vi.mocked(toSvg).mockRejectedValue(new Error('Cloning failed'));

    try {
      await exportSvg();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('RENDER_FAILED');
      expect((err as ExportError).message).toContain('Cloning failed');
    }
  });

  it('calls cleanup after successful export', async () => {
    const svgContent = '<svg><rect/></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    await exportSvg();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup even when toSvg fails', async () => {
    vi.mocked(toSvg).mockRejectedValue(new Error('Failed'));

    try {
      await exportSvg();
    } catch {
      // expected
    }

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('does not pass a filter option to toSvg (filtering done in clone preparation)', async () => {
    const svgContent = '<svg><rect/></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
    vi.mocked(toSvg).mockResolvedValue(dataUrl);

    await exportSvg();

    const callArgs = vi.mocked(toSvg).mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('filter');
  });
});
