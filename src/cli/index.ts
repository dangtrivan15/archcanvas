import { Command, CommanderError } from 'commander';
import { CLIError } from './errors';
import { formatError } from './output';
import { loadContext } from './context';
import { initCommand } from './commands/init';
import { addNodeCommand } from './commands/add-node';
import { addEdgeCommand } from './commands/add-edge';
import { removeNodeCommand } from './commands/remove-node';
import { removeEdgeCommand } from './commands/remove-edge';
import { listCommand } from './commands/list';
import { describeCommand } from './commands/describe';
import { searchCommand } from './commands/search';
import { importCommand } from './commands/import';
import { catalogCommand } from './commands/catalog';

const program = new Command();

program
  .name('archcanvas')
  .description('ArchCanvas — architecture-as-code CLI')
  .version('0.1.0')
  .option('--json', 'Output in JSON format', false)
  .option('--project <path>', 'Path to project directory')
  .exitOverride(); // Throw instead of calling process.exit — our main() handles exits

// --- Subcommands ---

program
  .command('init')
  .description('Initialize a new ArchCanvas project')
  .option('--name <name>', 'Project name (defaults to directory name)')
  .option('--path <path>', 'Target directory (defaults to cwd)')
  .action(async (options) => {
    const globalOpts = program.opts();
    await initCommand(options, { json: globalOpts.json === true });
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
  .action(async (flags: { scope?: string; type: string }) => {
    await loadContext(program.opts().project);
    const isJson = program.opts().json === true;
    listCommand(
      { scope: flags.scope, type: flags.type as 'nodes' | 'edges' | 'entities' | 'all' },
      { json: isJson },
    );
  });

program
  .command('describe')
  .description('Describe a node or the full architecture')
  .option('--id <id>', 'Node ID (omit for full architecture)')
  .option('--scope <scope>', 'Canvas scope (defaults to root)')
  .action(async (flags: { id?: string; scope?: string }) => {
    await loadContext(program.opts().project);
    const isJson = program.opts().json === true;
    describeCommand(
      { id: flags.id, scope: flags.scope },
      { json: isJson },
    );
  });

program
  .command('search')
  .description('Search nodes, edges, and entities')
  .argument('<query>', 'Search term')
  .option('--type <type>', 'Filter: nodes|edges|entities|all')
  .action(async (query: string, flags: { type?: string }) => {
    await loadContext(program.opts().project);
    const isJson = program.opts().json === true;
    searchCommand(
      query,
      { type: flags.type as 'nodes' | 'edges' | 'entities' | 'all' | undefined },
      { json: isJson },
    );
  });

program
  .command('import')
  .description('Import nodes, edges, and entities from a YAML file')
  .requiredOption('--file <file>', 'Path to YAML file')
  .option('--scope <scope>', 'Target canvas scope (defaults to root)')
  .action(async (flags: { file: string; scope?: string }) => {
    const isJson = program.opts().json === true;
    const ctx = await loadContext(program.opts().project);
    await importCommand(
      { file: flags.file, scope: flags.scope },
      { json: isJson },
      ctx,
    );
  });

program
  .command('catalog')
  .description('List all registered node types')
  .option('--namespace <ns>', 'Filter by namespace')
  .action(async (flags: { namespace?: string }) => {
    await loadContext(program.opts().project);
    const isJson = program.opts().json === true;
    catalogCommand(
      { namespace: flags.namespace },
      { json: isJson },
    );
  });

// --- Top-level error handler ---

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // CommanderError from --help, --version, or missing required option
    if (err instanceof CommanderError) {
      process.exit(err.exitCode);
    }

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
