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
  annotations: Annotation[];
}

export interface AnnotationPathData {
  /** Flat array of x,y coordinate pairs: [x0,y0, x1,y1, ...] */
  points: number[];
  /** Pressure values (0-1) per point, matching points length/2 */
  pressures: number[];
}

export interface Annotation {
  id: string;
  /** SVG path segments captured from pointer events */
  paths: AnnotationPathData[];
  /** CSS color string */
  color: string;
  /** Base stroke width in pixels */
  strokeWidth: number;
  /** If set, annotation is scoped to this node; otherwise global */
  nodeId?: string;
  /** When the annotation was created */
  timestampMs: number;
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

/**
 * Canvas viewport and panel state, saved alongside the architecture.
 */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface SavedCanvasState {
  viewport: CanvasViewport;
  selectedNodeIds: string[];
  navigationPath: string[];
  panelLayout?: {
    rightPanelOpen: boolean;
    rightPanelTab: string;
    rightPanelWidth: number;
  };
}
