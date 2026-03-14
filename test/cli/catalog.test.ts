/**
 * CLI Catalog Command Tests
 *
 * These tests run the built `dist/cli.js` binary via `execFile` in isolated
 * temp directories, following the same pattern as cli-integration.test.ts.
 */
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
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
 * are mixed in before the JSON.
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
  expect(existsSync(CLI_PATH)).toBe(true);
}, 30_000);

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archcanvas-catalog-test-'));
  // Initialize a project for catalog to work with
  await runCLI(['init', '--path', tempDir, '--name', 'test-project'], tempDir);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// catalog command
// ---------------------------------------------------------------------------

describe('catalog', () => {
  it('--json returns all 32 builtin NodeDefs', async () => {
    const result = await runCLI(['--json', 'catalog'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const nodeTypes = json.nodeTypes as Array<{
      type: string;
      displayName: string;
      namespace: string;
      description: string;
      tags: string[];
    }>;
    expect(nodeTypes).toHaveLength(32);

    // Every entry should have the expected fields
    for (const entry of nodeTypes) {
      expect(entry.type).toMatch(/^[a-z]+\/[a-z-]+$/);
      expect(entry.displayName).toBeTruthy();
      expect(entry.namespace).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(Array.isArray(entry.tags)).toBe(true);
    }
  });

  it('--namespace filters correctly', async () => {
    const result = await runCLI(['--json', 'catalog', '--namespace', 'compute'], tempDir);
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const nodeTypes = json.nodeTypes as Array<{ namespace: string; type: string }>;
    expect(nodeTypes.length).toBeGreaterThan(0);

    // All results should be in the compute namespace
    for (const entry of nodeTypes) {
      expect(entry.namespace).toBe('compute');
      expect(entry.type).toMatch(/^compute\//);
    }
  });

  it('--namespace with unknown namespace returns empty array', async () => {
    const result = await runCLI(
      ['--json', 'catalog', '--namespace', 'nonexistent'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const nodeTypes = json.nodeTypes as Array<unknown>;
    expect(nodeTypes).toHaveLength(0);
  });

  it('human-readable output groups by namespace', async () => {
    const result = await runCLI(['catalog'], tempDir);
    expect(result.exitCode).toBe(0);

    // Should contain namespace headers
    expect(result.stdout).toContain('compute/');
    expect(result.stdout).toContain('data/');
    // Should NOT be JSON
    expect(result.stdout).not.toContain('"ok"');
  });
});

// ---------------------------------------------------------------------------
// add-node improved error message
// ---------------------------------------------------------------------------

describe('add-node error improvements', () => {
  it('UNKNOWN_NODE_TYPE error suggests namespace/name format', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'x', '--type', 'fake/nonexistent'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    const error = json.error as { code: string; message: string };
    expect(error.code).toBe('UNKNOWN_NODE_TYPE');
    expect(error.message).toContain('namespace/name');
    expect(error.message).toContain('archcanvas catalog --json');
  });

  it('dot notation is auto-corrected to slash', async () => {
    // compute.service should be auto-corrected to compute/service
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'svc', '--type', 'compute.service'],
      tempDir,
    );
    expect(result.exitCode).toBe(0);

    const json = parseJSON(result.stdout);
    expect(json.ok).toBe(true);
    const node = json.node as { type: string };
    expect(node.type).toBe('compute/service');
  });

  it('shows similar types when type is close', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'x', '--type', 'compute/srvice'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    const error = json.error as { code: string; message: string };
    expect(error.code).toBe('UNKNOWN_NODE_TYPE');
    // The search should find "compute/service" as a similar type
    expect(error.message).toContain('Similar types:');
  });

  it('suggests dot→slash replacement in error message', async () => {
    const result = await runCLI(
      ['--json', 'add-node', '--id', 'x', '--type', 'fake.thing'],
      tempDir,
    );
    expect(result.exitCode).toBe(1);

    const json = parseJSON(result.stderr);
    const error = json.error as { code: string; message: string };
    expect(error.code).toBe('UNKNOWN_NODE_TYPE');
    expect(error.message).toContain("Did you mean 'fake/thing'?");
  });
});
