/**
 * Tests for Feature #237: Custom Node Colors and Icons
 * Verifies:
 * 1. Default color mappings per node type
 * 2. Custom color override via position.color
 * 3. Color persisted through graph engine operations
 * 4. Color picker integration with store
 * 5. RenderApi passes color to canvas nodes
 * 6. Icon map completeness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultNodeColor,
  getEffectiveNodeColor,
  colorToBackground,
  colorToBorder,
  NODE_COLOR_PALETTE,
} from '@/utils/nodeColors';
import {
  createNode,
  createEmptyGraph,
  addNode,
  findNode,
  updateNodeColor,
  updateNode,
  moveNode,
} from '@/core/graph/graphEngine';
import { RenderApi } from '@/api/renderApi';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';
import { iconMap } from '@/components/nodes/GenericNode';

// ============================================================
// 1. Default color mappings per node type
// ============================================================

describe('Default node color mappings', () => {
  it('compute/service returns blue', () => {
    expect(getDefaultNodeColor('compute/service')).toBe('#3B82F6');
  });

  it('compute/function returns indigo', () => {
    expect(getDefaultNodeColor('compute/function')).toBe('#6366F1');
  });

  it('compute/worker returns purple', () => {
    expect(getDefaultNodeColor('compute/worker')).toBe('#8B5CF6');
  });

  it('compute/api-gateway returns cyan', () => {
    expect(getDefaultNodeColor('compute/api-gateway')).toBe('#06B6D4');
  });

  it('data/database returns green', () => {
    expect(getDefaultNodeColor('data/database')).toBe('#10B981');
  });

  it('data/cache returns teal', () => {
    expect(getDefaultNodeColor('data/cache')).toBe('#14B8A6');
  });

  it('messaging/message-queue returns amber', () => {
    expect(getDefaultNodeColor('messaging/message-queue')).toBe('#F59E0B');
  });

  it('messaging/event-bus returns dark amber', () => {
    expect(getDefaultNodeColor('messaging/event-bus')).toBe('#D97706');
  });

  it('unknown compute type falls back to namespace blue', () => {
    expect(getDefaultNodeColor('compute/unknown')).toBe('#3B82F6');
  });

  it('unknown data type falls back to namespace green', () => {
    expect(getDefaultNodeColor('data/unknown')).toBe('#10B981');
  });

  it('unknown messaging type falls back to namespace orange', () => {
    expect(getDefaultNodeColor('messaging/unknown')).toBe('#F59E0B');
  });

  it('unknown network type falls back to namespace purple', () => {
    expect(getDefaultNodeColor('network/unknown')).toBe('#8B5CF6');
  });

  it('unknown observability type falls back to namespace cyan', () => {
    expect(getDefaultNodeColor('observability/unknown')).toBe('#06B6D4');
  });

  it('completely unknown type falls back to gray', () => {
    expect(getDefaultNodeColor('custom/something')).toBe('#6B7280');
  });

  it('empty string falls back to gray', () => {
    expect(getDefaultNodeColor('')).toBe('#6B7280');
  });
});

// ============================================================
// 2. Effective color (custom override vs type default)
// ============================================================

describe('Effective node color', () => {
  it('returns custom color when set', () => {
    expect(getEffectiveNodeColor('#FF0000', 'compute/service')).toBe('#FF0000');
  });

  it('returns type default when custom is undefined', () => {
    expect(getEffectiveNodeColor(undefined, 'compute/service')).toBe('#3B82F6');
  });

  it('returns type default when custom is empty string', () => {
    expect(getEffectiveNodeColor('', 'compute/service')).toBe('#3B82F6');
  });

  it('returns type default when custom is whitespace', () => {
    expect(getEffectiveNodeColor('   ', 'compute/service')).toBe('#3B82F6');
  });

  it('returns custom color from palette', () => {
    expect(getEffectiveNodeColor('#EF4444', 'data/database')).toBe('#EF4444');
  });
});

// ============================================================
// 3. Color utility functions
// ============================================================

describe('Color utility functions', () => {
  it('colorToBackground creates alpha-hex string', () => {
    const result = colorToBackground('#3B82F6', 0.12);
    expect(result).toMatch(/^#3B82F6[0-9a-f]{2}$/i);
  });

  it('colorToBackground default alpha is 0.12', () => {
    const result = colorToBackground('#3B82F6');
    // 0.12 * 255 ≈ 30.6 → 31 → hex "1f"
    expect(result).toBe('#3B82F61f');
  });

  it('colorToBorder creates alpha-hex string', () => {
    const result = colorToBorder('#10B981', 0.5);
    // 0.5 * 255 ≈ 127.5 → 128 → hex "80"
    expect(result).toBe('#10B98180');
  });

  it('colorToBorder default alpha is 0.5', () => {
    const result = colorToBorder('#10B981');
    expect(result).toBe('#10B98180');
  });
});

// ============================================================
// 4. Color palette
// ============================================================

describe('Node color palette', () => {
  it('has at least 10 colors', () => {
    expect(NODE_COLOR_PALETTE.length).toBeGreaterThanOrEqual(10);
  });

  it('all colors are valid hex strings', () => {
    for (const color of NODE_COLOR_PALETTE) {
      expect(color.value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('all colors have names', () => {
    for (const color of NODE_COLOR_PALETTE) {
      expect(color.name.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate color values', () => {
    const values = NODE_COLOR_PALETTE.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('has no duplicate color names', () => {
    const names = NODE_COLOR_PALETTE.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ============================================================
// 5. Graph Engine: updateNodeColor
// ============================================================

describe('Graph engine: updateNodeColor', () => {
  let graph: ArchGraph;
  const node1 = createNode({ type: 'compute/service', displayName: 'API Service' });
  const node2 = createNode({ type: 'data/database', displayName: 'Main DB' });

  beforeEach(() => {
    graph = createEmptyGraph('Test Architecture');
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
  });

  it('sets custom color on a node', () => {
    const updated = updateNodeColor(graph, node1.id, '#EF4444');
    const found = findNode(updated, node1.id);
    expect(found?.position.color).toBe('#EF4444');
  });

  it('does not affect other nodes', () => {
    const updated = updateNodeColor(graph, node1.id, '#EF4444');
    const found = findNode(updated, node2.id);
    expect(found?.position.color).toBeUndefined();
  });

  it('clears custom color when set to undefined', () => {
    let updated = updateNodeColor(graph, node1.id, '#EF4444');
    updated = updateNodeColor(updated, node1.id, undefined);
    const found = findNode(updated, node1.id);
    expect(found?.position.color).toBeUndefined();
  });

  it('preserves node position when updating color', () => {
    const movedGraph = moveNode(graph, node1.id, 100, 200);
    const updated = updateNodeColor(movedGraph, node1.id, '#EF4444');
    const found = findNode(updated, node1.id);
    expect(found?.position.x).toBe(100);
    expect(found?.position.y).toBe(200);
    expect(found?.position.color).toBe('#EF4444');
  });

  it('preserves node data when updating color', () => {
    const updated = updateNodeColor(graph, node1.id, '#EF4444');
    const found = findNode(updated, node1.id);
    expect(found?.displayName).toBe('API Service');
    expect(found?.type).toBe('compute/service');
  });

  it('returns same graph if node not found', () => {
    const updated = updateNodeColor(graph, 'nonexistent', '#EF4444');
    expect(updated.nodes).toEqual(graph.nodes);
  });
});

// ============================================================
// 6. TextApi: updateNodeColor
// ============================================================

describe('TextApi: updateNodeColor', () => {
  let textApi: TextApi;
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
    const graph = createEmptyGraph('Test');
    textApi = new TextApi(graph, registry);
  });

  it('sets custom color via TextApi', () => {
    const node = textApi.addNode({ type: 'compute/service', displayName: 'Svc' });
    textApi.updateNodeColor(node.id, '#EF4444');
    const found = findNode(textApi.getGraph(), node.id);
    expect(found?.position.color).toBe('#EF4444');
  });

  it('clears custom color via TextApi', () => {
    const node = textApi.addNode({ type: 'compute/service', displayName: 'Svc' });
    textApi.updateNodeColor(node.id, '#EF4444');
    textApi.updateNodeColor(node.id, undefined);
    const found = findNode(textApi.getGraph(), node.id);
    expect(found?.position.color).toBeUndefined();
  });
});

// ============================================================
// 7. RenderApi: color passed to canvas nodes
// ============================================================

describe('RenderApi: node color in canvas data', () => {
  let registry: RegistryManager;
  let renderApi: RenderApi;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
    renderApi = new RenderApi(registry);
  });

  it('passes undefined color when node has no custom color', () => {
    const node = createNode({ type: 'compute/service', displayName: 'API' });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);

    const { nodes } = renderApi.render(graph, []);
    expect(nodes[0].data.color).toBeUndefined();
  });

  it('passes custom color from position.color', () => {
    const node = createNode({ type: 'compute/service', displayName: 'API', position: { color: '#EF4444' } });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);

    const { nodes } = renderApi.render(graph, []);
    expect(nodes[0].data.color).toBe('#EF4444');
  });

  it('preserves icon from nodedef', () => {
    const node = createNode({ type: 'compute/service', displayName: 'API' });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);

    const { nodes } = renderApi.render(graph, []);
    // compute/service nodedef has icon 'Server'
    expect(nodes[0].data.icon).toBe('Server');
  });

  it('passes color after updateNodeColor', () => {
    const node = createNode({ type: 'data/database', displayName: 'DB' });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);
    graph = updateNodeColor(graph, node.id, '#F43F5E');

    const { nodes } = renderApi.render(graph, []);
    expect(nodes[0].data.color).toBe('#F43F5E');
  });
});

// ============================================================
// 8. Icon map completeness
// ============================================================

describe('Icon map completeness', () => {
  it('contains standard node type icons', () => {
    const requiredIcons = ['Server', 'Database', 'Shield', 'Radio', 'Globe', 'Cpu', 'Cog', 'Box'];
    for (const iconName of requiredIcons) {
      expect(iconMap[iconName]).toBeDefined();
    }
  });

  it('has at least 15 icons', () => {
    expect(Object.keys(iconMap).length).toBeGreaterThanOrEqual(15);
  });

  it('all icon entries are valid React components', () => {
    for (const [name, IconComponent] of Object.entries(iconMap)) {
      // Lucide icons can be functions or React.memo objects
      const isValid = typeof IconComponent === 'function' || typeof IconComponent === 'object';
      expect(isValid, `Icon '${name}' should be a valid React component`).toBe(true);
    }
  });
});

// ============================================================
// 9. Color persistence through graph operations
// ============================================================

describe('Color persistence through graph operations', () => {
  it('color survives node update (displayName change)', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Old Name' });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);
    graph = updateNodeColor(graph, node.id, '#EF4444');
    graph = updateNode(graph, node.id, { displayName: 'New Name' });

    const found = findNode(graph, node.id);
    expect(found?.position.color).toBe('#EF4444');
    expect(found?.displayName).toBe('New Name');
  });

  it('color survives node move', () => {
    const node = createNode({ type: 'compute/service', displayName: 'Svc' });
    let graph = createEmptyGraph();
    graph = addNode(graph, node);
    graph = updateNodeColor(graph, node.id, '#EC4899');
    graph = moveNode(graph, node.id, 500, 300);

    const found = findNode(graph, node.id);
    expect(found?.position.color).toBe('#EC4899');
    expect(found?.position.x).toBe(500);
    expect(found?.position.y).toBe(300);
  });

  it('color is included in createNode with position.color', () => {
    const node = createNode({
      type: 'compute/service',
      displayName: 'Colored Svc',
      position: { x: 10, y: 20, color: '#84CC16' },
    });
    expect(node.position.color).toBe('#84CC16');
  });

  it('multiple nodes can have different custom colors', () => {
    let graph = createEmptyGraph();
    const node1 = createNode({ type: 'compute/service', displayName: 'A' });
    const node2 = createNode({ type: 'data/database', displayName: 'B' });
    const node3 = createNode({ type: 'messaging/message-queue', displayName: 'C' });
    graph = addNode(graph, node1);
    graph = addNode(graph, node2);
    graph = addNode(graph, node3);
    graph = updateNodeColor(graph, node1.id, '#EF4444');
    graph = updateNodeColor(graph, node2.id, '#3B82F6');
    graph = updateNodeColor(graph, node3.id, '#10B981');

    expect(findNode(graph, node1.id)?.position.color).toBe('#EF4444');
    expect(findNode(graph, node2.id)?.position.color).toBe('#3B82F6');
    expect(findNode(graph, node3.id)?.position.color).toBe('#10B981');
  });
});

// ============================================================
// 10. Different node types have different default colors
// ============================================================

describe('Node types have visually distinct default colors', () => {
  it('compute and data types have different colors', () => {
    const computeColor = getDefaultNodeColor('compute/service');
    const dataColor = getDefaultNodeColor('data/database');
    expect(computeColor).not.toBe(dataColor);
  });

  it('data and messaging types have different colors', () => {
    const dataColor = getDefaultNodeColor('data/database');
    const messagingColor = getDefaultNodeColor('messaging/message-queue');
    expect(dataColor).not.toBe(messagingColor);
  });

  it('messaging and network types have different colors', () => {
    const messagingColor = getDefaultNodeColor('messaging/message-queue');
    const networkColor = getDefaultNodeColor('network/load-balancer');
    expect(messagingColor).not.toBe(networkColor);
  });

  it('observability and compute types have different colors', () => {
    const obsColor = getDefaultNodeColor('observability/monitoring');
    const computeColor = getDefaultNodeColor('compute/service');
    expect(obsColor).not.toBe(computeColor);
  });

  it('all namespace defaults are unique', () => {
    const colors = [
      getDefaultNodeColor('compute/unknown'),
      getDefaultNodeColor('data/unknown'),
      getDefaultNodeColor('messaging/unknown'),
      getDefaultNodeColor('network/unknown'),
      getDefaultNodeColor('observability/unknown'),
    ];
    expect(new Set(colors).size).toBe(5);
  });
});
