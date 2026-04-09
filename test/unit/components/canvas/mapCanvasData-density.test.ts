import { describe, it, expect } from 'vitest';
import { mapCanvasNodes } from '@/components/canvas/mapCanvasData';
import type { Canvas } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';

function makeCanvas(partial: Partial<Canvas> = {}): Canvas {
  return {
    project: { name: 'Test' },
    nodes: [],
    edges: [],
    ...partial,
  } as Canvas;
}

function makeNodeDef(overrides: Partial<NodeDef> = {}): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name: 'service',
      namespace: 'compute',
      version: '1.0',
      displayName: 'Service',
      description: 'A compute service',
      icon: 'Server',
      shape: 'rectangle',
    },
    spec: {},
    ...overrides,
  };
}

describe('mapCanvasNodes — keyArgs', () => {
  it('extracts args with non-default values', () => {
    const nodeDef = makeNodeDef({
      spec: {
        args: [
          { name: 'replicas', type: 'number', default: 1 },
          { name: 'region', type: 'string', default: 'us-east-1' },
          { name: 'tier', type: 'enum', options: ['free', 'pro'], default: 'free' },
        ],
      },
    });

    const canvas = makeCanvas({
      nodes: [
        {
          id: 'svc-1',
          type: 'compute/service',
          args: { replicas: 3, region: 'us-east-1', tier: 'pro' },
        },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => nodeDef,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.keyArgs).toHaveLength(2);
    expect(result[0].data.keyArgs![0]).toEqual({ name: 'replicas', value: 3 });
    // region has default value 'us-east-1' — should be skipped
    expect(result[0].data.keyArgs![1]).toEqual({ name: 'tier', value: 'pro' });
  });

  it('returns empty array when all args match defaults', () => {
    const nodeDef = makeNodeDef({
      spec: {
        args: [
          { name: 'replicas', type: 'number', default: 1 },
        ],
      },
    });

    const canvas = makeCanvas({
      nodes: [
        { id: 'svc-1', type: 'compute/service', args: { replicas: 1 } },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => nodeDef,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.keyArgs).toEqual([]);
  });

  it('returns empty array when node has no args', () => {
    const nodeDef = makeNodeDef({
      spec: {
        args: [
          { name: 'replicas', type: 'number', default: 1 },
        ],
      },
    });

    const canvas = makeCanvas({
      nodes: [{ id: 'svc-1', type: 'compute/service' }],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => nodeDef,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.keyArgs).toEqual([]);
  });

  it('limits to 2 key args even when more differ', () => {
    const nodeDef = makeNodeDef({
      spec: {
        args: [
          { name: 'a', type: 'string' },
          { name: 'b', type: 'string' },
          { name: 'c', type: 'string' },
        ],
      },
    });

    const canvas = makeCanvas({
      nodes: [
        { id: 'svc-1', type: 'compute/service', args: { a: 'x', b: 'y', c: 'z' } },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => nodeDef,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.keyArgs).toHaveLength(2);
  });

  it('returns undefined keyArgs for RefNodes', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'ref-1', ref: 'sub.yaml' }],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.keyArgs).toBeUndefined();
  });
});

describe('mapCanvasNodes — badges', () => {
  it('detects notes on inline nodes', () => {
    const canvas = makeCanvas({
      nodes: [
        {
          id: 'svc-1',
          type: 'compute/service',
          notes: [{ author: 'user', content: 'Important note' }],
        },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.badges?.hasNotes).toBe(true);
    expect(result[0].data.badges?.hasCodeRefs).toBe(false);
  });

  it('detects codeRefs on inline nodes', () => {
    const canvas = makeCanvas({
      nodes: [
        {
          id: 'svc-1',
          type: 'compute/service',
          codeRefs: ['src/main.ts:42'],
        },
      ],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.badges?.hasCodeRefs).toBe(true);
    expect(result[0].data.badges?.hasNotes).toBe(false);
  });

  it('sets childCount for RefNodes', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'ref-1', ref: 'sub.yaml' }],
    } as any);

    const childCanvas: Canvas = {
      nodes: [
        { id: 'child-1', type: 'compute/service' },
        { id: 'child-2', type: 'data/database' },
      ],
    } as any;

    const canvasesRef = new Map([['ref-1', { data: childCanvas }]]);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef,
    });

    expect(result[0].data.badges?.childCount).toBe(2);
  });

  it('returns childCount=0 for inline nodes', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'svc-1', type: 'compute/service' }],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.badges?.childCount).toBe(0);
  });
});

describe('mapCanvasNodes — childSummary', () => {
  it('generates namespace-grouped summary for RefNodes', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'ref-1', ref: 'sub.yaml' }],
    } as any);

    const childCanvas: Canvas = {
      nodes: [
        { id: 'c1', type: 'compute/service' },
        { id: 'c2', type: 'compute/function' },
        { id: 'c3', type: 'compute/worker' },
        { id: 'c4', type: 'data/database' },
        { id: 'c5', type: 'data/cache' },
      ],
    } as any;

    const canvasesRef = new Map([['ref-1', { data: childCanvas }]]);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef,
    });

    expect(result[0].data.childSummary).toBe('3 compute · 2 data');
  });

  it('returns undefined for inline nodes', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'svc-1', type: 'compute/service' }],
    } as any);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef: undefined,
    });

    expect(result[0].data.childSummary).toBeUndefined();
  });

  it('returns undefined for RefNodes with no children', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'ref-1', ref: 'sub.yaml' }],
    } as any);

    const childCanvas: Canvas = { nodes: [] } as any;
    const canvasesRef = new Map([['ref-1', { data: childCanvas }]]);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef,
    });

    expect(result[0].data.childSummary).toBeUndefined();
  });

  it('labels RefNode children as "subsystem"', () => {
    const canvas = makeCanvas({
      nodes: [{ id: 'ref-1', ref: 'sub.yaml' }],
    } as any);

    const childCanvas: Canvas = {
      nodes: [
        { id: 'nested-ref', ref: 'nested.yaml' },
      ],
    } as any;

    const canvasesRef = new Map([['ref-1', { data: childCanvas }]]);

    const result = mapCanvasNodes({
      canvas,
      resolve: () => undefined,
      selectedNodeIds: new Set(),
      canvasesRef,
    });

    expect(result[0].data.childSummary).toBe('1 subsystem');
  });
});
