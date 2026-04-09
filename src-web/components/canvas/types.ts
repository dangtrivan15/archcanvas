import type { Node } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { Edge } from '@/types';
import type { DiffStatus } from '@/core/diff/types';

/** A key argument with a non-default value, displayed on the node face. */
export interface KeyArg {
  name: string;
  value: string | number | boolean | string[];
}

/** Metadata badge flags derived from existing node data. */
export interface NodeBadges {
  hasNotes: boolean;
  hasCodeRefs: boolean;
  childCount: number;
}

/** Text-based child summary grouped by namespace (for RefNodes only). */
export type ChildSummary = string | undefined;

export interface CanvasNodeData extends Record<string, unknown> {
  node: Node;
  nodeDef: NodeDef | undefined;
  isSelected: boolean;
  isRef: boolean;
  /** Diff overlay status — undefined when diff is inactive */
  diffStatus?: DiffStatus;
  /** First 2 args with non-default values (inline nodes only) */
  keyArgs?: KeyArg[];
  /** Metadata badge flags */
  badges?: NodeBadges;
  /** Namespace-grouped child summary string (RefNodes only) */
  childSummary?: ChildSummary;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  edge: Edge;
  styleCategory: 'sync' | 'async' | 'default';
  inherited?: boolean;
  isSelected?: boolean;
  /** Diff overlay status — undefined when diff is inactive */
  diffStatus?: DiffStatus;
}

export const PROTOCOL_STYLES: Record<string, 'sync' | 'async'> = {
  HTTP: 'sync', HTTPS: 'sync', gRPC: 'sync', SQL: 'sync',
  Kafka: 'async', SQS: 'async', RabbitMQ: 'async', NATS: 'async',
};
