/**
 * Maps React Flow node type strings to node components.
 * All types currently use GenericNode - specialized components can be added later.
 */

import { GenericNode } from './GenericNode';

export const nodeTypes = {
  generic: GenericNode,
  service: GenericNode,
  database: GenericNode,
  cache: GenericNode,
  queue: GenericNode,
  gateway: GenericNode,
  ref: GenericNode,
};
