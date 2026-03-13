#!/usr/bin/env node
import { Command } from 'commander';
import { CLIError } from './errors';
import { formatError } from './output';
import { addNodeCommand } from './commands/add-node';
import { addEdgeCommand } from './commands/add-edge';
import { removeNodeCommand } from './commands/remove-node';
import { removeEdgeCommand } from './commands/remove-edge';

const program = new Command();

program
  .name('archcanvas')
  .description('ArchCanvas — architecture-as-code CLI')
  .version('0.1.0')
  .option('--json', 'Output in JSON format', false)
  .exitOverride(); // Throw instead of calling process.exit — our main() handles exits

// --- Subcommands ---

program
  .command('init')
  .description('Initialize a new ArchCanvas project')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .option('--path <path>', 'Target directory (defaults to cwd)')
  .action(async () => {
    throw new CLIError('INVALID_ARGS', 'init command not yet implemented');
  });

program
  .command('add-node')
  .description('Add a node to the canvas')
  .requiredOption('--id <id>', 'Node ID')
  .requiredOption('--type <type>', 'NodeDef type (e.g., compute/service)')
  .option('--name <name>', 'Display name')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .option('--args <json>', 'Node args as JSON string')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    await addNodeCommand(
      { ...opts, project: globalOpts.project },
      { json: globalOpts.json },
    );
  });

program
  .command('add-edge')
  .description('Add an edge between two nodes')
  .requiredOption('--from <from>', 'Source node ID')
  .requiredOption('--to <to>', 'Target node ID')
  .option('--from-port <port>', 'Source port name')
  .option('--to-port <port>', 'Target port name')
  .option('--protocol <protocol>', 'Protocol label')
  .option('--label <label>', 'Edge label')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    await addEdgeCommand(
      { ...opts, project: globalOpts.project },
      { json: globalOpts.json },
    );
  });

program
  .command('remove-node')
  .description('Remove a node from the canvas')
  .requiredOption('--id <id>', 'Node ID to remove')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    await removeNodeCommand(
      { ...opts, project: globalOpts.project },
      { json: globalOpts.json },
    );
  });

program
  .command('remove-edge')
  .description('Remove an edge between two nodes')
  .requiredOption('--from <from>', 'Source node ID')
  .requiredOption('--to <to>', 'Target node ID')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    await removeEdgeCommand(
      { ...opts, project: globalOpts.project },
      { json: globalOpts.json },
    );
  });

program
  .command('list')
  .description('List nodes, edges, and entities')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .option('--type <type>', 'Filter: nodes|edges|entities|all', 'all')
  .action(async () => {
    throw new CLIError('INVALID_ARGS', 'list command not yet implemented');
  });

program
  .command('describe')
  .description('Describe a node or the full architecture')
  .option('--id <id>', 'Node ID (omit for full architecture)')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .action(async () => {
    throw new CLIError('INVALID_ARGS', 'describe command not yet implemented');
  });

program
  .command('search')
  .description('Search nodes, edges, and entities')
  .argument('<query>', 'Search term')
  .option('--type <type>', 'Filter: nodes|edges|entities|all')
  .action(async () => {
    throw new CLIError('INVALID_ARGS', 'search command not yet implemented');
  });

program
  .command('import')
  .description('Import nodes, edges, and entities from a YAML file')
  .requiredOption('--file <file>', 'Path to YAML file')
  .option('--scope <scope>', 'Target canvas scope (defaults to root)')
  .action(async () => {
    throw new CLIError('INVALID_ARGS', 'import command not yet implemented');
  });

// --- Top-level error handler ---

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const isJson = program.opts().json === true;

    if (err instanceof CLIError) {
      process.stderr.write(formatError(err, { json: isJson }) + '\n');
      process.exit(1);
    }

    // Unhandled error — wrap as CLIError for consistent output
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new CLIError('INTERNAL_ERROR', message);
    process.stderr.write(formatError(wrapped, { json: isJson }) + '\n');
    process.exit(1);
  }
}

main();
