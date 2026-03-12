import type { Node } from '@/types';
import type { NodeDef } from '@/types/nodeDefSchema';
import type { Edge } from '@/types';

export interface CanvasNodeData extends Record<string, unknown> {
  node: Node;
  nodeDef: NodeDef | undefined;
  isSelected: boolean;   // hardcoded false until Task 8
  isRef: boolean;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  edge: Edge;
  styleCategory: 'sync' | 'async' | 'default';
}

export const PROTOCOL_STYLES: Record<string, 'sync' | 'async'> = {
  HTTP: 'sync', HTTPS: 'sync', gRPC: 'sync', SQL: 'sync',
  Kafka: 'async', SQS: 'async', RabbitMQ: 'async', NATS: 'async',
};
