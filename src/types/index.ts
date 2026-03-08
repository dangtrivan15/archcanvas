/**
 * Type definitions barrel export.
 */

// Graph types
export type {
  ArchGraph,
  AnnotationPathData,
  Annotation,
  ArchNode,
  ArchEdge,
  Note,
  CodeRef,
  Position,
  CanvasViewport,
  SavedCanvasState,
  EdgeType,
  NoteStatus,
  CodeRefRole,
  PropertyValue,
  PropertyMap,
} from './graph';

// Canvas types (React Flow)
export type { CanvasNodeData, CanvasNode, CanvasEdgeData, CanvasEdge } from './canvas';

// API types
export type {
  DescribeFormat,
  DescribeOptions,
  NodeSummary,
  NodeDetail,
  EdgeSummary,
  SearchResult,
  AddNodeParams,
  AddEdgeParams,
  AddNoteParams,
  UpdateNodeParams,
  AddCodeRefParams,
  SuggestParams,
} from './api';

// AI types
export type { AIConversation, AIMessage, AISuggestion, AIContext } from './ai';

// Project types
export type {
  ProjectManifest,
  ProjectFileEntry,
  ProjectFileLink,
} from './project';
export { PROJECT_MANIFEST_FILENAME } from './project';

// NodeDef types
export type {
  NodeDef,
  NodeDefShape,
  NodeDefMetadata,
  NodeDefSpec,
  ArgType,
  ArgDef,
  PortDef,
  ChildSlotDef,
  VariantDef,
} from './nodedef';
