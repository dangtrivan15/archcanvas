import { describe, it, expect } from 'vitest';
import type { NodeDef } from '@/types/nodeDefSchema';
import { buildRuleContext } from '@/core/validation/engine';
import {
  databaseBackupRule,
  healthCheckRule,
  publicExposureRule,
  circularDependencyRule,
  orphanNodeRule,
  missingObservabilityRule,
  reviewHintsRule,
} from '@/core/validation/rules';
import { makeCanvas, makeNode, makeEdge, registryWith, serviceNodeDef } from '../../../core/graph/helpers';

function def(overrides: {
  namespace: string;
  name: string;
  tags?: string[];
  ports?: NodeDef['spec']['ports'];
  reviewHints?: string[];
}): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name: overrides.name,
      namespace: overrides.namespace,
      version: '1.0.0',
      displayName: overrides.name,
      description: `A ${overrides.name}`,
      icon: 'box',
      tags: overrides.tags,
      shape: 'rectangle',
    },
    spec: {
      ports: overrides.ports,
      ai: overrides.reviewHints ? { reviewHints: overrides.reviewHints } : undefined,
    },
  };
}

const databaseDef = def({ namespace: 'data', name: 'database', tags: ['storage', 'persistence'] });
const objectStorageDef = def({ namespace: 'data', name: 'object-storage', tags: ['storage', 'blob', 'files'] });
const gatewayDef = def({ namespace: 'network', name: 'api-gateway' });
const wafDef = def({ namespace: 'security', name: 'waf' });
const authProviderDef = def({ namespace: 'security', name: 'auth-provider' });
const clientDef = def({ namespace: 'client', name: 'web-app' });
const loggingDef = def({ namespace: 'observability', name: 'logging' });
const workerDef = def({ namespace: 'compute', name: 'worker' });

describe('databaseBackupRule', () => {
  it('flags a database with no replicas and no backup target', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'db-a', type: 'data/database', args: { replicas: 0 } })],
      edges: [],
    });
    const registry = registryWith(['data/database', databaseDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = databaseBackupRule.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'db-no-backup', severity: 'warning', nodeId: 'db-a' });
  });

  it('does not flag a database with replicas >= 1', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'db-a', type: 'data/database', args: { replicas: 1 } })],
      edges: [],
    });
    const registry = registryWith(['data/database', databaseDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(databaseBackupRule.evaluate(ctx)).toHaveLength(0);
  });

  it('does not flag a database with a backup (object-storage) edge', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'db-a', type: 'data/database', args: { replicas: 0 } }),
        makeNode({ id: 'os-a', type: 'data/object-storage' }),
      ],
      edges: [makeEdge({ from: { node: 'db-a' }, to: { node: 'os-a' } })],
    });
    const registry = registryWith(['data/database', databaseDef], ['data/object-storage', objectStorageDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(databaseBackupRule.evaluate(ctx)).toHaveLength(0);
  });

  it('does not misclassify a data/object-storage node as a database via its `storage` tag', () => {
    // Regression: object-storage carries a `storage` tag but NOT `persistence`;
    // the rule's tag fallback is `persistence`-only, so the backup target itself
    // must never be flagged as needing a backup.
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'os-a', type: 'data/object-storage' })],
      edges: [],
    });
    const registry = registryWith(['data/object-storage', objectStorageDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(databaseBackupRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('healthCheckRule', () => {
  it('flags a service with no health port and no health edge', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'svc-a', type: 'compute/service' })], edges: [] });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = healthCheckRule.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'service-no-healthcheck', severity: 'info', nodeId: 'svc-a' });
  });

  it('does not flag a service with a health-check edge', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'svc-a', type: 'compute/service' }), makeNode({ id: 'mon-a', type: 'compute/worker' })],
      edges: [makeEdge({ from: { node: 'mon-a' }, to: { node: 'svc-a', port: 'healthz' } })],
    });
    const registry = registryWith(['compute/service', serviceNodeDef], ['compute/worker', workerDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(healthCheckRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('publicExposureRule', () => {
  it('flags a client→service edge with no WAF/auth as critical', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'web-a', type: 'client/web-app' }), makeNode({ id: 'svc-a', type: 'compute/service' })],
      edges: [makeEdge({ from: { node: 'web-a' }, to: { node: 'svc-a' } })],
    });
    const registry = registryWith(['client/web-app', clientDef], ['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = publicExposureRule.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'public-no-waf-auth', severity: 'critical', nodeId: 'svc-a' });
  });

  it('does not flag when an auth-provider neighbor is present', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'web-a', type: 'client/web-app' }),
        makeNode({ id: 'svc-a', type: 'compute/service' }),
        makeNode({ id: 'auth-a', type: 'security/auth-provider' }),
      ],
      edges: [
        makeEdge({ from: { node: 'web-a' }, to: { node: 'svc-a' } }),
        makeEdge({ from: { node: 'svc-a' }, to: { node: 'auth-a' } }),
      ],
    });
    const registry = registryWith(
      ['client/web-app', clientDef],
      ['compute/service', serviceNodeDef],
      ['security/auth-provider', authProviderDef],
    );
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(publicExposureRule.evaluate(ctx)).toHaveLength(0);
  });

  it('treats a gateway/lb/cdn node as public-facing even with no client edge', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'gw-a', type: 'network/api-gateway' })], edges: [] });
    const registry = registryWith(['network/api-gateway', gatewayDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(publicExposureRule.evaluate(ctx)).toHaveLength(1);
  });

  it('does not flag a gateway protected by a WAF neighbor', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'gw-a', type: 'network/api-gateway' }), makeNode({ id: 'waf-a', type: 'security/waf' })],
      edges: [makeEdge({ from: { node: 'waf-a' }, to: { node: 'gw-a' } })],
    });
    const registry = registryWith(['network/api-gateway', gatewayDef], ['security/waf', wafDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(publicExposureRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('circularDependencyRule', () => {
  it('emits exactly one finding for a genuine directed cycle', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' }), makeNode({ id: 'c' })],
      edges: [
        makeEdge({ from: { node: 'a' }, to: { node: 'b' } }),
        makeEdge({ from: { node: 'b' }, to: { node: 'c' } }),
        makeEdge({ from: { node: 'c' }, to: { node: 'a' } }),
      ],
    });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = circularDependencyRule.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'circular-dependency', severity: 'warning' });
    expect(findings[0].relatedNodeIds).toHaveLength(3);
  });

  it('emits nothing for a DAG', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: [makeEdge({ from: { node: 'a' }, to: { node: 'b' } })],
    });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(circularDependencyRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('orphanNodeRule', () => {
  it('flags a node with no connections', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: [],
    });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = orphanNodeRule.evaluate(ctx);
    expect(findings.map((f) => f.nodeId).sort()).toEqual(['a', 'b']);
  });

  it('does not flag when it is the only node on the canvas', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'a' })], edges: [] });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(orphanNodeRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('missingObservabilityRule', () => {
  it('flags a service with no connected observability node', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'svc-a', type: 'compute/service' })], edges: [] });
    const registry = registryWith(['compute/service', serviceNodeDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = missingObservabilityRule.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'missing-observability', severity: 'info', nodeId: 'svc-a' });
  });

  it('does not flag when connected to a logging node', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'svc-a', type: 'compute/service' }), makeNode({ id: 'log-a', type: 'observability/logging' })],
      edges: [makeEdge({ from: { node: 'svc-a' }, to: { node: 'log-a' } })],
    });
    const registry = registryWith(['compute/service', serviceNodeDef], ['observability/logging', loggingDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(missingObservabilityRule.evaluate(ctx)).toHaveLength(0);
  });
});

describe('reviewHintsRule', () => {
  it('emits one finding per authored reviewHint', () => {
    const hintedDef = def({ namespace: 'compute', name: 'service', reviewHints: ['Consider rate limiting.', 'Add retries with backoff.'] });
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'svc-a', type: 'compute/service' })], edges: [] });
    const registry = registryWith(['compute/service', hintedDef]);
    const ctx = buildRuleContext(canvas, registry, '__root__');
    const findings = reviewHintsRule.evaluate(ctx);
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.source === 'review-hint' && f.severity === 'info')).toBe(true);
    expect(findings.map((f) => f.message)).toEqual(['Consider rate limiting.', 'Add retries with backoff.']);
  });

  it('emits nothing for an unknown node type', () => {
    const canvas = makeCanvas({ nodes: [makeNode({ id: 'x', type: 'compute/service' })], edges: [] });
    const registry = registryWith();
    const ctx = buildRuleContext(canvas, registry, '__root__');
    expect(reviewHintsRule.evaluate(ctx)).toHaveLength(0);
  });
});
