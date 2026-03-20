import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' },
      nodes: [{ id: 'svc-a', type: 'compute/service' }],
      edges: [],
    } as any),
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction — entity actions', () => {
  beforeEach(setup);

  describe('addEntity', () => {
    it('adds entity to canvas', () => {
      const result = dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
        description: 'A purchase order',
        codeRefs: ['src/models/order.ts'],
      });
      expect(result).toMatchObject({ ok: true });
    });

    it('returns error for duplicate entity', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'DUPLICATE_ENTITY' },
      });
    });
  });

  describe('removeEntity', () => {
    it('removes entity from canvas', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('removeEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'Order',
      });
      expect(result).toMatchObject({ ok: true });
    });

    it('returns error when entity not found', () => {
      const result = dispatchStoreAction('removeEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'NonExistent',
      });
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'ENTITY_NOT_FOUND' },
      });
    });
  });

  describe('updateEntity', () => {
    it('updates entity description', () => {
      dispatchStoreAction('addEntity', {
        canvasId: ROOT_CANVAS_KEY,
        name: 'Order',
      });
      const result = dispatchStoreAction('updateEntity', {
        canvasId: ROOT_CANVAS_KEY,
        entityName: 'Order',
        description: 'Updated description',
      });
      expect(result).toMatchObject({ ok: true });
    });
  });
});
