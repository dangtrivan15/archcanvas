/**
 * Tests for the CLI `export` command (Feature #306).
 *
 * Verifies:
 * - Command is registered with --type, --output, --with-mermaid options
 * - --type markdown: calls generateMarkdownSummary()
 * - --type mermaid: calls generateMermaid()
 * - --type markdown --with-mermaid: calls generateSummaryWithMermaid()
 * - --output writes to file; without --output prints to stdout
 * - PNG/SVG type prints helpful error and exits
 * - Default type is markdown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgram } from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('CLI export Command', () => {
  let tmpDir: string;
  let testArchcFile: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-export-test-'));

    // Create a test .archc file using init
    const program = createProgram();
    const initOutput = path.join(tmpDir, 'test.archc');
    await program.parseAsync([
      'node',
      'archcanvas',
      '--quiet',
      'init',
      '--name',
      'Export Test Architecture',
      '--output',
      initOutput,
    ]);
    testArchcFile = initOutput;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ─── Command Registration ───────────────────────────────────

  describe('Command Registration', () => {
    it('export command is registered', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      expect(exportCmd).toBeDefined();
    });

    it('has --type option with choices markdown, mermaid, png, svg', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      const typeOpt = exportCmd!.options.find((o) => o.long === '--type');
      expect(typeOpt).toBeDefined();
      expect(typeOpt!.argChoices).toEqual(['markdown', 'mermaid', 'png', 'svg']);
    });

    it('has --type default of markdown', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      const typeOpt = exportCmd!.options.find((o) => o.long === '--type');
      expect(typeOpt!.defaultValue).toBe('markdown');
    });

    it('has --output option', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      const outputOpt = exportCmd!.options.find((o) => o.long === '--output');
      expect(outputOpt).toBeDefined();
    });

    it('has --with-mermaid flag', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      const wmOpt = exportCmd!.options.find((o) => o.long === '--with-mermaid');
      expect(wmOpt).toBeDefined();
    });
  });

  // ─── Markdown Export ─────────────────────────────────────────

  describe('Markdown Export', () => {
    it('--type markdown prints markdown to stdout', async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'markdown',
        ]);

        const output = logs.join('\n');
        expect(output).toContain('# Export Test Architecture');
        expect(output).toContain('## Overview');
        // Should NOT include Mermaid when --with-mermaid not specified
        expect(output).not.toContain('```mermaid');
      } finally {
        console.log = origLog;
      }
    });

    it('default type is markdown', async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync(['node', 'archcanvas', '--file', testArchcFile, 'export']);

        const output = logs.join('\n');
        expect(output).toContain('# Export Test Architecture');
      } finally {
        console.log = origLog;
      }
    });

    it('--type markdown --with-mermaid includes Mermaid diagram', async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'markdown',
          '--with-mermaid',
        ]);

        const output = logs.join('\n');
        expect(output).toContain('# Export Test Architecture');
        expect(output).toContain('```mermaid');
        expect(output).toContain('graph LR');
      } finally {
        console.log = origLog;
      }
    });
  });

  // ─── Mermaid Export ──────────────────────────────────────────

  describe('Mermaid Export', () => {
    it('--type mermaid prints Mermaid diagram to stdout', async () => {
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'mermaid',
        ]);

        const output = logs.join('\n');
        expect(output).toContain('graph LR');
        // Should NOT contain markdown heading (pure mermaid only)
        expect(output).not.toContain('# Export Test Architecture');
      } finally {
        console.log = origLog;
      }
    });
  });

  // ─── File Output ─────────────────────────────────────────────

  describe('File Output', () => {
    it('--output writes content to file', async () => {
      const outputPath = path.join(tmpDir, 'export-output.md');

      const program = createProgram();
      await program.parseAsync([
        'node',
        'archcanvas',
        '--file',
        testArchcFile,
        'export',
        '--type',
        'markdown',
        '--output',
        outputPath,
      ]);

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('# Export Test Architecture');
    });

    it('--output with mermaid type writes .mmd content', async () => {
      const outputPath = path.join(tmpDir, 'export-output.mmd');

      const program = createProgram();
      await program.parseAsync([
        'node',
        'archcanvas',
        '--file',
        testArchcFile,
        'export',
        '--type',
        'mermaid',
        '--output',
        outputPath,
      ]);

      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('graph LR');
    });

    it('prints confirmation message when writing to file', async () => {
      const outputPath = path.join(tmpDir, 'export-confirm.md');
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'markdown',
          '--output',
          outputPath,
        ]);

        const output = logs.join('\n');
        expect(output).toContain('Exported markdown to');
      } finally {
        console.log = origLog;
      }
    });

    it('--quiet suppresses confirmation message', async () => {
      const outputPath = path.join(tmpDir, 'export-quiet.md');
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        const msg = String(args[0] ?? '');
        if (!msg.startsWith('[')) logs.push(msg);
      };

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          '--quiet',
          'export',
          '--type',
          'markdown',
          '--output',
          outputPath,
        ]);

        expect(fs.existsSync(outputPath)).toBe(true);
        const output = logs.join('\n');
        expect(output).not.toContain('Exported');
      } finally {
        console.log = origLog;
      }
    });
  });

  // ─── PNG/SVG Error Handling ──────────────────────────────────

  describe('PNG/SVG Error Handling', () => {
    it('--type png prints helpful error', async () => {
      const errors: string[] = [];
      const origError = console.error;
      const origExit = process.exit;
      let exitCode: number | undefined;
      console.error = (...args: unknown[]) => errors.push(String(args[0] ?? ''));
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('EXIT');
      }) as never;

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'png',
        ]);
      } catch (e: unknown) {
        if (!(e instanceof Error && e.message === 'EXIT')) throw e;
      } finally {
        console.error = origError;
        process.exit = origExit;
      }

      expect(exitCode).toBe(1);
      const errorOutput = errors.join('\n');
      expect(errorOutput).toContain('PNG export is not supported in the CLI');
      expect(errorOutput).toContain('browser DOM');
    });

    it('--type svg prints helpful error', async () => {
      const errors: string[] = [];
      const origError = console.error;
      const origExit = process.exit;
      let exitCode: number | undefined;
      console.error = (...args: unknown[]) => errors.push(String(args[0] ?? ''));
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error('EXIT');
      }) as never;

      try {
        const program = createProgram();
        await program.parseAsync([
          'node',
          'archcanvas',
          '--file',
          testArchcFile,
          'export',
          '--type',
          'svg',
        ]);
      } catch (e: unknown) {
        if (!(e instanceof Error && e.message === 'EXIT')) throw e;
      } finally {
        console.error = origError;
        process.exit = origExit;
      }

      expect(exitCode).toBe(1);
      const errorOutput = errors.join('\n');
      expect(errorOutput).toContain('SVG export is not supported in the CLI');
      expect(errorOutput).toContain('browser DOM');
    });
  });
});
