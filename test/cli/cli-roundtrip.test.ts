/**
 * CLI Integration Tests — Round-trip & human output
 *
 * End-to-end smoke tests that exercise the full CLI flow via subprocess.
 * These intentionally use CLI calls for setup (not YAML fixtures) to test
 * the complete init → mutate → query → verify cycle.
 */
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runCLI, parseJSON, FIXTURES, writeFixture } from './cli-helpers';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-cli-roundtrip-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
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
    await writeFixture(tempDir, FIXTURES.empty());
  });

  it('init outputs a human-readable message', async () => {
    const newDir = join(tempDir, 'subproject');
    const result = await runCLI(['init', '--path', newDir, '--name', 'human-test'], tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initialized');
    expect(result.stdout).toContain('human-test');
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
