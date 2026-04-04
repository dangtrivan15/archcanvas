/**
 * Pure-function Markdown export for Canvas data.
 *
 * No DOM dependency — fully unit-testable. Consumes the Canvas type directly
 * and produces a Markdown string with nodes, edges, and entities sections.
 */

import type { Canvas, Node } from '@/types';
import { listNodes, listEdges, listEntities } from '@/core/graph/query';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MarkdownExportOptions {
  /** Include a table of contents at the top. Default: true */
  includeToc?: boolean;
  /** Include entity section. Default: true */
  includeEntities?: boolean;
  /** Canvas display name override. Falls back to canvas.displayName or "Untitled Canvas" */
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeDisplayName(node: Node): string {
  if ('displayName' in node && node.displayName) return node.displayName;
  return node.id;
}

function getNodeType(node: Node): string | null {
  if ('type' in node) return node.type;
  if ('ref' in node) return `ref:${node.ref}`;
  return null;
}

function isRefNode(node: Node): boolean {
  return 'ref' in node;
}

function formatEdgeEndpoint(endpoint: { node: string; port?: string }): string {
  return endpoint.port ? `${endpoint.node}:${endpoint.port}` : endpoint.node;
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|');
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export function exportCanvasToMarkdown(
  canvas: Canvas,
  options: MarkdownExportOptions = {},
): string {
  const {
    includeToc = true,
    includeEntities = true,
    title,
  } = options;

  const canvasTitle = title ?? canvas.displayName ?? 'Untitled Canvas';
  const nodes = listNodes(canvas);
  const edges = listEdges(canvas);
  const entities = listEntities(canvas);

  const lines: string[] = [];

  // Title
  lines.push(`# ${canvasTitle}`);
  lines.push('');

  // Description
  if (canvas.description) {
    lines.push(canvas.description);
    lines.push('');
  }

  // Table of contents
  if (includeToc) {
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('- [Nodes](#nodes)');
    lines.push('- [Edges](#edges)');
    if (includeEntities && entities.length > 0) {
      lines.push('- [Entities](#entities)');
    }
    lines.push('');
  }

  // Nodes section
  lines.push('## Nodes');
  lines.push('');

  if (nodes.length === 0) {
    lines.push('_No nodes defined._');
    lines.push('');
  } else {
    lines.push('| Name | Type | Description |');
    lines.push('|------|------|-------------|');

    for (const node of nodes) {
      const name = escapeMarkdown(getNodeDisplayName(node));
      const type = escapeMarkdown(getNodeType(node) ?? '—');
      const desc = escapeMarkdown(
        ('description' in node && node.description) ? node.description : '—',
      );
      const refBadge = isRefNode(node) ? ' (subsystem)' : '';
      lines.push(`| ${name}${refBadge} | \`${type}\` | ${desc} |`);
    }
    lines.push('');

    // Node details (args, notes) for inline nodes with extra data
    for (const node of nodes) {
      if (isRefNode(node)) continue;
      const hasArgs = 'args' in node && node.args && Object.keys(node.args).length > 0;
      const hasNotes = 'notes' in node && node.notes && node.notes.length > 0;
      const hasCodeRefs = 'codeRefs' in node && node.codeRefs && node.codeRefs.length > 0;

      if (!hasArgs && !hasNotes && !hasCodeRefs) continue;

      lines.push(`### ${getNodeDisplayName(node)}`);
      lines.push('');

      if (hasArgs && 'args' in node && node.args) {
        lines.push('**Properties:**');
        lines.push('');
        for (const [key, value] of Object.entries(node.args)) {
          const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
          lines.push(`- **${key}:** ${displayValue}`);
        }
        lines.push('');
      }

      if (hasCodeRefs && 'codeRefs' in node && node.codeRefs) {
        lines.push('**Code References:**');
        lines.push('');
        for (const ref of node.codeRefs) {
          lines.push(`- \`${ref}\``);
        }
        lines.push('');
      }

      if (hasNotes && 'notes' in node && node.notes) {
        lines.push('**Notes:**');
        lines.push('');
        for (const note of node.notes) {
          lines.push(`> **${note.author}:** ${note.content}`);
        }
        lines.push('');
      }
    }
  }

  // Edges section
  lines.push('## Edges');
  lines.push('');

  if (edges.length === 0) {
    lines.push('_No edges defined._');
    lines.push('');
  } else {
    lines.push('| From | To | Protocol | Label |');
    lines.push('|------|-----|----------|-------|');

    for (const edge of edges) {
      const from = escapeMarkdown(formatEdgeEndpoint(edge.from));
      const to = escapeMarkdown(formatEdgeEndpoint(edge.to));
      const protocol = escapeMarkdown(edge.protocol ?? '—');
      const label = escapeMarkdown(edge.label ?? '—');
      lines.push(`| ${from} | ${to} | ${protocol} | ${label} |`);
    }
    lines.push('');
  }

  // Entities section
  if (includeEntities && entities.length > 0) {
    lines.push('## Entities');
    lines.push('');
    lines.push('| Name | Description |');
    lines.push('|------|-------------|');

    for (const entity of entities) {
      const name = escapeMarkdown(entity.name);
      const desc = escapeMarkdown(entity.description ?? '—');
      lines.push(`| ${name} | ${desc} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
