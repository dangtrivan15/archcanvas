import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

function yamlOf(data: Record<string, unknown>): string {
  return serializeCanvas(data as any);
}

function createSeededFs(): InMemoryFileSystem {
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': yamlOf({
      project: { name: 'Test' },
      nodes: [{ id: 'db', type: 'data/database' }],
    }),
  });
  return fs;
}

describe('fileStore.registerCanvas', () => {
  beforeEach(async () => {
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
      fs: null,
    });
    const fs = createSeededFs();
    await useFileStore.getState().openProject(fs);
  });

  it('registers a new canvas and returns ok', () => {
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', displayName: 'Order Service', nodes: [], edges: [] },
    );
    expect(result).toEqual({ ok: true });
  });

  it('makes the canvas retrievable via getCanvas', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', displayName: 'Order Service', nodes: [], edges: [] },
    );
    const canvas = useFileStore.getState().getCanvas('order-svc');
    expect(canvas).toBeDefined();
    expect(canvas!.data.displayName).toBe('Order Service');
    expect(canvas!.filePath).toBe('.archcanvas/order-svc.yaml');
  });

  it('marks the new canvas as dirty', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(useFileStore.getState().dirtyCanvases.has('order-svc')).toBe(true);
  });

  it('sets data.id on the registered canvas', () => {
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(useFileStore.getState().getCanvas('order-svc')!.data.id).toBe('order-svc');
  });

  it('returns error when canvasId already exists', () => {
    // Register once
    useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    // Register again with same ID
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc-2.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'CANVAS_ALREADY_EXISTS', canvasId: 'order-svc' },
    });
  });

  it('does not register when project is null', () => {
    useFileStore.setState({ project: null });
    const result = useFileStore.getState().registerCanvas(
      'order-svc',
      '.archcanvas/order-svc.yaml',
      { id: 'order-svc', type: 'compute/service', nodes: [], edges: [] },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'CANVAS_ALREADY_EXISTS', canvasId: 'order-svc' },
    });
  });
});
