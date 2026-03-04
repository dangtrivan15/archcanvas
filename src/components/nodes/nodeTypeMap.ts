/**
 * Maps React Flow node type strings to node components.
 * Specialized components are used for distinct visual shapes.
 */

import { GenericNode } from './GenericNode';
import { CylinderNode } from './CylinderNode';
import { HexagonNode } from './HexagonNode';
import { ParallelogramNode } from './ParallelogramNode';
import { CloudNode } from './CloudNode';
import { StadiumNode } from './StadiumNode';
import { DocumentNode } from './DocumentNode';

export const nodeTypes = {
  generic: GenericNode,
  service: GenericNode,
  database: CylinderNode,
  cache: CylinderNode,
  'object-storage': CylinderNode,
  repository: CylinderNode,
  queue: ParallelogramNode,
  'stream-processor': ParallelogramNode,
  gateway: HexagonNode,
  cdn: CloudNode,
  'event-bus': StadiumNode,
  logging: DocumentNode,
  // Shape-based entries: allow NodeDef YAML shape metadata to select components
  cloud: CloudNode,
  stadium: StadiumNode,
  document: DocumentNode,
  ref: GenericNode,
};
