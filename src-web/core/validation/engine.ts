import type { Canvas, InlineNode } from '@/types';
import type { NodeDefRegistry } from '@/core/registry/core';
import { buildAdjacency } from './graph';
import { ALL_RULES } from './rules';
import type { RuleContext, Severity, ValidationFinding, ValidationReport, ValidationRule } from './types';

/** Build the shared `RuleContext` every rule folds over for a single run. */
export function buildRuleContext(
  canvas: Canvas,
  registry: NodeDefRegistry,
  canvasId: string,
): RuleContext {
  const allNodes = canvas.nodes ?? [];
  const inlineNodes = allNodes.filter((n): n is InlineNode => !('ref' in n));
  const edges = canvas.edges ?? [];
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const adjacency = buildAdjacency(edges, nodeIds);

  return {
    canvasId,
    canvas,
    registry,
    inlineNodes,
    edges,
    resolve: (node) => registry.resolve(node.type),
    adjacency,
  };
}

function findingKey(f: ValidationFinding): string {
  return `${f.ruleId}|${f.nodeId ?? ''}|${f.message}`;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function emptySummary(): Record<Severity, number> & { total: number } {
  return { critical: 0, warning: 0, info: 0, total: 0 };
}

/**
 * Validate a single canvas scope against the fixed rule set, producing a
 * deduplicated, severity-sorted report. Pure — no store/DOM/React dependency.
 */
export function validateArchitecture(
  canvas: Canvas,
  registry: NodeDefRegistry,
  opts?: { canvasId?: string; rules?: ValidationRule[] },
): ValidationReport {
  const canvasId = opts?.canvasId ?? canvas.id ?? '__root__';
  const rules = opts?.rules ?? ALL_RULES;

  const ctx = buildRuleContext(canvas, registry, canvasId);

  const seen = new Set<string>();
  const findings: ValidationFinding[] = [];
  for (const rule of rules) {
    for (const f of rule.evaluate(ctx)) {
      const key = findingKey(f);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(f);
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const summary = emptySummary();
  for (const f of findings) {
    summary[f.severity]++;
    summary.total++;
  }

  return { canvasId, findings, summary, ranAt: Date.now() };
}
