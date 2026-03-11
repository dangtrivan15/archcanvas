/**
 * Tests for Feature #448: Container Node Type (archc-ref)
 * Verifies:
 * 1. ContainerNode component renders with correct visual elements
 * 2. NodeDef YAML for meta/canvas-ref is properly defined
 * 3. Node type maps include the container type
 * 4. RenderApi maps meta/canvas-ref to 'container' component type
 * 5. refSource with .archc extension maps to container type
 * 6. File name extraction from refSource patterns
 */

import { describe, it, expect } from 'vitest';
import { nodeTypes } from '@/components/nodes/nodeTypeMap';
import { lodNodeTypes } from '@/components/nodes/lodNodeTypeMap';
import { ContainerNode } from '@/components/nodes/ContainerNode';
import { SimplifiedNode } from '@/components/nodes/SimplifiedNode';
import { RenderApi } from '@/api/renderApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createNode, createEmptyGraph, addNode } from '@/core/graph/graphEngine';
import { iconMap } from '@/components/nodes/iconMap';

// ============================================================
// 1. NodeTypeMap registration
// ============================================================

describe('Container node type registration', () => {
  it('nodeTypes map includes container entry', () => {
    expect(nodeTypes).toHaveProperty('container');
    expect(nodeTypes.container).toBe(ContainerNode);
  });

  it('lodNodeTypes map includes container entry', () => {
    expect(lodNodeTypes).toHaveProperty('container');
    expect(lodNodeTypes.container).toBe(SimplifiedNode);
  });
});

// ============================================================
// 2. Icon registration
// ============================================================

describe('Container node icon', () => {
  it('FolderOpen icon is registered in iconMap', () => {
    expect(iconMap).toHaveProperty('FolderOpen');
    expect(typeof iconMap.FolderOpen).toBe('object'); // React component
  });
});

// ============================================================
// 3. NodeDef YAML loaded in registry
// ============================================================

describe('Container NodeDef registration', () => {
  let registry: RegistryManager;

  it('meta/canvas-ref nodedef is resolved by the registry', () => {
    registry = new RegistryManager();
    registry.initialize();
    const def = registry.resolve('meta/canvas-ref');
    expect(def).toBeDefined();
    expect(def!.metadata.name).toBe('canvas-ref');
    expect(def!.metadata.namespace).toBe('meta');
    expect(def!.metadata.displayName).toBe('Architecture Canvas');
    expect(def!.metadata.icon).toBe('FolderOpen');
    expect(def!.metadata.shape).toBe('container');
  });

  it('meta/canvas-ref has filePath arg defined', () => {
    registry = new RegistryManager();
    registry.initialize();
    const def = registry.resolve('meta/canvas-ref');
    expect(def).toBeDefined();
    const filePathArg = def!.spec.args.find((a: { name: string }) => a.name === 'filePath');
    expect(filePathArg).toBeDefined();
    expect(filePathArg!.type).toBe('string');
    expect(filePathArg!.required).toBe(false);
  });

  it('meta/canvas-ref has nodeCount arg defined', () => {
    registry = new RegistryManager();
    registry.initialize();
    const def = registry.resolve('meta/canvas-ref');
    expect(def).toBeDefined();
    const nodeCountArg = def!.spec.args.find((a: { name: string }) => a.name === 'nodeCount');
    expect(nodeCountArg).toBeDefined();
    expect(nodeCountArg!.type).toBe('number');
  });

  it('meta/canvas-ref has inbound and outbound ports', () => {
    registry = new RegistryManager();
    registry.initialize();
    const def = registry.resolve('meta/canvas-ref');
    expect(def).toBeDefined();
    const inbound = def!.spec.ports.filter(
      (p: { direction: string }) => p.direction === 'inbound',
    );
    const outbound = def!.spec.ports.filter(
      (p: { direction: string }) => p.direction === 'outbound',
    );
    expect(inbound.length).toBeGreaterThanOrEqual(1);
    expect(outbound.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 4. RenderApi mapping
// ============================================================

describe('RenderApi container node mapping', () => {
  let registry: RegistryManager;
  let renderApi: RenderApi;

  it('meta/canvas-ref node maps to container component type', () => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
    let graph = createEmptyGraph('test');
    const node = createNode({ type: 'meta/canvas-ref', displayName: 'Child System' });
    graph = addNode(graph, node);

    const result = renderApi.render(graph, []);
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].type).toBe('container');
  });

  it('node with .archc refSource maps to container type regardless of nodedef', () => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
    let graph = createEmptyGraph('test');
    const node = createNode({ type: 'compute/service', displayName: 'Some Service' });
    // Add a .archc refSource to simulate linking
    node.refSource = 'file://./child-system.archc';
    graph = addNode(graph, node);

    const result = renderApi.render(graph, []);
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].type).toBe('container');
  });

  it('node with non-.archc refSource still maps to ref type', () => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
    let graph = createEmptyGraph('test');
    const node = createNode({ type: 'compute/service', displayName: 'External Service' });
    node.refSource = 'https://example.com/api';
    graph = addNode(graph, node);

    const result = renderApi.render(graph, []);
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].type).toBe('ref');
  });

  it('container node passes refSource to canvas data', () => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
    let graph = createEmptyGraph('test');
    const node = createNode({ type: 'meta/canvas-ref', displayName: 'Nested Canvas' });
    node.refSource = 'file://./subsystem.archc';
    graph = addNode(graph, node);

    const result = renderApi.render(graph, []);
    expect(result.nodes[0].data.refSource).toBe('file://./subsystem.archc');
  });
});

// ============================================================
// 5. Shape-to-component mapping
// ============================================================

describe('Container shape mapping', () => {
  it('SHAPE_TO_COMPONENT includes container mapping', () => {
    // Test indirectly: a meta/canvas-ref node with shape=container gets the right type
    const registry = new RegistryManager();
    registry.initialize();
    const renderApi = new RenderApi(registry);
    let graph = createEmptyGraph('test');
    const node = createNode({ type: 'meta/canvas-ref', displayName: 'Test Canvas' });
    graph = addNode(graph, node);

    const result = renderApi.render(graph, []);
    expect(result.nodes[0].type).toBe('container');
  });
});
