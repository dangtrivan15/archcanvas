/**
 * Incremental Re-analysis and Merge
 *
 * Supports re-analyzing a codebase that already has an .archc file.
 * Instead of generating from scratch, detects what changed (new files,
 * removed files, modified structure) and merges updates into the existing
 * architecture. Preserves manually added nodes, notes, and customizations
 * while updating AI-inferred components.
 *
 * This makes the tool useful for ongoing architecture maintenance,
 * not just initial generation.
 */

import type { ArchGraph, ArchNode, ArchEdge, Note } from '@/types/graph';
import type { InferenceResult, InferredNode, InferredEdge } from './inferEngine';
import { flattenNodes } from '@/core/graph/graphQuery';

// ── Types ────────────────────────────────────────────────────────────────────

/** Conflict resolution strategy */
export type ConflictStrategy = 'ai-wins' | 'manual-wins' | 'prompt';

/** Options for the merge operation */
export interface MergeOptions {
  /** Conflict resolution strategy (default: 'manual-wins') */
  conflictStrategy?: ConflictStrategy;
  /** Author name for merge notes (default: 'ai-merge') */
  noteAuthor?: string;
  /** Whether to add notes about changes (default: true) */
  addChangeNotes?: boolean;
}

/** Classification of a matched node pair */
export interface NodeMatch {
  /** Existing node in the graph */
  existingNode: ArchNode;
  /** Corresponding inferred node from new analysis */
  inferredNode: InferredNode;
  /** How the match was found */
  matchMethod: 'code-ref' | 'display-name';
  /** Whether the node type changed */
  typeChanged: boolean;
}

/** Summary of what changed during the merge */
export interface MergeResult {
  /** Nodes that matched and were updated */
  matched: NodeMatch[];
  /** New inferred nodes that were added */
  added: InferredNode[];
  /** Existing nodes not found in new inference (flagged, not deleted) */
  possiblyRemoved: ArchNode[];
  /** Edges that were added from new inference */
  edgesAdded: InferredEdge[];
  /** Existing edges not found in new inference (flagged, not deleted) */
  edgesFlagged: ArchEdge[];
  /** Edges that were preserved (matched) */
  edgesPreserved: ArchEdge[];
  /** Warnings produced during the merge */
  warnings: string[];
  /** Total changes summary */
  summary: {
    nodesMatched: number;
    nodesAdded: number;
    nodesFlagged: number;
    edgesAdded: number;
    edgesFlagged: number;
    edgesPreserved: number;
    typeChanges: number;
    codeRefUpdates: number;
  };
}

// ── Node Matching ────────────────────────────────────────────────────────────

/**
 * Check whether a node was manually created (not from AI analysis).
 * Nodes created by AI typically have 'ai-inferred' tagged notes.
 */
function isManualNode(node: ArchNode): boolean {
  // Nodes with no notes or no 'ai-inferred' tagged notes are manual
  const hasAiNote = node.notes.some(n => n.tags.includes('ai-inferred'));
  return !hasAiNote;
}

/**
 * Check whether an edge was manually added.
 * Edges added manually have notes or properties set by a human.
 */
function isManualEdge(edge: ArchEdge): boolean {
  return edge.notes.length > 0 || Object.keys(edge.properties).length > 0;
}

/**
 * Compute the code-ref path set for a node.
 */
function getCodeRefPaths(node: ArchNode): Set<string> {
  return new Set(node.codeRefs.map(cr => cr.path));
}

/**
 * Match existing nodes against newly inferred nodes.
 *
 * Matching strategy:
 * 1. First pass: match by overlapping code-ref paths
 * 2. Second pass: match remaining by normalized display name
 *
 * Returns maps of matched, unmatched existing, and unmatched inferred nodes.
 */
export function matchNodes(
  existingNodes: ArchNode[],
  inferredNodes: InferredNode[],
): {
  matches: NodeMatch[];
  unmatchedExisting: ArchNode[];
  unmatchedInferred: InferredNode[];
} {
  const matches: NodeMatch[] = [];
  const matchedExistingIds = new Set<string>();
  const matchedInferredIds = new Set<string>();

  // Flatten existing nodes to include children
  const allExisting = flattenNodes(existingNodes);

  // ── Pass 1: Code-ref path matching ──
  for (const inferred of inferredNodes) {
    if (matchedInferredIds.has(inferred.id)) continue;
    if (inferred.codeRefs.length === 0) continue;

    const inferredPaths = new Set(inferred.codeRefs.map(cr => cr.path));

    let bestMatch: ArchNode | undefined;
    let bestOverlap = 0;

    for (const existing of allExisting) {
      if (matchedExistingIds.has(existing.id)) continue;
      if (existing.codeRefs.length === 0) continue;

      const existingPaths = getCodeRefPaths(existing);
      let overlap = 0;
      for (const p of inferredPaths) {
        if (existingPaths.has(p)) overlap++;
      }

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = existing;
      }
    }

    if (bestMatch && bestOverlap > 0) {
      matchedExistingIds.add(bestMatch.id);
      matchedInferredIds.add(inferred.id);
      matches.push({
        existingNode: bestMatch,
        inferredNode: inferred,
        matchMethod: 'code-ref',
        typeChanged: bestMatch.type !== inferred.type && !inferred.type.includes(bestMatch.type),
      });
    }
  }

  // ── Pass 2: Display name matching ──
  for (const inferred of inferredNodes) {
    if (matchedInferredIds.has(inferred.id)) continue;

    const normalizedInferred = normalizeDisplayName(inferred.displayName);

    for (const existing of allExisting) {
      if (matchedExistingIds.has(existing.id)) continue;

      const normalizedExisting = normalizeDisplayName(existing.displayName);
      if (normalizedInferred === normalizedExisting) {
        matchedExistingIds.add(existing.id);
        matchedInferredIds.add(inferred.id);
        matches.push({
          existingNode: existing,
          inferredNode: inferred,
          matchMethod: 'display-name',
          typeChanged: existing.type !== inferred.type && !inferred.type.includes(existing.type),
        });
        break;
      }
    }
  }

  // Also match children recursively
  for (const inferred of inferredNodes) {
    if (matchedInferredIds.has(inferred.id)) continue;

    for (const child of inferred.children) {
      if (matchedInferredIds.has(child.id)) continue;

      const normalizedChild = normalizeDisplayName(child.displayName);
      for (const existing of allExisting) {
        if (matchedExistingIds.has(existing.id)) continue;

        if (normalizeDisplayName(existing.displayName) === normalizedChild) {
          matchedExistingIds.add(existing.id);
          matchedInferredIds.add(child.id);
          matches.push({
            existingNode: existing,
            inferredNode: child,
            matchMethod: 'display-name',
            typeChanged: existing.type !== child.type,
          });
          break;
        }
      }
    }
  }

  const unmatchedExisting = allExisting.filter(n => !matchedExistingIds.has(n.id));
  const unmatchedInferred = inferredNodes.filter(n => !matchedInferredIds.has(n.id));

  return { matches, unmatchedExisting, unmatchedInferred };
}

/**
 * Normalize a display name for comparison.
 * Lowercases, removes common prefixes/suffixes, trims whitespace.
 */
function normalizeDisplayName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*(service|server|api|app|client|db|database|cache|queue|store)\s*$/i, '')
    .trim() || name.toLowerCase().trim();
}

// ── Edge Matching ────────────────────────────────────────────────────────────

/**
 * Find matching edges between existing graph and newly inferred edges.
 * Uses the node ID mapping from node matching to translate inferred node IDs
 * to existing node IDs, then checks for equivalent edges.
 */
function matchEdges(
  existingEdges: ArchEdge[],
  inferredEdges: InferredEdge[],
  nodeIdMap: Map<string, string>, // inferred ID -> existing ID
): {
  newEdges: InferredEdge[];
  removedEdges: ArchEdge[];
  preservedEdges: ArchEdge[];
} {
  const newEdges: InferredEdge[] = [];
  const matchedExistingIds = new Set<string>();

  for (const inferred of inferredEdges) {
    const fromId = nodeIdMap.get(inferred.from);
    const toId = nodeIdMap.get(inferred.to);

    if (!fromId || !toId) {
      // Edge references unmapped nodes — it's new (will be added with new nodes)
      newEdges.push(inferred);
      continue;
    }

    // Find matching existing edge
    const match = existingEdges.find(
      e => e.fromNode === fromId && e.toNode === toId && !matchedExistingIds.has(e.id),
    );

    if (match) {
      matchedExistingIds.add(match.id);
    } else {
      newEdges.push(inferred);
    }
  }

  // Edges in existing graph not matched by new inference
  const removedEdges = existingEdges.filter(
    e => !matchedExistingIds.has(e.id),
  );

  const preservedEdges = existingEdges.filter(
    e => matchedExistingIds.has(e.id),
  );

  return { newEdges, removedEdges, preservedEdges };
}

// ── Core Merge Function ──────────────────────────────────────────────────────

/**
 * Merge a new AI inference result into an existing ArchCanvas graph.
 *
 * This function performs a non-destructive merge:
 * 1. Matches existing nodes to new inferred nodes by code refs and display names
 * 2. For matched nodes: updates code refs if files moved, flags type changes
 * 3. For new inferred nodes: marks them for addition
 * 4. For unmatched existing nodes: flags as 'possibly removed' (never auto-deletes)
 * 5. Merges edges: adds new relationships, flags removed ones
 * 6. Preserves manually added nodes, notes, and customizations
 *
 * Returns a MergeResult describing all changes. The caller (pipeline/CLI/MCP)
 * can then apply the changes to the graph via TextApi.
 *
 * @param existingGraph - The current architecture graph
 * @param newInferenceResult - The new AI inference output
 * @param options - Merge options (conflict strategy, note author, etc.)
 * @returns MergeResult with matched, added, removed nodes and edges
 */
export function mergeAnalysis(
  existingGraph: ArchGraph,
  newInferenceResult: InferenceResult,
  options: MergeOptions = {},
): MergeResult {
  const {
    conflictStrategy = 'manual-wins',
    noteAuthor = 'ai-merge',
    addChangeNotes = true,
  } = options;

  const warnings: string[] = [];
  let codeRefUpdates = 0;

  // ── Step 1: Match nodes ────────────────────────────────────────
  const { matches, unmatchedExisting, unmatchedInferred } = matchNodes(
    existingGraph.nodes,
    newInferenceResult.nodes,
  );

  // ── Step 2: Process matched nodes ──────────────────────────────
  for (const match of matches) {
    const { existingNode, inferredNode } = match;

    // Check for code ref changes (files moved/added/removed)
    const existingPaths = getCodeRefPaths(existingNode);
    const inferredPaths = new Set(inferredNode.codeRefs.map(cr => cr.path));

    // Find new code refs
    for (const path of inferredPaths) {
      if (!existingPaths.has(path)) {
        codeRefUpdates++;
      }
    }

    // Detect type change
    if (match.typeChanged) {
      if (conflictStrategy === 'ai-wins') {
        // AI wins: note the change, type will be updated by caller
        warnings.push(
          `Node '${existingNode.displayName}' type changed: ` +
          `'${existingNode.type}' -> '${inferredNode.type}' (ai-wins strategy applied)`,
        );
      } else {
        // manual-wins or prompt: keep existing type, just flag it
        warnings.push(
          `Node '${existingNode.displayName}' type may have changed: ` +
          `existing='${existingNode.type}', inferred='${inferredNode.type}' ` +
          `(${conflictStrategy} strategy: keeping existing)`,
        );
      }
    }
  }

  // ── Step 3: Flag possibly removed nodes ────────────────────────
  // Only flag non-manual nodes as possibly removed.
  // Manual nodes are always preserved.
  const possiblyRemoved: ArchNode[] = [];
  for (const node of unmatchedExisting) {
    if (isManualNode(node)) {
      // Manual nodes are always preserved — don't flag them
      continue;
    }
    possiblyRemoved.push(node);
  }

  // ── Step 4: Build node ID map for edge matching ────────────────
  const nodeIdMap = new Map<string, string>();
  for (const match of matches) {
    nodeIdMap.set(match.inferredNode.id, match.existingNode.id);
  }

  // ── Step 5: Match edges ────────────────────────────────────────
  const { newEdges, removedEdges, preservedEdges } = matchEdges(
    existingGraph.edges,
    newInferenceResult.edges,
    nodeIdMap,
  );

  // Only flag non-manual edges as possibly removed
  const edgesFlagged: ArchEdge[] = [];
  for (const edge of removedEdges) {
    if (isManualEdge(edge)) {
      // Manual edges are always preserved
      continue;
    }
    edgesFlagged.push(edge);
  }

  // ── Build result ───────────────────────────────────────────────
  const typeChanges = matches.filter(m => m.typeChanged).length;

  const result: MergeResult = {
    matched: matches,
    added: unmatchedInferred,
    possiblyRemoved,
    edgesAdded: newEdges,
    edgesFlagged,
    edgesPreserved: preservedEdges,
    warnings,
    summary: {
      nodesMatched: matches.length,
      nodesAdded: unmatchedInferred.length,
      nodesFlagged: possiblyRemoved.length,
      edgesAdded: newEdges.length,
      edgesFlagged: edgesFlagged.length,
      edgesPreserved: preservedEdges.length,
      typeChanges,
      codeRefUpdates,
    },
  };

  return result;
}

// ── Apply Merge to Graph ─────────────────────────────────────────────────────

/**
 * Apply a MergeResult to an ArchGraph, producing a new merged graph.
 *
 * This function:
 * 1. Updates code refs on matched nodes (adds new ones from inference)
 * 2. Optionally updates types on matched nodes (if ai-wins)
 * 3. Adds new inferred nodes to the graph
 * 4. Adds 'possibly removed' notes to flagged nodes
 * 5. Adds new edges to the graph
 * 6. Adds 'possibly removed' notes to flagged edges
 *
 * @param graph - The existing graph to modify (immutably)
 * @param mergeResult - The merge result to apply
 * @param options - Merge options
 * @returns A new ArchGraph with the merge applied
 */
export function applyMerge(
  graph: ArchGraph,
  mergeResult: MergeResult,
  options: MergeOptions = {},
): ArchGraph {
  const {
    conflictStrategy = 'manual-wins',
    noteAuthor = 'ai-merge',
    addChangeNotes = true,
  } = options;

  let newNodes = [...graph.nodes];
  let newEdges = [...graph.edges];
  const now = Date.now();

  // ── Update matched nodes ───────────────────────────────────────
  for (const match of mergeResult.matched) {
    const nodeIndex = findNodeIndex(newNodes, match.existingNode.id);
    if (nodeIndex === -1) continue;

    const node = deepCloneNode(newNodes[nodeIndex]);

    // Update code refs: add new ones from inference
    const existingPaths = getCodeRefPaths(node);
    for (const codeRef of match.inferredNode.codeRefs) {
      if (!existingPaths.has(codeRef.path)) {
        node.codeRefs = [
          ...node.codeRefs,
          { path: codeRef.path, role: mapRole(codeRef.role) },
        ];
      }
    }

    // Update type if ai-wins
    if (match.typeChanged && conflictStrategy === 'ai-wins') {
      node.type = match.inferredNode.type;
    }

    // Add a change note if type changed
    if (addChangeNotes && match.typeChanged) {
      const changeNote: Note = {
        id: `merge-note-${now}-${match.existingNode.id}`,
        author: noteAuthor,
        timestampMs: now,
        content: conflictStrategy === 'ai-wins'
          ? `Type updated from '${match.existingNode.type}' to '${match.inferredNode.type}' during re-analysis.`
          : `Re-analysis suggests type '${match.inferredNode.type}' (currently '${match.existingNode.type}'). Review and update if needed.`,
        tags: ['merge-change', 'type-change'],
        status: 'pending',
      };
      node.notes = [...node.notes, changeNote];
    }

    newNodes[nodeIndex] = node;
  }

  // ── Add new inferred nodes ─────────────────────────────────────
  for (const inferred of mergeResult.added) {
    const newNode = inferredToArchNode(inferred, noteAuthor, now);
    newNodes = [...newNodes, newNode];
  }

  // ── Flag possibly removed nodes ────────────────────────────────
  if (addChangeNotes) {
    for (const removed of mergeResult.possiblyRemoved) {
      const nodeIndex = findNodeIndex(newNodes, removed.id);
      if (nodeIndex === -1) continue;

      const node = deepCloneNode(newNodes[nodeIndex]);
      const removalNote: Note = {
        id: `merge-note-removed-${now}-${removed.id}`,
        author: noteAuthor,
        timestampMs: now,
        content: `This component was not detected in the latest re-analysis. It may have been removed from the codebase. Review and delete if no longer needed.`,
        tags: ['merge-change', 'possibly-removed'],
        status: 'pending',
      };
      node.notes = [...node.notes, removalNote];
      newNodes[nodeIndex] = node;
    }
  }

  // ── Add new edges ──────────────────────────────────────────────
  // Build ID map: inferred node ID -> actual node ID
  const nodeIdMap = new Map<string, string>();
  for (const match of mergeResult.matched) {
    nodeIdMap.set(match.inferredNode.id, match.existingNode.id);
  }
  // Map newly added nodes: use the inferred ID as the actual ID (since we created them with that ID)
  for (const added of mergeResult.added) {
    nodeIdMap.set(added.id, added.id);
  }

  for (const edge of mergeResult.edgesAdded) {
    const fromId = nodeIdMap.get(edge.from);
    const toId = nodeIdMap.get(edge.to);
    if (!fromId || !toId) continue;

    const newEdge: ArchEdge = {
      id: `merge-edge-${now}-${edge.from}-${edge.to}`,
      fromNode: fromId,
      toNode: toId,
      type: mapEdgeType(edge.type),
      label: edge.label || undefined,
      properties: {},
      notes: [],
    };
    newEdges = [...newEdges, newEdge];
  }

  // ── Flag possibly removed edges ────────────────────────────────
  if (addChangeNotes) {
    for (const flagged of mergeResult.edgesFlagged) {
      const edgeIndex = newEdges.findIndex(e => e.id === flagged.id);
      if (edgeIndex === -1) continue;

      const edge = { ...newEdges[edgeIndex] };
      const flagNote: Note = {
        id: `merge-note-edge-removed-${now}-${flagged.id}`,
        author: noteAuthor,
        timestampMs: now,
        content: `This relationship was not detected in the latest re-analysis. It may have been removed. Review and delete if no longer needed.`,
        tags: ['merge-change', 'possibly-removed'],
        status: 'pending',
      };
      edge.notes = [...edge.notes, flagNote];
      newEdges[edgeIndex] = edge;
    }
  }

  return {
    ...graph,
    nodes: newNodes,
    edges: newEdges,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the index of a node in a flat node array by ID.
 * For nested nodes, searches recursively and returns top-level index.
 */
function findNodeIndex(nodes: ArchNode[], nodeId: string): number {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) return i;
    // Check children recursively
    if (hasChildWithId(nodes[i], nodeId)) return i;
  }
  return -1;
}

function hasChildWithId(node: ArchNode, nodeId: string): boolean {
  for (const child of node.children) {
    if (child.id === nodeId) return true;
    if (hasChildWithId(child, nodeId)) return true;
  }
  return false;
}

function deepCloneNode(node: ArchNode): ArchNode {
  return {
    ...node,
    args: { ...node.args },
    codeRefs: [...node.codeRefs],
    notes: [...node.notes],
    properties: { ...node.properties },
    position: { ...node.position },
    children: node.children.map(deepCloneNode),
  };
}

/**
 * Convert an InferredNode to an ArchNode for insertion into the graph.
 */
function inferredToArchNode(
  inferred: InferredNode,
  noteAuthor: string,
  timestampMs: number,
): ArchNode {
  const notes: Note[] = [];

  // Add description as a note
  if (inferred.description) {
    notes.push({
      id: `merge-desc-${timestampMs}-${inferred.id}`,
      author: noteAuthor,
      timestampMs,
      content: inferred.description,
      tags: ['ai-inferred', 'merge-added'],
      status: 'none',
    });
  }

  // Add "new component" note
  notes.push({
    id: `merge-new-${timestampMs}-${inferred.id}`,
    author: noteAuthor,
    timestampMs,
    content: `New component detected during re-analysis. Verify it belongs in the architecture.`,
    tags: ['merge-change', 'newly-detected'],
    status: 'pending',
  });

  return {
    id: inferred.id,
    type: inferred.type,
    displayName: inferred.displayName,
    args: {},
    codeRefs: inferred.codeRefs.map(cr => ({
      path: cr.path,
      role: mapRole(cr.role),
    })),
    notes,
    properties: {},
    position: { x: 0, y: 0, width: 200, height: 100 },
    children: inferred.children.map(child =>
      inferredToArchNode(child, noteAuthor, timestampMs),
    ),
  };
}

function mapRole(aiRole: string): 'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test' {
  const roleMap: Record<string, 'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test'> = {
    'SOURCE': 'source',
    'API_SPEC': 'api-spec',
    'SCHEMA': 'schema',
    'DEPLOYMENT': 'deployment',
    'CONFIG': 'config',
    'TEST': 'test',
  };
  return roleMap[aiRole.toUpperCase()] ?? 'source';
}

function mapEdgeType(aiType: string): 'sync' | 'async' | 'data-flow' {
  switch (aiType.toUpperCase()) {
    case 'SYNC': return 'sync';
    case 'ASYNC': return 'async';
    case 'DATA_FLOW': return 'data-flow';
    default: return 'sync';
  }
}
