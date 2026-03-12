import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvasFile } from '@/storage/yamlCodec';
import { useCanvasRenderer } from '@/components/canvas/hooks/useCanvasRenderer';

function yamlOf(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvasFile(data as any);
}

async function seedAndOpen(
  files: Record<string, Record<string, unknown>>,
): Promise<void> {
  const fs = new InMemoryFileSystem();
  const seeded: Record<string, string> = {};
  for (const [path, data] of Object.entries(files)) {
    seeded[path] = yamlOf(data);
  }
  fs.seed(seeded);
  await useFileStore.getState().openProject(fs);
}

describe('useCanvasRenderer', () => {
  beforeEach(async () => {
    // Reset fileStore
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
    });
    // Initialize registryStore (loads builtins)
    await useRegistryStore.getState().initialize();
  });

  it('returns empty arrays when fileStore has no project', () => {
    const { result } = renderHook(() => useCanvasRenderer());
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });

  it('returns correct nodes when canvas has nodes', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'api', type: 'compute/service', position: { x: 10, y: 20 } },
          { id: 'db', type: 'data/database', position: { x: 50, y: 60 } },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const { nodes } = result.current;

    expect(nodes).toHaveLength(2);

    const apiNode = nodes.find((n) => n.id === 'api');
    expect(apiNode).toBeDefined();
    expect(apiNode?.position).toEqual({ x: 10, y: 20 });
    expect(apiNode?.type).toBe('archNode');

    const dbNode = nodes.find((n) => n.id === 'db');
    expect(dbNode).toBeDefined();
    expect(dbNode?.position).toEqual({ x: 50, y: 60 });
  });

  it('resolves NodeDef for InlineNode type', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'api', type: 'compute/service' },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const node = result.current.nodes[0];

    expect(node.data.nodeDef).toBeDefined();
    expect(node.data.nodeDef?.metadata.namespace).toBe('compute');
    expect(node.data.nodeDef?.metadata.name).toBe('service');
  });

  it('returns undefined nodeDef for unknown type', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'mystery', type: 'unknown/thing' },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const node = result.current.nodes[0];

    expect(node.data.nodeDef).toBeUndefined();
  });

  it('sets isRef=true for RefNodes, isRef=false for InlineNodes', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'inline-node', type: 'compute/service' },
          { id: 'ref-node', ref: 'some-subsystem' },
        ],
      },
      '.archcanvas/some-subsystem.yaml': {
        id: 'some-subsystem',
        type: 'compute/service',
        displayName: 'Some Subsystem',
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const { nodes } = result.current;

    const inlineNode = nodes.find((n) => n.id === 'inline-node');
    const refNode = nodes.find((n) => n.id === 'ref-node');

    expect(inlineNode?.data.isRef).toBe(false);
    expect(refNode?.data.isRef).toBe(true);
  });

  it('maps edge protocols to correct style categories', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'a', type: 'compute/service' },
          { id: 'b', type: 'compute/service' },
          { id: 'c', type: 'compute/service' },
          { id: 'd', type: 'compute/service' },
        ],
        edges: [
          { from: { node: 'a' }, to: { node: 'b' }, protocol: 'HTTP' },
          { from: { node: 'b' }, to: { node: 'c' }, protocol: 'Kafka' },
          { from: { node: 'c' }, to: { node: 'd' }, protocol: 'gRPC' },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const { edges } = result.current;

    const httpEdge = edges.find((e) => e.id === 'a-b');
    const kafkaEdge = edges.find((e) => e.id === 'b-c');
    const grpcEdge = edges.find((e) => e.id === 'c-d');

    expect(httpEdge?.data?.styleCategory).toBe('sync');
    expect(kafkaEdge?.data?.styleCategory).toBe('async');
    expect(grpcEdge?.data?.styleCategory).toBe('sync');
  });

  it('unmapped protocols get "default" category', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'x', type: 'compute/service' },
          { id: 'y', type: 'compute/service' },
        ],
        edges: [
          { from: { node: 'x' }, to: { node: 'y' }, protocol: 'WebSocket' },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const { edges } = result.current;

    expect(edges[0].data?.styleCategory).toBe('default');
  });

  it('edges with no protocol get "default" category', async () => {
    await seedAndOpen({
      '.archcanvas/main.yaml': {
        project: { name: 'Test' },
        nodes: [
          { id: 'x', type: 'compute/service' },
          { id: 'y', type: 'compute/service' },
        ],
        edges: [
          { from: { node: 'x' }, to: { node: 'y' } },
        ],
      },
    });

    const { result } = renderHook(() => useCanvasRenderer());
    const { edges } = result.current;

    expect(edges[0].data?.styleCategory).toBe('default');
  });
});
