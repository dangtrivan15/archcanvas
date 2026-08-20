import type { NodeDef } from '@/types/nodeDefSchema';
import type { RuleContext, ValidationFinding, ValidationRule } from './types';
import { findCycles, isOrphan } from './graph';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** `namespace/name` for a resolved NodeDef. */
function nsName(def: NodeDef): string {
  return `${def.metadata.namespace}/${def.metadata.name}`;
}

function hasTag(def: NodeDef, tag: string): boolean {
  return (def.metadata.tags ?? []).includes(tag);
}

/** All edges (in-scope or not) with `nodeId` as either endpoint. */
function incidentEdges(ctx: RuleContext, nodeId: string) {
  return ctx.edges.filter((e) => e.from.node === nodeId || e.to.node === nodeId);
}

function resolvedNeighbor(ctx: RuleContext, neighborId: string): NodeDef | undefined {
  const node = ctx.inlineNodes.find((n) => n.id === neighborId);
  return node ? ctx.resolve(node) : undefined;
}

/** True when any 1-hop (in or out) in-scope neighbor's resolved def satisfies `predicate`. */
function neighborsOfType(
  ctx: RuleContext,
  nodeId: string,
  predicate: (def: NodeDef) => boolean,
): boolean {
  const entry = ctx.adjacency.get(nodeId);
  if (!entry) return false;
  const neighborIds = [...entry.out, ...entry.in];
  return neighborIds.some((id) => {
    const def = resolvedNeighbor(ctx, id);
    return def ? predicate(def) : false;
  });
}

const HEALTH_PORT_RE = /health|healthz|readiness|liveness|ping/i;
const PUBLIC_ENTRYPOINT_TYPES = new Set(['network/api-gateway', 'network/load-balancer', 'network/cdn']);
const OBSERVABILITY_NAMESPACE = 'observability';
const SERVICE_LIKE_TYPES = new Set(['compute/service', 'compute/worker']);
const OBSERVABILITY_SOURCE_TYPES = new Set(['compute/service', 'compute/worker', 'compute/function']);

function finding(partial: Omit<ValidationFinding, 'canvasId' | 'source'> & { source?: ValidationFinding['source'] }, ctx: RuleContext): ValidationFinding {
  return { canvasId: ctx.canvasId, source: 'builtin-rule', ...partial };
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

/**
 * Database with no read replica and no edge to an object-storage backup
 * target. The database-like check only falls back to the `persistence` tag
 * (unique to data/database among builtins) — NOT `storage`, which
 * data/object-storage also carries and would otherwise misclassify the
 * backup target itself as needing a backup. No built-in NodeDef carries a
 * `backup` tag, so the backup-target check below is type-based
 * (data/object-storage), not tag-based. Extend both if a future NodeDef
 * adopts a `backup` tag convention.
 */
export const databaseBackupRule: ValidationRule = {
  id: 'db-no-backup',
  description: 'Flags databases with no read replica and no backup/object-storage target.',
  evaluate(ctx) {
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      const def = ctx.resolve(node);
      if (!def) continue;
      const isDatabaseLike = nsName(def) === 'data/database' || hasTag(def, 'persistence');
      if (!isDatabaseLike) continue;

      const replicas = Number(node.args?.replicas ?? 0);
      if (replicas >= 1) continue;

      const hasBackupTarget = neighborsOfType(ctx, node.id, (d) => nsName(d) === 'data/object-storage');
      if (hasBackupTarget) continue;

      findings.push(finding({
        ruleId: 'db-no-backup',
        severity: 'warning',
        title: node.displayName ?? def.metadata.displayName,
        message: `'${node.displayName ?? node.id}' has no read replica and no backup target.`,
        nodeId: node.id,
        suggestion: 'Add a read replica (replicas ≥ 1) or connect it to a backup target.',
      }, ctx));
    }
    return findings;
  },
};

export const healthCheckRule: ValidationRule = {
  id: 'service-no-healthcheck',
  description: 'Flags services/workers with no health-check port or connected health-check edge.',
  evaluate(ctx) {
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      const def = ctx.resolve(node);
      if (!def || !SERVICE_LIKE_TYPES.has(nsName(def))) continue;

      const defHasHealthPort = (def.spec.ports ?? []).some((p) => HEALTH_PORT_RE.test(p.name));
      if (defHasHealthPort) continue;

      const hasHealthEdge = incidentEdges(ctx, node.id).some(
        (e) => HEALTH_PORT_RE.test(e.from.port ?? '') || HEALTH_PORT_RE.test(e.to.port ?? ''),
      );
      if (hasHealthEdge) continue;

      findings.push(finding({
        ruleId: 'service-no-healthcheck',
        severity: 'info',
        title: node.displayName ?? def.metadata.displayName,
        message: `'${node.displayName ?? node.id}' exposes no health-check port or edge.`,
        nodeId: node.id,
        suggestion: 'Expose or attach a health-check probe (health/healthz/readiness/liveness).',
      }, ctx));
    }
    return findings;
  },
};

export const publicExposureRule: ValidationRule = {
  id: 'public-no-waf-auth',
  description: 'Flags public-facing nodes with no adjacent WAF or auth provider.',
  evaluate(ctx) {
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      const def = ctx.resolve(node);
      if (!def) continue;

      const isEntrypointType = PUBLIC_ENTRYPOINT_TYPES.has(nsName(def));
      const hasClientInbound = (ctx.adjacency.get(node.id)?.in ?? []).some((id) => {
        const neighborDef = resolvedNeighbor(ctx, id);
        return neighborDef?.metadata.namespace === 'client';
      });
      const isPublicFacing = isEntrypointType || hasClientInbound;
      if (!isPublicFacing) continue;

      const isProtected = neighborsOfType(
        ctx,
        node.id,
        (d) => nsName(d) === 'security/waf' || nsName(d) === 'security/auth-provider',
      );
      if (isProtected) continue;

      findings.push(finding({
        ruleId: 'public-no-waf-auth',
        severity: 'critical',
        title: node.displayName ?? def.metadata.displayName,
        message: `'${node.displayName ?? node.id}' is public-facing with no WAF or auth-provider in front of it.`,
        nodeId: node.id,
        suggestion: 'Place a WAF or auth-provider in front of this node.',
      }, ctx));
    }
    return findings;
  },
};

export const circularDependencyRule: ValidationRule = {
  id: 'circular-dependency',
  description: 'Flags directed cycles among in-scope nodes.',
  evaluate(ctx) {
    const cycles = findCycles(ctx.adjacency);
    return cycles.map((cycle) => finding({
      ruleId: 'circular-dependency',
      severity: 'warning',
      title: 'Circular dependency',
      message: `Cycle detected: ${cycle.join(' → ')} → ${cycle[0]}`,
      nodeId: cycle[0],
      relatedNodeIds: cycle,
      suggestion: 'Break the cycle by removing or inverting one of the edges in the path.',
    }, ctx));
  },
};

export const orphanNodeRule: ValidationRule = {
  id: 'orphan-node',
  description: 'Flags nodes with no in-scope inbound or outbound edges.',
  evaluate(ctx) {
    const totalNodeCount = (ctx.canvas.nodes ?? []).length;
    if (totalNodeCount <= 1) return [];
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      if (!isOrphan(node.id, ctx.adjacency)) continue;
      const def = ctx.resolve(node);
      findings.push(finding({
        ruleId: 'orphan-node',
        severity: 'info',
        title: node.displayName ?? def?.metadata.displayName ?? node.id,
        message: `'${node.displayName ?? node.id}' has no connections in this scope.`,
        nodeId: node.id,
        suggestion: 'Connect this node, or remove it if unused.',
      }, ctx));
    }
    return findings;
  },
};

export const missingObservabilityRule: ValidationRule = {
  id: 'missing-observability',
  description: 'Flags services/workers/functions with no connected logging/monitoring/tracing node.',
  evaluate(ctx) {
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      const def = ctx.resolve(node);
      if (!def || !OBSERVABILITY_SOURCE_TYPES.has(nsName(def))) continue;

      const hasObservabilityNeighbor = neighborsOfType(
        ctx,
        node.id,
        (d) => d.metadata.namespace === OBSERVABILITY_NAMESPACE,
      );
      if (hasObservabilityNeighbor) continue;

      findings.push(finding({
        ruleId: 'missing-observability',
        severity: 'info',
        title: node.displayName ?? def.metadata.displayName,
        message: `'${node.displayName ?? node.id}' has no connected logging/monitoring/tracing node.`,
        nodeId: node.id,
        suggestion: 'Connect this node to an observability component (logging, monitoring, or tracing).',
      }, ctx));
    }
    return findings;
  },
};

export const reviewHintsRule: ValidationRule = {
  id: 'review-hint',
  description: "Surfaces each authored NodeDef's spec.ai.reviewHints as a contextual info finding.",
  evaluate(ctx) {
    const findings: ValidationFinding[] = [];
    for (const node of ctx.inlineNodes) {
      const def = ctx.resolve(node);
      if (!def) continue;
      const hints = def.spec.ai?.reviewHints ?? [];
      for (const hint of hints) {
        findings.push({
          ruleId: 'review-hint',
          severity: 'info',
          title: def.metadata.displayName,
          message: hint,
          canvasId: ctx.canvasId,
          nodeId: node.id,
          source: 'review-hint',
        });
      }
    }
    return findings;
  },
};

export const BUILTIN_RULES: ValidationRule[] = [
  databaseBackupRule,
  healthCheckRule,
  publicExposureRule,
  circularDependencyRule,
  orphanNodeRule,
  missingObservabilityRule,
];

export const ALL_RULES: ValidationRule[] = [...BUILTIN_RULES, reviewHintsRule];
