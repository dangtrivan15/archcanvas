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
 * Load a GraphContext from the --file option.
 * Validates that --file is provided and the file exists.
 * Exits with code 1 if the file cannot be loaded.
 */
export async function loadContext(opts: GlobalOptions): Promise<GraphContext> {
  if (!opts.file) {
    console.error('Error: --file <path> is required for this command.');
    process.exit(1);
  }

  try {
    const ctx = await GraphContext.loadFromFile(opts.file);
    return ctx;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to load "${opts.file}": ${message}`);
    process.exit(1);
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

  program
    .command('init')
    .description('Create a new .archc architecture file')
    .argument('[name]', 'Architecture name', 'Untitled Architecture')
    .option('-o, --output <path>', 'Output file path', './architecture.archc')
    .action(
      withErrorHandler(async (name: string, cmdOpts: { output: string }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = GraphContext.createNew(name);
        await ctx.saveAs(cmdOpts.output);
        if (!opts.quiet) {
          console.log(`Created new architecture "${name}" at ${cmdOpts.output}`);
        }
      }),
    );

  // ─── info ──────────────────────────────────────────────────

  program
    .command('info')
    .description('Show architecture file summary')
    .action(
      withErrorHandler(async () => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const graph = ctx.getGraph();
        const info = {
          name: graph.name,
          description: graph.description || '(none)',
          owners: graph.owners.length > 0 ? graph.owners.join(', ') : '(none)',
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          file: ctx.getFilePath() ?? '(unsaved)',
        };
        printOutput(info, opts.format, () =>
          [
            `Architecture: ${info.name}`,
            `Description:  ${info.description}`,
            `Owners:       ${info.owners}`,
            `Nodes:        ${info.nodes}`,
            `Edges:        ${info.edges}`,
            `File:         ${info.file}`,
          ].join('\n'),
        );
      }),
    );

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

  // ─── add-node ──────────────────────────────────────────────

  program
    .command('add-node')
    .description('Add a new node to the architecture')
    .requiredOption('-t, --type <type>', 'Node type (e.g., compute/service)')
    .requiredOption('-n, --name <name>', 'Display name')
    .option('-p, --parent <id>', 'Parent node ID (for nesting)')
    .action(
      withErrorHandler(async (cmdOpts: { type: string; name: string; parent?: string }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const node = ctx.textApi.addNode({
          type: cmdOpts.type,
          displayName: cmdOpts.name,
          parentId: cmdOpts.parent,
        });
        await ctx.save();
        if (!opts.quiet) {
          console.log(`Added node "${cmdOpts.name}" (${node.id})`);
        }
        if (opts.format === 'json') {
          printOutput({ id: node.id, type: cmdOpts.type, displayName: cmdOpts.name }, 'json');
        }
      }),
    );

  // ─── add-edge ──────────────────────────────────────────────

  program
    .command('add-edge')
    .description('Add an edge between two nodes')
    .requiredOption('--from <id>', 'Source node ID')
    .requiredOption('--to <id>', 'Target node ID')
    .option('--type <type>', 'Edge type: sync, async, data-flow', 'sync')
    .option('-l, --label <label>', 'Edge label')
    .action(
      withErrorHandler(
        async (cmdOpts: { from: string; to: string; type: string; label?: string }) => {
          const opts = program.opts<GlobalOptions>();
          const ctx = await loadContext(opts);
          const edge = ctx.textApi.addEdge({
            fromNode: cmdOpts.from,
            toNode: cmdOpts.to,
            type: cmdOpts.type as 'sync' | 'async' | 'data-flow',
            label: cmdOpts.label,
          });
          await ctx.save();
          if (!opts.quiet) {
            console.log(`Added edge ${cmdOpts.from} → ${cmdOpts.to} (${edge.id})`);
          }
          if (opts.format === 'json') {
            printOutput(
              {
                id: edge.id,
                from: cmdOpts.from,
                to: cmdOpts.to,
                type: cmdOpts.type,
                label: cmdOpts.label,
              },
              'json',
            );
          }
        },
      ),
    );

  // ─── remove-node ───────────────────────────────────────────

  program
    .command('remove-node')
    .description('Remove a node (and its connected edges)')
    .argument('<id>', 'Node ID to remove')
    .action(
      withErrorHandler(async (id: string) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        ctx.textApi.removeNode(id);
        await ctx.save();
        if (!opts.quiet) {
          console.log(`Removed node "${id}"`);
        }
      }),
    );

  // ─── remove-edge ───────────────────────────────────────────

  program
    .command('remove-edge')
    .description('Remove an edge')
    .argument('<id>', 'Edge ID to remove')
    .action(
      withErrorHandler(async (id: string) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        ctx.textApi.removeEdge(id);
        await ctx.save();
        if (!opts.quiet) {
          console.log(`Removed edge "${id}"`);
        }
      }),
    );

  // ─── add-note ──────────────────────────────────────────────

  program
    .command('add-note')
    .description('Add a note to a node')
    .requiredOption('--node <id>', 'Target node ID')
    .requiredOption('-c, --content <text>', 'Note content (markdown)')
    .option('-a, --author <name>', 'Author name', 'cli')
    .action(
      withErrorHandler(
        async (cmdOpts: { node: string; content: string; author: string }) => {
          const opts = program.opts<GlobalOptions>();
          const ctx = await loadContext(opts);
          const note = ctx.textApi.addNote({
            targetNodeId: cmdOpts.node,
            content: cmdOpts.content,
            author: cmdOpts.author,
          });
          await ctx.save();
          if (!opts.quiet) {
            console.log(`Added note to node "${cmdOpts.node}" (${note.id})`);
          }
          if (opts.format === 'json') {
            printOutput({ id: note.id, nodeId: cmdOpts.node, content: cmdOpts.content }, 'json');
          }
        },
      ),
    );

  // ─── update-node ───────────────────────────────────────────

  program
    .command('update-node')
    .description('Update a node\'s display name or properties')
    .argument('<id>', 'Node ID to update')
    .option('-n, --name <name>', 'New display name')
    .option('--set-prop <key=value...>', 'Set property key=value pairs')
    .action(
      withErrorHandler(async (id: string, cmdOpts: { name?: string; setProp?: string[] }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);

        const updates: Record<string, unknown> = {};
        if (cmdOpts.name) {
          updates.displayName = cmdOpts.name;
        }
        if (cmdOpts.setProp) {
          const properties: Record<string, string> = {};
          for (const pair of cmdOpts.setProp) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex === -1) {
              console.error(`Error: Invalid property format "${pair}". Use key=value.`);
              process.exit(1);
            }
            properties[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
          }
          updates.properties = properties;
        }

        ctx.textApi.updateNode(id, updates);
        await ctx.save();
        if (!opts.quiet) {
          console.log(`Updated node "${id}"`);
        }
      }),
    );

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

  program
    .command('export')
    .description('Export architecture to markdown or mermaid')
    .addOption(
      new Option('--type <type>', 'Export type')
        .choices(['markdown', 'mermaid', 'summary'])
        .default('summary'),
    )
    .option('-o, --output <path>', 'Output file path (stdout if omitted)')
    .action(
      withErrorHandler(async (cmdOpts: { type: string; output?: string }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);
        const graph = ctx.getGraph();

        let content: string;
        switch (cmdOpts.type) {
          case 'markdown':
            content = ctx.exportApi.generateMarkdownSummary(graph);
            break;
          case 'mermaid':
            content = ctx.exportApi.generateMermaid(graph);
            break;
          case 'summary':
          default:
            content = ctx.exportApi.generateSummaryWithMermaid(graph);
            break;
        }

        if (cmdOpts.output) {
          const fs = await import('node:fs/promises');
          const path = await import('node:path');
          await fs.writeFile(path.resolve(cmdOpts.output), content, 'utf-8');
          if (!opts.quiet) {
            console.log(`Exported ${cmdOpts.type} to ${cmdOpts.output}`);
          }
        } else {
          console.log(content);
        }
      }),
    );

  // ─── list-nodedefs ─────────────────────────────────────────

  program
    .command('list-nodedefs')
    .description('List all available node type definitions')
    .option('--namespace <ns>', 'Filter by namespace')
    .action(
      withErrorHandler(async (cmdOpts: { namespace?: string }) => {
        const opts = program.opts<GlobalOptions>();
        // list-nodedefs doesn't need --file — load registry from disk
        const { RegistryManagerCore } = await import('@/core/registry/registryCore');
        const { loadBuiltinNodeDefs } = await import('@/cli/nodeLoader');
        const registry = new RegistryManagerCore();
        registry.initialize(await loadBuiltinNodeDefs());

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

  // ─── serve (stub) ──────────────────────────────────────────

  program
    .command('serve')
    .description('Start an HTTP server for the architecture API')
    .option('--port <port>', 'Server port', '3100')
    .action(
      withErrorHandler(async () => {
        console.error(
          'Error: The "serve" command is not yet implemented. It will start an HTTP API server.',
        );
        process.exit(1);
      }),
    );

  // ─── mcp (stub) ────────────────────────────────────────────

  program
    .command('mcp')
    .description('Start an MCP (Model Context Protocol) server')
    .option('--transport <type>', 'Transport: stdio or sse', 'stdio')
    .action(
      withErrorHandler(async () => {
        console.error(
          'Error: The "mcp" command is not yet implemented. It will start an MCP server.',
        );
        process.exit(1);
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
