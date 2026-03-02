/**
 * Canvas types for React Flow integration.
 * These bridge the internal graph types to React Flow node/edge formats.
 */

import type { Node, Edge } from '@xyflow/react';

export interface CanvasNodeData extends Record<string, unknown> {
  archNodeId: string;
  displayName: string;
  nodedefType: string;
  args: Record<string, string | number | boolean>;
  ports: {
    inbound: { name: string; protocol: string[] }[];
    outbound: { name: string; protocol: string[] }[];
  };
  hasChildren: boolean;
  noteCount: number;
  pendingSuggestionCount: number;
  codeRefCount: number;
  properties: Record<string, string | number | boolean>;
  icon: string;
  color?: string;
  refSource?: string;
}

export type CanvasNode = Node<CanvasNodeData>;

export interface CanvasEdgeData extends Record<string, unknown> {
  archEdgeId: string;
  edgeType: 'sync' | 'async' | 'data-flow';
  label?: string;
  protocol?: string;
  noteCount: number;
}

export type CanvasEdge = Edge<CanvasEdgeData>;
