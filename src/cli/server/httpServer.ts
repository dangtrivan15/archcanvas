/**
 * HTTP REST API Server for ArchCanvas.
 *
 * Exposes the Text API and Export API as REST endpoints so external agents
 * can interact with an .archc file over standard HTTP requests.
 *
 * Uses Node.js built-in `node:http` — no external framework dependency.
 *
 * Endpoints:
 *   GET  /api/info                – Architecture summary
 *   GET  /api/describe?style=...  – Describe architecture
 *   GET  /api/nodes               – List all nodes
 *   GET  /api/nodes/:id           – Get node detail
 *   POST /api/nodes               – Add a node
 *   PATCH /api/nodes/:id          – Update a node
 *   DELETE /api/nodes/:id         – Remove a node
 *   GET  /api/edges               – List all edges
 *   POST /api/edges               – Add an edge
 *   PATCH /api/edges/:id          – Update an edge
 *   DELETE /api/edges/:id         – Remove an edge
 *   POST /api/nodes/:id/notes     – Add note to node
 *   DELETE /api/nodes/:nid/notes/:noteId – Remove note
 *   GET  /api/search?q=...        – Search
 *   GET  /api/export/markdown     – Export as markdown
 *   GET  /api/export/mermaid      – Export as mermaid
 *   GET  /api/export/summary      – Export summary + mermaid
 *   GET  /health                  – Health check
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { GraphContext } from '@/cli/context';

// ─── Types ───────────────────────────────────────────────────

export interface HttpServerOptions {
  port: number;
  host: string;
  cors: boolean;
}

interface RouteMatch {
  handler: (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, body?: unknown) => Promise<void>;
  params: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────

function parseUrl(url: string): { pathname: string; searchParams: URLSearchParams } {
  const parsed = new URL(url, 'http://localhost');
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
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
  sendJson(res, statusCode, { error: message });
}

function sendText(res: ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

// ─── Route Matching ──────────────────────────────────────────

type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>, body?: unknown) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

function defineRoute(method: string, path: string, handler: RouteHandler): Route {
  const paramNames: string[] = [];
  const regexParts = path.split('/').map((seg) => {
    if (seg.startsWith(':')) {
      paramNames.push(seg.slice(1));
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const pattern = new RegExp(`^${regexParts.join('/')}$`);
  return { method: method.toUpperCase(), pattern, paramNames, handler };
}

function matchRoute(routes: Route[], method: string, pathname: string): RouteMatch | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1]!;
      });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// ─── Server Factory ──────────────────────────────────────────

export function createHttpServer(ctx: GraphContext, options: HttpServerOptions): Server {
  const { cors } = options;

  // ─── Define Routes ───────────────────────────────────────

  const routes: Route[] = [
    // Health check
    defineRoute('GET', '/health', async (_req, res) => {
      sendJson(res, 200, { status: 'ok', file: ctx.getFilePath() ?? '(unsaved)' });
    }),

    // Architecture info
    defineRoute('GET', '/api/info', async (_req, res) => {
      const graph = ctx.getGraph();
      sendJson(res, 200, {
        name: graph.name,
        description: graph.description || '',
        owners: graph.owners,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        file: ctx.getFilePath() ?? '(unsaved)',
      });
    }),

    // Describe architecture
    defineRoute('GET', '/api/describe', async (req, res) => {
      const { searchParams } = parseUrl(req.url!);
      const style = (searchParams.get('style') ?? 'human') as 'structured' | 'human' | 'ai';
      const result = ctx.textApi.describe({ format: style });
      sendText(res, 200, result);
    }),

    // List nodes
    defineRoute('GET', '/api/nodes', async (_req, res) => {
      const nodes = ctx.textApi.listNodes();
      sendJson(res, 200, nodes);
    }),

    // Get node detail
    defineRoute('GET', '/api/nodes/:id', async (_req, res, params) => {
      const node = ctx.textApi.getNode(params.id!);
      if (!node) {
        sendError(res, 404, `Node "${params.id}" not found`);
        return;
      }
      sendJson(res, 200, node);
    }),

    // Add node
    defineRoute('POST', '/api/nodes', async (_req, res, _params, body) => {
      const data = body as Record<string, unknown> | undefined;
      if (!data || !data.type || !data.displayName) {
        sendError(res, 400, 'Request body must include "type" and "displayName"');
        return;
      }
      const node = ctx.textApi.addNode({
        type: data.type as string,
        displayName: data.displayName as string,
        parentId: data.parentId as string | undefined,
      });
      await ctx.save();
      sendJson(res, 201, { id: node.id, type: node.type, displayName: node.displayName });
    }),

    // Update node
    defineRoute('PATCH', '/api/nodes/:id', async (_req, res, params, body) => {
      const data = body as Record<string, unknown> | undefined;
      if (!data) {
        sendError(res, 400, 'Request body required');
        return;
      }
      try {
        ctx.textApi.updateNode(params.id!, data);
        await ctx.save();
        sendJson(res, 200, { updated: params.id });
      } catch (err: unknown) {
        sendError(res, 404, err instanceof Error ? err.message : String(err));
      }
    }),

    // Remove node
    defineRoute('DELETE', '/api/nodes/:id', async (_req, res, params) => {
      try {
        ctx.textApi.removeNode(params.id!);
        await ctx.save();
        sendJson(res, 200, { removed: params.id });
      } catch (err: unknown) {
        sendError(res, 404, err instanceof Error ? err.message : String(err));
      }
    }),

    // Add note to node
    defineRoute('POST', '/api/nodes/:id/notes', async (_req, res, params, body) => {
      const data = body as Record<string, unknown> | undefined;
      if (!data || !data.content) {
        sendError(res, 400, 'Request body must include "content"');
        return;
      }
      const note = ctx.textApi.addNote({
        nodeId: params.id!,
        content: data.content as string,
        author: (data.author as string) ?? 'http-api',
      });
      await ctx.save();
      sendJson(res, 201, { id: note.id, nodeId: params.id, content: note.content });
    }),

    // Remove note from node
    defineRoute('DELETE', '/api/nodes/:nid/notes/:noteId', async (_req, res, params) => {
      try {
        ctx.textApi.removeNote(params.nid!, params.noteId!);
        await ctx.save();
        sendJson(res, 200, { removed: params.noteId });
      } catch (err: unknown) {
        sendError(res, 404, err instanceof Error ? err.message : String(err));
      }
    }),

    // List edges
    defineRoute('GET', '/api/edges', async (_req, res) => {
      const edges = ctx.textApi.getEdges();
      sendJson(res, 200, edges);
    }),

    // Add edge
    defineRoute('POST', '/api/edges', async (_req, res, _params, body) => {
      const data = body as Record<string, unknown> | undefined;
      if (!data || !data.fromNode || !data.toNode) {
        sendError(res, 400, 'Request body must include "fromNode" and "toNode"');
        return;
      }
      const edge = ctx.textApi.addEdge({
        fromNode: data.fromNode as string,
        toNode: data.toNode as string,
        type: (data.type as 'sync' | 'async' | 'data-flow') ?? 'sync',
        label: data.label as string | undefined,
      });
      await ctx.save();
      sendJson(res, 201, { id: edge.id, from: edge.fromNode, to: edge.toNode, type: edge.type });
    }),

    // Update edge
    defineRoute('PATCH', '/api/edges/:id', async (_req, res, params, body) => {
      const data = body as Record<string, unknown> | undefined;
      if (!data) {
        sendError(res, 400, 'Request body required');
        return;
      }
      try {
        ctx.textApi.updateEdge(params.id!, data as Record<string, unknown>);
        await ctx.save();
        sendJson(res, 200, { updated: params.id });
      } catch (err: unknown) {
        sendError(res, 404, err instanceof Error ? err.message : String(err));
      }
    }),

    // Remove edge
    defineRoute('DELETE', '/api/edges/:id', async (_req, res, params) => {
      try {
        ctx.textApi.removeEdge(params.id!);
        await ctx.save();
        sendJson(res, 200, { removed: params.id });
      } catch (err: unknown) {
        sendError(res, 404, err instanceof Error ? err.message : String(err));
      }
    }),

    // Search
    defineRoute('GET', '/api/search', async (req, res) => {
      const { searchParams } = parseUrl(req.url!);
      const query = searchParams.get('q') ?? '';
      if (!query) {
        sendError(res, 400, 'Query parameter "q" is required');
        return;
      }
      const results = ctx.textApi.search(query);
      sendJson(res, 200, results);
    }),

    // Export markdown
    defineRoute('GET', '/api/export/markdown', async (_req, res) => {
      const graph = ctx.getGraph();
      const content = ctx.exportApi.generateMarkdownSummary(graph);
      sendText(res, 200, content);
    }),

    // Export mermaid
    defineRoute('GET', '/api/export/mermaid', async (_req, res) => {
      const graph = ctx.getGraph();
      const content = ctx.exportApi.generateMermaid(graph);
      sendText(res, 200, content);
    }),

    // Export summary (markdown + mermaid)
    defineRoute('GET', '/api/export/summary', async (_req, res) => {
      const graph = ctx.getGraph();
      const content = ctx.exportApi.generateSummaryWithMermaid(graph);
      sendText(res, 200, content);
    }),
  ];

  // ─── Request Handler ─────────────────────────────────────

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    const method = req.method?.toUpperCase() ?? 'GET';
    const { pathname } = parseUrl(req.url ?? '/');

    // CORS headers
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    // Handle preflight
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      logRequest(method, pathname, 204, startTime);
      return;
    }

    // Match route
    const match = matchRoute(routes, method, pathname);
    if (!match) {
      sendError(res, 404, `Not found: ${method} ${pathname}`);
      logRequest(method, pathname, 404, startTime);
      return;
    }

    try {
      // Parse body for POST/PUT/PATCH
      let body: unknown;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        body = await readBody(req);
      }

      await match.handler(req, res, match.params, body);
      logRequest(method, pathname, res.statusCode, startTime);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      sendError(res, 500, message);
      logRequest(method, pathname, 500, startTime);
    }
  });

  return server;
}

// ─── Request Logging ─────────────────────────────────────────

function logRequest(method: string, path: string, status: number, startTime: number): void {
  const duration = Date.now() - startTime;
  process.stderr.write(`${method} ${path} ${status} ${duration}ms\n`);
}

// ─── Start Server ────────────────────────────────────────────

export async function startHttpServer(
  ctx: GraphContext,
  options: HttpServerOptions,
): Promise<Server> {
  const server = createHttpServer(ctx, options);

  return new Promise((resolve, reject) => {
    server.on('error', (err: Error) => {
      reject(err);
    });

    server.listen(options.port, options.host, () => {
      const url = `http://${options.host}:${options.port}`;
      process.stderr.write(`\nArchCanvas HTTP API Server\n`);
      process.stderr.write(`  URL:  ${url}\n`);
      process.stderr.write(`  File: ${ctx.getFilePath() ?? '(unsaved)'}\n`);
      process.stderr.write(`  CORS: ${options.cors ? 'enabled' : 'disabled'}\n\n`);
      process.stderr.write(`Endpoints:\n`);
      process.stderr.write(`  GET  ${url}/health\n`);
      process.stderr.write(`  GET  ${url}/api/info\n`);
      process.stderr.write(`  GET  ${url}/api/describe?style=human|structured|ai\n`);
      process.stderr.write(`  GET  ${url}/api/nodes\n`);
      process.stderr.write(`  GET  ${url}/api/nodes/:id\n`);
      process.stderr.write(`  POST ${url}/api/nodes\n`);
      process.stderr.write(`  GET  ${url}/api/edges\n`);
      process.stderr.write(`  POST ${url}/api/edges\n`);
      process.stderr.write(`  GET  ${url}/api/search?q=...\n`);
      process.stderr.write(`  GET  ${url}/api/export/markdown\n`);
      process.stderr.write(`  GET  ${url}/api/export/mermaid\n`);
      process.stderr.write(`  GET  ${url}/api/export/summary\n\n`);
      process.stderr.write(`Press Ctrl+C to stop.\n\n`);

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        process.stderr.write(`\n${signal} received. Shutting down...\n`);
        if (ctx.isModified()) {
          process.stderr.write(`Saving modified file...\n`);
          try {
            await ctx.save(true);
            process.stderr.write(`File saved successfully.\n`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`Warning: Failed to save file: ${msg}\n`);
          }
        }
        server.close(() => {
          process.stderr.write(`Server stopped.\n`);
          process.exit(0);
        });
        // Force exit after 5 seconds if server doesn't close
        setTimeout(() => process.exit(1), 5000);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      resolve(server);
    });
  });
}
