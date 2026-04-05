import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock html-to-image before importing the module under test
vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
}));

import { exportPng } from '@/export/exportPng';
import { ExportError } from '@/export/types';
import { toPng } from 'html-to-image';

describe('exportPng', () => {
  let viewport: HTMLElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Create a mock .react-flow__viewport element
    viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    document.body.appendChild(viewport);
  });

  afterEach(() => {
    if (viewport.parentNode) {
      viewport.parentNode.removeChild(viewport);
    }
  });

  it('calls toPng with the viewport element and correct options', async () => {
    const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(toPng).mockResolvedValue(fakeDataUrl);

    // Mock fetch for data URL → Blob conversion
    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBlob),
    );

    const result = await exportPng(2);

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
      pixelRatio: 2,
      backgroundColor: expect.any(String),
    }));
    expect(fetchSpy).toHaveBeenCalledWith(fakeDataUrl);
    expect(result).toBeInstanceOf(Blob);
  });

  it('respects the scale parameter', async () => {
    const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(toPng).mockResolvedValue(fakeDataUrl);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['data'])),
    );

    await exportPng(3);

    expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
      pixelRatio: 3,
    }));
  });

  it('defaults to scale 2', async () => {
    const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(toPng).mockResolvedValue(fakeDataUrl);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['data'])),
    );

    await exportPng();

    expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
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

  it('throws ExportError with RENDER_FAILED when toPng fails', async () => {
    vi.mocked(toPng).mockRejectedValue(new Error('Canvas tainted'));

    try {
      await exportPng();
      expect.unreachable('Expected ExportError');
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe('RENDER_FAILED');
      expect((err as ExportError).message).toContain('Canvas tainted');
    }
  });

  it('passes filterGhostElements as filter option', async () => {
    const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    vi.mocked(toPng).mockResolvedValue(fakeDataUrl);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['data'])),
    );

    await exportPng();

    expect(toPng).toHaveBeenCalledWith(viewport, expect.objectContaining({
      filter: expect.any(Function),
    }));
  });
});
