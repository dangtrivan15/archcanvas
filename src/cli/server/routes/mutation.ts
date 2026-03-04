/**
 * HTTP Mutation Endpoints – write REST routes that map to Text API mutation methods.
 *
 * External agents use POST/PUT/DELETE requests to modify the architecture.
 * The .archc file is auto-saved after each mutation, and the .summary.md
 * sidecar is regenerated.
 *
 * Routes:
 *   POST   /api/nodes                    – Add a node (201)
 *   PUT    /api/nodes/:id                – Update a node (200)
 *   DELETE /api/nodes/:id                – Remove a node (204)
 *   POST   /api/edges                    – Add an edge (201)
 *   PUT    /api/edges/:id                – Update an edge (200)
 *   DELETE /api/edges/:id                – Remove an edge (204)
 *   POST   /api/nodes/:id/notes          – Add note to node (201)
 *   DELETE /api/nodes/:nid/notes/:noteId – Remove note from node (204)
 *   POST   /api/nodes/:id/code-refs      – Add code reference to node (201)
 *
 * All mutations auto-save the .archc file and regenerate the .summary.md sidecar.
 * Request bodies are validated using Zod schemas.
 * Returns 201 for creates, 200 for updates, 204 for deletes.
 */

import { z } from 'zod';
import type { ServerResponse } from 'node:http';
import type { GraphContext } from '@/cli/context';
import type { RouteDefinition, RouteHandler } from './query';

// ─── Zod Schemas ─────────────────────────────────────────────

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
}).optional();

const AddNodeSchema = z.object({
  type: z.string().min(1, 'type is required'),
  displayName: z.string().min(1, 'displayName is required'),
  parentId: z.string().optional(),
  position: PositionSchema,
  args: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const UpdateNodeSchema = z.object({
  displayName: z.string().min(1).optional(),
  args: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  color: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

const AddEdgeSchema = z.object({
  fromNode: z.string().min(1, 'fromNode is required'),
  toNode: z.string().min(1, 'toNode is required'),
  type: z.enum(['sync', 'async', 'data-flow']).optional().default('sync'),
  label: z.string().optional(),
  fromPort: z.string().optional(),
  toPort: z.string().optional(),
});

const UpdateEdgeSchema = z.object({
  type: z.enum(['sync', 'async', 'data-flow']).optional(),
  label: z.string().optional(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

const AddNoteSchema = z.object({
  content: z.string().min(1, 'content is required'),
  author: z.string().optional().default('http-api'),
  tags: z.array(z.string()).optional(),
});

const AddCodeRefSchema = z.object({
  path: z.string().min(1, 'path is required'),
  role: z.enum(['source', 'api-spec', 'schema', 'deployment', 'config', 'test']),
});

// ─── Helpers ─────────────────────────────────────────────────

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res: ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { error: message });
}

function sendNoContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

/**
 * Validate request body against a Zod schema.
 * Returns parsed data on success, or sends 400 error and returns null.
 */
function validateBody<T>(
  res: ServerResponse,
  body: unknown,
  schema: z.ZodType<T>,
): T | null {
  if (body === undefined || body === null) {
    sendError(res, 400, 'Request body is required');
    return null;
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    sendError(res, 400, `Validation error: ${messages}`);
    return null;
  }
  return result.data;
}

/**
 * Auto-save .archc file and regenerate .summary.md sidecar after mutation.
 */
async function autoSave(ctx: GraphContext): Promise<void> {
  await ctx.save();
  try {
    await ctx.saveSidecar();
  } catch {
    // Sidecar generation is best-effort; don't fail the mutation
  }
}

// ─── Shared Handlers ─────────────────────────────────────────

function updateNodeHandler(ctx: GraphContext): RouteHandler {
  return async (_req, res, params, body) => {
    const data = validateBody(res, body, UpdateNodeSchema);
    if (!data) return;

    try {
      const { color, ...updateParams } = data;
      if (Object.keys(updateParams).length > 0) {
        ctx.textApi.updateNode(params.id!, updateParams);
      }
      if (color !== undefined) {
        ctx.textApi.updateNodeColor(params.id!, color || undefined);
      }
      await autoSave(ctx);
      sendJson(res, 200, { updated: params.id });
    } catch (err: unknown) {
      sendError(res, 404, err instanceof Error ? err.message : String(err));
    }
  };
}

function updateEdgeHandler(ctx: GraphContext): RouteHandler {
  return async (_req, res, params, body) => {
    const data = validateBody(res, body, UpdateEdgeSchema);
    if (!data) return;

    try {
      ctx.textApi.updateEdge(params.id!, data as Record<string, unknown>);
      await autoSave(ctx);
      sendJson(res, 200, { updated: params.id });
    } catch (err: unknown) {
      sendError(res, 404, err instanceof Error ? err.message : String(err));
    }
  };
}

// ─── Route Factory ───────────────────────────────────────────

export function createMutationRoutes(ctx: GraphContext): RouteDefinition[] {
  return [
    // ── POST /api/nodes ─────────────────────────────────────
    {
      method: 'POST',
      path: '/api/nodes',
      handler: async (_req, res, _params, body) => {
        const data = validateBody(res, body, AddNodeSchema);
        if (!data) return;

        const node = ctx.textApi.addNode({
          type: data.type,
          displayName: data.displayName,
          parentId: data.parentId,
          position: data.position,
          args: data.args,
        });

        await autoSave(ctx);
        sendJson(res, 201, {
          id: node.id,
          type: node.type,
          displayName: node.displayName,
          args: node.args,
          position: node.position,
        });
      },
    },

    // ── PUT /api/nodes/:id ──────────────────────────────────
    {
      method: 'PUT',
      path: '/api/nodes/:id',
      handler: updateNodeHandler(ctx),
    },

    // ── PATCH /api/nodes/:id (alias for PUT) ────────────────
    {
      method: 'PATCH',
      path: '/api/nodes/:id',
      handler: updateNodeHandler(ctx),
    },

    // ── DELETE /api/nodes/:id ───────────────────────────────
    {
      method: 'DELETE',
      path: '/api/nodes/:id',
      handler: async (_req, res, params) => {
        try {
          ctx.textApi.removeNode(params.id!);
          await autoSave(ctx);
          sendNoContent(res);
        } catch (err: unknown) {
          sendError(res, 404, err instanceof Error ? err.message : String(err));
        }
      },
    },

    // ── POST /api/edges ─────────────────────────────────────
    {
      method: 'POST',
      path: '/api/edges',
      handler: async (_req, res, _params, body) => {
        const data = validateBody(res, body, AddEdgeSchema);
        if (!data) return;

        const edge = ctx.textApi.addEdge({
          fromNode: data.fromNode,
          toNode: data.toNode,
          type: data.type,
          label: data.label,
          fromPort: data.fromPort,
          toPort: data.toPort,
        });

        await autoSave(ctx);
        sendJson(res, 201, {
          id: edge.id,
          fromNode: edge.fromNode,
          toNode: edge.toNode,
          type: edge.type,
          label: edge.label,
        });
      },
    },

    // ── PUT /api/edges/:id ──────────────────────────────────
    {
      method: 'PUT',
      path: '/api/edges/:id',
      handler: updateEdgeHandler(ctx),
    },

    // ── PATCH /api/edges/:id (alias for PUT) ────────────────
    {
      method: 'PATCH',
      path: '/api/edges/:id',
      handler: updateEdgeHandler(ctx),
    },

    // ── DELETE /api/edges/:id ───────────────────────────────
    {
      method: 'DELETE',
      path: '/api/edges/:id',
      handler: async (_req, res, params) => {
        try {
          ctx.textApi.removeEdge(params.id!);
          await autoSave(ctx);
          sendNoContent(res);
        } catch (err: unknown) {
          sendError(res, 404, err instanceof Error ? err.message : String(err));
        }
      },
    },

    // ── POST /api/nodes/:id/notes ───────────────────────────
    {
      method: 'POST',
      path: '/api/nodes/:id/notes',
      handler: async (_req, res, params, body) => {
        const data = validateBody(res, body, AddNoteSchema);
        if (!data) return;

        try {
          const note = ctx.textApi.addNote({
            nodeId: params.id!,
            content: data.content,
            author: data.author,
            tags: data.tags,
          });
          await autoSave(ctx);
          sendJson(res, 201, {
            id: note.id,
            nodeId: params.id,
            content: note.content,
            author: note.author,
            tags: note.tags,
          });
        } catch (err: unknown) {
          sendError(res, 404, err instanceof Error ? err.message : String(err));
        }
      },
    },

    // ── DELETE /api/nodes/:nid/notes/:noteId ────────────────
    {
      method: 'DELETE',
      path: '/api/nodes/:nid/notes/:noteId',
      handler: async (_req, res, params) => {
        try {
          ctx.textApi.removeNote(params.nid!, params.noteId!);
          await autoSave(ctx);
          sendNoContent(res);
        } catch (err: unknown) {
          sendError(res, 404, err instanceof Error ? err.message : String(err));
        }
      },
    },

    // ── POST /api/nodes/:id/code-refs ───────────────────────
    {
      method: 'POST',
      path: '/api/nodes/:id/code-refs',
      handler: async (_req, res, params, body) => {
        const data = validateBody(res, body, AddCodeRefSchema);
        if (!data) return;

        try {
          ctx.textApi.addCodeRef({
            nodeId: params.id!,
            path: data.path,
            role: data.role,
          });
          await autoSave(ctx);
          sendJson(res, 201, {
            nodeId: params.id,
            path: data.path,
            role: data.role,
          });
        } catch (err: unknown) {
          sendError(res, 404, err instanceof Error ? err.message : String(err));
        }
      },
    },
  ];
}
