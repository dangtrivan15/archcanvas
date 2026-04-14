import type {
  Canvas,
  InlineNode,
  RefNode,
  Edge,
  Entity,
} from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { NodeDefRegistry } from '@/core/registry/core';

export function makeCanvas(overrides?: Partial<Canvas>): Canvas {
  return {
    nodes: [],
    edges: [],
    entities: [],
    ...overrides,
  };
}

export function makeNode(overrides?: Partial<InlineNode>): InlineNode {
  return {
    id: 'test-node',
    type: 'compute/service',
    ...overrides,
  };
}

export function makeRefNode(overrides?: Partial<RefNode>): RefNode {
  return {
    id: 'test-ref',
    ref: 'svc-order-service',
    ...overrides,
  };
}

export function makeEdge(overrides?: Partial<Edge>): Edge {
  return {
    from: { node: 'node-a' },
    to: { node: 'node-b' },
    ...overrides,
  };
}

export function makeEntity(overrides?: Partial<Entity>): Entity {
  return {
    name: 'Order',
    ...overrides,
  };
}

export function makeMockRegistry(
  nodeDefs?: Map<string, NodeDef>,
): NodeDefRegistry {
  const defs = nodeDefs ?? new Map<string, NodeDef>();
  return {
    resolve: (type: string) => {
      // Strip @version suffix for lookup (mirrors real registry behavior)
      const atIdx = type.indexOf('@');
      const key = atIdx === -1 ? type : type.substring(0, atIdx);
      return defs.get(key);
    },
    resolveVersioned: (typeRef) => {
      const nodeDef = defs.get(typeRef.typeKey);
      return { nodeDef, versionMatch: true };
    },
    list: () => Array.from(defs.values()),
    search: () => [],
    listByNamespace: () => [],
  };
}

export const serviceNodeDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'service',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Service',
    description: 'A compute service',
    icon: 'server',
    shape: 'rectangle',
  },
  spec: {
    args: [
      { name: 'runtime', type: 'enum', required: true, options: ['node', 'go', 'rust'] },
      { name: 'replicas', type: 'number' },
      { name: 'description', type: 'string' },
    ],
    ports: [
      { name: 'http-in', direction: 'inbound', protocol: ['http'] },
      { name: 'http-out', direction: 'outbound', protocol: ['http'] },
    ],
  },
};

export function registryWith(...entries: [string, NodeDef][]) {
  return makeMockRegistry(new Map(entries));
}
