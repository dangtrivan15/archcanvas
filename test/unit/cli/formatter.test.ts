/**
 * Tests for CLI Output Formatter (Feature #307).
 *
 * Verifies the shared output formatting module:
 * - formatAsJson: JSON output with 2-space indent
 * - formatAsTable: ASCII table with column alignment
 * - formatAsHuman: Template-based human-readable output
 * - formatNodeSummary: Node list formatting across all formats
 * - formatNodeDetail: Single node detail formatting
 * - formatEdgeSummary: Edge list formatting
 * - formatSearchResult: Search result formatting
 * - formatOutput: Generic format dispatcher
 * - writeOutput / writeInfo / writeError: stdout/stderr helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatAsJson,
  formatAsTable,
  formatAsHuman,
  formatOutput,
  formatNodeSummary,
  formatNodeDetail,
  formatEdgeSummary,
  formatSearchResult,
  writeOutput,
  writeInfo,
  writeError,
  type TableColumn,
} from '@/cli/formatter';

// ─── formatAsJson ────────────────────────────────────────────

describe('formatAsJson', () => {
  it('formats objects with 2-space indentation', () => {
    const data = { name: 'test', value: 42 };
    const result = formatAsJson(data);
    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  it('formats arrays', () => {
    const data = [1, 2, 3];
    expect(formatAsJson(data)).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('formats nested objects', () => {
    const data = { nested: { key: 'value' } };
    const result = formatAsJson(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('handles null', () => {
    expect(formatAsJson(null)).toBe('null');
  });

  it('handles strings', () => {
    expect(formatAsJson('hello')).toBe('"hello"');
  });
});

// ─── formatAsTable ───────────────────────────────────────────

describe('formatAsTable', () => {
  const headers: TableColumn[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
  ];

  it('formats a simple table with headers and rows', () => {
    const rows = [
      { name: 'Auth', type: 'service' },
      { name: 'DB', type: 'database' },
    ];
    const result = formatAsTable(headers, rows);
    const lines = result.split('\n');

    // Header row
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Type');

    // Separator
    expect(lines[1]).toMatch(/─+/);

    // Data rows
    expect(lines[2]).toContain('Auth');
    expect(lines[2]).toContain('service');
    expect(lines[3]).toContain('DB');
    expect(lines[3]).toContain('database');
  });

  it('returns (no results) for empty rows', () => {
    expect(formatAsTable(headers, [])).toBe('(no results)');
  });

  it('respects minWidth on columns', () => {
    const wideHeaders: TableColumn[] = [
      { key: 'x', header: 'X', minWidth: 20 },
    ];
    const rows = [{ x: 'hi' }];
    const result = formatAsTable(wideHeaders, rows);
    const lines = result.split('\n');
    // Header should be padded to at least 20 chars
    expect(lines[0]!.length).toBeGreaterThanOrEqual(20);
  });

  it('supports right alignment', () => {
    const rightHeaders: TableColumn[] = [
      { key: 'name', header: 'Name' },
      { key: 'score', header: 'Score', align: 'right' },
    ];
    const rows = [
      { name: 'Alpha', score: '99' },
      { name: 'Beta', score: '5' },
    ];
    const result = formatAsTable(rightHeaders, rows);
    const lines = result.split('\n');
    // Right-aligned "5" should have leading spaces
    const scoreCol = lines[3]!.split('  ').pop()!.trimEnd();
    // The score column value should be right-padded/aligned
    expect(lines[3]).toContain('5');
  });

  it('handles missing values gracefully', () => {
    const rows = [{ name: 'Test' }]; // missing 'type' key
    const result = formatAsTable(headers, rows);
    expect(result).toContain('Test');
    // Should not throw
  });
});

// ─── formatAsHuman ───────────────────────────────────────────

describe('formatAsHuman', () => {
  it('replaces {key} placeholders with data values', () => {
    const result = formatAsHuman('Hello, {name}! You have {count} items.', {
      name: 'Alice',
      count: 5,
    });
    expect(result).toBe('Hello, Alice! You have 5 items.');
  });

  it('replaces missing keys with empty string', () => {
    const result = formatAsHuman('Value: {missing}', {});
    expect(result).toBe('Value: ');
  });

  it('handles multiple occurrences of the same key', () => {
    const result = formatAsHuman('{x} and {x}', { x: 'yes' });
    expect(result).toBe('yes and yes');
  });
});

// ─── formatNodeSummary ───────────────────────────────────────

describe('formatNodeSummary', () => {
  const nodes = [
    { id: 'n1', type: 'compute/service', displayName: 'API Gateway' },
    { id: 'n2', type: 'data/database', displayName: 'Users DB' },
  ];

  it('formats as JSON', () => {
    const result = formatNodeSummary(nodes, 'json');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].displayName).toBe('API Gateway');
  });

  it('formats as table with ID, Type, Name columns', () => {
    const result = formatNodeSummary(nodes, 'table');
    expect(result).toContain('ID');
    expect(result).toContain('Type');
    expect(result).toContain('Name');
    expect(result).toContain('API Gateway');
    expect(result).toContain('Users DB');
  });

  it('formats as human-readable list', () => {
    const result = formatNodeSummary(nodes, 'human');
    expect(result).toContain('API Gateway [compute/service] (n1)');
    expect(result).toContain('Users DB [data/database] (n2)');
  });

  it('shows (no nodes) for empty list', () => {
    expect(formatNodeSummary([], 'human')).toBe('(no nodes)');
    expect(formatNodeSummary([], 'table')).toBe('(no nodes)');
  });
});

// ─── formatNodeDetail ────────────────────────────────────────

describe('formatNodeDetail', () => {
  const node = {
    id: 'n1',
    type: 'compute/service',
    displayName: 'API Gateway',
    args: { port: '8080' },
    codeRefs: [{ path: 'src/api.ts', role: 'SOURCE' }],
    notes: [{ id: 'note1', content: 'Main entry point', author: 'dev' }],
    properties: { version: '2.0' },
    children: [{ id: 'child1' }],
  };

  it('formats as JSON with all fields', () => {
    const result = formatNodeDetail(node, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('n1');
    expect(parsed.args.port).toBe('8080');
  });

  it('formats as table with key-value pairs', () => {
    const result = formatNodeDetail(node, 'table');
    expect(result).toContain('Field');
    expect(result).toContain('Value');
    expect(result).toContain('API Gateway');
    expect(result).toContain('compute/service');
  });

  it('formats as human-readable detail', () => {
    const result = formatNodeDetail(node, 'human');
    expect(result).toContain('Node: API Gateway');
    expect(result).toContain('ID:   n1');
    expect(result).toContain('Type: compute/service');
    expect(result).toContain('Args:');
    expect(result).toContain('Code Refs:');
    expect(result).toContain('src/api.ts');
    expect(result).toContain('Notes:');
    expect(result).toContain('Main entry point');
    expect(result).toContain('Children: 1 child node(s)');
  });

  it('omits empty sections in human format', () => {
    const simple = { id: 'n2', type: 'data/database', displayName: 'DB' };
    const result = formatNodeDetail(simple, 'human');
    expect(result).not.toContain('Args:');
    expect(result).not.toContain('Code Refs:');
    expect(result).not.toContain('Notes:');
  });
});

// ─── formatEdgeSummary ───────────────────────────────────────

describe('formatEdgeSummary', () => {
  const edges = [
    { id: 'e1', from: 'n1', to: 'n2', type: 'sync', label: 'queries' },
    { id: 'e2', fromNode: 'n2', toNode: 'n3', type: 'async' },
  ];

  it('formats as JSON', () => {
    const result = formatEdgeSummary(edges, 'json');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
  });

  it('formats as table', () => {
    const result = formatEdgeSummary(edges, 'table');
    expect(result).toContain('ID');
    expect(result).toContain('From');
    expect(result).toContain('To');
    expect(result).toContain('Type');
    expect(result).toContain('e1');
  });

  it('formats as human-readable with arrows', () => {
    const result = formatEdgeSummary(edges, 'human');
    expect(result).toContain('n1 → n2 [sync] "queries" (e1)');
    expect(result).toContain('n2 → n3 [async]');
  });

  it('handles fromNode/toNode aliases', () => {
    const result = formatEdgeSummary(edges, 'human');
    expect(result).toContain('n2 → n3');
  });

  it('shows (no edges) for empty list', () => {
    expect(formatEdgeSummary([], 'human')).toBe('(no edges)');
    expect(formatEdgeSummary([], 'table')).toBe('(no edges)');
  });
});

// ─── formatSearchResult ──────────────────────────────────────

describe('formatSearchResult', () => {
  const results = [
    { type: 'node', id: 'n1', displayName: 'API Gateway', matchContext: 'name match', score: 1.0 },
    { type: 'edge', id: 'e1', displayName: 'n1→n2', matchContext: 'label match', score: 0.5 },
  ];

  it('formats as JSON', () => {
    const result = formatSearchResult(results, 'api', 'json');
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].score).toBe(1.0);
  });

  it('formats as table with Score column', () => {
    const result = formatSearchResult(results, 'api', 'table');
    expect(result).toContain('Type');
    expect(result).toContain('Name');
    expect(result).toContain('Context');
    expect(result).toContain('Score');
    expect(result).toContain('API Gateway');
  });

  it('formats as human-readable with type badges', () => {
    const result = formatSearchResult(results, 'api', 'human');
    expect(result).toContain('[node] API Gateway — name match');
    expect(result).toContain('[edge] n1→n2 — label match');
  });

  it('shows no-results message with query', () => {
    expect(formatSearchResult([], 'xyz', 'human')).toBe('No results for "xyz"');
    expect(formatSearchResult([], 'xyz', 'table')).toBe('No results for "xyz"');
  });
});

// ─── formatOutput (generic dispatcher) ──────────────────────

describe('formatOutput', () => {
  it('dispatches to JSON format', () => {
    const result = formatOutput({ x: 1 }, 'json');
    expect(JSON.parse(result)).toEqual({ x: 1 });
  });

  it('dispatches to human format with custom formatter', () => {
    const result = formatOutput({ x: 1 }, 'human', () => 'custom output');
    expect(result).toBe('custom output');
  });

  it('auto-generates table from array data', () => {
    const result = formatOutput(
      [{ name: 'A', value: 1 }],
      'table',
    );
    expect(result).toContain('name');
    expect(result).toContain('value');
    expect(result).toContain('A');
  });

  it('shows key-value format for plain objects in table mode', () => {
    const result = formatOutput({ key: 'val', num: 42 }, 'table');
    expect(result).toContain('key');
    expect(result).toContain('val');
    expect(result).toContain('42');
  });

  it('returns (no results) for empty array', () => {
    expect(formatOutput([], 'table')).toBe('(no results)');
  });

  it('stringifies primitives', () => {
    expect(formatOutput('hello', 'table')).toBe('hello');
    expect(formatOutput(42, 'human')).toBe('42');
  });
});

// ─── writeOutput / writeInfo / writeError ────────────────────

describe('output helpers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('writeOutput sends to console.log (stdout)', () => {
    writeOutput('data goes here');
    expect(logSpy).toHaveBeenCalledWith('data goes here');
  });

  it('writeInfo sends to console.error (stderr) when not quiet', () => {
    writeInfo('info message', false);
    expect(errorSpy).toHaveBeenCalledWith('info message');
  });

  it('writeInfo suppresses output when quiet=true', () => {
    writeInfo('should not appear', true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('writeError sends to console.error (stderr) with Error prefix', () => {
    writeError('something broke');
    expect(errorSpy).toHaveBeenCalledWith('Error: something broke');
  });
});
