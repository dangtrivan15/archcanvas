import type { Node } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { Edge } from '@/types';
import type { DiffStatus } from '@/core/diff/types';

export interface CanvasNodeData extends Record<string, unknown> {
  node: Node;
  nodeDef: NodeDef | undefined;
  isSelected: boolean;
  isRef: boolean;
  /** Diff overlay status — undefined when diff is inactive */
  diffStatus?: DiffStatus;
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
