/**
 * Diff data types for the Visual Git Diff Overlay feature.
 *
 * All types are plain objects (no classes) so they can be stored in Zustand
 * and serialized if needed.
 */

// ---------------------------------------------------------------------------
// Diff status enum
// ---------------------------------------------------------------------------

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

// ---------------------------------------------------------------------------
// Property-level diff
// ---------------------------------------------------------------------------

export interface PropertyDiff {
  key: string;
  status: DiffStatus;
  oldValue?: unknown;
  newValue?: unknown;
}

// ---------------------------------------------------------------------------
// Node-level diff
// ---------------------------------------------------------------------------

export interface NodeDiff {
  nodeId: string;
  status: DiffStatus;
  properties: PropertyDiff[];
}

// ---------------------------------------------------------------------------
// Edge-level diff
// ---------------------------------------------------------------------------

/** Canonical edge key: "fromNode:fromPort→toNode:toPort" */
export type EdgeKey = string;

export interface EdgeDiff {
  edgeKey: EdgeKey;
  status: DiffStatus;
  properties: PropertyDiff[];
}

// ---------------------------------------------------------------------------
// Canvas-level diff
// ---------------------------------------------------------------------------

export interface CanvasDiff {
  canvasId: string;
  nodes: Map<string, NodeDiff>;
  edges: Map<EdgeKey, EdgeDiff>;
  /** Summary counts for quick display */
  summary: DiffSummary;
}

export interface DiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesModified: number;
}

// ---------------------------------------------------------------------------
// Project-level diff (across all canvases)
// ---------------------------------------------------------------------------

export interface ProjectDiff {
  canvases: Map<string, CanvasDiff>;
  /** IDs of canvases that exist in current but not in base */
  addedCanvases: string[];
  /** IDs of canvases that exist in base but not in current */
  removedCanvases: string[];
  summary: DiffSummary;
}

// ---------------------------------------------------------------------------
// Diff options
// ---------------------------------------------------------------------------

export interface DiffOptions {
  /** If true, position changes are treated as modifications. Default: false */
  includePosition?: boolean;
}
