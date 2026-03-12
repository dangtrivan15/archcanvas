import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvasFile } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

function yamlOf(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvasFile(data as any);
}

describe('fileStore', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    // Reset store state between tests
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
    });

    fs = new InMemoryFileSystem();
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api' },
          { id: 'db', type: 'data/database' },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        displayName: 'API Service',
      }),
    });
  });

  describe('openProject', () => {
    it('transitions to loading then loaded', async () => {
      const promise = useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().status).toBe('loading');

      await promise;
      expect(useFileStore.getState().status).toBe('loaded');
      expect(useFileStore.getState().project).not.toBeNull();
      expect(useFileStore.getState().error).toBeNull();
    });

    it('sets project data correctly', async () => {
      await useFileStore.getState().openProject(fs);
      const { project } = useFileStore.getState();
      expect(project?.root.data.project?.name).toBe('Test');
      expect(project?.canvases.has('svc-api')).toBe(true);
    });

    it('clears dirty canvases on load', async () => {
      useFileStore.setState({ dirtyCanvases: new Set(['old']) });
      await useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
    });

    it('sets error status on failure', async () => {
      const emptyFs = new InMemoryFileSystem();
      await useFileStore.getState().openProject(emptyFs);
      expect(useFileStore.getState().status).toBe('error');
      expect(useFileStore.getState().error).toBeTruthy();
    });
  });

  describe('markDirty', () => {
    it('adds canvas ID to dirty set', () => {
      useFileStore.getState().markDirty('svc-api');
      expect(useFileStore.getState().dirtyCanvases.has('svc-api')).toBe(true);
    });

    it('does not duplicate entries', () => {
      useFileStore.getState().markDirty('svc-api');
      useFileStore.getState().markDirty('svc-api');
      expect(useFileStore.getState().dirtyCanvases.size).toBe(1);
    });
  });

  describe('saveCanvas', () => {
    it('writes to file system and clears dirty flag', async () => {
      await useFileStore.getState().openProject(fs);
      useFileStore.getState().markDirty('svc-api');

      await useFileStore.getState().saveCanvas(fs, 'svc-api');

      expect(useFileStore.getState().dirtyCanvases.has('svc-api')).toBe(false);
      const written = await fs.readFile('.archcanvas/svc-api.yaml');
      expect(written).toContain('API Service');
    });
  });

  describe('saveAll', () => {
    it('saves all dirty canvases', async () => {
      await useFileStore.getState().openProject(fs);
      useFileStore.getState().markDirty(ROOT_CANVAS_KEY);
      useFileStore.getState().markDirty('svc-api');

      await useFileStore.getState().saveAll(fs);

      expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
    });
  });

  describe('getCanvas / getRootCanvas', () => {
    it('getCanvas returns canvas by ID', async () => {
      await useFileStore.getState().openProject(fs);
      const canvas = useFileStore.getState().getCanvas('svc-api');
      expect(canvas?.data.displayName).toBe('API Service');
    });

    it('getCanvas returns undefined for unknown ID', async () => {
      await useFileStore.getState().openProject(fs);
      expect(useFileStore.getState().getCanvas('nonexistent')).toBeUndefined();
    });

    it('getRootCanvas returns the root', async () => {
      await useFileStore.getState().openProject(fs);
      const root = useFileStore.getState().getRootCanvas();
      expect(root?.data.project?.name).toBe('Test');
    });
  });

  describe('updateCanvasData', () => {
    it('replaces canvas data and marks dirty', async () => {
      await useFileStore.getState().openProject(fs);
      const canvas = useFileStore.getState().getCanvas('svc-api')!;
      const mutatedData = { ...canvas.data, displayName: 'Modified Service' };

      useFileStore.getState().updateCanvasData('svc-api', mutatedData);

      const updated = useFileStore.getState().getCanvas('svc-api')!;
      expect(updated.data.displayName).toBe('Modified Service');
      expect(useFileStore.getState().dirtyCanvases.has('svc-api')).toBe(true);
    });

    it('clears doc after updateCanvasData so saves use plain stringify', async () => {
      await useFileStore.getState().openProject(fs);
      const canvas = useFileStore.getState().getCanvas('svc-api')!;
      expect(canvas.doc).toBeDefined();

      const mutatedData = { ...canvas.data, displayName: 'Modified Service' };
      useFileStore.getState().updateCanvasData('svc-api', mutatedData);

      const updated = useFileStore.getState().getCanvas('svc-api')!;
      expect(updated.doc).toBeUndefined();
      expect(updated.data.displayName).toBe('Modified Service');

      await useFileStore.getState().saveCanvas(fs, 'svc-api');
      const written = await fs.readFile('.archcanvas/svc-api.yaml');
      expect(written).toContain('Modified Service');
    });

    it('triggers Zustand re-render by creating a new project reference', async () => {
      await useFileStore.getState().openProject(fs);
      const projectBefore = useFileStore.getState().project;

      const canvas = useFileStore.getState().getCanvas('svc-api')!;
      const mutatedData = { ...canvas.data, displayName: 'New Name' };
      useFileStore.getState().updateCanvasData('svc-api', mutatedData);

      const projectAfter = useFileStore.getState().project;
      expect(projectAfter).not.toBe(projectBefore);
    });

    it('updates root canvas via ROOT_CANVAS_KEY', async () => {
      await useFileStore.getState().openProject(fs);
      const root = useFileStore.getState().getRootCanvas()!;
      const mutatedData = { ...root.data, displayName: 'Modified Root' };

      useFileStore.getState().updateCanvasData(ROOT_CANVAS_KEY, mutatedData);

      const updatedRoot = useFileStore.getState().getRootCanvas()!;
      expect(updatedRoot.data.displayName).toBe('Modified Root');
      expect(updatedRoot.doc).toBeUndefined();
      expect(useFileStore.getState().dirtyCanvases.has(ROOT_CANVAS_KEY)).toBe(true);

      // project.root and canvases.get(ROOT_CANVAS_KEY) should be the same object
      const fromMap = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY);
      expect(fromMap).toBe(updatedRoot);
    });

    it('is a no-op for unknown canvasId', async () => {
      await useFileStore.getState().openProject(fs);
      const projectBefore = useFileStore.getState().project;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFileStore.getState().updateCanvasData('nonexistent', {} as any);

      expect(useFileStore.getState().project).toBe(projectBefore);
      expect(useFileStore.getState().dirtyCanvases.has('nonexistent')).toBe(false);
    });

    it('is a no-op when no project is loaded', () => {
      // store is in idle state with no project
      expect(useFileStore.getState().project).toBeNull();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFileStore.getState().updateCanvasData('svc-api', {} as any);

      // Should not throw; state unchanged
      expect(useFileStore.getState().project).toBeNull();
    });
  });
});
