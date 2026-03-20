import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useNavigationStore } from '@/store/navigationStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

function yamlOf(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvas(data as any);
}

async function seedMultiCanvas(): Promise<void> {
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': yamlOf({
      project: { name: 'Test' },
      nodes: [
        { id: 'svc-api', ref: 'svc-api.yaml' },
        { id: 'db', type: 'data/database' },
      ],
    }),
    '.archcanvas/svc-api.yaml': yamlOf({
      id: 'svc-api',
      type: 'compute/service',
      displayName: 'API Service',
    }),
  });
  await useFileStore.getState().openProject(fs);
}

describe('navigationStore', () => {
  beforeEach(() => {
    // Reset fileStore
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
    });
    // Reset navigationStore
    useNavigationStore.setState({
      currentCanvasId: ROOT_CANVAS_KEY,
      breadcrumb: [{ canvasId: ROOT_CANVAS_KEY, displayName: 'Root' }],
      parentCanvasId: null,
      parentEdges: [],
      savedViewports: {},
    });
  });

  describe('initial state', () => {
    it('starts at ROOT_CANVAS_KEY', () => {
      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
    });

    it('has breadcrumb with a single root entry', () => {
      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb).toHaveLength(1);
      expect(breadcrumb[0].canvasId).toBe(ROOT_CANVAS_KEY);
      expect(breadcrumb[0].displayName).toBe('Root');
    });
  });

  describe('diveIn', () => {
    it('navigates into a RefNode and updates currentCanvasId', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');

      expect(useNavigationStore.getState().currentCanvasId).toBe('svc-api');
    });

    it('pushes a new breadcrumb entry with the canvas displayName', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');

      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb).toHaveLength(2);
      expect(breadcrumb[0].canvasId).toBe(ROOT_CANVAS_KEY);
      expect(breadcrumb[1].canvasId).toBe('svc-api');
      expect(breadcrumb[1].displayName).toBe('API Service');
    });

    it('is a no-op when node id does not exist', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('nonexistent-node');

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('is a no-op when the node is not a RefNode (InlineNode)', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('db');

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('is a no-op when the target canvas does not exist in fileStore', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        '.archcanvas/main.yaml': yamlOf({
          project: { name: 'Test' },
          nodes: [
            // ref points to a file that doesn't exist
            { id: 'ghost', ref: 'missing-canvas.yaml' },
          ],
        }),
      });
      await useFileStore.getState().openProject(fs);

      useNavigationStore.getState().diveIn('ghost');

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('falls back to refNodeId as displayName when canvas has no displayName', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        '.archcanvas/main.yaml': yamlOf({
          project: { name: 'Test' },
          nodes: [{ id: 'worker', ref: 'worker.yaml' }],
        }),
        '.archcanvas/worker.yaml': yamlOf({
          id: 'worker',
          type: 'compute/service',
          // no displayName
        }),
      });
      await useFileStore.getState().openProject(fs);

      useNavigationStore.getState().diveIn('worker');

      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb[1].displayName).toBe('worker');
    });
  });

  describe('goUp', () => {
    it('pops breadcrumb and restores parent canvasId', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      expect(useNavigationStore.getState().currentCanvasId).toBe('svc-api');

      useNavigationStore.getState().goUp();

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('is a no-op at root (breadcrumb length 1)', () => {
      useNavigationStore.getState().goUp();

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });
  });

  describe('goToRoot', () => {
    it('resets to root from a nested canvas', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().goToRoot();

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
      expect(useNavigationStore.getState().breadcrumb[0].canvasId).toBe(ROOT_CANVAS_KEY);
    });

    it('is a no-op when already at root', () => {
      useNavigationStore.getState().goToRoot();

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });
  });

  describe('goToBreadcrumb', () => {
    it('truncates breadcrumb to the specified index', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(2);

      useNavigationStore.getState().goToBreadcrumb(0);

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('navigates to the canvas at the given index', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().goToBreadcrumb(1);

      expect(useNavigationStore.getState().currentCanvasId).toBe('svc-api');
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(2);
    });

    it('is a no-op for out-of-bounds index', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      const stateBefore = useNavigationStore.getState();

      useNavigationStore.getState().goToBreadcrumb(99);

      expect(useNavigationStore.getState().currentCanvasId).toBe(stateBefore.currentCanvasId);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(stateBefore.breadcrumb.length);
    });

    it('is a no-op for negative index', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().goToBreadcrumb(-1);

      expect(useNavigationStore.getState().currentCanvasId).toBe('svc-api');
    });
  });

  describe('parent context', () => {
    it('diveIn stores parentCanvasId and parentEdges', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        '.archcanvas/main.yaml': yamlOf({
          project: { name: 'Test' },
          nodes: [
            { id: 'svc-api', ref: 'svc-api.yaml' },
            { id: 'db', type: 'data/database' },
          ],
          edges: [
            { from: { node: '@svc-api/handler' }, to: { node: 'db' }, label: 'persist' },
          ],
        }),
        '.archcanvas/svc-api.yaml': yamlOf({
          id: 'svc-api',
          type: 'compute/service',
          displayName: 'API Service',
          nodes: [{ id: 'handler', type: 'compute/function' }],
        }),
      });
      await useFileStore.getState().openProject(fs);

      useNavigationStore.getState().diveIn('svc-api');

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(state.parentEdges).toHaveLength(1);
      expect(state.parentEdges[0].label).toBe('persist');
    });

    it('goUp clears parentCanvasId and parentEdges', async () => {
      const fs = new InMemoryFileSystem();
      fs.seed({
        '.archcanvas/main.yaml': yamlOf({
          project: { name: 'Test' },
          nodes: [
            { id: 'svc-api', ref: 'svc-api.yaml' },
            { id: 'db', type: 'data/database' },
          ],
          edges: [
            { from: { node: '@svc-api/handler' }, to: { node: 'db' } },
          ],
        }),
        '.archcanvas/svc-api.yaml': yamlOf({
          id: 'svc-api',
          type: 'compute/service',
          nodes: [{ id: 'handler', type: 'compute/function' }],
        }),
      });
      await useFileStore.getState().openProject(fs);

      useNavigationStore.getState().diveIn('svc-api');
      expect(useNavigationStore.getState().parentEdges).toHaveLength(1);

      useNavigationStore.getState().goUp();

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBeNull();
      expect(state.parentEdges).toHaveLength(0);
    });

    it('goToRoot clears parentCanvasId and parentEdges', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().goToRoot();

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBeNull();
      expect(state.parentEdges).toHaveLength(0);
    });

    it('goToBreadcrumb clears parentCanvasId and parentEdges', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().goToBreadcrumb(0);

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBeNull();
      expect(state.parentEdges).toHaveLength(0);
    });

    it('navigateTo clears parentCanvasId and parentEdges', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().navigateTo(ROOT_CANVAS_KEY);

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBeNull();
      expect(state.parentEdges).toHaveLength(0);
    });

    it('initial state has null parentCanvasId and empty parentEdges', () => {
      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBeNull();
      expect(state.parentEdges).toHaveLength(0);
    });

    it('diveIn stores empty parentEdges when parent has no edges', async () => {
      await seedMultiCanvas(); // seedMultiCanvas has no edges

      useNavigationStore.getState().diveIn('svc-api');

      const state = useNavigationStore.getState();
      expect(state.parentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(state.parentEdges).toHaveLength(0);
    });
  });

  describe('navigateTo', () => {
    it('jumps directly to a canvas with root + target breadcrumb', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().navigateTo('svc-api');

      expect(useNavigationStore.getState().currentCanvasId).toBe('svc-api');

      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb).toHaveLength(2);
      expect(breadcrumb[0].canvasId).toBe(ROOT_CANVAS_KEY);
      expect(breadcrumb[1].canvasId).toBe('svc-api');
    });

    it('navigates to root when given ROOT_CANVAS_KEY', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().diveIn('svc-api');
      useNavigationStore.getState().navigateTo(ROOT_CANVAS_KEY);

      expect(useNavigationStore.getState().currentCanvasId).toBe(ROOT_CANVAS_KEY);
      expect(useNavigationStore.getState().breadcrumb).toHaveLength(1);
    });

    it('uses canvas displayName in breadcrumb', async () => {
      await seedMultiCanvas();

      useNavigationStore.getState().navigateTo('svc-api');

      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb[1].displayName).toBe('API Service');
    });

    it('falls back to canvasId as displayName when canvas is not loaded', () => {
      // No project open — fileStore returns undefined for any canvas

      useNavigationStore.getState().navigateTo('orphan-canvas');

      const { breadcrumb } = useNavigationStore.getState();
      expect(breadcrumb[1].displayName).toBe('orphan-canvas');
    });
  });

  describe('savedViewports', () => {
    it('starts with an empty savedViewports map', () => {
      expect(useNavigationStore.getState().savedViewports).toEqual({});
    });

    it('saveViewport stores viewport for a canvas', () => {
      useNavigationStore.getState().saveViewport(ROOT_CANVAS_KEY, { x: 100, y: 200, zoom: 1.5 });

      expect(useNavigationStore.getState().savedViewports[ROOT_CANVAS_KEY]).toEqual({
        x: 100, y: 200, zoom: 1.5,
      });
    });

    it('getSavedViewport retrieves a saved viewport', () => {
      useNavigationStore.getState().saveViewport('canvas-a', { x: 50, y: 75, zoom: 2 });

      const vp = useNavigationStore.getState().getSavedViewport('canvas-a');
      expect(vp).toEqual({ x: 50, y: 75, zoom: 2 });
    });

    it('getSavedViewport returns undefined for unsaved canvas', () => {
      expect(useNavigationStore.getState().getSavedViewport('unknown')).toBeUndefined();
    });

    it('saveViewport overwrites previous viewport for the same canvas', () => {
      const store = useNavigationStore.getState();
      store.saveViewport('canvas-a', { x: 10, y: 20, zoom: 1 });
      store.saveViewport('canvas-a', { x: 99, y: 88, zoom: 3 });

      expect(useNavigationStore.getState().getSavedViewport('canvas-a')).toEqual({
        x: 99, y: 88, zoom: 3,
      });
    });

    it('saveViewport does not affect other canvases', () => {
      const store = useNavigationStore.getState();
      store.saveViewport('canvas-a', { x: 1, y: 2, zoom: 1 });
      store.saveViewport('canvas-b', { x: 3, y: 4, zoom: 2 });

      expect(useNavigationStore.getState().getSavedViewport('canvas-a')).toEqual({ x: 1, y: 2, zoom: 1 });
      expect(useNavigationStore.getState().getSavedViewport('canvas-b')).toEqual({ x: 3, y: 4, zoom: 2 });
    });
  });
});
