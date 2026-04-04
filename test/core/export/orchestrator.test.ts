import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCanvas } from '@/core/export/orchestrator';
import { setFileSaver } from '@/platform/fileSaver';
import type { FileSaver, SaveFileOptions } from '@/platform/fileSaver';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';
import { makeCanvas, makeNode, makeEdge, makeEntity } from '../graph/helpers';
import type { LoadedCanvas } from '@/storage/fileResolver';

// ---------------------------------------------------------------------------
// Mock the image export module — DOM rasterization can't run in happy-dom
// ---------------------------------------------------------------------------

vi.mock('@/core/export/image', () => ({
  exportCanvasToPng: vi.fn().mockResolvedValue({
    blob: new Blob(['fake-png'], { type: 'image/png' }),
    width: 800,
    height: 600,
  }),
  exportCanvasToSvg: vi.fn().mockResolvedValue({
    blob: new Blob(['<svg></svg>'], { type: 'image/svg+xml' }),
    width: 800,
    height: 600,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFileSaver(saved = true): FileSaver & { calls: Array<{ data: Blob | string; options: SaveFileOptions }> } {
  const calls: Array<{ data: Blob | string; options: SaveFileOptions }> = [];
  return {
    calls,
    saveFile: vi.fn(async (data: Blob | string, options: SaveFileOptions) => {
      calls.push({ data, options });
      return saved;
    }),
  };
}

function setupStoreWithCanvas() {
  const canvas = makeCanvas({
    displayName: 'Test Architecture',
    nodes: [makeNode({ id: 'svc-a', type: 'compute/service' })],
    edges: [makeEdge()],
    entities: [makeEntity()],
  });

  const loaded: LoadedCanvas = {
    filePath: 'test.yaml',
    data: canvas,
    doc: {} as any,
  };

  // Set up navigation store
  useNavigationStore.setState({ currentCanvasId: '__root__' });

  // Mock getCanvas on the file store
  const originalGetCanvas = useFileStore.getState().getCanvas;
  useFileStore.setState({
    getCanvas: (_id: string) => loaded,
  } as any);

  return { canvas, loaded, restore: () => useFileStore.setState({ getCanvas: originalGetCanvas } as any) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportCanvas', () => {
  let mockSaver: ReturnType<typeof makeMockFileSaver>;

  beforeEach(() => {
    mockSaver = makeMockFileSaver();
    setFileSaver(mockSaver);
  });

  afterEach(() => {
    setFileSaver(null);
  });

  it('exports Markdown successfully', async () => {
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'markdown' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('.md');
    expect(mockSaver.calls).toHaveLength(1);
    expect(mockSaver.calls[0].options.mimeType).toBe('text/markdown');
    expect(mockSaver.calls[0].options.defaultName).toMatch(/\.md$/);
    expect(typeof mockSaver.calls[0].data).toBe('string');
    expect(mockSaver.calls[0].data).toContain('# Test Architecture');

    restore();
  });

  it('exports PNG via mock', async () => {
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'png' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('.png');
    expect(mockSaver.calls).toHaveLength(1);
    expect(mockSaver.calls[0].options.mimeType).toBe('image/png');
    expect(mockSaver.calls[0].data).toBeInstanceOf(Blob);

    restore();
  });

  it('exports SVG via mock', async () => {
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'svg' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('.svg');
    expect(mockSaver.calls).toHaveLength(1);
    expect(mockSaver.calls[0].options.mimeType).toBe('image/svg+xml');

    restore();
  });

  it('uses custom filename', async () => {
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'markdown', filename: 'custom-name' });

    expect(result.success).toBe(true);
    expect(mockSaver.calls[0].options.defaultName).toBe('custom-name.md');

    restore();
  });

  it('reports cancelled when user cancels save dialog', async () => {
    const cancelSaver = makeMockFileSaver(false);
    setFileSaver(cancelSaver);
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'markdown' });

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.message).toBe('Export cancelled');

    restore();
  });

  it('returns failure when no canvas data is available for Markdown', async () => {
    useNavigationStore.setState({ currentCanvasId: '__root__' });
    useFileStore.setState({
      getCanvas: () => undefined,
    } as any);

    const result = await exportCanvas({ format: 'markdown' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('No canvas data');
  });

  it('sanitizes displayName for filename', async () => {
    const canvas = makeCanvas({ displayName: 'My Architecture / v2.0' });
    const loaded: LoadedCanvas = {
      filePath: 'test.yaml',
      data: canvas,
      doc: {} as any,
    };
    useNavigationStore.setState({ currentCanvasId: '__root__' });
    useFileStore.setState({
      getCanvas: () => loaded,
    } as any);

    const result = await exportCanvas({ format: 'markdown' });

    expect(result.success).toBe(true);
    // Filename should be sanitized (no slashes/special chars)
    const defaultName = mockSaver.calls[0].options.defaultName;
    expect(defaultName).not.toContain('/');
    expect(defaultName).toMatch(/\.md$/);
  });

  it('handles export error gracefully', async () => {
    const { exportCanvasToPng } = await import('@/core/export/image');
    vi.mocked(exportCanvasToPng).mockRejectedValueOnce(new Error('DOM failure'));
    const { restore } = setupStoreWithCanvas();

    const result = await exportCanvas({ format: 'png' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('DOM failure');

    restore();
  });
});
