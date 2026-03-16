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
});
