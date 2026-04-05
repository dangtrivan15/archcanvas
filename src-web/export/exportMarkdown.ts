import type { Canvas, Node, InlineNode } from '@/types';

/**
 * Export a canvas as a structured Markdown document with an embedded
 * Mermaid diagram block.
 *
 * This is a pure function — no DOM access, no side effects.
 */
export function exportMarkdown(canvas: Canvas): string {
  const lines: string[] = [];

  // --- Title ---
  const title = canvas.project?.name
    ?? canvas.displayName
    ?? 'Architecture';
  lines.push(`# ${title}`);
  lines.push('');

  // --- Description ---
  if (canvas.description) {
    lines.push(canvas.description);
    lines.push('');
  }

  // --- Nodes ---
  const nodes = canvas.nodes ?? [];
  if (nodes.length > 0) {
    lines.push('## Components');
    lines.push('');
    for (const node of nodes) {
      const isInline = 'type' in node;
      const name = isInline
        ? ((node as InlineNode).displayName ?? node.id)
        : node.id;
      const type = isInline ? (node as InlineNode).type : 'ref';
      lines.push(`### ${name}`);
      lines.push('');
      lines.push(`- **Type:** ${type}`);
      lines.push(`- **ID:** \`${node.id}\``);

      if (isInline) {
        const inline = node as InlineNode;
        if (inline.description) {
          lines.push(`- **Description:** ${inline.description}`);
        }
        if (inline.args && Object.keys(inline.args).length > 0) {
          lines.push(`- **Properties:**`);
          for (const [key, value] of Object.entries(inline.args)) {
            lines.push(`  - ${key}: \`${String(value)}\``);
          }
        }
        if (inline.codeRefs && inline.codeRefs.length > 0) {
          lines.push(`- **Code refs:** ${inline.codeRefs.map((r) => `\`${r}\``).join(', ')}`);
        }
      } else {
        lines.push(`- **Ref:** \`${'ref' in node ? node.ref : ''}\``);
      }
      lines.push('');
    }
  }

  // --- Entities ---
  const entities = canvas.entities ?? [];
  if (entities.length > 0) {
    lines.push('## Entities');
    lines.push('');
    for (const entity of entities) {
      lines.push(`- **${entity.name}**${entity.description ? `: ${entity.description}` : ''}`);
    }
    lines.push('');
  }

  // --- Edges ---
  const edges = canvas.edges ?? [];
  if (edges.length > 0) {
    lines.push('## Connections');
    lines.push('');
    lines.push('| From | To | Protocol | Label | Entities |');
    lines.push('|------|-----|----------|-------|----------|');
    for (const edge of edges) {
      const from = formatEndpoint(edge.from.node, edge.from.port);
      const to = formatEndpoint(edge.to.node, edge.to.port);
      const protocol = edge.protocol ?? '';
      const label = edge.label ?? '';
      const ents = (edge.entities ?? []).join(', ');
      lines.push(`| ${from} | ${to} | ${protocol} | ${label} | ${ents} |`);
    }
    lines.push('');
  }

  // --- Mermaid diagram ---
  if (nodes.length > 0 || edges.length > 0) {
    lines.push('## Diagram');
    lines.push('');
    lines.push('```mermaid');
    lines.push('graph TD');
    for (const node of nodes) {
      const label = getNodeLabel(node);
      const safeId = sanitizeMermaidId(node.id);
      lines.push(`    ${safeId}["${escapeMermaid(label)}"]`);
    }
    for (const edge of edges) {
      const fromId = sanitizeMermaidId(edge.from.node);
      const toId = sanitizeMermaidId(edge.to.node);
      const label = edge.label ?? edge.protocol ?? '';
      if (label) {
        lines.push(`    ${fromId} -->|"${escapeMermaid(label)}"| ${toId}`);
      } else {
        lines.push(`    ${fromId} --> ${toId}`);
      }
    }
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function formatEndpoint(node: string, port?: string): string {
  return port ? `${node}:${port}` : node;
}

function getNodeLabel(node: Node): string {
  if ('type' in node) {
    return (node as InlineNode).displayName ?? node.id;
  }
  return node.id;
}

/** Sanitize a node ID for use as a Mermaid node identifier */
function sanitizeMermaidId(id: string): string {
  // Replace non-alphanumeric characters (except _ and -) with underscores
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Escape special Mermaid characters in labels.
 * Quotes are replaced with single quotes; brackets and other Mermaid
 * syntax characters are removed to prevent rendering issues.
 */
function escapeMermaid(text: string): string {
  return text.replace(/"/g, "'").replace(/[[\]{}()#&]/g, '');
}
