/**
 * CLI `init` Command
 *
 * Creates a new empty .archc architecture file with proper magic bytes,
 * header, and an empty architecture graph. Optionally generates a
 * .summary.md sidecar file alongside it.
 *
 * Usage:
 *   archcanvas init [--name 'My Architecture'] [--output project.archc] [--force]
 */

import { Command } from 'commander';
import { GraphContext } from '@/cli/context';
import { type GlobalOptions, withErrorHandler, suppressDiagnosticLogs } from '@/cli/index';

interface InitOptions {
  name: string;
  output: string;
  force: boolean;
}

/**
 * Register the `init` subcommand on the given Commander program.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Create a new .archc architecture file')
    .option('--name <name>', 'Architecture name', 'Untitled Architecture')
    .option('-o, --output <path>', 'Output file path', './architecture.archc')
    .option('--force', 'Overwrite existing file without error', false)
    .action(
      withErrorHandler(async (cmdOpts: InitOptions) => {
        const opts = program.opts<GlobalOptions>();
        const fs = await import('node:fs');
        const path = await import('node:path');

        const resolvedOutput = path.resolve(cmdOpts.output);

        // Check if file already exists (unless --force)
        if (!cmdOpts.force && fs.existsSync(resolvedOutput)) {
          throw new Error(`File already exists: ${resolvedOutput}\nUse --force to overwrite.`);
        }

        // Suppress diagnostic log noise from registry init
        const restore = suppressDiagnosticLogs();
        let ctx: GraphContext;
        try {
          ctx = GraphContext.createNew(cmdOpts.name);
        } finally {
          restore();
        }

        // Save the .archc file
        await ctx.saveAs(resolvedOutput);

        // Generate the .summary.md sidecar file
        try {
          await ctx.saveSidecar();
        } catch {
          // Sidecar generation is best-effort; don't fail the init
        }

        // Report success with file path and size
        if (!opts.quiet) {
          const stats = fs.statSync(resolvedOutput);
          const sizeBytes = stats.size;
          const sizeDisplay =
            sizeBytes < 1024 ? `${sizeBytes} bytes` : `${(sizeBytes / 1024).toFixed(1)} KB`;

          console.log(
            `Created new architecture "${cmdOpts.name}" at ${resolvedOutput} (${sizeDisplay})`,
          );

          // Also report sidecar if it was generated
          const sidecarName = path.basename(resolvedOutput).replace(/\.archc$/, '.summary.md');
          const sidecarPath = path.join(path.dirname(resolvedOutput), sidecarName);
          if (fs.existsSync(sidecarPath)) {
            console.log(`Generated sidecar: ${sidecarPath}`);
          }
        }

        // JSON output
        if (opts.format === 'json') {
          const stats = fs.statSync(resolvedOutput);
          console.log(
            JSON.stringify(
              {
                name: cmdOpts.name,
                file: resolvedOutput,
                size: stats.size,
                created: true,
              },
              null,
              2,
            ),
          );
        }
      }),
    );
}
