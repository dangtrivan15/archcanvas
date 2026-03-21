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

describe('dispatchStoreAction: createSubsystem', () => {
  beforeEach(setup);

  it('creates subsystem via dispatcher', async () => {
    const result = await dispatchStoreAction('createSubsystem', {
      canvasId: ROOT_CANVAS_KEY,
      id: 'order-svc',
      type: 'compute/service',
      name: 'Order Service',
    }) as any;
    expect(result.ok).toBe(true);
    expect(useFileStore.getState().getCanvas('order-svc')).toBeDefined();
  });

  it('returns error for invalid canvas', async () => {
    const result = await dispatchStoreAction('createSubsystem', {
      canvasId: 'nonexistent',
      id: 'order-svc',
      type: 'compute/service',
    }) as any;
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('CANVAS_NOT_FOUND');
  });
});
