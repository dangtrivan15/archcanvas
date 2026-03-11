/**
 * Tests for CLI `analyze` command (Feature #346).
 *
 * Verifies:
 * - Command registration with correct name, description, arguments, and options
 * - CLI flags: --output/-o, --name/-n, --depth/-d, --dry-run, --verbose
 * - Error handling for missing directory, invalid directory, invalid depth
 * - API key environment variable detection
 * - Progress reporting via onProgress callback
 * - Dry-run mode outputs inference result without writing files
 * - Summary output on completion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Command Registration ────────────────────────────────────────

describe('CLI analyze command', () => {
  describe('Command Registration', () => {
    it('registers the analyze subcommand', () => {
      const program = createProgram();
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain('analyze');
    });

    it('has a description mentioning analyze/codebase/archc', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const desc = cmd!.description();
      expect(desc).toContain('nalyze');
    });

    it('accepts a <directory> argument', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      // Commander stores registered arguments
      const args = cmd!.registeredArguments ?? [];
      expect(args.length).toBeGreaterThanOrEqual(1);
      expect(args[0].name()).toBe('directory');
    });

    it('has --output / -o option', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find((o) => o.long === '--output');
      expect(opt).toBeDefined();
      expect(opt!.short).toBe('-o');
    });

    it('has --name / -n option', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find((o) => o.long === '--name');
      expect(opt).toBeDefined();
      expect(opt!.short).toBe('-n');
    });

    it('has --depth / -d option with default "standard"', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find((o) => o.long === '--depth');
      expect(opt).toBeDefined();
      expect(opt!.short).toBe('-d');
      expect(opt!.defaultValue).toBe('standard');
    });

    it('has --dry-run flag (default false)', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find((o) => o.long === '--dry-run');
      expect(opt).toBeDefined();
      expect(opt!.defaultValue).toBe(false);
    });

    it('has --verbose flag (default false)', () => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === 'analyze');
      expect(cmd).toBeDefined();
      const opt = cmd!.options.find((o) => o.long === '--verbose');
      expect(opt).toBeDefined();
      expect(opt!.defaultValue).toBe(false);
    });
  });

  // ─── Error Handling ────────────────────────────────────────────

  describe('Error Handling', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('errors when directory does not exist', async () => {
      const program = createProgram();
      program.exitOverride();
      try {
        await program.parseAsync([
          'node',
          'archcanvas',
          'analyze',
          '/tmp/nonexistent-test-dir-archcanvas-xyz',
        ]);
      } catch {
        // expected
      }
      const errorCalls = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(errorCalls).toContain('not found');
    });

    it('errors when path is a file, not a directory', async () => {
      // Create a temp file
      const tmpFile = path.join(os.tmpdir(), `archcanvas-test-file-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, 'test');
      try {
        const program = createProgram();
        program.exitOverride();
        try {
          await program.parseAsync(['node', 'archcanvas', 'analyze', tmpFile]);
        } catch {
          // expected
        }
        const errorCalls = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(errorCalls).toContain('Not a directory');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  // ─── Pipeline Integration (structural-only, no AI key) ────────

  describe('Pipeline Integration (structural-only)', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let origApiKey: string | undefined;
    let origViteApiKey: string | undefined;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // Clear API keys so structural-only path is used
      origApiKey = process.env.ANTHROPIC_API_KEY;
      origViteApiKey = process.env.VITE_ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.VITE_ANTHROPIC_API_KEY;
    });

    afterEach(() => {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      // Restore API keys
      if (origApiKey !== undefined) process.env.ANTHROPIC_API_KEY = origApiKey;
      else delete process.env.ANTHROPIC_API_KEY;
      if (origViteApiKey !== undefined) process.env.VITE_ANTHROPIC_API_KEY = origViteApiKey;
      else delete process.env.VITE_ANTHROPIC_API_KEY;
    });

    it('runs dry-run analysis on a temp directory and outputs JSON', async () => {
      // Create a minimal project directory
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-analyze-'));
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { express: '^4.0.0' },
        }),
      );
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'const express = require("express");');

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--format',
          'json',
          'analyze',
          tmpDir,
          '--dry-run',
          '--name',
          'TestProject',
        ]);

        // Find the JSON output in console.log calls
        const logOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
        expect(logOutput).toBeTruthy();

        // Parse JSON output
        const parsed = JSON.parse(logOutput);
        expect(parsed.dryRun).toBe(true);
        expect(parsed.stats).toBeDefined();
        expect(parsed.stats.nodes).toBeGreaterThanOrEqual(0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('writes .archc file in non-dry-run mode', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-analyze-'));
      const outputPath = path.join(tmpDir, 'test-output.archc');
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--format',
          'json',
          'analyze',
          tmpDir,
          '--output',
          outputPath,
          '--name',
          'TestProject',
        ]);

        // The .archc file should be created
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify output file has magic bytes
        const data = fs.readFileSync(outputPath);
        expect(data.length).toBeGreaterThan(8);
        // Magic bytes: "ARCHC\x00"
        expect(data[0]).toBe(0x41); // 'A'
        expect(data[1]).toBe(0x52); // 'R'
        expect(data[2]).toBe(0x43); // 'C'
        expect(data[3]).toBe(0x48); // 'H'
        expect(data[4]).toBe(0x43); // 'C'
        expect(data[5]).toBe(0x00);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('shows progress messages when not quiet', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-analyze-'));
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');

      try {
        const program = createProgram();
        await program.parseAsync(['node', 'archcanvas', 'analyze', tmpDir, '--dry-run']);

        const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        // Should show progress phases
        expect(errOutput).toContain('Scanning');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('runs structural pipeline without AI (Anthropic SDK removed)', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-analyze-'));
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');

      try {
        const program = createProgram();
        await program.parseAsync(['node', 'archcanvas', 'analyze', tmpDir, '--dry-run']);

        // Should NOT reference ANTHROPIC_API_KEY since SDK was removed
        const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(errOutput).not.toContain('ANTHROPIC_API_KEY');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('outputs summary with node/edge counts in human format', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-analyze-'));
      const outputPath = path.join(tmpDir, 'out.archc');
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');

      try {
        const program = createProgram();
        await program.parseAsync(['node', 'archcanvas', 'analyze', tmpDir, '--output', outputPath]);

        const errOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        expect(errOutput).toContain('Nodes created');
        expect(errOutput).toContain('Edges created');
        expect(errOutput).toContain('Output file');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
