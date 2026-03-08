/**
 * LOD (Level-of-Detail) node type map.
 * Maps all node types to the SimplifiedNode component for low-zoom rendering.
 * Used when the canvas is zoomed out far enough that full detail is unnecessary.
 */

import { SimplifiedNode } from './SimplifiedNode';

export const lodNodeTypes: Record<string, typeof SimplifiedNode> = {
  generic: SimplifiedNode,
  service: SimplifiedNode,
  database: SimplifiedNode,
  cache: SimplifiedNode,
  'object-storage': SimplifiedNode,
  repository: SimplifiedNode,
  queue: SimplifiedNode,
  'stream-processor': SimplifiedNode,
  gateway: SimplifiedNode,
  cdn: SimplifiedNode,
  'event-bus': SimplifiedNode,
  logging: SimplifiedNode,
  cloud: SimplifiedNode,
  stadium: SimplifiedNode,
  document: SimplifiedNode,
  ref: SimplifiedNode,
  container: SimplifiedNode,
};
