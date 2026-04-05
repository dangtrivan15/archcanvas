import { describe, it, expect } from 'vitest';
import { getAllTemplates } from '@/core/templates/loader';
import { loadBuiltins } from '@/core/registry/loader';

describe('template validation against builtin registry', () => {
  const builtins = loadBuiltins();
  const templates = getAllTemplates();

  it('has builtins loaded', () => {
    expect(builtins.size).toBeGreaterThan(0);
  });

  for (const template of templates) {
    describe(`template: ${template.id}`, () => {
      const nodes = template.canvas.nodes ?? [];
      const edges = template.canvas.edges ?? [];

      it('has at least one node', () => {
        expect(nodes.length).toBeGreaterThan(0);
      });

      it('has at least one edge', () => {
        expect(edges.length).toBeGreaterThan(0);
      });

      it('all node types exist in the builtin registry', () => {
        for (const node of nodes) {
          if ('type' in node) {
            const exists = builtins.has(node.type);
            expect(exists, `Node "${node.id}" uses type "${node.type}" which is not in the builtin registry`).toBe(true);
          }
        }
      });

      it('all edge endpoints reference existing nodes', () => {
        const nodeIds = new Set(nodes.map((n) => n.id));

        for (const edge of edges) {
          expect(
            nodeIds.has(edge.from.node),
            `Edge from "${edge.from.node}" references non-existent node in template "${template.id}"`,
          ).toBe(true);

          expect(
            nodeIds.has(edge.to.node),
            `Edge to "${edge.to.node}" references non-existent node in template "${template.id}"`,
          ).toBe(true);
        }
      });

      it('all node IDs are unique', () => {
        const ids = nodes.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('all inline nodes have a position', () => {
        for (const node of nodes) {
          if ('type' in node) {
            expect(node.position, `Node "${node.id}" is missing a position`).toBeDefined();
          }
        }
      });
    });
  }
});
