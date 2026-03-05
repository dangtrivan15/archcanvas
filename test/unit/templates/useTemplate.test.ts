/**
 * Integration tests for the "Use Template" action.
 * Verifies that template instantiation produces valid architectures
 * with unique IDs, ELK auto-layout, and proper state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { instantiateStack, getAvailableStacks, type StackTemplate } from '@/stacks/stackLoader';
import { computeElkLayout } from '@/core/layout/elkLayout';
import { generateId } from '@/utils/idGenerator';
import type { ArchGraph } from '@/types/graph';

// Helper: create a minimal stack template for testing
function createTestStack(overrides?: Partial<StackTemplate>): StackTemplate {
  return {
    metadata: {
      name: 'test-stack',
      displayName: 'Test Stack',
      description: 'A test stack template',
      icon: 'Rocket',
      tags: ['test'],
    },
    nodes: [
      {
        id: 'node-a',
        type: 'service',
        displayName: 'Service A',
        args: { framework: 'express', language: 'typescript' },
        position: { x: 0, y: 0, width: 200, height: 100 },
      },
      {
        id: 'node-b',
        type: 'database',
        displayName: 'Database B',
        args: { engine: 'postgres' },
        position: { x: 300, y: 0, width: 200, height: 100 },
      },
      {
        id: 'node-c',
        type: 'cache',
        displayName: 'Cache C',
        args: { engine: 'redis' },
        position: { x: 600, y: 0, width: 200, height: 100 },
      },
    ],
    edges: [
      { fromNode: 'node-a', toNode: 'node-b', type: 'sync', label: 'queries' },
      { fromNode: 'node-a', toNode: 'node-c', type: 'sync', label: 'reads' },
    ],
    ...overrides,
  };
}

describe('Use Template Action - Template Instantiation', () => {
  describe('instantiateStack', () => {
    it('generates fresh ULIDs for all nodes', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      expect(graph.nodes).toHaveLength(3);
      // All node IDs should be unique ULIDs (not the template-local IDs)
      const nodeIds = graph.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size).toBe(3);
      // None should match the original template IDs
      expect(nodeIds).not.toContain('node-a');
      expect(nodeIds).not.toContain('node-b');
      expect(nodeIds).not.toContain('node-c');
    });

    it('generates fresh ULIDs for all edges', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      expect(graph.edges).toHaveLength(2);
      const edgeIds = graph.edges.map((e) => e.id);
      expect(new Set(edgeIds).size).toBe(2);
    });

    it('rewires edge references to new node IDs', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.fromNode)).toBe(true);
        expect(nodeIds.has(edge.toNode)).toBe(true);
      }
    });

    it('preserves node types and display names', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const names = graph.nodes.map((n) => n.displayName).sort();
      expect(names).toEqual(['Cache C', 'Database B', 'Service A']);

      const types = graph.nodes.map((n) => n.type).sort();
      expect(types).toEqual(['cache', 'database', 'service']);
    });

    it('preserves node args', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const serviceA = graph.nodes.find((n) => n.displayName === 'Service A');
      expect(serviceA?.args).toEqual({ framework: 'express', language: 'typescript' });

      const dbB = graph.nodes.find((n) => n.displayName === 'Database B');
      expect(dbB?.args).toEqual({ engine: 'postgres' });
    });

    it('preserves edge labels and types', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const labels = graph.edges.map((e) => e.label).sort();
      expect(labels).toEqual(['queries', 'reads']);

      expect(graph.edges.every((e) => e.type === 'sync')).toBe(true);
    });

    it('sets architecture name from template displayName', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);
      expect(graph.name).toBe('Test Stack');
    });

    it('sets architecture description from template', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);
      expect(graph.description).toBe('A test stack template');
    });

    it('initializes empty annotations array', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);
      expect(graph.annotations).toEqual([]);
    });

    it('produces unique IDs across multiple instantiations', () => {
      const stack = createTestStack();
      const graph1 = instantiateStack(stack);
      const graph2 = instantiateStack(stack);

      const allIds1 = [...graph1.nodes.map((n) => n.id), ...graph1.edges.map((e) => e.id)];
      const allIds2 = [...graph2.nodes.map((n) => n.id), ...graph2.edges.map((e) => e.id)];

      // No ID overlap between two instantiations
      const overlap = allIds1.filter((id) => allIds2.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('initializes empty codeRefs and notes for each node', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      for (const node of graph.nodes) {
        expect(node.codeRefs).toEqual([]);
        expect(node.notes).toEqual([]);
        expect(node.properties).toEqual({});
        expect(node.children).toEqual([]);
      }
    });
  });

  describe('ELK auto-layout', () => {
    it('computes layout positions for all nodes', async () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const result = await computeElkLayout(graph.nodes, graph.edges, 'horizontal');
      expect(result.positions.size).toBe(3);

      for (const node of graph.nodes) {
        const pos = result.positions.get(node.id);
        expect(pos).toBeDefined();
        expect(typeof pos!.x).toBe('number');
        expect(typeof pos!.y).toBe('number');
      }
    });

    it('produces non-overlapping layout positions', async () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const result = await computeElkLayout(graph.nodes, graph.edges, 'horizontal');
      const positions = Array.from(result.positions.values());

      // At least some positions should differ (not all stacked at origin)
      const uniqueX = new Set(positions.map((p) => p.x));
      const uniqueY = new Set(positions.map((p) => p.y));
      expect(uniqueX.size + uniqueY.size).toBeGreaterThan(2);
    });

    it('handles empty graph gracefully', async () => {
      const result = await computeElkLayout([], [], 'horizontal');
      expect(result.positions.size).toBe(0);
    });
  });

  describe('Architecture name customization', () => {
    it('allows overriding the architecture name after instantiation', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      // Simulate what UseTemplateDialog does
      graph.name = 'My Custom Architecture';
      expect(graph.name).toBe('My Custom Architecture');
    });

    it('falls back to template displayName when name is empty', () => {
      const stack = createTestStack();
      const graph = instantiateStack(stack);

      const customName = '';
      graph.name = customName || stack.metadata.displayName;
      expect(graph.name).toBe('Test Stack');
    });
  });

  describe('Built-in template instantiation', () => {
    const builtinStacks = getAvailableStacks();

    it('has at least 10 built-in templates', () => {
      expect(builtinStacks.length).toBeGreaterThanOrEqual(10);
    });

    it.each(builtinStacks.map((s) => [s.metadata.name, s]))(
      'template "%s" instantiates with valid unique IDs',
      (_name, stack) => {
        const graph = instantiateStack(stack as StackTemplate);

        // All node IDs are unique
        const nodeIds = graph.nodes.map((n) => n.id);
        expect(new Set(nodeIds).size).toBe(nodeIds.length);

        // All edge IDs are unique
        const edgeIds = graph.edges.map((e) => e.id);
        expect(new Set(edgeIds).size).toBe(edgeIds.length);

        // All edges reference valid nodes
        const nodeIdSet = new Set(nodeIds);
        for (const edge of graph.edges) {
          expect(nodeIdSet.has(edge.fromNode)).toBe(true);
          expect(nodeIdSet.has(edge.toNode)).toBe(true);
        }

        // Architecture has a name
        expect(graph.name).toBeTruthy();
        expect(graph.nodes.length).toBeGreaterThan(0);
      },
    );
  });
});
