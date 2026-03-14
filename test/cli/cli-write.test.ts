/**
 * CLI Integration Tests — Write commands (init, add-node, add-edge,
 * remove-node, remove-edge, import)
 *
 * These commands mutate project state. Each test gets its own temp dir
 * with a pre-written YAML fixture (no CLI spawns for setup).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCLI, parseJSON, FIXTURES, writeFixture } from './cli-helpers';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-cli-write-'));
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
    await runCLI(['init', '--path', tempDir, '--name', 'first'], tempDir);

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
    await writeFixture(tempDir, FIXTURES.empty());
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
// add-edge command (C5c)
// ---------------------------------------------------------------------------

describe('add-edge', () => {
  beforeEach(async () => {
    await writeFixture(tempDir, FIXTURES.twoNodesNoEdge());
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
    await writeFixture(tempDir, FIXTURES.twoNodesOneEdge());
  });

  it('removes an edge (C5e.1)', async () => {
    const result = await runCLI(
      ['--json', 'remove-edge', '--from', 'api', '--to', 'db'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);

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
    await writeFixture(tempDir, FIXTURES.twoNodesOneEdge());
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
// import command (C5i)
// ---------------------------------------------------------------------------

describe('import', () => {
  beforeEach(async () => {
    await writeFixture(tempDir, FIXTURES.empty());
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

    const listResult = await runCLI(['--json', 'list'], tempDir);
    const listJson = parseJSON(listResult.stdout);
    const nodes = listJson.nodes as Array<{ id: string }>;
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(['api', 'web']);
  });

  it('collects errors per item without stopping (C5i.3)', async () => {
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
    expect(added.nodes).toBe(1);
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
