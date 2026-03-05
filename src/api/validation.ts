/**
 * Zod validation schemas for API boundary inputs.
 *
 * These schemas validate data at the Text API, Render API, and Export API
 * boundaries before it reaches the core graph engine. They mirror the
 * TypeScript interfaces in @/types/api but enforce runtime validation.
 */

import { z } from 'zod';

// ─── Shared value types ─────────────────────────────────────

const ArgValue = z.union([z.string(), z.number(), z.boolean()]);
const ArgsMap = z.record(ArgValue);

// ─── Text API: Query schemas ────────────────────────────────

export const DescribeOptionsSchema = z.object({
  format: z.enum(['ai', 'human', 'structured']),
  scope: z.enum(['full', 'node', 'nodes']).optional(),
  nodeId: z.string().optional(),
  nodeIds: z.array(z.string()).optional(),
  depth: z.number().int().min(0).optional(),
  includeNotes: z.boolean().optional(),
  includeCodeRefs: z.boolean().optional(),
  includeAIContext: z.boolean().optional(),
});

export const SearchQuerySchema = z.string().min(1, 'Search query must not be empty');

export const NodeIdSchema = z.string().min(1, 'Node ID must not be empty');

export const EdgeIdSchema = z.string().min(1, 'Edge ID must not be empty');

export const NoteIdSchema = z.string().min(1, 'Note ID must not be empty');

// ─── Text API: Mutation schemas ─────────────────────────────

export const AddNodeSchema = z.object({
  type: z.string().min(1, 'Node type is required'),
  displayName: z.string().min(1, 'Display name is required'),
  parentId: z.string().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  args: ArgsMap.optional(),
});

export const AddEdgeSchema = z.object({
  fromNode: z.string().min(1, 'Source node ID (fromNode) is required'),
  toNode: z.string().min(1, 'Target node ID (toNode) is required'),
  type: z.enum(['sync', 'async', 'data-flow']),
  fromPort: z.string().optional(),
  toPort: z.string().optional(),
  label: z.string().optional(),
});

export const AddNoteSchema = z
  .object({
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    author: z.string().min(1, 'Author is required'),
    content: z.string().min(1, 'Content is required'),
    tags: z.array(z.string()).optional(),
  })
  .refine((data) => data.nodeId || data.edgeId, {
    message: 'Either nodeId or edgeId must be provided',
  });

export const AddCodeRefSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  path: z.string().min(1, 'File path is required'),
  role: z.enum(['source', 'api-spec', 'schema', 'deployment', 'config', 'test']),
});

export const UpdateNodeSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    args: ArgsMap.optional(),
    properties: ArgsMap.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const UpdateEdgeSchema = z.object({
  type: z.enum(['sync', 'async', 'data-flow']).optional(),
  label: z.string().optional(),
  properties: ArgsMap.optional(),
});

export const SuggestSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  content: z.string().min(1, 'Suggestion content is required'),
  suggestionType: z.string().optional(),
});

export const ResolveSuggestionActionSchema = z.enum(['accepted', 'dismissed']);

// ─── Export API schemas ─────────────────────────────────────

export const FileNameSchema = z.string().min(1, 'File name must not be empty').default('architecture');

// ─── Error formatting ───────────────────────────────────────

/**
 * Format a Zod error into a user-friendly message.
 */
export function formatValidationError(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}
