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

// ─── Version ──────────────────────────────────────────────────

const VERSION = '0.1.0';
const DESCRIPTION =
  'Visual architecture design tool — CLI for .archc files';

// ─── Output Formatting ───────────────────────────────────────

/** Supported output formats. */
export type OutputFormat = 'json' | 'table' | 'human';

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
 * - json: JSON.stringify with 2-space indent
 * - table: tabular text (for arrays) or key-value (for objects)
 * - human: human-readable prose
 */
export function printOutput(
  data: unknown,
  format: OutputFormat,
  humanFormatter?: (data: unknown) => string,
): void {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (format === 'human' && humanFormatter) {
    console.log(humanFormatter(data));
    return;
  }

  // Default: table format or plain JSON if no formatter
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('(no results)');
      return;
    }
    // Print simple table
    const keys = Object.keys(data[0] as Record<string, unknown>);
    const widths = keys.map((k) =>
      Math.max(k.length, ...data.map((r) => String((r as Record<string, unknown>)[k] ?? '').length)),
    );
    // Header
    console.log(keys.map((k, i) => k.padEnd(widths[i]!)).join('  '));
    console.log(widths.map((w) => '─'.repeat(w)).join('  '));
    // Rows
    for (const row of data) {
      console.log(
        keys.map((k, i) => String((row as Record<string, unknown>)[k] ?? '').padEnd(widths[i]!)).join('  '),
      );
    }
  } else if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);
    const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
    for (const [key, value] of entries) {
      console.log(`${key.padEnd(maxKeyLen)}  ${String(value)}`);
    }
  } else {
    console.log(String(data));
  }
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
    .addOption(
      new Option('-f, --file <path>', 'Path to the .archc file')
        .env('ARCHCANVAS_FILE'),
    )
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
        printOutput(nodes, opts.format, (data) => {
          const items = data as Array<{ id: string; type: string; displayName: string }>;
          if (items.length === 0) return '(no nodes)';
          return items
            .map((n) => `  ${n.displayName} [${n.type}] (${n.id})`)
            .join('\n');
        });
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
        printOutput(node, opts.format, (d) => JSON.stringify(d, null, 2));
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
        printOutput(results, opts.format, (data) => {
          const items = data as Array<{ type: string; id: string; displayName: string; matchContext: string; score: number }>;
          if (items.length === 0) return `No results for "${query}"`;
          return items
            .map(
              (r) =>
                `  [${r.type}] ${r.displayName} — ${r.matchContext}`,
            )
            .join('\n');
        });
      }),
    );

  // ─── export ────────────────────────────────────────────────
  registerExportCommand(program);

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

  program
    .command('mcp')
    .description('Start an MCP (Model Context Protocol) server')
    .option('--transport <type>', 'Transport: stdio or sse', 'stdio')
    .option('--file <path>', 'Load an .archc file for persistent file-backed mode')
    .option('-f <path>', 'Alias for --file')
    .action(
      withErrorHandler(async (_cmdOpts: Record<string, string>, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as GlobalOptions & { transport: string; file?: string; f?: string };
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

  return program;
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

// Only run main() when this file is the entry point (not when imported by tests/modules).
// Check if process.argv[1] resolves to this file. In test runners (vitest), it won't.
const _isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (_isDirectRun) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Fatal: ${message}`);
    process.exit(1);
  });
}
