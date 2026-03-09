/**
 * Graph engine barrel export.
 *
 * Immutable graph operations, queries, and deletion impact analysis.
 */

// Graph engine (CRUD operations)
export {
  createEmptyGraph,
  createNode,
  createEdge,
  createNote,
  addNode,
  addChildNode,
  removeNode,
  updateNode,
  updateNodeColor,
  moveNode,
  addEdge,
  removeEdge,
  updateEdge,
  addNoteToNode,
  addNoteToEdge,
  removeNoteFromNode,
  updateNoteContent,
  addCodeRef,
  findNode,
  findEdge,
  findNodeParent,
  getNodePath,
} from './graphEngine';

// Graph queries
export {
  getNodesAtLevel,
  getEdgesAtLevel,
  getExternalEdges,
  getNeighbors,
  searchGraph,
  flattenNodes,
  countAllNodes,
} from './graphQuery';

// Deletion impact analysis
export type { DeletionImpact } from './deletionImpact';
export { calculateDeletionImpact } from './deletionImpact';
