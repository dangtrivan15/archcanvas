/**
 * CLI Integration Tests
 *
 * These tests run the built `dist/cli.js` binary via `execFile` (not `exec`,
 * to avoid shell injection) in isolated temp directories. Each test creates
 * its own temp dir, runs CLI commands, and verifies stdout/stderr/exit codes.
 *
 * Spec: section 7.9 of docs/specs/2026-03-13-i5-cli-persistence-ui-design.md
 */
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

const execFileAsync = promisify(execFileCb);
const CLI_PATH = resolve(__dirname, '../../dist/cli.js');

interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCLI(args: string[], cwd: string): Promise<CLIResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd,
      timeout: 15000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    };
  }
}

/**
 * Parse JSON from CLI output. Handles cases where Node.js warnings
 * (e.g., `(node:XXXX) Warning: ...`) are mixed in before the JSON.
 * Extracts the first `{...}` block from the string.
 */
function parseJSON(output: string): Record<string, unknown> {
  const trimmed = output.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`No JSON found in output: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(jsonStart));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeAll(async () => {
  // Build CLI before running integration tests
  await execFileAsync('npx', ['vite', 'build', '--config', 'vite.config.cli.ts'], {
    cwd: resolve(__dirname, '../..'),
  });
  // Verify the CLI binary exists
  expect(existsSync(CLI_PATH)).toBe(true);
}, 30_000);

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-cli-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// init command (C5a)
// ---------------------------------------------------------------------------

describe('init', () => {
  it('creates .archcanvas/ and main.yaml (C5a.1, C5a.2)', async () => {
    const result = await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('test-project');

    // Verify files created
    const mainYaml = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    expect(mainYaml).toContain('name: test-project');
    expect(mainYaml).toContain('nodes: []');
    expect(mainYaml).toContain('edges: []');
    expect(mainYaml).toContain('entities: []');
  });

  it('--json outputs valid JSON with { ok: true, project: { name, path } } (C5a.5)', async () => {
    const result = await runCLI(
      ['--json', 'init', '--path', tempDir, '--name', 'json-project'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    expect(json.project).toBeDefined();
    const project = json.project as { name: string; path: string };
    expect(project.name).toBe('json-project');
    expect(project.path).toBeTruthy();
  });

  it('exits with code 1 and error message on existing project (C5a.3)', async () => {
    // First init succeeds
    await runCLI(['init', '--path', tempDir, '--name', 'first'], tempDir);

    // Second init fails
    const result = await runCLI(
      ['--json', 'init', '--path', tempDir, '--name', 'second'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
    const error = json.error as { code: string; message: string };
    expect(error.code).toBe('PROJECT_EXISTS');
  });
});

// ---------------------------------------------------------------------------
// add-node command (C5b)
// ---------------------------------------------------------------------------

describe('add-node', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
  });

  it('--json outputs valid JSON with node details (C5b.6, C6.1)', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'api', '--type', 'compute/service', '--name', 'API Server'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const node = json.node as { id: string; type: string; displayName: string };
    expect(node.id).toBe('api');
    expect(node.type).toBe('compute/service');
    expect(node.displayName).toBe('API Server');
  });

  it('uses NodeDef displayName when --name is not provided (C5b.5)', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'svc1', '--type', 'compute/service'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    const node = json.node as { displayName: string };
    // The compute/service NodeDef displayName is "Service"
    expect(node.displayName).toBe('Service');
  });

  it('errors for unknown node type (C5b.4)', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'x', '--type', 'fake/nonexistent'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
    const error = json.error as { code: string };
    expect(error.code).toBe('UNKNOWN_NODE_TYPE');
  });

  it('errors for duplicate node ID', async () => {
    await runCLI(['add-node', '--id', 'dup', '--type', 'compute/service'], tempDir);
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'dup', '--type', 'compute/service'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
    const error = json.error as { code: string };
    expect(error.code).toBe('DUPLICATE_NODE_ID');
  });
});

// ---------------------------------------------------------------------------
// list command (C5f)
// ---------------------------------------------------------------------------

describe('list', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    await runCLI(
      ['add-node', '--id', 'api', '--type', 'compute/service', '--name', 'API'],
      tempDir,
    );
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
// add-edge command (C5c)
// ---------------------------------------------------------------------------

describe('add-edge', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    await runCLI(['add-node', '--id', 'api', '--type', 'compute/service'], tempDir);
    await runCLI(['add-node', '--id', 'db', '--type', 'data/database'], tempDir);
  });

  it('connects two nodes successfully (C5c.1)', async () => {
    const result = await runCLI(
      ['--json', 'add-edge', '--from', 'api', '--to', 'db', '--label', 'queries'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const edge = json.edge as { from: string; to: string; label: string };
    expect(edge.from).toBe('api');
    expect(edge.to).toBe('db');
    expect(edge.label).toBe('queries');
  });

  it('edge appears in list (C5c.2)', async () => {
    await runCLI(['add-edge', '--from', 'api', '--to', 'db'], tempDir);

    const result = await runCLI(['--json', 'list'], tempDir);
    const json = parseJSON(result.stdout);
    const edges = json.edges as Array<{ from: string; to: string }>;
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('api');
    expect(edges[0].to).toBe('db');
  });
});

// ---------------------------------------------------------------------------
// remove-edge command (C5e)
// ---------------------------------------------------------------------------

describe('remove-edge', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    await runCLI(['add-node', '--id', 'api', '--type', 'compute/service'], tempDir);
    await runCLI(['add-node', '--id', 'db', '--type', 'data/database'], tempDir);
    await runCLI(['add-edge', '--from', 'api', '--to', 'db'], tempDir);
  });

  it('removes an edge (C5e.1)', async () => {
    const result = await runCLI(
      ['--json', 'remove-edge', '--from', 'api', '--to', 'db'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);

    // Verify edge is gone
    const listResult = await runCLI(['--json', 'list'], tempDir);
    const listJson = parseJSON(listResult.stdout);
    const edges = listJson.edges as Array<{ from: string; to: string }>;
    expect(edges).toHaveLength(0);
  });

  it('errors for non-existent edge (C5e.3)', async () => {
    const result = await runCLI(
      ['--json', 'remove-edge', '--from', 'api', '--to', 'nonexistent'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// remove-node command (C5d)
// ---------------------------------------------------------------------------

describe('remove-node', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    await runCLI(['add-node', '--id', 'api', '--type', 'compute/service'], tempDir);
    await runCLI(['add-node', '--id', 'db', '--type', 'data/database'], tempDir);
    await runCLI(['add-edge', '--from', 'api', '--to', 'db'], tempDir);
  });

  it('removes a node and connected edges (C5d.1, C5d.4)', async () => {
    const result = await runCLI(
      ['--json', 'remove-node', '--id', 'db'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const removed = json.removed as { id: string };
    expect(removed.id).toBe('db');

    // Verify node and connected edges are gone
    const listResult = await runCLI(['--json', 'list'], tempDir);
    const listJson = parseJSON(listResult.stdout);
    const nodes = listJson.nodes as Array<{ id: string }>;
    const edges = listJson.edges as Array<{ from: string; to: string }>;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('api');
    expect(edges).toHaveLength(0);
  });

  it('errors for non-existent node (C5d.3)', async () => {
    const result = await runCLI(
      ['--json', 'remove-node', '--id', 'ghost'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// describe command (C5g)
// ---------------------------------------------------------------------------

describe('describe', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'my-arch'], tempDir);
    await runCLI(
      ['add-node', '--id', 'api', '--type', 'compute/service', '--name', 'API'],
      tempDir,
    );
    await runCLI(['add-node', '--id', 'db', '--type', 'data/database', '--name', 'DB'], tempDir);
    await runCLI(['add-edge', '--from', 'api', '--to', 'db'], tempDir);
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
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
    await runCLI(
      ['add-node', '--id', 'api-gateway', '--type', 'compute/service', '--name', 'API Gateway'],
      tempDir,
    );
    await runCLI(
      ['add-node', '--id', 'user-db', '--type', 'data/database', '--name', 'User Database'],
      tempDir,
    );
    await runCLI(
      ['add-edge', '--from', 'api-gateway', '--to', 'user-db', '--label', 'queries user data'],
      tempDir,
    );
  });

  it('finds nodes by ID (C5h.1, C5h.2)', async () => {
    const result = await runCLI(['--json', 'search', 'api'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const results = json.results as Array<{ type: string; scope: string; item: Record<string, unknown> }>;
    expect(results.length).toBeGreaterThan(0);
    // Should find the node and the edge (api-gateway appears in edge from)
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

// ---------------------------------------------------------------------------
// import command (C5i)
// ---------------------------------------------------------------------------

describe('import', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
  });

  it('bulk-creates nodes and edges from YAML (C5i.1, C5i.2)', async () => {
    const importFile = join(tempDir, 'import.yaml');
    await writeFile(
      importFile,
      `nodes:
  - id: web
    type: client/web-app
    displayName: Web Frontend
  - id: api
    type: compute/service
    displayName: API Server
edges:
  - from:
      node: web
    to:
      node: api
    label: HTTP calls
`,
    );

    const result = await runCLI(
      ['--json', 'import', '--file', importFile],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const added = json.added as { nodes: number; edges: number; entities: number };
    expect(added.nodes).toBe(2);
    expect(added.edges).toBe(1);
    expect(added.entities).toBe(0);
    const errors = json.errors as Array<unknown>;
    expect(errors).toHaveLength(0);

    // Verify via list
    const listResult = await runCLI(['--json', 'list'], tempDir);
    const listJson = parseJSON(listResult.stdout);
    const nodes = listJson.nodes as Array<{ id: string }>;
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(['api', 'web']);
  });

  it('collects errors per item without stopping (C5i.3)', async () => {
    // Add a node first so the import has a duplicate
    await runCLI(['add-node', '--id', 'existing', '--type', 'compute/service'], tempDir);

    const importFile = join(tempDir, 'import.yaml');
    await writeFile(
      importFile,
      `nodes:
  - id: existing
    type: compute/service
    displayName: Duplicate
  - id: fresh
    type: data/database
    displayName: Fresh DB
`,
    );

    const result = await runCLI(
      ['--json', 'import', '--file', importFile],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    const added = json.added as { nodes: number };
    const errors = json.errors as Array<{ type: string; error: string }>;
    expect(added.nodes).toBe(1); // only the fresh one
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('node');
    expect(errors[0].error).toContain('DUPLICATE_NODE_ID');
  });

  it('errors for non-existent import file', async () => {
    const result = await runCLI(
      ['--json', 'import', '--file', join(tempDir, 'does-not-exist.yaml')],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    expect(json.ok).toBe(false);
    const error = json.error as { code: string };
    expect(error.code).toBe('INVALID_ARGS');
  });
});

// ---------------------------------------------------------------------------
// Round-trip test (Cross-system)
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  it('init → add-node (2) → add-edge → list --json verifies 2 nodes and 1 edge', { timeout: 30_000 }, async () => {
    // 1. init
    const initResult = await runCLI(
      ['--json', 'init', '--path', tempDir, '--name', 'roundtrip'],
      tempDir,
    );
    expect(initResult.exitCode).toBe(0);

    // 2. add two nodes
    const n1 = await runCLI(
      ['--json', 'add-node', '--id', 'frontend', '--type', 'client/web-app', '--name', 'Frontend'],
      tempDir,
    );
    expect(n1.exitCode).toBe(0);

    const n2 = await runCLI(
      ['--json', 'add-node', '--id', 'backend', '--type', 'compute/service', '--name', 'Backend'],
      tempDir,
    );
    expect(n2.exitCode).toBe(0);

    // 3. add edge
    const e1 = await runCLI(
      ['--json', 'add-edge', '--from', 'frontend', '--to', 'backend', '--protocol', 'REST'],
      tempDir,
    );
    expect(e1.exitCode).toBe(0);

    // 4. list and verify
    const listResult = await runCLI(['--json', 'list'], tempDir);
    expect(listResult.exitCode).toBe(0);

    const json = parseJSON(listResult.stdout);
    expect(json.ok).toBe(true);
    const nodes = json.nodes as Array<{ id: string; type: string; displayName: string }>;
    const edges = json.edges as Array<{ from: string; to: string; protocol: string }>;

    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(['backend', 'frontend']);
    expect(nodes.find((n) => n.id === 'frontend')!.displayName).toBe('Frontend');
    expect(nodes.find((n) => n.id === 'backend')!.displayName).toBe('Backend');

    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('frontend');
    expect(edges[0].to).toBe('backend');
    expect(edges[0].protocol).toBe('REST');

    // 5. Verify the YAML file was persisted correctly
    const mainYaml = await readFile(join(tempDir, '.archcanvas', 'main.yaml'), 'utf-8');
    expect(mainYaml).toContain('frontend');
    expect(mainYaml).toContain('backend');
  });
});

// ---------------------------------------------------------------------------
// Human output mode
// ---------------------------------------------------------------------------

describe('human output mode', () => {
  beforeEach(async () => {
    await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
  });

  it('init outputs a human-readable message', async () => {
    const newDir = join(tempDir, 'subproject');
    // Note: cwd must be tempDir (not newDir) because newDir doesn't exist yet;
    // --path tells init where to create the project.
    const result = await runCLI(['init', '--path', newDir, '--name', 'human-test'], tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized');
    expect(result.stdout).toContain('human-test');
    // Should NOT be JSON
    expect(result.stdout).not.toContain('"ok"');
  });

  it('add-node outputs human-readable text', async () => {
    const result = await runCLI(
      ['add-node', '--id', 'svc', '--type', 'compute/service', '--name', 'My Service'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('"ok"');
    expect(result.stdout).toContain('svc');
  });

  it('list outputs human-readable text', async () => {
    await runCLI(['add-node', '--id', 'svc', '--type', 'compute/service'], tempDir);
    const result = await runCLI(['list'], tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('"ok"');
  });
});
