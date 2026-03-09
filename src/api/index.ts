/**
 * API module barrel export.
 *
 * Three internal APIs: Render (graph to React Flow), Text (read/write architecture),
 * and Export (markdown/mermaid/PNG/SVG).
 *
 * Validation schemas (Zod) enforce runtime validation at API boundaries.
 */

export { RenderApi } from './renderApi';
export { TextApi, getNodeTypeEmoji } from './textApi';
export { ExportApi } from './exportApi';

// Zod validation schemas for API boundary inputs
export {
  DescribeOptionsSchema,
  SearchQuerySchema,
  NodeIdSchema,
  EdgeIdSchema,
  NoteIdSchema,
  AddNodeSchema,
  AddEdgeSchema,
  AddNoteSchema,
  AddCodeRefSchema,
  UpdateNodeSchema,
  UpdateEdgeSchema,
  FileNameSchema,
  formatValidationError,
} from './validation';
