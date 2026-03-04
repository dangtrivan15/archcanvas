/**
 * HTTP Query Endpoints – read-only REST routes that map to Text API query methods.
 *
 * All GET endpoints return JSON with a consistent response envelope:
 *   { data: <payload>, meta: { timestamp: string, ... } }
 *
 * Routes:
 *   GET /api/info               – File metadata (name, version, timestamps, counts)
 *   GET /api/describe           – Describe architecture (scope, nodeId, format params)
 *   GET /api/nodes              – List all nodes (NodeSummary[])
 *   GET /api/nodes/:id          – Get node detail (NodeDetail, 404 if not found)
 *   GET /api/edges              – List all edges (EdgeSummary[])
 *   GET /api/search?q=<query>   – Search architecture (SearchResult[])
 *   GET /api/nodedefs           – List available node type definitions
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GraphContext } from '@/cli/context';

// ─── Types ──────────────────────────────────────────────────

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  body?: unknown,
) => Promise<void>;

export interface RouteDefinition {
  method: string;
  path: string;
  handler: RouteHandler;
}

// ─── Helpers ────────────────────────────────────────────────

function parseUrl(url: string): { pathname: string; searchParams: URLSearchParams } {
  const parsed = new URL(url, 'http://localhost');
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res: ServerResponse, statusCode: number, message: string): void {
  sendJson(res, statusCode, { error: message, meta: { timestamp: new Date().toISOString() } });
}

/** Wrap a payload in the standard { data, meta } envelope. */
function envelope(data: unknown, extra?: Record<string, unknown>): { data: unknown; meta: Record<string, unknown> } {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...extra,
    },
  };
}

// ─── Route Factory ──────────────────────────────────────────

export function createQueryRoutes(ctx: GraphContext): RouteDefinition[] {
  return [
    // ── GET /api/info ──────────────────────────────────────
    {
      method: 'GET',
      path: '/api/info',
      handler: async (_req, res) => {
        const graph = ctx.getGraph();
        const info = {
          name: graph.name,
          description: graph.description || '',
          owners: graph.owners,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          file: ctx.getFilePath() ?? '(unsaved)',
        };
        sendJson(res, 200, envelope(info));
      },
    },

    // ── GET /api/describe ──────────────────────────────────
    {
      method: 'GET',
      path: '/api/describe',
      handler: async (req, res) => {
        const { searchParams } = parseUrl(req.url!);

        const scope = (searchParams.get('scope') ?? 'full') as 'full' | 'node' | 'nodes';
        const nodeId = searchParams.get('nodeId') ?? undefined;
        const format = (searchParams.get('format') ??
          searchParams.get('style') ??
          'human') as 'structured' | 'human' | 'ai';

        // Validate scope + nodeId combination
        if (scope === 'node' && !nodeId) {
          sendError(res, 400, 'Parameter "nodeId" is required when scope is "node"');
          return;
        }

        const result = ctx.textApi.describe({
          scope,
          nodeId,
          format,
        });

        sendJson(res, 200, envelope(result, { scope, format }));
      },
    },

    // ── GET /api/nodes ─────────────────────────────────────
    {
      method: 'GET',
      path: '/api/nodes',
      handler: async (_req, res) => {
        const nodes = ctx.textApi.listNodes();
        sendJson(res, 200, envelope(nodes, { count: nodes.length }));
      },
    },

    // ── GET /api/nodes/:id ─────────────────────────────────
    {
      method: 'GET',
      path: '/api/nodes/:id',
      handler: async (_req, res, params) => {
        const node = ctx.textApi.getNode(params.id!);
        if (!node) {
          sendError(res, 404, `Node "${params.id}" not found`);
          return;
        }
        sendJson(res, 200, envelope(node));
      },
    },

    // ── GET /api/edges ─────────────────────────────────────
    {
      method: 'GET',
      path: '/api/edges',
      handler: async (_req, res) => {
        const edges = ctx.textApi.getEdges();
        sendJson(res, 200, envelope(edges, { count: edges.length }));
      },
    },

    // ── GET /api/search?q=<query> ──────────────────────────
    {
      method: 'GET',
      path: '/api/search',
      handler: async (req, res) => {
        const { searchParams } = parseUrl(req.url!);
        const query = searchParams.get('q') ?? '';
        if (!query) {
          sendError(res, 400, 'Query parameter "q" is required');
          return;
        }
        const results = ctx.textApi.search(query);
        sendJson(res, 200, envelope(results, { query, count: results.length }));
      },
    },

    // ── GET /api/nodedefs ──────────────────────────────────
    {
      method: 'GET',
      path: '/api/nodedefs',
      handler: async (req, res) => {
        const { searchParams } = parseUrl(req.url!);
        const namespace = searchParams.get('namespace') ?? undefined;

        let defs;
        if (namespace) {
          defs = ctx.registry.listByNamespace(namespace);
        } else {
          defs = ctx.registry.listAll();
        }

        // Return a summary of each nodedef (not the full spec to keep responses lean)
        const summaries = defs.map((def) => ({
          type: `${def.metadata.namespace}/${def.metadata.name}`,
          displayName: def.metadata.displayName,
          namespace: def.metadata.namespace,
          description: def.metadata.description,
          icon: def.metadata.icon,
          tags: def.metadata.tags,
          shape: def.metadata.shape ?? 'rectangle',
          argCount: def.spec.args.length,
          portCount: def.spec.ports.length,
        }));

        sendJson(res, 200, envelope(summaries, {
          count: summaries.length,
          ...(namespace ? { namespace } : {}),
        }));
      },
    },
  ];
}
