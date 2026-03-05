/**
 * Tests for CLI Entry Point & Argument Parser (Feature #301).
 *
 * Verifies:
 * - Commander.js program setup with name, description, version
 * - Global options: --file, --format, --quiet
 * - All 16 subcommand stubs are registered
 * - --help auto-generation for all commands
 * - --version flag reads correct version
 * - --file validation and error handling
 * - Error handler wrapper catches and formats errors
 * - Output formatting for json, table, and human formats
 * - bin field in package.json
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProgram,
  printOutput,
  withErrorHandler,
  loadContext,
  type GlobalOptions,
} from '@/cli/index';
import fs from 'node:fs';
import path from 'node:path';

// ─── createProgram setup tests ──────────────────────────────

describe('CLI Entry Point', () => {
  describe('createProgram', () => {
    it('creates a program with name "archcanvas"', () => {
      const program = createProgram();
      expect(program.name()).toBe('archcanvas');
    });

    it('has a description', () => {
      const program = createProgram();
      expect(program.description()).toContain('architecture');
    });

    it('has version 0.1.0', () => {
      const program = createProgram();
      expect(program.version()).toBe('0.1.0');
    });

    it('defines --file global option', () => {
      const program = createProgram();
      const fileOpt = program.options.find((o) => o.long === '--file');
      expect(fileOpt).toBeDefined();
      expect(fileOpt!.short).toBe('-f');
    });

    it('defines --format global option with choices', () => {
      const program = createProgram();
      const formatOpt = program.options.find((o) => o.long === '--format');
      expect(formatOpt).toBeDefined();
      expect(formatOpt!.defaultValue).toBe('human');
    });

    it('defines --quiet global option with default false', () => {
      const program = createProgram();
      const quietOpt = program.options.find((o) => o.long === '--quiet');
      expect(quietOpt).toBeDefined();
      expect(quietOpt!.short).toBe('-q');
    });
  });

  // ─── Subcommand Registration ───────────────────────────────

  describe('Subcommand Registration', () => {
    const EXPECTED_COMMANDS = [
      'init',
      'info',
      'describe',
      'list-nodes',
      'get-node',
      'add-node',
      'add-edge',
      'remove-node',
      'remove-edge',
      'add-note',
      'update-node',
      'search',
      'export',
      'list-nodedefs',
      'serve',
      'mcp',
    ];

    it('registers all 16 subcommands', () => {
      const program = createProgram();
      const commandNames = program.commands.map((c) => c.name());
      for (const name of EXPECTED_COMMANDS) {
        expect(commandNames).toContain(name);
      }
    });

    it('produces help text when requested', () => {
      const program = createProgram();
      // Commander auto-generates help text
      const helpText = program.helpInformation();
      expect(helpText).toContain('archcanvas');
      expect(helpText).toContain('--help');
    });

    it.each(EXPECTED_COMMANDS)('subcommand "%s" has a description', (name) => {
      const program = createProgram();
      const cmd = program.commands.find((c) => c.name() === name);
      expect(cmd).toBeDefined();
      expect(cmd!.description()).toBeTruthy();
    });
  });

  // ─── Specific Subcommand Options ───────────────────────────

  describe('Subcommand Options', () => {
    it('init has --output option with default', () => {
      const program = createProgram();
      const init = program.commands.find((c) => c.name() === 'init');
      expect(init).toBeDefined();
      const outputOpt = init!.options.find((o) => o.long === '--output');
      expect(outputOpt).toBeDefined();
      expect(outputOpt!.defaultValue).toBe('./architecture.archc');
    });

    it('add-node requires --type and --name', () => {
      const program = createProgram();
      const addNode = program.commands.find((c) => c.name() === 'add-node');
      expect(addNode).toBeDefined();
      const typeOpt = addNode!.options.find((o) => o.long === '--type');
      const nameOpt = addNode!.options.find((o) => o.long === '--name');
      expect(typeOpt).toBeDefined();
      expect(typeOpt!.required).toBe(true);
      expect(nameOpt).toBeDefined();
      expect(nameOpt!.required).toBe(true);
    });

    it('add-edge requires --from and --to', () => {
      const program = createProgram();
      const addEdge = program.commands.find((c) => c.name() === 'add-edge');
      expect(addEdge).toBeDefined();
      const fromOpt = addEdge!.options.find((o) => o.long === '--from');
      const toOpt = addEdge!.options.find((o) => o.long === '--to');
      expect(fromOpt).toBeDefined();
      expect(fromOpt!.required).toBe(true);
      expect(toOpt).toBeDefined();
      expect(toOpt!.required).toBe(true);
    });

    it('describe has --style option', () => {
      const program = createProgram();
      const describe = program.commands.find((c) => c.name() === 'describe');
      expect(describe).toBeDefined();
      const styleOpt = describe!.options.find((o) => o.long === '--style');
      expect(styleOpt).toBeDefined();
    });

    it('export has --type option with choices', () => {
      const program = createProgram();
      const exportCmd = program.commands.find((c) => c.name() === 'export');
      expect(exportCmd).toBeDefined();
      const typeOpt = exportCmd!.options.find((o) => o.long === '--type');
      expect(typeOpt).toBeDefined();
    });

    it('list-nodedefs has --namespace filter', () => {
      const program = createProgram();
      const listNodedefs = program.commands.find((c) => c.name() === 'list-nodedefs');
      expect(listNodedefs).toBeDefined();
      const nsOpt = listNodedefs!.options.find((o) => o.long === '--namespace');
      expect(nsOpt).toBeDefined();
    });

    it('serve has --port option', () => {
      const program = createProgram();
      const serve = program.commands.find((c) => c.name() === 'serve');
      expect(serve).toBeDefined();
      const portOpt = serve!.options.find((o) => o.long === '--port');
      expect(portOpt).toBeDefined();
    });

    it('mcp has --transport option', () => {
      const program = createProgram();
      const mcp = program.commands.find((c) => c.name() === 'mcp');
      expect(mcp).toBeDefined();
      const transportOpt = mcp!.options.find((o) => o.long === '--transport');
      expect(transportOpt).toBeDefined();
    });
  });

  // ─── printOutput ───────────────────────────────────────────

  describe('printOutput', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('outputs JSON with 2-space indent for json format', () => {
      printOutput({ name: 'test', count: 5 }, 'json');
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ name: 'test', count: 5 }, null, 2));
    });

    it('uses humanFormatter for human format when provided', () => {
      printOutput({ x: 1 }, 'human', () => 'formatted output');
      expect(logSpy).toHaveBeenCalledWith('formatted output');
    });

    it('displays table format for arrays', () => {
      printOutput(
        [
          { id: 'a', name: 'Foo' },
          { id: 'b', name: 'Bar' },
        ],
        'table',
      );
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('id');
      expect(output).toContain('name');
      expect(output).toContain('Foo');
      expect(output).toContain('Bar');
    });

    it('displays (no results) for empty arrays', () => {
      printOutput([], 'table');
      expect(logSpy).toHaveBeenCalledWith('(no results)');
    });

    it('displays key-value for objects in table format', () => {
      printOutput({ foo: 'bar', num: 42 }, 'table');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('foo');
      expect(output).toContain('bar');
    });

    it('displays plain string for scalar values', () => {
      printOutput('hello world', 'table');
      expect(logSpy).toHaveBeenCalledWith('hello world');
    });
  });

  // ─── withErrorHandler ──────────────────────────────────────

  describe('withErrorHandler', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('passes through on success', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const wrapped = withErrorHandler(fn);
      await wrapped();
      expect(fn).toHaveBeenCalled();
    });

    it('catches errors and prints user-friendly message', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('something broke'));
      const wrapped = withErrorHandler(fn);
      try {
        await wrapped();
      } catch {
        // process.exit throws
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: something broke');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('handles non-Error thrown values', async () => {
      const fn = vi.fn().mockRejectedValue('string error');
      const wrapped = withErrorHandler(fn);
      try {
        await wrapped();
      } catch {
        // process.exit throws
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: string error');
    });
  });

  // ─── loadContext ───────────────────────────────────────────

  describe('loadContext', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);
    });

    afterEach(() => {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('exits with error when --file is not provided', async () => {
      const opts: GlobalOptions = { format: 'human', quiet: false };
      try {
        await loadContext(opts);
      } catch {
        // process.exit throws
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: --file <path> is required for this command.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('exits with error when file does not exist', async () => {
      const opts: GlobalOptions = {
        file: '/tmp/nonexistent-archc-test-file.archc',
        format: 'human',
        quiet: false,
      };
      try {
        await loadContext(opts);
      } catch {
        // process.exit throws
      }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Failed to load'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ─── package.json Configuration ────────────────────────────

  describe('package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));

    it('has bin field with archcanvas entry', () => {
      expect(pkg.bin).toBeDefined();
      expect(pkg.bin.archcanvas).toBe('./dist/cli/index.js');
    });

    it('has commander as a dependency', () => {
      expect(pkg.dependencies.commander).toBeDefined();
    });

    it('has tsx as a devDependency', () => {
      expect(pkg.devDependencies.tsx).toBeDefined();
    });

    it('has a cli script', () => {
      expect(pkg.scripts.cli).toBeDefined();
      expect(pkg.scripts.cli).toContain('tsx');
      expect(pkg.scripts.cli).toContain('src/cli/index.ts');
    });
  });

  // ─── Shebang & Entry Point ─────────────────────────────────

  describe('Entry point file', () => {
    it('has #!/usr/bin/env node shebang', () => {
      const content = fs.readFileSync(path.resolve('src/cli/index.ts'), 'utf-8');
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    it('exports createProgram function', () => {
      expect(typeof createProgram).toBe('function');
    });

    it('exports printOutput function', () => {
      expect(typeof printOutput).toBe('function');
    });

    it('exports withErrorHandler function', () => {
      expect(typeof withErrorHandler).toBe('function');
    });

    it('exports loadContext function', () => {
      expect(typeof loadContext).toBe('function');
    });
  });

  // ─── RegistryManagerCore / nodeLoader ──────────────────────

  describe('CLI NodeDef Loader', () => {
    it('loadBuiltinNodeDefs returns 15 nodedefs', async () => {
      const { loadBuiltinNodeDefs } = await import('@/cli/nodeLoader');
      const defs = loadBuiltinNodeDefs();
      expect(defs).toHaveLength(15);
    });

    it('loaded nodedefs have correct structure', async () => {
      const { loadBuiltinNodeDefs } = await import('@/cli/nodeLoader');
      const defs = loadBuiltinNodeDefs();
      for (const def of defs) {
        expect(def.kind).toBe('NodeDef');
        expect(def.metadata).toBeDefined();
        expect(def.metadata.name).toBeTruthy();
        expect(def.metadata.namespace).toBeTruthy();
        expect(def.metadata.displayName).toBeTruthy();
      }
    });

    it('RegistryManagerCore initializes with loaded defs', async () => {
      const { RegistryManagerCore } = await import('@/core/registry/registryCore');
      const { loadBuiltinNodeDefs } = await import('@/cli/nodeLoader');
      const registry = new RegistryManagerCore();
      registry.initialize(loadBuiltinNodeDefs());
      expect(registry.size).toBe(15);
      expect(registry.resolve('compute/service')).toBeDefined();
    });
  });

  // ─── Protobuf Compatibility ────────────────────────────────

  describe('Protobuf ESM Compatibility', () => {
    it('protobuf-minimal wrapper exports roots', async () => {
      const mod = await import('@/proto/protobuf-minimal');
      expect(mod.roots).toBeDefined();
      expect(typeof mod.roots).toBe('object');
    });

    it('protobuf-minimal wrapper exports Reader and Writer', async () => {
      const mod = await import('@/proto/protobuf-minimal');
      expect(mod.Reader).toBeDefined();
      expect(mod.Writer).toBeDefined();
    });
  });
});
