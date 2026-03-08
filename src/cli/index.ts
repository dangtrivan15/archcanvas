#!/usr/bin/env node
/**
 * ArchCanvas CLI Entry Point
 *
 * The main CLI binary for ArchCanvas, providing command-line access to
 * architecture files (.archc). All subcommands operate on the same
 * TextApi/ExportApi/GraphContext stack as the web UI.
 *
 * Usage:
 *   archcanvas <command> [options]
 *   archcanvas --help
 *   archcanvas --version
 */

import { Command, Option } from 'commander';
import { GraphContext } from '@/cli/context';
import { registerInitCommand } from '@/cli/commands/init';
import { registerInfoCommand } from '@/cli/commands/info';
import { registerExportCommand } from '@/cli/commands/export';
import { registerMutateCommands } from '@/cli/commands/mutate';
import { registerAnalyzeCommand } from '@/cli/commands/analyze';
import { registerBackupPushCommand } from '@/cli/commands/backupPush';
import { registerMcpInstallCommand } from '@/cli/commands/mcpInstall';
import { registerMcpUninstallCommand } from '@/cli/commands/mcpUninstall';

// ─── Version ──────────────────────────────────────────────────

const VERSION = '0.1.0';
const DESCRIPTION = 'Visual architecture design tool — CLI for .archc files';

// ─── Output Formatting ───────────────────────────────────────

// Re-export from formatter module for backward compatibility
export type { OutputFormat } from '@/cli/formatter';
export {
  formatAsJson,
  formatAsTable,
  formatAsHuman,
  formatOutput,
  formatNodeSummary,
  formatNodeDetail,
  formatEdgeSummary,
  formatSearchResult,
  writeOutput,
  writeInfo,
  writeError,
} from '@/cli/formatter';

import type { OutputFormat } from '@/cli/formatter';
import {
  formatOutput,
  formatNodeSummary,
  formatNodeDetail,
  formatSearchResult,
  writeOutput,
} from '@/cli/formatter';

/** Global options shared across all commands. */
export interface GlobalOptions {
  file?: string;
  format: OutputFormat;
  quiet: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Suppress diagnostic console.log messages during CLI operations.
 * Redirects console.log to stderr so that stdout remains clean for piping.
 * Returns a restore function to undo the redirection.
 */
export function suppressDiagnosticLogs(): () => void {
  const origLog = console.log;
  console.log = (...args: unknown[]) => {
    // Redirect diagnostic messages (e.g., [TextApi], [RegistryManager]) to stderr
    const first = String(args[0] ?? '');
    if (first.startsWith('[')) {
      console.error(...args);
      return;
    }
    origLog(...args);
  };
  return () => {
    console.log = origLog;
  };
}

/**
 * Load a GraphContext from the --file option.
 * Validates that --file is provided and the file exists.
 * Exits with code 1 if the file cannot be loaded.
 */
export async function loadContext(opts: GlobalOptions): Promise<GraphContext> {
  if (!opts.file) {
    console.error('Error: --file <path> is required for this command.');
    process.exit(1);
  }

  const restore = suppressDiagnosticLogs();
  try {
    const ctx = await GraphContext.loadFromFile(opts.file);
    return ctx;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to load "${opts.file}": ${message}`);
    process.exit(1);
  } finally {
    restore();
  }
}

/**
 * Print output in the requested format.
 * Uses the shared formatter module for consistent output across all commands.
 *
 * - json: JSON.stringify with 2-space indent
 * - table: tabular text (for arrays) or key-value (for objects)
 * - human: human-readable prose
 *
 * All data output goes to stdout via writeOutput() so piping works correctly.
 */
export function printOutput(
  data: unknown,
  format: OutputFormat,
  humanFormatter?: (data: unknown) => string,
): void {
  const result = formatOutput(data, format, humanFormatter);
  writeOutput(result);
}

/**
 * Wrap a command action with error handling.
 * Catches errors, prints user-friendly messages, and exits with code 1.
 */
export function withErrorHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  };
}

// ─── Program Setup ───────────────────────────────────────────

/**
 * Create and configure the CLI program.
 * Exported for testing purposes.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('archcanvas')
    .description(DESCRIPTION)
    .version(VERSION, '-v, --version', 'Display the version number')
    .addOption(new Option('-f, --file <path>', 'Path to the .archc file').env('ARCHCANVAS_FILE'))
    .addOption(
      new Option('--format <format>', 'Output format')
        .choices(['json', 'table', 'human'])
        .default('human'),
    )
    .option('-q, --quiet', 'Suppress non-essential output', false);

  // ─── init ──────────────────────────────────────────────────
  registerInitCommand(program);

  // ─── info ──────────────────────────────────────────────────
  registerInfoCommand(program);

  // ─── describe ──────────────────────────────────────────────

  program
    .command('describe')
    .description('Describe the architecture in detail')
    .option('--style <style>', 'Description style: structured, human, ai', 'human')
    .action(
      withErrorHandler(async (cmdOpts: { style: 'structured' | 'human' | 'ai' }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const result = ctx.textApi.describe({ format: cmdOpts.style });
        printOutput(result, opts.format, (d) => String(d));
      }),
    );

  // ─── list-nodes ────────────────────────────────────────────

  program
    .command('list-nodes')
    .description('List all nodes in the architecture')
    .action(
      withErrorHandler(async () => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const nodes = ctx.textApi.listNodes();
        const output = formatNodeSummary(nodes, opts.format);
        writeOutput(output);
      }),
    );

  // ─── get-node ──────────────────────────────────────────────

  program
    .command('get-node')
    .description('Get detailed information about a specific node')
    .argument('<id>', 'Node ID')
    .action(
      withErrorHandler(async (id: string) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const node = ctx.textApi.getNode(id);
        if (!node) {
          console.error(`Error: Node "${id}" not found.`);
          process.exit(1);
        }
        const output = formatNodeDetail(node, opts.format);
        writeOutput(output);
      }),
    );

  // ─── Mutation commands (add-node, add-edge, remove-node, remove-edge, add-note, update-node) ──
  registerMutateCommands(program);

  // ─── search ────────────────────────────────────────────────

  program
    .command('search')
    .description('Search across nodes, edges, and notes')
    .argument('<query>', 'Search query string')
    .action(
      withErrorHandler(async (query: string) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const results = ctx.textApi.search(query);
        const output = formatSearchResult(results, query, opts.format);
        writeOutput(output);
      }),
    );

  // ─── export ────────────────────────────────────────────────
  registerExportCommand(program);

  // ─── analyze ──────────────────────────────────────────────
  registerAnalyzeCommand(program);

  // ─── backup-push ──────────────────────────────────────────
  registerBackupPushCommand(program);

  // ─── list-nodedefs ─────────────────────────────────────────

  program
    .command('list-nodedefs')
    .description('List all available node type definitions')
    .option('--namespace <ns>', 'Filter by namespace')
    .action(
      withErrorHandler(async (cmdOpts: { namespace?: string }) => {
        const opts = program.opts<GlobalOptions>();
        // list-nodedefs doesn't need --file — load registry from disk
        const restore = suppressDiagnosticLogs();
        const { RegistryManagerCore } = await import('@/core/registry/registryCore');
        const { loadBuiltinNodeDefs } = await import('@/cli/nodeLoader');
        const registry = new RegistryManagerCore();
        registry.initialize(await loadBuiltinNodeDefs());
        restore();

        let types: Array<{ type: string; displayName: string; namespace: string }>;
        if (cmdOpts.namespace) {
          const defs = registry.listByNamespace(cmdOpts.namespace);
          types = defs.map((d) => ({
            type: `${d.metadata.namespace}/${d.metadata.name}`,
            displayName: d.metadata.displayName,
            namespace: d.metadata.namespace,
          }));
        } else {
          const allDefs = registry.listAll();
          types = allDefs.map((d) => ({
            type: `${d.metadata.namespace}/${d.metadata.name}`,
            displayName: d.metadata.displayName,
            namespace: d.metadata.namespace,
          }));
        }

        printOutput(types, opts.format, (data) => {
          const items = data as Array<{ type: string; displayName: string; namespace: string }>;
          if (items.length === 0) return '(no nodedefs found)';
          // Group by namespace
          const grouped = new Map<string, Array<{ type: string; displayName: string }>>();
          for (const item of items) {
            const ns = item.namespace;
            if (!grouped.has(ns)) grouped.set(ns, []);
            grouped.get(ns)!.push(item);
          }
          const lines: string[] = [];
          for (const [ns, defs] of grouped) {
            lines.push(`\n${ns}/`);
            for (const d of defs) {
              lines.push(`  ${d.type.padEnd(30)} ${d.displayName}`);
            }
          }
          return lines.join('\n');
        });
      }),
    );

  // ─── serve ──────────────────────────────────────────────────

  program
    .command('serve')
    .description('Start an HTTP REST API server for the architecture')
    .option('--port <port>', 'Server port', '3001')
    .option('--host <host>', 'Server host', 'localhost')
    .option('--cors', 'Enable CORS headers for browser-based agents', false)
    .action(
      withErrorHandler(async (cmdOpts: { port: string; host: string; cors: boolean }) => {
        const opts = program.opts<GlobalOptions>();
        if (!opts.file) {
          console.error('Error: --file <path> is required for the serve command.');
          process.exit(1);
        }
        const ctx = await loadContext(opts);
        const { startHttpServer } = await import('@/cli/server/httpServer');
        await startHttpServer(ctx, {
          port: parseInt(cmdOpts.port, 10),
          host: cmdOpts.host,
          cors: cmdOpts.cors,
        });
      }),
    );

  // ─── mcp ─────────────────────────────────────────────────────

  const mcpCmd = program
    .command('mcp')
    .description('MCP (Model Context Protocol) server commands')
    .option('--transport <type>', 'Transport: stdio or sse', 'stdio')
    .option('--file <path>', 'Load an .archc file for persistent file-backed mode')
    .option('-f <path>', 'Alias for --file')
    .action(
      withErrorHandler(async (_cmdOpts: Record<string, string>, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as GlobalOptions & {
          transport: string;
          file?: string;
          f?: string;
        };
        const filePath = opts.file ?? opts.f ?? (cmd.parent?.opts() as GlobalOptions)?.file;

        const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
        const { createMcpServer } = await import('@/mcp/server');
        const { RegistryManager } = await import('@/core/registry/registryManager');
        const { TextApi } = await import('@/api/textApi');
        const { createEmptyGraph } = await import('@/core/graph/graphEngine');

        let graphContext: GraphContext | undefined;
        let textApi: InstanceType<typeof TextApi>;
        const registry = new RegistryManager();
        registry.initialize();

        if (filePath) {
          graphContext = await GraphContext.loadFromFile(filePath);
          textApi = graphContext.textApi;
          if (!opts.quiet) {
            console.error(`[MCP] Loaded architecture from: ${filePath}`);
          }
        } else {
          const graph = createEmptyGraph('Untitled Architecture');
          textApi = new TextApi(graph, registry);
          if (!opts.quiet) {
            console.error('[MCP] Starting with empty graph (no --file specified)');
          }
        }

        const mcpServer = createMcpServer(textApi, registry, graphContext);
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);

        if (!opts.quiet) {
          console.error('[MCP] ArchCanvas MCP server running on stdio');
        }

        // Keep process alive until transport closes
        await new Promise<void>((resolve) => {
          process.on('SIGINT', resolve);
          process.on('SIGTERM', resolve);
        });
      }),
    );

  // ─── mcp install ────────────────────────────────────────────
  registerMcpInstallCommand(mcpCmd);

  // ─── mcp uninstall ─────────────────────────────────────────
  registerMcpUninstallCommand(mcpCmd);

  return program;
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

// Only run main() when this file is the entry point (not when imported by tests/modules).
// Resolve symlinks via realpathSync so `npm link` works (process.argv[1] may be a symlink
// while import.meta.url points to the real file).
import { realpathSync } from 'node:fs';
const _isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const resolved = new URL(
      'file://' + realpathSync(process.argv[1]),
    ).href;
    return (
      import.meta.url === resolved ||
      import.meta.url.endsWith(resolved.split('/').pop()!)
    );
  } catch {
    // If realpathSync fails (e.g. file doesn't exist), fall back to direct comparison
    return import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
  }
})();

if (_isDirectRun) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Fatal: ${message}`);
    process.exit(1);
  });
}
