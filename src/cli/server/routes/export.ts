/**
 * HTTP Export Endpoints – REST routes for markdown and Mermaid export.
 *
 * External agents can fetch architecture documentation programmatically.
 *
 * Routes:
 *   GET /api/export/markdown           – Export as markdown (text/markdown)
 *   GET /api/export/markdown?withMermaid=true – Export markdown + mermaid diagram
 *   GET /api/export/mermaid            – Export as Mermaid diagram (text/plain)
 *   GET /api/export/summary            – Export summary with mermaid (alias)
 *
 * Content negotiation:
 *   Accept: text/markdown or text/plain → raw text response
 *   Accept: application/json            → { content: '...' } JSON wrapper
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GraphContext } from '@/cli/context';
import type { RouteDefinition } from './query';

// ─── Helpers ────────────────────────────────────────────────

function parseUrl(url: string): { pathname: string; searchParams: URLSearchParams } {
  const parsed = new URL(url, 'http://localhost');
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

function wantsJson(req: IncomingMessage): boolean {
  const accept = req.headers['accept'] ?? '';
  // If the Accept header explicitly includes application/json, return JSON
  // unless it also includes text/* with higher priority
  if (accept.includes('application/json')) {
    return true;
  }
  return false;
}

function sendText(
  res: ServerResponse,
  statusCode: number,
  text: string,
  contentType: string,
): void {
  res.writeHead(statusCode, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Send export content, respecting Accept header content negotiation.
 * - Accept: application/json → { content: '...' }
 * - Otherwise → raw text with the given content type
 */
function sendExport(
  req: IncomingMessage,
  res: ServerResponse,
  content: string,
  textContentType: string,
): void {
  if (wantsJson(req)) {
    sendJson(res, 200, { content });
  } else {
    sendText(res, 200, content, textContentType);
  }
}

// ─── Route Factory ──────────────────────────────────────────

export function createExportRoutes(ctx: GraphContext): RouteDefinition[] {
  return [
    // ── GET /api/export/markdown ──────────────────────────────
    {
      method: 'GET',
      path: '/api/export/markdown',
      handler: async (req, res) => {
        const { searchParams } = parseUrl(req.url!);
        const withMermaid = searchParams.get('withMermaid') === 'true';
        const graph = ctx.getGraph();

        let content: string;
        if (withMermaid) {
          content = ctx.exportApi.generateSummaryWithMermaid(graph);
        } else {
          content = ctx.exportApi.generateMarkdownSummary(graph);
        }

        sendExport(req, res, content, 'text/markdown');
      },
    },

    // ── GET /api/export/mermaid ───────────────────────────────
    {
      method: 'GET',
      path: '/api/export/mermaid',
      handler: async (req, res) => {
        const graph = ctx.getGraph();
        const content = ctx.exportApi.generateMermaid(graph);
        sendExport(req, res, content, 'text/plain');
      },
    },

    // ── GET /api/export/summary ───────────────────────────────
    {
      method: 'GET',
      path: '/api/export/summary',
      handler: async (req, res) => {
        const graph = ctx.getGraph();
        const content = ctx.exportApi.generateSummaryWithMermaid(graph);
        sendExport(req, res, content, 'text/markdown');
      },
    },
  ];
}
