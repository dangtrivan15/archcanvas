/**
 * CLI Integration Tests (Feature #315).
 *
 * Tests the full CLI round-trip:
 *   init → add-node → add-edge → describe → export
 * Verifies that CLI mutation commands correctly save .archc files
 * and that the data can be re-read. Also tests error handling:
 * missing file, invalid node ID, corrupt file, and JSON output.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Helper to run a CLI command and capture stdout/stderr
async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const program = createProgram();
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;

  console.log = (...a: unknown[]) => {
    stdout += a.map(String).join(' ') + '\n';
  };
  console.error = (...a: unknown[]) => {
    stderr += a.map(String).join(' ') + '\n';
  };
  // @ts-expect-error - mock process.exit
  process.exit = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`__EXIT_${code}__`);
  };

  try {
    await program.parseAsync(['node', 'archcanvas', ...args]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.startsWith('__EXIT_')) {
      stderr += `Error: ${msg}\n`;
      exitCode = 1;
    }
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe('CLI Integration: Full Round-Trip', () => {
  let tmpDir: string;
  let archcFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-cli-integration-'));
    archcFile = path.join(tmpDir, 'test.archc');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Step 1: init → add-node → add-edge → describe → export round-trip ───

  it('completes full init → add-node → add-edge → describe → export round-trip', async () => {
    // 1. Init a new architecture
    const initResult = await runCli([
      'init',
      '--name',
      'Integration Test Arch',
      '--output',
      archcFile,
    ]);
    expect(initResult.exitCode).toBe(0);
    expect(fs.existsSync(archcFile)).toBe(true);

    // 2. Add a node (use -q to suppress human message before JSON)
    const addNode1 = await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'add-node',
      '--type',
      'compute/service',
      '--name',
      'AuthService',
    ]);
    expect(addNode1.exitCode).toBe(0);
    const node1 = JSON.parse(addNode1.stdout);
    expect(node1.id).toBeDefined();
    expect(node1.displayName).toBe('AuthService');

    // 3. Add another node
    const addNode2 = await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'add-node',
      '--type',
      'data/database',
      '--name',
      'UsersDB',
    ]);
    expect(addNode2.exitCode).toBe(0);
    const node2 = JSON.parse(addNode2.stdout);
    expect(node2.id).toBeDefined();

    // 4. Add an edge between them
    const addEdge = await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'add-edge',
      '--from',
      node1.id,
      '--to',
      node2.id,
      '--type',
      'sync',
      '--label',
      'queries',
    ]);
    expect(addEdge.exitCode).toBe(0);
    const edge = JSON.parse(addEdge.stdout);
    expect(edge.id).toBeDefined();

    // 5. Describe the architecture (human format — the describe command's default)
    // describe returns a string. With --format human, printOutput uses the humanFormatter
    const descResult = await runCli(['-f', archcFile, 'describe', '--style', 'human']);
    expect(descResult.exitCode).toBe(0);
    expect(descResult.stdout).toContain('AuthService');
    expect(descResult.stdout).toContain('UsersDB');

    // 6. Export as markdown
    const exportMd = await runCli(['-f', archcFile, 'export', '--type', 'markdown']);
    expect(exportMd.exitCode).toBe(0);
    expect(exportMd.stdout).toContain('AuthService');
    expect(exportMd.stdout).toContain('UsersDB');

    // 7. Export as mermaid
    const exportMermaid = await runCli(['-f', archcFile, 'export', '--type', 'mermaid']);
    expect(exportMermaid.exitCode).toBe(0);
    expect(exportMermaid.stdout).toContain('graph');
  });

  // ─── Step 2: Mutations correctly save .archc and can be re-read ───

  it('mutations persist to .archc file and can be re-read', async () => {
    await runCli(['init', '--name', 'Persist Test', '--output', archcFile]);

    const addResult = await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'add-node',
      '--type',
      'compute/service',
      '--name',
      'PersistService',
    ]);
    const nodeId = JSON.parse(addResult.stdout).id;

    // Re-read from file and verify the node is present
    const listResult = await runCli(['-f', archcFile, '--format', 'json', 'list-nodes']);
    expect(listResult.exitCode).toBe(0);
    const nodes = JSON.parse(listResult.stdout);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(nodeId);
    expect(nodes[0].displayName).toBe('PersistService');
  });

  // ─── Step 3: Error handling ───

  describe('Error handling', () => {
    it('errors when file does not exist', async () => {
      const result = await runCli(['-f', path.join(tmpDir, 'nonexistent.archc'), 'describe']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('errors when getting a non-existent node ID', async () => {
      await runCli(['init', '--output', archcFile]);
      const result = await runCli(['-f', archcFile, 'get-node', 'INVALID_NODE_ID_12345']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found');
    });

    it('errors on corrupt file', async () => {
      fs.writeFileSync(archcFile, Buffer.from('this is not a valid archc file'));
      const result = await runCli(['-f', archcFile, 'describe']);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error');
    });
  });

  // ─── Step 4: JSON output format ───

  it('--format json produces valid parseable JSON for list-nodes and search', async () => {
    await runCli(['init', '--name', 'JSON Test', '--output', archcFile]);
    await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'add-node',
      '--type',
      'compute/service',
      '--name',
      'JsonNode',
    ]);

    // list-nodes with JSON format produces array
    const listResult = await runCli(['-f', archcFile, '--format', 'json', 'list-nodes']);
    expect(listResult.exitCode).toBe(0);
    const parsed = JSON.parse(listResult.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);

    // describe --format json: describe() returns a string, printOutput JSON-encodes it,
    // so we get a double-encoded JSON string. Parse twice to get the structured object.
    const descResult = await runCli([
      '-f',
      archcFile,
      '--format',
      'json',
      'describe',
      '--style',
      'structured',
    ]);
    expect(descResult.exitCode).toBe(0);
    // First parse removes the JSON.stringify wrapper
    const descOuter = JSON.parse(descResult.stdout);
    // descOuter is the string from TextApi.describe() — parse again if it's a string
    const descObj = typeof descOuter === 'string' ? JSON.parse(descOuter) : descOuter;
    expect(descObj.nodeCount).toBe(1);

    // search with JSON format
    const searchResult = await runCli(['-f', archcFile, '--format', 'json', 'search', 'JsonNode']);
    expect(searchResult.exitCode).toBe(0);
    const searchParsed = JSON.parse(searchResult.stdout);
    expect(Array.isArray(searchParsed)).toBe(true);
  });

  // ─── Step 5: Multi-step mutation round-trip ───

  it('add-node → add-edge → remove-edge → verify state persists', async () => {
    await runCli(['init', '--name', 'Remove Test', '--output', archcFile]);

    const n1 = JSON.parse(
      (
        await runCli([
          '-f',
          archcFile,
          '-q',
          '--format',
          'json',
          'add-node',
          '--type',
          'compute/service',
          '--name',
          'SvcA',
        ])
      ).stdout,
    );
    const n2 = JSON.parse(
      (
        await runCli([
          '-f',
          archcFile,
          '-q',
          '--format',
          'json',
          'add-node',
          '--type',
          'compute/service',
          '--name',
          'SvcB',
        ])
      ).stdout,
    );

    const edge = JSON.parse(
      (
        await runCli([
          '-f',
          archcFile,
          '-q',
          '--format',
          'json',
          'add-edge',
          '--from',
          n1.id,
          '--to',
          n2.id,
          '--type',
          'async',
        ])
      ).stdout,
    );

    // Remove edge (positional argument, not --id)
    const removeResult = await runCli([
      '-f',
      archcFile,
      '-q',
      '--format',
      'json',
      'remove-edge',
      edge.id,
    ]);
    expect(removeResult.exitCode).toBe(0);

    // Verify edge is gone — use human describe since it returns a plain string
    const descResult = await runCli(['-f', archcFile, 'describe', '--style', 'structured']);
    expect(descResult.exitCode).toBe(0);
    // structured describe returns JSON directly when not using --format json
    const descObj = JSON.parse(descResult.stdout);
    expect(descObj.edgeCount).toBe(0);
    expect(descObj.nodeCount).toBe(2);
  });
});
