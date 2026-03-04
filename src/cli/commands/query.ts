/**
 * CLI Query Commands.
 *
 * Read-only subcommands for inspecting an architecture file:
 * - describe: Describe the architecture in detail
 * - list-nodes: List all nodes in the architecture
 * - get-node: Get detailed information about a specific node
 * - search: Full-text search across nodes, edges, and notes
 * - list-nodedefs: List all available node type definitions
 *
 * All commands delegate to the TextApi and respect the global --format flag.
 * Output goes to stdout for piping; errors go to stderr.
 */

import type { Command } from 'commander';
import type { GlobalOptions } from '@/cli/index';
import { loadContext, printOutput, withErrorHandler, suppressDiagnosticLogs } from '@/cli/index';

// ─── describe ──────────────────────────────────────────────

export function registerDescribeCommand(program: Command): void {
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
}

// ─── list-nodes ────────────────────────────────────────────

export function registerListNodesCommand(program: Command): void {
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
}

// ─── get-node ──────────────────────────────────────────────

export function registerGetNodeCommand(program: Command): void {
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
}

// ─── search ────────────────────────────────────────────────

export function registerSearchCommand(program: Command): void {
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
          const items = data as Array<{
            type: string;
            id: string;
            displayName: string;
            matchContext: string;
            score: number;
          }>;
          if (items.length === 0) return `No results for "${query}"`;
          return items
            .map(
              (r) => `  [${r.type}] ${r.displayName} — ${r.matchContext}`,
            )
            .join('\n');
        });
      }),
    );
}

// ─── list-nodedefs ─────────────────────────────────────────

export function registerListNodedefsCommand(program: Command): void {
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
        registry.initialize(loadBuiltinNodeDefs());
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
          const items = data as Array<{
            type: string;
            displayName: string;
            namespace: string;
          }>;
          if (items.length === 0) return '(no nodedefs found)';
          // Group by namespace
          const grouped = new Map<
            string,
            Array<{ type: string; displayName: string }>
          >();
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
}

// ─── Register All Query Commands ────────────────────────────

/**
 * Register all read-only query commands on the program.
 */
export function registerQueryCommands(program: Command): void {
  registerDescribeCommand(program);
  registerListNodesCommand(program);
  registerGetNodeCommand(program);
  registerSearchCommand(program);
  registerListNodedefsCommand(program);
}
