/**
 * Tests for CLI Query Commands (Feature #304).
 *
 * Verifies the 5 read-only query subcommands:
 * - describe: Describe the architecture in detail
 * - list-nodes: List all nodes in the architecture
 * - get-node: Get detailed information about a specific node
 * - search: Full-text search across nodes, edges, and notes
 * - list-nodedefs: List all available node type definitions
 *
 * Each command is tested with:
 * - JSON output format (for machine consumption / piping)
 * - Human-readable output format
 * - Table output format (where applicable)
 * - Error cases (missing file, node not found, etc.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphContext } from '@/cli/context';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Test Fixtures ──────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), 'archcanvas-query-test');
const TEST_FILE = path.join(TEST_DIR, 'test-query.archc');

let testNodeIds: string[] = [];
let testEdgeId: string;

beforeAll(async () => {
  // Create test directory and architecture file
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const ctx = GraphContext.createNew('Query Test Architecture');

  // Add test nodes
  const apiNode = ctx.textApi.addNode({
    type: 'compute/service',
    displayName: 'API Gateway',
  });
  const dbNode = ctx.textApi.addNode({
    type: 'data/database',
    displayName: 'Users Database',
  });
  const cacheNode = ctx.textApi.addNode({
    type: 'data/cache',
    displayName: 'Redis Cache',
  });

  testNodeIds = [apiNode.id, dbNode.id, cacheNode.id];

  // Add an edge
  const edge = ctx.textApi.addEdge({
    fromNode: apiNode.id,
    toNode: dbNode.id,
    type: 'sync',
    label: 'queries',
  });
  testEdgeId = edge.id;

  // Add a note
  ctx.textApi.addNote({
    targetNodeId: apiNode.id,
    content: 'Handles authentication and routing',
    author: 'test',
  });

  await ctx.saveAs(TEST_FILE);
});

afterAll(() => {
  // Clean up test files
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ─── Helper: Capture stdout from a command ──────────────────

async function captureOutput(
  args: string[],
): Promise<{ stdout: string[]; stderr: string[]; exitCode: number }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode = 0;

  // Mock console.log/error and process.exit
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;

  console.log = (...msgs: unknown[]) => {
    stdout.push(msgs.map(String).join(' '));
  };
  console.error = (...msgs: unknown[]) => {
    stderr.push(msgs.map(String).join(' '));
  };
  process.exit = ((code: number) => {
    exitCode = code;
    throw new Error(`EXIT_${code}`);
  }) as never;

  try {
    const program = createProgram();
    program.exitOverride(); // Prevent commander from calling process.exit
    await program.parseAsync(['node', 'archcanvas', ...args]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('EXIT_') && !msg.includes('outputHelp')) {
      // Re-throw unexpected errors
      console.log = origLog;
      console.error = origError;
      process.exit = origExit;
      throw err;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }

  return { stdout, stderr, exitCode };
}

// ─── describe command ───────────────────────────────────────

describe('describe command', () => {
  it('outputs architecture description in human format', async () => {
    const { stdout } = await captureOutput([
      'describe',
      '--file',
      TEST_FILE,
      '--format',
      'human',
    ]);
    const output = stdout.join('\n');
    expect(output).toContain('Query Test Architecture');
  });

  it('outputs architecture description in JSON format', async () => {
    const { stdout } = await captureOutput([
      'describe',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
  });

  it('supports --style structured', async () => {
    const { stdout } = await captureOutput([
      'describe',
      '--file',
      TEST_FILE,
      '--format',
      'json',
      '--style',
      'structured',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();
  });

  it('supports --style ai', async () => {
    const { stdout } = await captureOutput([
      'describe',
      '--file',
      TEST_FILE,
      '--format',
      'json',
      '--style',
      'ai',
    ]);
    const output = stdout.join('\n');
    expect(output.length).toBeGreaterThan(0);
  });

  it('requires --file flag', async () => {
    const { stderr, exitCode } = await captureOutput([
      'describe',
      '--format',
      'human',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr.join(' ')).toContain('--file');
  });
});

// ─── list-nodes command ─────────────────────────────────────

describe('list-nodes command', () => {
  it('lists all nodes in human format', async () => {
    const { stdout } = await captureOutput([
      'list-nodes',
      '--file',
      TEST_FILE,
      '--format',
      'human',
    ]);
    const output = stdout.join('\n');
    expect(output).toContain('API Gateway');
    expect(output).toContain('Users Database');
    expect(output).toContain('Redis Cache');
    expect(output).toContain('compute/service');
    expect(output).toContain('data/database');
    expect(output).toContain('data/cache');
  });

  it('lists all nodes in JSON format with correct structure', async () => {
    const { stdout } = await captureOutput([
      'list-nodes',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);

    // Each node should have id, type, displayName
    for (const node of parsed) {
      expect(node.id).toBeDefined();
      expect(node.type).toBeDefined();
      expect(node.displayName).toBeDefined();
    }
  });

  it('outputs table format with headers and rows', async () => {
    const { stdout } = await captureOutput([
      'list-nodes',
      '--file',
      TEST_FILE,
      '--format',
      'table',
    ]);
    const output = stdout.join('\n');
    // Table format should have header row with column names
    expect(output).toContain('id');
    expect(output).toContain('type');
    expect(output).toContain('displayName');
    // And data rows
    expect(output).toContain('API Gateway');
  });

  it('shows (no nodes) for empty architecture', async () => {
    const emptyFile = path.join(TEST_DIR, 'empty.archc');
    const ctx = GraphContext.createNew('Empty');
    await ctx.saveAs(emptyFile);

    const { stdout } = await captureOutput([
      'list-nodes',
      '--file',
      emptyFile,
      '--format',
      'human',
    ]);
    expect(stdout.join('\n')).toContain('(no nodes)');
  });
});

// ─── get-node command ───────────────────────────────────────

describe('get-node command', () => {
  it('returns detailed node information in JSON format', async () => {
    const { stdout } = await captureOutput([
      'get-node',
      testNodeIds[0]!,
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe(testNodeIds[0]);
    expect(parsed.displayName).toBe('API Gateway');
    expect(parsed.type).toBe('compute/service');
  });

  it('includes notes in node details', async () => {
    const { stdout } = await captureOutput([
      'get-node',
      testNodeIds[0]!,
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.notes).toBeDefined();
    expect(parsed.notes.length).toBeGreaterThan(0);
    expect(parsed.notes[0].content).toContain('authentication');
  });

  it('includes edge information', async () => {
    const { stdout } = await captureOutput([
      'get-node',
      testNodeIds[0]!,
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    // API Gateway has outbound edge to Users Database
    expect(parsed.outboundEdges).toBeDefined();
    expect(parsed.outboundEdges.length).toBe(1);
  });

  it('exits with error for non-existent node ID', async () => {
    const { stderr, exitCode } = await captureOutput([
      'get-node',
      'nonexistent-node-id',
      '--file',
      TEST_FILE,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr.join(' ')).toContain('not found');
  });

  it('shows human-readable format', async () => {
    const { stdout } = await captureOutput([
      'get-node',
      testNodeIds[0]!,
      '--file',
      TEST_FILE,
      '--format',
      'human',
    ]);
    const output = stdout.join('\n');
    // Human format for get-node falls through to JSON.stringify
    expect(output).toContain('API Gateway');
    expect(output).toContain(testNodeIds[0]!);
  });
});

// ─── search command ─────────────────────────────────────────

describe('search command', () => {
  it('finds nodes by display name', async () => {
    const { stdout } = await captureOutput([
      'search',
      'Gateway',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    const match = parsed.find(
      (r: { displayName: string }) => r.displayName === 'API Gateway',
    );
    expect(match).toBeDefined();
    expect(match.type).toBe('node');
  });

  it('finds nodes by type keyword', async () => {
    const { stdout } = await captureOutput([
      'search',
      'database',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('shows human-readable search results', async () => {
    const { stdout } = await captureOutput([
      'search',
      'Cache',
      '--file',
      TEST_FILE,
      '--format',
      'human',
    ]);
    const output = stdout.join('\n');
    expect(output).toContain('Redis Cache');
  });

  it('shows "No results" for non-matching query', async () => {
    const { stdout } = await captureOutput([
      'search',
      'xyznonexistent',
      '--file',
      TEST_FILE,
      '--format',
      'human',
    ]);
    expect(stdout.join('\n')).toContain('No results');
  });

  it('returns empty array in JSON for no matches', async () => {
    const { stdout } = await captureOutput([
      'search',
      'xyznonexistent',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed).toEqual([]);
  });

  it('search results include matchContext', async () => {
    const { stdout } = await captureOutput([
      'search',
      'Gateway',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed[0].matchContext).toBeDefined();
    expect(parsed[0].matchContext.length).toBeGreaterThan(0);
  });
});

// ─── list-nodedefs command ──────────────────────────────────

describe('list-nodedefs command', () => {
  it('lists all 15 built-in nodedefs in JSON format', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'json',
    ]);
    const output = stdout.join('\n');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(15);
  });

  it('each nodedef has type, displayName, and namespace', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    for (const def of parsed) {
      expect(def.type).toBeDefined();
      expect(def.displayName).toBeDefined();
      expect(def.namespace).toBeDefined();
    }
  });

  it('filters by namespace', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--namespace',
      'compute',
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed).toHaveLength(4);
    for (const def of parsed) {
      expect(def.namespace).toBe('compute');
    }
  });

  it('filters data namespace correctly', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--namespace',
      'data',
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed).toHaveLength(4);
    for (const def of parsed) {
      expect(def.namespace).toBe('data');
    }
  });

  it('shows human-readable grouped output', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'human',
    ]);
    const output = stdout.join('\n');
    expect(output).toContain('compute/');
    expect(output).toContain('data/');
    expect(output).toContain('messaging/');
    expect(output).toContain('network/');
    expect(output).toContain('observability/');
  });

  it('includes specific nodedef types', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'json',
    ]);
    const parsed = JSON.parse(stdout.join('\n'));
    const types = parsed.map((d: { type: string }) => d.type);
    expect(types).toContain('compute/service');
    expect(types).toContain('data/database');
    expect(types).toContain('messaging/message-queue');
    expect(types).toContain('network/load-balancer');
    expect(types).toContain('observability/logging');
  });

  it('does not require --file flag', async () => {
    // list-nodedefs should work without --file since it just reads built-in definitions
    const { stdout, exitCode } = await captureOutput([
      'list-nodedefs',
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed.length).toBe(15);
  });

  it('table format shows columns', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'table',
    ]);
    const output = stdout.join('\n');
    expect(output).toContain('type');
    expect(output).toContain('displayName');
    expect(output).toContain('namespace');
  });
});

// ─── All commands respect --format flag ─────────────────────

describe('Format flag consistency', () => {
  it('describe respects --format json', async () => {
    const { stdout } = await captureOutput([
      'describe',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    // JSON format should produce valid JSON
    expect(() => JSON.parse(stdout.join('\n'))).not.toThrow();
  });

  it('list-nodes respects --format json', async () => {
    const { stdout } = await captureOutput([
      'list-nodes',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    expect(() => JSON.parse(stdout.join('\n'))).not.toThrow();
  });

  it('search respects --format json', async () => {
    const { stdout } = await captureOutput([
      'search',
      'API',
      '--file',
      TEST_FILE,
      '--format',
      'json',
    ]);
    expect(() => JSON.parse(stdout.join('\n'))).not.toThrow();
  });

  it('list-nodedefs respects --format json', async () => {
    const { stdout } = await captureOutput([
      'list-nodedefs',
      '--format',
      'json',
    ]);
    expect(() => JSON.parse(stdout.join('\n'))).not.toThrow();
  });
});

// ─── Errors to stderr ───────────────────────────────────────

describe('Error output to stderr', () => {
  it('missing --file error goes to stderr', async () => {
    const { stderr, exitCode } = await captureOutput(['list-nodes']);
    expect(exitCode).toBe(1);
    expect(stderr.join(' ')).toContain('--file');
  });

  it('file not found error goes to stderr', async () => {
    const { stderr, exitCode } = await captureOutput([
      'list-nodes',
      '--file',
      '/tmp/nonexistent-file-archc-test.archc',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr.join(' ')).toContain('Failed to load');
  });

  it('node not found error goes to stderr', async () => {
    const { stderr, exitCode } = await captureOutput([
      'get-node',
      'fake-id',
      '--file',
      TEST_FILE,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr.join(' ')).toContain('not found');
  });
});

// ─── query.ts module exports ────────────────────────────────

describe('query.ts module', () => {
  it('exports registerQueryCommands function', async () => {
    const mod = await import('@/cli/commands/query');
    expect(typeof mod.registerQueryCommands).toBe('function');
  });

  it('exports individual command registration functions', async () => {
    const mod = await import('@/cli/commands/query');
    expect(typeof mod.registerDescribeCommand).toBe('function');
    expect(typeof mod.registerListNodesCommand).toBe('function');
    expect(typeof mod.registerGetNodeCommand).toBe('function');
    expect(typeof mod.registerSearchCommand).toBe('function');
    expect(typeof mod.registerListNodedefsCommand).toBe('function');
  });
});
