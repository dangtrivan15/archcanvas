/**
 * Core graph types for ArchCanvas.
 * These are the internal TypeScript types used throughout the application.
 * Proto types are converted to/from these via the codec layer.
 */

export interface ArchGraph {
  name: string;
  description: string;
  owners: string[];
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchNode {
  id: string;
  type: string;
  displayName: string;
  args: Record<string, string | number | boolean>;
  codeRefs: CodeRef[];
  notes: Note[];
  properties: Record<string, string | number | boolean>;
  position: Position;
  children: ArchNode[];
  refSource?: string;
}

export type EdgeType = 'sync' | 'async' | 'data-flow';

export interface ArchEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromPort?: string;
  toPort?: string;
  type: EdgeType;
  label?: string;
  properties: Record<string, string | number | boolean>;
  notes: Note[];
}

export type NoteStatus = 'none' | 'pending' | 'accepted' | 'dismissed';

export interface Note {
  id: string;
  author: string;
  timestampMs: number;
  content: string;
  tags: string[];
  status: NoteStatus;
  suggestionType?: string;
}

export type CodeRefRole = 'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test';

export interface CodeRef {
  path: string;
  role: CodeRefRole;
}

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}
