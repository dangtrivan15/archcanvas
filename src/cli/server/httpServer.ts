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
import { createQueryRoutes, type RouteDefinition } from './routes/query';
import { createMutationRoutes } from './routes/mutation';
import { createExportRoutes } from './routes/export';

// ─── Types ───────────────────────────────────────────────────

export interface HttpServerOptions {
  port: number;
  host: string;
  cors: boolean;
}

interface RouteMatch {
  handler: (
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body?: unknown,
  ) => Promise<void>;
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

// ─── Route Matching ──────────────────────────────────────────

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  body?: unknown,
) => Promise<void>;

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

  // ─── Import routes from route modules ────────────────────
  const queryRoutes: RouteDefinition[] = createQueryRoutes(ctx);
  const mutationRoutes: RouteDefinition[] = createMutationRoutes(ctx);
  const exportRoutes: RouteDefinition[] = createExportRoutes(ctx);

  // ─── Define Routes ───────────────────────────────────────

  const routes: Route[] = [
    // Health check
    defineRoute('GET', '/health', async (_req, res) => {
      sendJson(res, 200, { status: 'ok', file: ctx.getFilePath() ?? '(unsaved)' });
    }),

    // Register all query routes from routes/query.ts
    ...queryRoutes.map((r) => defineRoute(r.method, r.path, r.handler)),

    // Register all mutation routes from routes/mutation.ts
    ...mutationRoutes.map((r) => defineRoute(r.method, r.path, r.handler)),

    // Register all export routes from routes/export.ts
    ...exportRoutes.map((r) => defineRoute(r.method, r.path, r.handler)),
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
      process.stderr.write(`  GET  ${url}/api/nodedefs?namespace=...\n`);
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
