/**
 * CLI `export` Command
 *
 * Exports architecture to markdown or Mermaid format from the CLI.
 * Uses the existing ExportApi content generation functions.
 *
 * Usage:
 *   archcanvas export --file f.archc --type markdown|mermaid [--output out.md]
 *   archcanvas export --file f.archc --type markdown --with-mermaid
 *
 * Notes:
 *   --type is used instead of --format to avoid conflict with the global
 *   --format option (json/table/human) for output formatting.
 *   PNG/SVG export is NOT supported in CLI (requires browser DOM).
 *   A helpful error message is shown if those formats are requested.
 */

import { Command, Option } from 'commander';
import { type GlobalOptions, loadContext, withErrorHandler } from '@/cli/index';

interface ExportOptions {
  type: string;
  output?: string;
  withMermaid?: boolean;
}

/**
 * Register the `export` subcommand on the given Commander program.
 */
export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export architecture to markdown or mermaid')
    .addOption(
      new Option('--type <type>', 'Export format: markdown, mermaid, png, svg')
        .choices(['markdown', 'mermaid', 'png', 'svg'])
        .default('markdown'),
    )
    .option('-o, --output <path>', 'Output file path (stdout if omitted)')
    .option('--with-mermaid', 'Include Mermaid diagram in markdown output', false)
    .action(
      withErrorHandler(async (cmdOpts: ExportOptions) => {
        const opts = program.opts<GlobalOptions>();

        // ─── PNG/SVG: not supported in CLI ───────────────────
        if (cmdOpts.type === 'png' || cmdOpts.type === 'svg') {
          const fmt = cmdOpts.type.toUpperCase();
          console.error(
            `Error: ${fmt} export is not supported in the CLI.\n` +
              `${fmt} export requires a browser DOM (html-to-image).\n` +
              `Use the web UI to export as ${fmt}, or choose "markdown" or "mermaid" format.`,
          );
          process.exit(1);
        }

        const ctx = await loadContext(opts);
        const graph = ctx.getGraph();

        let content: string;
        switch (cmdOpts.type) {
          case 'mermaid':
            content = ctx.exportApi.generateMermaid(graph);
            break;
          case 'markdown':
          default:
            if (cmdOpts.withMermaid) {
              content = ctx.exportApi.generateSummaryWithMermaid(graph);
            } else {
              content = ctx.exportApi.generateMarkdownSummary(graph);
            }
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
}
