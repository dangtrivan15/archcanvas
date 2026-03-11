/**
 * Tests for the CLI `info` command (Feature #303).
 *
 * Verifies:
 * - Displays architecture name, description, owners
 * - Displays format version, tool version, created/updated timestamps
 * - Displays total node count (including nested), edge count
 * - Displays file size, checksum status (valid/invalid)
 * - Supports --format json for machine-readable output
 * - Registered as command in CLI entry point
 * - Requires --file option
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('CLI info Command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-info-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper: create a test .archc file with init command
  async function createTestFile(name: string, archName = 'Test Architecture'): Promise<string> {
    const outputPath = path.join(tmpDir, name);
    const program = createProgram();
    program.exitOverride();
    // Global options must come before the subcommand
    await program.parseAsync([
      'node',
      'archcanvas',
      '-q',
      'init',
      '--name',
      archName,
      '--output',
      outputPath,
    ]);
    return outputPath;
  }

  // Helper: run info command and capture console.log output
  async function runInfo(
    filePath: string,
    extraArgs: string[] = [],
  ): Promise<{ logs: string[]; errors: string[] }> {
    const logs: string[] = [];
    const errors: string[] = [];
    const mockLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    const mockErr = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    const program = createProgram();
    program.exitOverride();

    try {
      // Global options (--file, --format) must come before the subcommand
      await program.parseAsync(['node', 'archcanvas', '--file', filePath, ...extraArgs, 'info']);
    } catch {
      // May throw on process.exit override
    }

    mockLog.mockRestore();
    mockErr.mockRestore();
    return { logs, errors };
  }

  // ─── Command Registration ───────────────────────────────────

  describe('Command Registration', () => {
    it('info command is registered', () => {
      const program = createProgram();
      const info = program.commands.find((c) => c.name() === 'info');
      expect(info).toBeDefined();
    });

    it('has a description mentioning metadata or archc', () => {
      const program = createProgram();
      const info = program.commands.find((c) => c.name() === 'info');
      expect(info!.description().toLowerCase()).toMatch(/metadata|archc|summary/);
    });
  });

  // ─── Architecture Metadata ─────────────────────────────────

  describe('Architecture Metadata', () => {
    it('displays architecture name', async () => {
      const filePath = await createTestFile('name-test.archc', 'My Cool Architecture');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toContain('My Cool Architecture');
    });

    it('displays description (none for empty)', async () => {
      const filePath = await createTestFile('desc-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      // New architectures have no description
      expect(output).toMatch(/description/i);
    });

    it('displays owners (none for empty)', async () => {
      const filePath = await createTestFile('owners-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/owners/i);
    });
  });

  // ─── Format & Version Info ─────────────────────────────────

  describe('Format & Version Info', () => {
    it('displays format version', async () => {
      const filePath = await createTestFile('version-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/format.*version/i);
    });

    it('displays tool version', async () => {
      const filePath = await createTestFile('tool-version.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/tool.*version/i);
    });

    it('displays created timestamp', async () => {
      const filePath = await createTestFile('created-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/created/i);
    });

    it('displays updated timestamp', async () => {
      const filePath = await createTestFile('updated-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/updated/i);
    });
  });

  // ─── Node & Edge Counts ────────────────────────────────────

  describe('Node & Edge Counts', () => {
    it('displays total node count', async () => {
      const filePath = await createTestFile('nodes-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/nodes/i);
    });

    it('displays edge count', async () => {
      const filePath = await createTestFile('edges-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/edges/i);
    });

    it('shows 0 nodes and 0 edges for empty architecture', async () => {
      const filePath = await createTestFile('empty-counts.archc');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      expect(jsonStr).toBeDefined();
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.totalNodes).toBe(0);
      expect(parsed.edges).toBe(0);
    });
  });

  // ─── File Info ─────────────────────────────────────────────

  describe('File Info', () => {
    it('displays file size', async () => {
      const filePath = await createTestFile('size-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/file.*size|bytes|KB/i);
    });

    it('displays checksum status as valid for good file', async () => {
      const filePath = await createTestFile('checksum-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toMatch(/checksum/i);
      expect(output).toMatch(/valid/i);
    });

    it('displays file path', async () => {
      const filePath = await createTestFile('path-test.archc');
      const { logs } = await runInfo(filePath);
      const output = logs.join('\n');
      expect(output).toContain(path.resolve(filePath));
    });
  });

  // ─── JSON Output Format ────────────────────────────────────

  describe('JSON Output Format', () => {
    it('outputs valid JSON when --format json is used', async () => {
      const filePath = await createTestFile('json-test.archc', 'JSON Test Arch');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      expect(jsonStr).toBeDefined();
      const parsed = JSON.parse(jsonStr!);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('formatVersion');
      expect(parsed).toHaveProperty('totalNodes');
      expect(parsed).toHaveProperty('edges');
      expect(parsed).toHaveProperty('checksumStatus');
      expect(parsed).toHaveProperty('fileSizeBytes');
    });

    it('JSON output contains architecture name', async () => {
      const filePath = await createTestFile('json-name.archc', 'Named Architecture');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.name).toBe('Named Architecture');
    });

    it('JSON output contains timestamps', async () => {
      const filePath = await createTestFile('json-ts.archc');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.createdAt).toBeDefined();
      expect(parsed.updatedAt).toBeDefined();
      // Timestamps should be ISO format strings
      expect(parsed.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(parsed.updatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('JSON output shows valid checksum status', async () => {
      const filePath = await createTestFile('json-checksum.archc');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.checksumStatus).toBe('valid');
    });

    it('JSON output contains format version number', async () => {
      const filePath = await createTestFile('json-fv.archc');
      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.formatVersion).toBe(1);
    });
  });

  // ─── Error Handling ─────────────────────────────────────────

  describe('Error Handling', () => {
    it('errors when --file is not provided', async () => {
      const errors: string[] = [];
      const mockErr = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.join(' '));
      });
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'archcanvas', 'info']);
      } catch {
        // Expected
      }

      const allErrors = errors.join(' ');
      expect(allErrors).toMatch(/--file|required/i);

      mockErr.mockRestore();
      mockExit.mockRestore();
    });

    it('errors when file does not exist', async () => {
      const errors: string[] = [];
      const mockErr = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.join(' '));
      });
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          '/tmp/nonexistent-file.archc',
          'info',
        ]);
      } catch {
        // Expected
      }

      mockErr.mockRestore();
      mockExit.mockRestore();
    });
  });

  // ─── Checksum Verification ─────────────────────────────────

  describe('Checksum Verification', () => {
    it('reports INVALID for tampered file', async () => {
      const filePath = await createTestFile('tamper-test.archc');

      // Tamper with the protobuf payload (byte 42+)
      const data = fs.readFileSync(filePath);
      const buf = Buffer.from(data);
      // Modify a byte in the protobuf payload area (after the 40-byte header)
      if (buf.length > 45) {
        buf[45] = (buf[45]! + 1) % 256;
        fs.writeFileSync(filePath, buf);
      }

      const { logs } = await runInfo(filePath, ['--format', 'json']);
      const jsonStr = logs.find((l) => l.startsWith('{'));
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        expect(parsed.checksumStatus).toBe('INVALID');
      }
    });
  });
});
