/**
 * API types for the Text API, Render API, and Export API.
 */

export type DescribeFormat = 'ai' | 'human' | 'structured';

export interface DescribeOptions {
  scope?: 'full' | 'node' | 'nodes';
  nodeId?: string;
  nodeIds?: string[];
  depth?: number;
  format: DescribeFormat;
  includeNotes?: boolean;
  includeCodeRefs?: boolean;
  includeAIContext?: boolean;
}

export interface NodeSummary {
  id: string;
  type: string;
  displayName: string;
  childCount: number;
  noteCount: number;
  connectionCount: number;
}

export interface NodeDetail {
  id: string;
  type: string;
  displayName: string;
  args: Record<string, string | number | boolean>;
  properties: Record<string, string | number | boolean>;
  codeRefs: { path: string; role: string }[];
  notes: { id: string; author: string; content: string; timestampMs: number; status: string }[];
  children: NodeSummary[];
  inboundEdges: EdgeSummary[];
  outboundEdges: EdgeSummary[];
  nodedefAIContext?: string;
}

export interface EdgeSummary {
  id: string;
  fromNode: string;
  toNode: string;
  type: string;
  label?: string;
  noteCount: number;
}

export interface SearchResult {
  type: 'node' | 'edge' | 'note';
  id: string;
  parentId?: string;
  displayName: string;
  matchContext: string;
  score: number;
}

export interface AddNodeParams {
  type: string;
  displayName: string;
  parentId?: string;
  position?: { x: number; y: number };
  args?: Record<string, string | number | boolean>;
}

export interface AddEdgeParams {
  fromNode: string;
  toNode: string;
  type: 'sync' | 'async' | 'data-flow';
  fromPort?: string;
  toPort?: string;
  label?: string;
}

export interface AddNoteParams {
  nodeId?: string;
  edgeId?: string;
  author: string;
  content: string;
  tags?: string[];
}

export interface UpdateNodeParams {
  displayName?: string;
  args?: Record<string, string | number | boolean>;
  properties?: Record<string, string | number | boolean>;
}

export interface AddCodeRefParams {
  nodeId: string;
  path: string;
  role: 'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test';
}

export interface SuggestParams {
  nodeId: string;
  content: string;
  suggestionType?: string;
}
