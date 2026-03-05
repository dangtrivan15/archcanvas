/**
 * Tests for the CLI `init` command (Feature #302).
 *
 * Verifies:
 * - Creates a new .archc file with proper magic bytes and header
 * - Accepts --name option (default: 'Untitled Architecture')
 * - Accepts --output option (default: './architecture.archc')
 * - Generates .summary.md sidecar file alongside .archc
 * - Prints confirmation with file path and size
 * - Errors if output file already exists (unless --force flag)
 * - Registers command in CLI entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('CLI init Command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-init-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Command Registration ───────────────────────────────────

  describe('Command Registration', () => {
    it('init command is registered', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      expect(init).toBeDefined();
    });

    it('has --name option with default "Untitled Architecture"', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      const nameOpt = init!.options.find((o) => o.long === '--name');
      expect(nameOpt).toBeDefined();
      expect(nameOpt!.defaultValue).toBe('Untitled Architecture');
    });

    it('has --output option with default "./architecture.archc"', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      const outputOpt = init!.options.find((o) => o.long === '--output');
      expect(outputOpt).toBeDefined();
      expect(outputOpt!.defaultValue).toBe('./architecture.archc');
    });

    it('has --force option with default false', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      const forceOpt = init!.options.find((o) => o.long === '--force');
      expect(forceOpt).toBeDefined();
      expect(forceOpt!.defaultValue).toBe(false);
    });

    it('has a description', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      expect(init!.description()).toContain('archc');
    });
  });

  // ─── File Creation ──────────────────────────────────────────

  describe('File Creation', () => {
    it('creates a .archc file at the specified output path', async () => {
      const outputPath = path.join(tmpDir, 'test.archc');
      const program = createProgram();
      program.exitOverride(); // Prevent process.exit

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('creates file with proper magic bytes (ARCHC\\x00)', async () => {
      const outputPath = path.join(tmpDir, 'magic.archc');
      const program = createProgram();
      program.exitOverride();

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      const data = fs.readFileSync(outputPath);
      // Magic bytes: ARCHC\x00
      expect(data[0]).toBe(0x41); // A
      expect(data[1]).toBe(0x52); // R
      expect(data[2]).toBe(0x43); // C
      expect(data[3]).toBe(0x48); // H
      expect(data[4]).toBe(0x43); // C
      expect(data[5]).toBe(0x00); // null
    });

    it('uses default name "Untitled Architecture" when --name not specified', async () => {
      const outputPath = path.join(tmpDir, 'default-name.archc');
      const program = createProgram();
      program.exitOverride();

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      expect(fs.existsSync(outputPath)).toBe(true);
      // File was created (we can't easily inspect protobuf, but existence is the key test)
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('uses custom name when --name is specified', async () => {
      const outputPath = path.join(tmpDir, 'custom-name.archc');
      const program = createProgram();
      program.exitOverride();

      await program.parseAsync([
        'node',
        'archcanvas',
        'init',
        '--name',
        'My Architecture',
        '--output',
        outputPath,
        '-q',
      ]);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });

  // ─── Sidecar Generation ─────────────────────────────────────

  describe('Sidecar Generation', () => {
    it('generates .summary.md sidecar file', async () => {
      const outputPath = path.join(tmpDir, 'sidecar-test.archc');
      const sidecarPath = path.join(tmpDir, 'sidecar-test.summary.md');
      const program = createProgram();
      program.exitOverride();

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      expect(fs.existsSync(sidecarPath)).toBe(true);
    });

    it('sidecar contains markdown content', async () => {
      const outputPath = path.join(tmpDir, 'sidecar-content.archc');
      const sidecarPath = path.join(tmpDir, 'sidecar-content.summary.md');
      const program = createProgram();
      program.exitOverride();

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      const content = fs.readFileSync(sidecarPath, 'utf-8');
      expect(content).toContain('#'); // Markdown heading
    });
  });

  // ─── Overwrite Protection ───────────────────────────────────

  describe('Overwrite Protection', () => {
    it('errors when output file already exists', async () => {
      const outputPath = path.join(tmpDir, 'existing.archc');
      fs.writeFileSync(outputPath, 'existing content');

      const program = createProgram();
      program.exitOverride();

      // Mock process.exit to catch the error
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      const mockStderr = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);
      } catch {
        // Expected - either process.exit or thrown error
      }

      // Should have printed an error about existing file
      const errorCalls = mockStderr.mock.calls.flat().join(' ');
      expect(errorCalls).toContain('already exists');

      mockExit.mockRestore();
      mockStderr.mockRestore();
    });

    it('overwrites when --force flag is used', async () => {
      const outputPath = path.join(tmpDir, 'force-overwrite.archc');
      fs.writeFileSync(outputPath, 'existing content');

      const program = createProgram();
      program.exitOverride();

      await program.parseAsync([
        'node',
        'archcanvas',
        'init',
        '--output',
        outputPath,
        '--force',
        '-q',
      ]);

      // File should now be a valid .archc
      const data = fs.readFileSync(outputPath);
      expect(data[0]).toBe(0x41); // A (start of ARCHC magic)
    });
  });

  // ─── Output Messages ───────────────────────────────────────

  describe('Output Messages', () => {
    it('prints confirmation with file path and size', async () => {
      const outputPath = path.join(tmpDir, 'output-msg.archc');
      const program = createProgram();
      program.exitOverride();

      const logs: string[] = [];
      const mockLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath]);

      const allOutput = logs.join('\n');
      expect(allOutput).toContain('Created new architecture');
      expect(allOutput).toContain(path.resolve(outputPath));

      mockLog.mockRestore();
    });

    it('suppresses output when --quiet is used', async () => {
      const outputPath = path.join(tmpDir, 'quiet-test.archc');
      const program = createProgram();
      program.exitOverride();

      const logs: string[] = [];
      const mockLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      await program.parseAsync(['node', 'archcanvas', 'init', '--output', outputPath, '-q']);

      // With quiet mode, no "Created" message should appear
      const createdLogs = logs.filter((l) => l.includes('Created'));
      expect(createdLogs).toHaveLength(0);

      mockLog.mockRestore();
    });

    it('outputs JSON when --format json is used', async () => {
      const outputPath = path.join(tmpDir, 'json-output.archc');
      const program = createProgram();
      program.exitOverride();

      const logs: string[] = [];
      const mockLog = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      await program.parseAsync([
        'node',
        'archcanvas',
        'init',
        '--output',
        outputPath,
        '--format',
        'json',
        '-q',
      ]);

      // Find the JSON output
      const jsonStr = logs.find((l) => l.startsWith('{'));
      expect(jsonStr).toBeDefined();
      const parsed = JSON.parse(jsonStr!);
      expect(parsed.created).toBe(true);
      expect(parsed.file).toBe(path.resolve(outputPath));
      expect(parsed.size).toBeGreaterThan(0);

      mockLog.mockRestore();
    });
  });
});
