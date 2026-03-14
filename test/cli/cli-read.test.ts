/**
 * CLI Integration Tests — Read-only commands (list, describe, search)
 *
 * These commands query project state without mutating it.
 * Fixtures are written directly as YAML (no CLI spawns for setup).
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCLI, parseJSON, FIXTURES, writeFixture } from './cli-helpers';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-cli-read-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// list command (C5f)
// ---------------------------------------------------------------------------

describe('list', () => {
  beforeEach(async () => {
    await writeFixture(tempDir, FIXTURES.oneNode());
  });

  it('shows the node after add-node (C5f.1)', async () => {
    const result = await runCLI(['--json', 'list'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const nodes = json.nodes as Array<{ id: string }>;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('api');
  });

  it('filters by --type nodes (C5f.2, C5f.4)', async () => {
    const result = await runCLI(['--json', 'list', '--type', 'nodes'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.nodes).toBeDefined();
    expect(json.edges).toBeUndefined();
    expect(json.entities).toBeUndefined();
  });

  it('filters by --type edges (C5f.2)', async () => {
    const result = await runCLI(['--json', 'list', '--type', 'edges'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.edges).toBeDefined();
    expect(json.nodes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// describe command (C5g)
// ---------------------------------------------------------------------------

describe('describe', () => {
  beforeEach(async () => {
    await writeFixture(tempDir, FIXTURES.twoNodesOneEdge('my-arch'));
  });

  it('shows full architecture when no --id given (C5g.2)', async () => {
    const result = await runCLI(['--json', 'describe'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    expect(json.project).toBe('my-arch');
    const scopes = json.scopes as Array<{ canvasId: string; nodeCount: number; edgeCount: number }>;
    expect(scopes.length).toBeGreaterThan(0);
    const root = scopes.find((s) => s.canvasId === '__root__');
    expect(root).toBeDefined();
    expect(root!.nodeCount).toBe(2);
    expect(root!.edgeCount).toBe(1);
  });

  it('describes a single node with ports (C5g.1, C5g.4)', async () => {
    const result = await runCLI(['--json', 'describe', '--id', 'api'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const node = json.node as {
      id: string;
      type: string;
      ports: Array<{ name: string }>;
      connectedEdges: Array<{ from: string; to: string }>;
    };
    expect(node.id).toBe('api');
    expect(node.type).toBe('compute/service');
    expect(node.ports).toBeDefined();
    expect(node.ports.length).toBeGreaterThan(0);
    expect(node.connectedEdges).toHaveLength(1);
    expect(node.connectedEdges[0].to).toBe('db');
  });

  it('errors for non-existent node', async () => {
    const result = await runCLI(['--json', 'describe', '--id', 'ghost'], tempDir);
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
    const error = json.error as { code: string };
    expect(error.code).toBe('NODE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// search command (C5h)
// ---------------------------------------------------------------------------

describe('search', () => {
  beforeEach(async () => {
    await writeFixture(tempDir, FIXTURES.searchData());
  });

  it('finds nodes by ID (C5h.1, C5h.2)', async () => {
    const result = await runCLI(['--json', 'search', 'api'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const results = json.results as Array<{ type: string; scope: string; item: Record<string, unknown> }>;
    expect(results.length).toBeGreaterThan(0);
    const nodeResults = results.filter((r) => r.type === 'node');
    expect(nodeResults.length).toBeGreaterThan(0);
    expect((nodeResults[0].item as { id: string }).id).toBe('api-gateway');
  });

  it('case-insensitive matching (C5h.3)', async () => {
    const result = await runCLI(['--json', 'search', 'DATABASE'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    const results = json.results as Array<{ type: string; item: Record<string, unknown> }>;
    const nodeResults = results.filter((r) => r.type === 'node');
    expect(nodeResults.length).toBeGreaterThan(0);
  });

  it('results include scope (canvasId) (C5h.4)', async () => {
    const result = await runCLI(['--json', 'search', 'api'], tempDir);
    const json = parseJSON(result.stdout);
    const results = json.results as Array<{ scope: string }>;
    for (const r of results) {
      expect(r.scope).toBeDefined();
      expect(typeof r.scope).toBe('string');
    }
  });

  it('finds edges by label (C5h.2)', async () => {
    const result = await runCLI(['--json', 'search', 'queries'], tempDir);
    const json = parseJSON(result.stdout);
    const results = json.results as Array<{ type: string }>;
    const edgeResults = results.filter((r) => r.type === 'edge');
    expect(edgeResults.length).toBeGreaterThan(0);
  });

  it('returns empty results for no match (C5h.5)', async () => {
    const result = await runCLI(['--json', 'search', 'zzz-nonexistent-zzz'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    const results = json.results as Array<unknown>;
    expect(results).toHaveLength(0);
  });
});
