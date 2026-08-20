import type { Canvas, InlineNode, Edge } from '@/types';
import type { NodeDefRegistry } from '@/core/registry/core';
import type { NodeDef } from '@/types/nodeDefSchema';

/**
 * Architecture validation severity. Distinct from the schema validator's
 * `EngineWarning` (core/graph/validation.ts), which has no severity — this
 * feature is a soft-warning / design-review concern, not integrity checking.
 */
export type Severity = 'info' | 'warning' | 'critical';

/** A single architectural finding surfaced by the validation engine. */
export interface ValidationFinding {
  /** Stable rule identifier, e.g. 'db-no-backup'. */
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  /** Canvas scope this finding was produced against. */
  canvasId: string;
  /** The primary node this finding targets, if any. */
  nodeId?: string;
  /** The edge this finding targets, if any (format: "from→to"). */
  edgeKey?: string;
  /** Additional related node ids (e.g. every member of a cycle). */
  relatedNodeIds?: string[];
  /** Optional actionable suggestion text. */
  suggestion?: string;
  /** Whether this came from a deterministic built-in rule or an authored NodeDef review hint. */
  source: 'builtin-rule' | 'review-hint';
}

/** Aggregated result of a single validation run against one canvas scope. */
export interface ValidationReport {
  canvasId: string;
  findings: ValidationFinding[];
  summary: Record<Severity, number> & { total: number };
  ranAt: number;
}

/** Precomputed context shared by every rule during a single validation run. */
export interface RuleContext {
  canvasId: string;
  canvas: Canvas;
  registry: NodeDefRegistry;
  inlineNodes: InlineNode[];
  edges: Edge[];
  resolve(node: InlineNode): NodeDef | undefined;
  adjacency: Map<string, { out: string[]; in: string[] }>;
}

/** A single independently-testable validation rule. */
export interface ValidationRule {
  id: string;
  description: string;
  evaluate(ctx: RuleContext): ValidationFinding[];
}
