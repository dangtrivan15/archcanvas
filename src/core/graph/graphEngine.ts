/**
 * Graph engine providing pure CRUD functions for nodes, edges, and notes.
 * All functions are immutable - they return new state rather than mutating.
 */

import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef, Position } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT, DEFAULT_ARCHITECTURE_NAME } from '@/utils/constants';

// ============================================================
// Factory Functions
// ============================================================

/**
 * Create a new empty architecture graph.
 */
export function createEmptyGraph(name?: string): ArchGraph {
  return {
    name: name ?? DEFAULT_ARCHITECTURE_NAME,
    description: '',
    owners: [],
    nodes: [],
    edges: [],
  };
}

/**
 * Create a new node with default values.
 */
export function createNode(params: {
  type: string;
  displayName: string;
  position?: Partial<Position>;
  args?: Record<string, string | number | boolean>;
}): ArchNode {
  return {
    id: generateId(),
    type: params.type,
    displayName: params.displayName,
    args: params.args ?? {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: {
      x: params.position?.x ?? 0,
      y: params.position?.y ?? 0,
      width: params.position?.width ?? DEFAULT_NODE_WIDTH,
      height: params.position?.height ?? DEFAULT_NODE_HEIGHT,
      color: params.position?.color,
    },
    children: [],
  };
}

/**
 * Create a new edge.
 */
export function createEdge(params: {
  fromNode: string;
  toNode: string;
  type: ArchEdge['type'];
  fromPort?: string;
  toPort?: string;
  label?: string;
}): ArchEdge {
  return {
    id: generateId(),
    fromNode: params.fromNode,
    toNode: params.toNode,
    fromPort: params.fromPort,
    toPort: params.toPort,
    type: params.type,
    label: params.label,
    properties: {},
    notes: [],
  };
}

/**
 * Create a new note.
 */
export function createNote(params: {
  author: string;
  content: string;
  tags?: string[];
  status?: Note['status'];
  suggestionType?: string;
}): Note {
  return {
    id: generateId(),
    author: params.author,
    timestampMs: Date.now(),
    content: params.content,
    tags: params.tags ?? [],
    status: params.status ?? 'none',
    suggestionType: params.suggestionType,
  };
}

// ============================================================
// Node CRUD (immutable operations on ArchGraph)
// ============================================================

/**
 * Add a node to the graph at root level.
 */
export function addNode(graph: ArchGraph, node: ArchNode): ArchGraph {
  return {
    ...graph,
    nodes: [...graph.nodes, node],
  };
}

/**
 * Add a child node to an existing parent node (recursive search).
 */
export function addChildNode(
  graph: ArchGraph,
  parentId: string,
  child: ArchNode,
): ArchGraph {
  return {
    ...graph,
    nodes: addChildToNodes(graph.nodes, parentId, child),
  };
}

function addChildToNodes(
  nodes: ArchNode[],
  parentId: string,
  child: ArchNode,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, child] };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addChildToNodes(node.children, parentId, child),
      };
    }
    return node;
  });
}

/**
 * Remove a node and its connected edges from the graph.
 */
export function removeNode(graph: ArchGraph, nodeId: string): ArchGraph {
  // Collect all node IDs that will be removed (including children recursively)
  const removedIds = collectNodeIds(graph.nodes, nodeId);

  return {
    ...graph,
    nodes: removeNodeFromList(graph.nodes, nodeId),
    edges: graph.edges.filter(
      (e) => !removedIds.has(e.fromNode) && !removedIds.has(e.toNode),
    ),
  };
}

function collectNodeIds(nodes: ArchNode[], targetId: string): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (node.id === targetId) {
      collectAllIds(node, ids);
      return ids;
    }
    if (node.children.length > 0) {
      const childIds = collectNodeIds(node.children, targetId);
      if (childIds.size > 0) return childIds;
    }
  }
  return ids;
}

function collectAllIds(node: ArchNode, ids: Set<string>): void {
  ids.add(node.id);
  for (const child of node.children) {
    collectAllIds(child, ids);
  }
}

function removeNodeFromList(nodes: ArchNode[], nodeId: string): ArchNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      children: removeNodeFromList(node.children, nodeId),
    }));
}

/**
 * Update a node's properties (recursive search).
 */
export function updateNode(
  graph: ArchGraph,
  nodeId: string,
  updates: Partial<Pick<ArchNode, 'displayName' | 'args' | 'properties'>>,
): ArchGraph {
  return {
    ...graph,
    nodes: updateNodeInList(graph.nodes, nodeId, updates),
  };
}

function updateNodeInList(
  nodes: ArchNode[],
  nodeId: string,
  updates: Partial<Pick<ArchNode, 'displayName' | 'args' | 'properties'>>,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        ...(updates.displayName !== undefined && {
          displayName: updates.displayName,
        }),
        ...(updates.args !== undefined && { args: { ...updates.args } }),
        ...(updates.properties !== undefined && {
          properties: { ...updates.properties },
        }),
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInList(node.children, nodeId, updates),
      };
    }
    return node;
  });
}

/**
 * Move a node to a new position (recursive search).
 */
export function moveNode(
  graph: ArchGraph,
  nodeId: string,
  x: number,
  y: number,
): ArchGraph {
  return {
    ...graph,
    nodes: moveNodeInList(graph.nodes, nodeId, x, y),
  };
}

function moveNodeInList(
  nodes: ArchNode[],
  nodeId: string,
  x: number,
  y: number,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, position: { ...node.position, x, y } };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: moveNodeInList(node.children, nodeId, x, y),
      };
    }
    return node;
  });
}

// ============================================================
// Edge CRUD
// ============================================================

/**
 * Add an edge to the graph.
 */
export function addEdge(graph: ArchGraph, edge: ArchEdge): ArchGraph {
  return {
    ...graph,
    edges: [...graph.edges, edge],
  };
}

/**
 * Remove an edge from the graph.
 */
export function removeEdge(graph: ArchGraph, edgeId: string): ArchGraph {
  return {
    ...graph,
    edges: graph.edges.filter((e) => e.id !== edgeId),
  };
}

/**
 * Update an edge's properties.
 */
export function updateEdge(
  graph: ArchGraph,
  edgeId: string,
  updates: Partial<Pick<ArchEdge, 'type' | 'label' | 'properties'>>,
): ArchGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      if (edge.id === edgeId) {
        return {
          ...edge,
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.label !== undefined && { label: updates.label }),
          ...(updates.properties !== undefined && {
            properties: { ...updates.properties },
          }),
        };
      }
      return edge;
    }),
  };
}

// ============================================================
// Note CRUD (on nodes or edges, recursive)
// ============================================================

/**
 * Add a note to a node (recursive search).
 */
export function addNoteToNode(
  graph: ArchGraph,
  nodeId: string,
  note: Note,
): ArchGraph {
  return {
    ...graph,
    nodes: addNoteToNodeList(graph.nodes, nodeId, note),
  };
}

function addNoteToNodeList(
  nodes: ArchNode[],
  nodeId: string,
  note: Note,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, notes: [...node.notes, note] };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addNoteToNodeList(node.children, nodeId, note),
      };
    }
    return node;
  });
}

/**
 * Add a note to an edge.
 */
export function addNoteToEdge(
  graph: ArchGraph,
  edgeId: string,
  note: Note,
): ArchGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      if (edge.id === edgeId) {
        return { ...edge, notes: [...edge.notes, note] };
      }
      return edge;
    }),
  };
}

/**
 * Remove a note from a node (recursive search).
 */
export function removeNoteFromNode(
  graph: ArchGraph,
  nodeId: string,
  noteId: string,
): ArchGraph {
  return {
    ...graph,
    nodes: removeNoteFromNodeList(graph.nodes, nodeId, noteId),
  };
}

function removeNoteFromNodeList(
  nodes: ArchNode[],
  nodeId: string,
  noteId: string,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, notes: node.notes.filter((n) => n.id !== noteId) };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: removeNoteFromNodeList(node.children, nodeId, noteId),
      };
    }
    return node;
  });
}

/**
 * Update a note's status (for accepting/dismissing AI suggestions).
 */
export function updateNoteStatus(
  graph: ArchGraph,
  nodeId: string,
  noteId: string,
  status: Note['status'],
): ArchGraph {
  return {
    ...graph,
    nodes: updateNoteInNodeList(graph.nodes, nodeId, noteId, status),
  };
}

function updateNoteInNodeList(
  nodes: ArchNode[],
  nodeId: string,
  noteId: string,
  status: Note['status'],
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        notes: node.notes.map((n) =>
          n.id === noteId ? { ...n, status } : n,
        ),
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNoteInNodeList(node.children, nodeId, noteId, status),
      };
    }
    return node;
  });
}

/**
 * Update a note's content while preserving author, timestamp, and id.
 * Searches recursively through node children.
 */
export function updateNoteContent(
  graph: ArchGraph,
  nodeId: string,
  noteId: string,
  content: string,
): ArchGraph {
  return {
    ...graph,
    nodes: updateNoteContentInNodeList(graph.nodes, nodeId, noteId, content),
  };
}

function updateNoteContentInNodeList(
  nodes: ArchNode[],
  nodeId: string,
  noteId: string,
  content: string,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        notes: node.notes.map((n) =>
          n.id === noteId ? { ...n, content } : n,
        ),
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateNoteContentInNodeList(node.children, nodeId, noteId, content),
      };
    }
    return node;
  });
}

// ============================================================
// Code Ref CRUD
// ============================================================

/**
 * Add a code reference to a node (recursive search).
 */
export function addCodeRef(
  graph: ArchGraph,
  nodeId: string,
  codeRef: CodeRef,
): ArchGraph {
  return {
    ...graph,
    nodes: addCodeRefToNodeList(graph.nodes, nodeId, codeRef),
  };
}

function addCodeRefToNodeList(
  nodes: ArchNode[],
  nodeId: string,
  codeRef: CodeRef,
): ArchNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, codeRefs: [...node.codeRefs, codeRef] };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: addCodeRefToNodeList(node.children, nodeId, codeRef),
      };
    }
    return node;
  });
}

// ============================================================
// Find Operations (recursive)
// ============================================================

/**
 * Find a node by ID, searching recursively through children.
 */
export function findNode(
  graph: ArchGraph,
  nodeId: string,
): ArchNode | undefined {
  return findNodeInList(graph.nodes, nodeId);
}

function findNodeInList(
  nodes: ArchNode[],
  nodeId: string,
): ArchNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children.length > 0) {
      const found = findNodeInList(node.children, nodeId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Find an edge by ID.
 */
export function findEdge(
  graph: ArchGraph,
  edgeId: string,
): ArchEdge | undefined {
  return graph.edges.find((e) => e.id === edgeId);
}

/**
 * Find the parent of a node by searching recursively.
 * Returns undefined if the node is at root level.
 */
export function findNodeParent(
  graph: ArchGraph,
  nodeId: string,
): ArchNode | undefined {
  return findParentInList(graph.nodes, nodeId);
}

function findParentInList(
  nodes: ArchNode[],
  nodeId: string,
): ArchNode | undefined {
  for (const node of nodes) {
    if (node.children.some((child) => child.id === nodeId)) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findParentInList(node.children, nodeId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Get the navigation path (breadcrumb) for a node.
 * Returns array of node IDs from root to the target node.
 */
export function getNodePath(
  graph: ArchGraph,
  nodeId: string,
): string[] {
  const path: string[] = [];
  if (buildPath(graph.nodes, nodeId, path)) {
    return path;
  }
  return [];
}

function buildPath(
  nodes: ArchNode[],
  targetId: string,
  path: string[],
): boolean {
  for (const node of nodes) {
    if (node.id === targetId) {
      path.push(node.id);
      return true;
    }
    if (node.children.length > 0) {
      path.push(node.id);
      if (buildPath(node.children, targetId, path)) {
        return true;
      }
      path.pop();
    }
  }
  return false;
}
