import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

function makeMainYaml() {
  return serializeCanvas({
    project: { name: 'Test' },
    nodes: [
      { id: 'node-a', type: 'compute/service', displayName: 'Node A' },
    ],
    edges: [],
  } as any);
}

async function setupStores() {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });
  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
  return fs;
}

describe('graphStore.createSubsystem', () => {
  beforeEach(async () => {
    await setupStores();
  });

  it('creates subsystem: RefNode in parent + child canvas registered', () => {
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
      displayName: 'Order Service',
    });
    expect(result.ok).toBe(true);

    // RefNode in parent
    const root = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const refNode = root.data.nodes!.find((n) => n.id === 'order-svc');
    expect(refNode).toBeDefined();
    expect('ref' in refNode!).toBe(true);

    // Child canvas registered
    const child = useFileStore.getState().getCanvas('order-svc');
    expect(child).toBeDefined();
    expect(child!.data.type).toBe('compute/service');
    expect(child!.data.displayName).toBe('Order Service');
    expect(child!.filePath).toBe('.archcanvas/order-svc.yaml');
  });

  it('marks both parent and child as dirty', () => {
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    const dirty = useFileStore.getState().dirtyCanvases;
    expect(dirty.has(ROOT_CANVAS_KEY)).toBe(true);
    expect(dirty.has('order-svc')).toBe(true);
  });

  it('returns CANVAS_NOT_FOUND for invalid parent', () => {
    const result = useGraphStore.getState().createSubsystem('nonexistent', {
      id: 'order-svc',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CANVAS_NOT_FOUND');
  });

  it('returns CANVAS_ALREADY_EXISTS on canvas ID collision', () => {
    // Create first
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    // Try duplicate
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CANVAS_ALREADY_EXISTS');
  });

  it('returns DUPLICATE_NODE_ID when RefNode ID collides with existing node', () => {
    // 'node-a' already exists as an InlineNode
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'node-a',
      type: 'compute/service',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_NODE_ID');
    // Canvas is registered (orphan) but parent is unchanged — acceptable per spec
  });

  it('returns UNKNOWN_SUBSYSTEM_TYPE for invalid type', () => {
    const result = useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'nonexistent/type',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_SUBSYSTEM_TYPE');
  });

  it('resolves displayName from NodeDef when omitted', () => {
    useGraphStore.getState().createSubsystem(ROOT_CANVAS_KEY, {
      id: 'order-svc',
      type: 'compute/service',
    });
    const child = useFileStore.getState().getCanvas('order-svc');
    // compute/service NodeDef has displayName "Service"
    expect(child!.data.displayName).toBe('Service');
  });
});
