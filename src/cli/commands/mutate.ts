/**
 * CLI Mutation Commands
 *
 * Write subcommands that mutate the architecture graph and save the .archc file.
 * These allow external agents to programmatically build and modify architectures.
 *
 * Commands: add-node, add-edge, remove-node, remove-edge, add-note, update-node
 *
 * All mutation commands:
 * - Auto-save the .archc file
 * - Regenerate the .summary.md sidecar
 * - Output JSON when --format json is specified
 */

import type { Command } from 'commander';
import type { GlobalOptions } from '@/cli/index';
import { loadContext, printOutput, withErrorHandler } from '@/cli/index';
import type { GraphContext } from '@/cli/context';

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Parse key=value pairs from a string array.
 * Used for --args and --set-prop options.
 *
 * @param pairs - Array of "key=value" strings
 * @returns Record of key-value pairs
 */
function parseKeyValuePairs(pairs: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      console.error(`Error: Invalid key=value format "${pair}". Use key=value.`);
      process.exit(1);
    }
    result[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
  }
  return result;
}

/**
 * Save the .archc file and regenerate the .summary.md sidecar.
 */
async function saveAndRegenerateSidecar(ctx: GraphContext): Promise<void> {
  await ctx.save();
  try {
    await ctx.saveSidecar();
  } catch {
    // Sidecar generation is best-effort; don't fail the mutation
  }
}

// ─── Register Commands ────────────────────────────────────────

/**
 * Register all mutation commands on the given Commander program.
 */
export function registerMutateCommands(program: Command): void {
  // ─── add-node ──────────────────────────────────────────────
  program
    .command('add-node')
    .description('Add a new node to the architecture')
    .requiredOption('-t, --type <type>', 'Node type (e.g., compute/service)')
    .requiredOption('-n, --name <name>', 'Display name')
    .option('-p, --parent <id>', 'Parent node ID (for nesting)')
    .option('--args <key=value...>', 'Node arguments as key=value pairs')
    .action(
      withErrorHandler(
        async (cmdOpts: { type: string; name: string; parent?: string; args?: string[] }) => {
          const opts = program.opts<GlobalOptions>();
          const ctx = await loadContext(opts);

          const args = cmdOpts.args ? parseKeyValuePairs(cmdOpts.args) : undefined;

          const node = ctx.textApi.addNode({
            type: cmdOpts.type,
            displayName: cmdOpts.name,
            parentId: cmdOpts.parent,
            args,
          });

          await saveAndRegenerateSidecar(ctx);

          if (!opts.quiet) {
            console.log(`Added node "${cmdOpts.name}" (${node.id})`);
          }
          if (opts.format === 'json') {
            printOutput(
              {
                id: node.id,
                type: cmdOpts.type,
                displayName: cmdOpts.name,
                parentId: cmdOpts.parent ?? null,
                args: args ?? {},
              },
              'json',
            );
          }
        },
      ),
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

          await saveAndRegenerateSidecar(ctx);

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
                label: cmdOpts.label ?? null,
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
    .option('--force', 'Force removal without confirmation', false)
    .action(
      withErrorHandler(async (id: string, cmdOpts: { force: boolean }) => {
        const opts = program.opts<GlobalOptions>();
        const ctx = await loadContext(opts);

        // Check if node exists
        const node = ctx.textApi.getNode(id);
        if (!node) {
          console.error(`Error: Node "${id}" not found.`);
          process.exit(1);
        }

        // Check if node has children — warn unless --force
        if (node.children && node.children.length > 0 && !cmdOpts.force) {
          console.error(
            `Error: Node "${id}" has ${node.children.length} child node(s). Use --force to remove it and all children.`,
          );
          process.exit(1);
        }

        ctx.textApi.removeNode(id);
        await saveAndRegenerateSidecar(ctx);

        if (!opts.quiet) {
          console.log(`Removed node "${id}"`);
        }
        if (opts.format === 'json') {
          printOutput({ id, removed: true }, 'json');
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

        // Check if edge exists
        const graph = ctx.getGraph();
        const edgeExists = graph.edges.some((e) => e.id === id);
        if (!edgeExists) {
          console.error(`Error: Edge "${id}" not found.`);
          process.exit(1);
        }

        ctx.textApi.removeEdge(id);
        await saveAndRegenerateSidecar(ctx);

        if (!opts.quiet) {
          console.log(`Removed edge "${id}"`);
        }
        if (opts.format === 'json') {
          printOutput({ id, removed: true }, 'json');
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
    .option('--tags <tags>', 'Comma-separated tags (e.g., tag1,tag2)')
    .action(
      withErrorHandler(
        async (cmdOpts: { node: string; content: string; author: string; tags?: string }) => {
          const opts = program.opts<GlobalOptions>();
          const ctx = await loadContext(opts);

          // Parse comma-separated tags
          const tags = cmdOpts.tags
            ? cmdOpts.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined;

          const note = ctx.textApi.addNote({
            nodeId: cmdOpts.node,
            content: cmdOpts.content,
            author: cmdOpts.author,
            tags,
          });

          await saveAndRegenerateSidecar(ctx);

          if (!opts.quiet) {
            console.log(`Added note to node "${cmdOpts.node}" (${note.id})`);
          }
          if (opts.format === 'json') {
            printOutput(
              {
                id: note.id,
                nodeId: cmdOpts.node,
                content: cmdOpts.content,
                author: cmdOpts.author,
                tags: tags ?? [],
              },
              'json',
            );
          }
        },
      ),
    );

  // ─── update-node ───────────────────────────────────────────
  program
    .command('update-node')
    .description("Update a node's display name, args, properties, or color")
    .argument('<id>', 'Node ID to update')
    .option('-n, --name <name>', 'New display name')
    .option('--args <key=value...>', 'Set args as key=value pairs')
    .option('--set-prop <key=value...>', 'Set property key=value pairs')
    .option('--color <hex>', 'Set node color (e.g., #ff6600)')
    .action(
      withErrorHandler(
        async (
          id: string,
          cmdOpts: { name?: string; args?: string[]; setProp?: string[]; color?: string },
        ) => {
          const opts = program.opts<GlobalOptions>();
          const ctx = await loadContext(opts);

          // Check if node exists
          const existing = ctx.textApi.getNode(id);
          if (!existing) {
            console.error(`Error: Node "${id}" not found.`);
            process.exit(1);
          }

          const updates: Record<string, unknown> = {};
          if (cmdOpts.name) {
            updates.displayName = cmdOpts.name;
          }
          if (cmdOpts.args) {
            updates.args = parseKeyValuePairs(cmdOpts.args);
          }
          if (cmdOpts.setProp) {
            updates.properties = parseKeyValuePairs(cmdOpts.setProp);
          }

          // Apply name/args/properties updates
          if (Object.keys(updates).length > 0) {
            ctx.textApi.updateNode(id, updates);
          }

          // Apply color separately (uses updateNodeColor)
          if (cmdOpts.color !== undefined) {
            ctx.textApi.updateNodeColor(id, cmdOpts.color);
          }

          await saveAndRegenerateSidecar(ctx);

          if (!opts.quiet) {
            console.log(`Updated node "${id}"`);
          }
          if (opts.format === 'json') {
            printOutput(
              {
                id,
                updated: true,
                displayName: cmdOpts.name ?? null,
                args: cmdOpts.args ? parseKeyValuePairs(cmdOpts.args) : null,
                properties: cmdOpts.setProp ? parseKeyValuePairs(cmdOpts.setProp) : null,
                color: cmdOpts.color ?? null,
              },
              'json',
            );
          }
        },
      ),
    );
}
