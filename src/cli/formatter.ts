/**
 * CLI Output Formatter
 *
 * Shared output formatting module used by all CLI commands.
 * Supports three output modes:
 * - json:  Machine-readable JSON (for piping and external agents)
 * - table: ASCII table with column alignment
 * - human: Natural-language, human-readable text
 *
 * Design principles:
 * - Data always goes to stdout (so piping works)
 * - Errors and informational messages go to stderr
 * - The --quiet flag suppresses informational messages
 */

// ─── Types ────────────────────────────────────────────────────

export type OutputFormat = 'json' | 'table' | 'human';

export interface TableColumn {
  key: string;
  header: string;
  /** Minimum width for the column */
  minWidth?: number;
  /** Alignment: 'left' (default) or 'right' */
  align?: 'left' | 'right';
}

// ─── Core Formatters ──────────────────────────────────────────

/**
 * Format data as JSON with 2-space indentation.
 * Suitable for piping to other tools or AI agents.
 */
export function formatAsJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format data as an ASCII table with column alignment.
 *
 * @param headers - Column definitions with key, header label, and optional alignment
 * @param rows - Array of objects containing the data to display
 * @returns Formatted ASCII table string
 *
 * @example
 * ```
 * formatAsTable(
 *   [{ key: 'name', header: 'Name' }, { key: 'type', header: 'Type' }],
 *   [{ name: 'Auth', type: 'compute/service' }]
 * )
 * // Name  Type
 * // ────  ────────────────
 * // Auth  compute/service
 * ```
 */
export function formatAsTable(headers: TableColumn[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return '(no results)';
  }

  // Calculate column widths
  const widths = headers.map((col) => {
    const minW = col.minWidth ?? 0;
    const headerW = col.header.length;
    const maxDataW = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(minW, headerW, maxDataW);
  });

  const lines: string[] = [];

  // Header row
  lines.push(headers.map((col, i) => padCell(col.header, widths[i]!, col.align)).join('  '));

  // Separator
  lines.push(widths.map((w) => '─'.repeat(w)).join('  '));

  // Data rows
  for (const row of rows) {
    lines.push(
      headers
        .map((col, i) => padCell(String(row[col.key] ?? ''), widths[i]!, col.align))
        .join('  '),
    );
  }

  return lines.join('\n');
}

/**
 * Format data as human-readable text using a template function.
 *
 * @param template - A template string with `{key}` placeholders
 * @param data - Data object to fill placeholders
 * @returns Formatted human-readable string
 */
export function formatAsHuman(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    return String(data[key] ?? '');
  });
}

// ─── Domain-Specific Formatters ──────────────────────────────

interface NodeSummaryData {
  id: string;
  type: string;
  displayName: string;
  [key: string]: unknown;
}

interface NodeDetailData {
  id: string;
  type: string;
  displayName: string;
  args?: Record<string, unknown>;
  codeRefs?: Array<{ path: string; role: string }>;
  notes?: Array<{ id: string; content: string; author: string }>;
  properties?: Record<string, unknown>;
  children?: unknown[];
  [key: string]: unknown;
}

interface EdgeSummaryData {
  id: string;
  from?: string;
  to?: string;
  fromNode?: string;
  toNode?: string;
  type: string;
  label?: string;
  [key: string]: unknown;
}

interface SearchResultData {
  type: string;
  id: string;
  displayName: string;
  matchContext: string;
  score: number;
  [key: string]: unknown;
}

/**
 * Format a list of nodes as a summary.
 *
 * - json: Returns the raw array
 * - table: ASCII table with ID, Type, Display Name columns
 * - human: Indented list with name [type] (id)
 */
export function formatNodeSummary(nodes: NodeSummaryData[], format: OutputFormat): string {
  if (format === 'json') {
    return formatAsJson(nodes);
  }

  if (nodes.length === 0) {
    return '(no nodes)';
  }

  if (format === 'table') {
    return formatAsTable(
      [
        { key: 'id', header: 'ID', minWidth: 10 },
        { key: 'type', header: 'Type', minWidth: 10 },
        { key: 'displayName', header: 'Name', minWidth: 10 },
      ],
      nodes,
    );
  }

  // human
  return nodes.map((n) => `  ${n.displayName} [${n.type}] (${n.id})`).join('\n');
}

/**
 * Format detailed information about a single node.
 *
 * - json: Full node object as JSON
 * - table: Key-value table
 * - human: Multi-line detail view
 */
export function formatNodeDetail(node: NodeDetailData, format: OutputFormat): string {
  if (format === 'json') {
    return formatAsJson(node);
  }

  if (format === 'table') {
    const rows: Record<string, unknown>[] = [
      { field: 'ID', value: node.id },
      { field: 'Type', value: node.type },
      { field: 'Name', value: node.displayName },
    ];
    if (node.args && Object.keys(node.args).length > 0) {
      rows.push({ field: 'Args', value: JSON.stringify(node.args) });
    }
    if (node.properties && Object.keys(node.properties).length > 0) {
      rows.push({ field: 'Properties', value: JSON.stringify(node.properties) });
    }
    if (node.codeRefs && node.codeRefs.length > 0) {
      rows.push({
        field: 'Code Refs',
        value: node.codeRefs.map((r) => `${r.path} (${r.role})`).join(', '),
      });
    }
    if (node.notes && node.notes.length > 0) {
      rows.push({ field: 'Notes', value: `${node.notes.length} note(s)` });
    }
    if (node.children && node.children.length > 0) {
      rows.push({ field: 'Children', value: `${node.children.length} child node(s)` });
    }
    return formatAsTable(
      [
        { key: 'field', header: 'Field', minWidth: 12 },
        { key: 'value', header: 'Value', minWidth: 10 },
      ],
      rows,
    );
  }

  // human
  const lines: string[] = [
    `Node: ${node.displayName}`,
    `  ID:   ${node.id}`,
    `  Type: ${node.type}`,
  ];
  if (node.args && Object.keys(node.args).length > 0) {
    lines.push(`  Args: ${JSON.stringify(node.args)}`);
  }
  if (node.properties && Object.keys(node.properties).length > 0) {
    lines.push(`  Properties: ${JSON.stringify(node.properties)}`);
  }
  if (node.codeRefs && node.codeRefs.length > 0) {
    lines.push('  Code Refs:');
    for (const ref of node.codeRefs) {
      lines.push(`    - ${ref.path} (${ref.role})`);
    }
  }
  if (node.notes && node.notes.length > 0) {
    lines.push('  Notes:');
    for (const note of node.notes) {
      lines.push(`    - [${note.author}] ${note.content}`);
    }
  }
  if (node.children && node.children.length > 0) {
    lines.push(`  Children: ${node.children.length} child node(s)`);
  }
  return lines.join('\n');
}

/**
 * Format a list of edges as a summary.
 *
 * - json: Returns the raw array
 * - table: ASCII table with ID, From, To, Type, Label columns
 * - human: Arrow-style list (from → to)
 */
export function formatEdgeSummary(edges: EdgeSummaryData[], format: OutputFormat): string {
  if (format === 'json') {
    return formatAsJson(edges);
  }

  if (edges.length === 0) {
    return '(no edges)';
  }

  // Normalize from/to fields
  const normalized = edges.map((e) => ({
    ...e,
    from: e.from ?? e.fromNode ?? '',
    to: e.to ?? e.toNode ?? '',
  }));

  if (format === 'table') {
    return formatAsTable(
      [
        { key: 'id', header: 'ID', minWidth: 10 },
        { key: 'from', header: 'From', minWidth: 8 },
        { key: 'to', header: 'To', minWidth: 8 },
        { key: 'type', header: 'Type', minWidth: 6 },
        { key: 'label', header: 'Label' },
      ],
      normalized,
    );
  }

  // human
  return normalized
    .map((e) => {
      const label = e.label ? ` "${e.label}"` : '';
      return `  ${e.from} → ${e.to} [${e.type}]${label} (${e.id})`;
    })
    .join('\n');
}

/**
 * Format search results.
 *
 * - json: Returns the raw array
 * - table: ASCII table with Type, Name, Context, Score columns
 * - human: Indented list with match context
 */
export function formatSearchResult(
  results: SearchResultData[],
  query: string,
  format: OutputFormat,
): string {
  if (format === 'json') {
    return formatAsJson(results);
  }

  if (results.length === 0) {
    return `No results for "${query}"`;
  }

  if (format === 'table') {
    return formatAsTable(
      [
        { key: 'type', header: 'Type', minWidth: 6 },
        { key: 'displayName', header: 'Name', minWidth: 10 },
        { key: 'matchContext', header: 'Context', minWidth: 10 },
        { key: 'score', header: 'Score', align: 'right', minWidth: 5 },
      ],
      results,
    );
  }

  // human
  return results.map((r) => `  [${r.type}] ${r.displayName} — ${r.matchContext}`).join('\n');
}

// ─── Generic Output Helper ───────────────────────────────────

/**
 * Format any data according to the specified output format.
 * This is a generic dispatcher that handles json/table/human routing.
 *
 * @param data - The data to format
 * @param format - Output format (json, table, human)
 * @param humanFormatter - Custom function for human-readable output
 * @param tableConfig - Optional table column configuration for table format
 */
export function formatOutput(
  data: unknown,
  format: OutputFormat,
  humanFormatter?: (data: unknown) => string,
  tableConfig?: { headers: TableColumn[] },
): string {
  if (format === 'json') {
    return formatAsJson(data);
  }

  if (format === 'human' && humanFormatter) {
    return humanFormatter(data);
  }

  // Table format or fallback
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '(no results)';
    }
    if (tableConfig) {
      return formatAsTable(tableConfig.headers, data as Record<string, unknown>[]);
    }
    // Auto-detect columns from first row
    const keys = Object.keys(data[0] as Record<string, unknown>);
    const headers: TableColumn[] = keys.map((k) => ({ key: k, header: k }));
    return formatAsTable(headers, data as Record<string, unknown>[]);
  }

  if (typeof data === 'object' && data !== null) {
    if (tableConfig) {
      return formatAsTable(tableConfig.headers, [data as Record<string, unknown>]);
    }
    // Key-value format for objects
    const entries = Object.entries(data as Record<string, unknown>);
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    return entries.map(([key, value]) => `${key.padEnd(maxKeyLen)}  ${String(value)}`).join('\n');
  }

  return String(data);
}

// ─── Stdout/Stderr Output Helpers ────────────────────────────

/**
 * Write data output to stdout.
 * Uses console.log so output can be captured in tests.
 * This is where formatted results go (for piping).
 */
export function writeOutput(text: string): void {
  console.log(text);
}

/**
 * Write informational message to stderr.
 * Only writes if quiet mode is not enabled.
 * Informational messages go to stderr so they don't interfere with piped output.
 */
export function writeInfo(message: string, quiet: boolean = false): void {
  if (!quiet) {
    console.error(message);
  }
}

/**
 * Write error message to stderr.
 */
export function writeError(message: string): void {
  console.error(`Error: ${message}`);
}

// ─── Internal Helpers ─────────────────────────────────────────

function padCell(text: string, width: number, align?: 'left' | 'right'): string {
  if (align === 'right') {
    return text.padStart(width);
  }
  return text.padEnd(width);
}
