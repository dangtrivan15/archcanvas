import { describe, it, expect } from 'vitest';
import type { NodeDef } from '@/types/nodeDefSchema';
import { validateArchitecture } from '@/core/validation/engine';
import type { ValidationRule } from '@/core/validation/types';
import { makeCanvas, makeNode, makeRefNode, makeEdge, registryWith, serviceNodeDef } from '../../../core/graph/helpers';

const clientDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'web-app',
    namespace: 'client',
    version: '1.0.0',
    displayName: 'Web App',
    description: 'A web app',
    icon: 'box',
    shape: 'rectangle',
  },
  spec: {},
};

describe('validateArchitecture', () => {
  it('returns an empty report with a zeroed summary for an empty canvas', () => {
    const canvas = makeCanvas({ nodes: [], edges: [] });
    const registry = registryWith();
    const report = validateArchitecture(canvas, registry, { canvasId: '__root__' });
    expect(report.findings).toEqual([]);
    expect(report.summary).toEqual({ critical: 0, warning: 0, info: 0, total: 0 });
    expect(report.canvasId).toBe('__root__');
    expect(typeof report.ranAt).toBe('number');
  });

  it('sorts findings critical → warning → info', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'web-a', type: 'client/web-app' }),
        makeNode({ id: 'svc-a', type: 'compute/service' }),
        makeNode({ id: 'db-a', type: 'data/database', args: { replicas: 0 } }),
      ],
      edges: [makeEdge({ from: { node: 'web-a' }, to: { node: 'svc-a' } })],
    });
    const databaseDef: NodeDef = {
      kind: 'NodeDef',
      apiVersion: 'v1',
      metadata: {
        name: 'database', namespace: 'data', version: '1.0.0', displayName: 'Database',
        description: 'A database', icon: 'box', tags: ['storage', 'persistence'], shape: 'cylinder',
      },
      spec: {},
    };
    const registry = registryWith(
      ['client/web-app', clientDef],
      ['compute/service', serviceNodeDef],
      ['data/database', databaseDef],
    );
    const report = validateArchitecture(canvas, registry, { canvasId: '__root__' });

    expect(report.findings.length).toBeGreaterThan(0);
    const severities = report.findings.map((f) => f.severity);
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
    }
    expect(severities).toContain('critical'); // public-no-waf-auth
    expect(severities).toContain('warning'); // db-no-backup
  });

  it('dedupes repeated findings', () => {
    const dupeRule: ValidationRule = {
      id: 'dupe',
      description: 'always emits the same finding twice',
      evaluate: (ctx) => [
        { ruleId: 'dupe', severity: 'info', title: 't', message: 'm', canvasId: ctx.canvasId, nodeId: 'a', source: 'builtin-rule' },
        { ruleId: 'dupe', severity: 'info', title: 't', message: 'm', canvasId: ctx.canvasId, nodeId: 'a', source: 'builtin-rule' },
      ],
    };
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })], edges: [] });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const report = validateArchitecture(canvas, registry, { canvasId: '__root__', rules: [dupeRule] });
    expect(report.findings).toHaveLength(1);
    expect(report.summary.total).toBe(1);
  });

  it('skips ref-only nodes (no NodeDef to resolve)', () => {
    const canvas = makeCanvas({ nodes: [makeRefNode({ id: 'ref-a' })], edges: [] });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const report = validateArchitecture(canvas, registry, { canvasId: '__root__' });
    expect(report.findings).toEqual([]);
  });

  it('defaults canvasId to canvas.id, then __root__', () => {
    const canvas = makeCanvas({ id: 'sub-a', nodes: [], edges: [] });
    const registry = registryWith();
    expect(validateArchitecture(canvas, registry).canvasId).toBe('sub-a');
    expect(validateArchitecture(makeCanvas({ nodes: [], edges: [] }), registry).canvasId).toBe('__root__');
  });
});
