/**
 * CLI `analyze` Command
 *
 * Analyzes a codebase directory and produces a .archc architecture file.
 * This is the primary user-facing entry point for the codebase analysis feature.
 *
 * Usage:
 *   archcanvas analyze <directory>
 *   archcanvas analyze ./my-project --output project.archc --depth deep --name "My App"
 *   archcanvas analyze . --dry-run --verbose
 */

import { Command } from 'commander';
import { type GlobalOptions, withErrorHandler, suppressDiagnosticLogs } from '@/cli/index';
import type { AnalysisDepth } from '@/analyze/inferEngine';

interface AnalyzeCommandOptions {
  output?: string;
  name?: string;
  depth: string;
  dryRun: boolean;
  verbose: boolean;
  merge: boolean;
  strategy: string;
}

/**
 * Register the `analyze` subcommand on the given Commander program.
 */
export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze a codebase and produce a .archc architecture file')
    .argument('<directory>', 'Directory to analyze')
    .option(
      '-o, --output <path>',
      'Output .archc file path (default: <directory>/architecture.archc)',
    )
    .option('-n, --name <name>', 'Architecture name (default: directory name)')
    .option('-d, --depth <depth>', 'Analysis depth: quick, standard, or deep', 'standard')
    .option('--dry-run', 'Print inference result without saving to file', false)
    .option('--verbose', 'Show detailed logging for each pipeline phase', false)
    .option(
      '--merge',
      'Merge new analysis into an existing .archc file instead of generating from scratch',
      false,
    )
    .option(
      '--strategy <strategy>',
      'Conflict resolution strategy for merge: ai-wins, manual-wins, or prompt',
      'manual-wins',
    )
    .action(
      withErrorHandler(async (directory: string, cmdOpts: AnalyzeCommandOptions) => {
        const opts = program.opts<GlobalOptions>();
        const fs = await import('node:fs');
        const path = await import('node:path');

        // ─── Validate directory ────────────────────────────────────
        const resolvedDir = path.resolve(directory);
        if (!fs.existsSync(resolvedDir)) {
          throw new Error(`Directory not found: ${resolvedDir}`);
        }
        const stat = fs.statSync(resolvedDir);
        if (!stat.isDirectory()) {
          throw new Error(`Not a directory: ${resolvedDir}`);
        }

        // ─── Validate depth ───────────────────────────────────────
        const validDepths = ['quick', 'standard', 'deep'];
        if (!validDepths.includes(cmdOpts.depth)) {
          throw new Error(
            `Invalid depth "${cmdOpts.depth}". Must be one of: ${validDepths.join(', ')}`,
          );
        }
        const analysisDepth = cmdOpts.depth as AnalysisDepth;

        // ─── Check for AI API key ─────────────────────────────────
        const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;

        if (!apiKey) {
          if (!opts.quiet) {
            console.error(
              'Warning: ANTHROPIC_API_KEY / VITE_ANTHROPIC_API_KEY not set. ' +
                'AI inference will be skipped; using structural-only analysis.',
            );
          }
        }

        // ─── Build AI sender (if key available) ───────────────────
        let aiSender: import('@/analyze/inferEngine').AIMessageSender | undefined;

        if (apiKey) {
          try {
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const client = new Anthropic({ apiKey });

            aiSender = {
              async sendMessage(options: {
                messages: Array<{ role: 'user' | 'assistant'; content: string }>;
                system?: string;
                maxTokens?: number;
                stream?: boolean;
                onChunk?: (text: string) => void;
                signal?: AbortSignal;
              }): Promise<{
                content: string;
                stopReason: string | null;
                usage: { inputTokens: number; outputTokens: number };
              }> {
                const response = await client.messages.create({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: options.maxTokens ?? 8192,
                  system: options.system ?? '',
                  messages: options.messages,
                });
                // Extract text from the response
                const textBlock = response.content.find((b) => b.type === 'text');
                return {
                  content: textBlock ? textBlock.text : '',
                  stopReason: response.stop_reason,
                  usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                  },
                };
              },
            };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!opts.quiet) {
              console.error(`Warning: Failed to initialize AI client: ${msg}`);
              console.error('Falling back to structural-only analysis.');
            }
          }
        }

        // ─── Suppress diagnostic logs unless verbose ──────────────
        const restore = cmdOpts.verbose ? () => {} : suppressDiagnosticLogs();

        try {
          // ─── Import pipeline ───────────────────────────────────
          const { analyzeCodebase } = await import('@/analyze/pipeline');

          // ─── Resolve output path ───────────────────────────────
          const outputPath = cmdOpts.output
            ? path.resolve(cmdOpts.output)
            : path.join(resolvedDir, 'architecture.archc');

          // ─── Progress reporting ────────────────────────────────
          const phaseLabels: Record<string, string> = {
            scanning: 'Scanning files',
            detecting: 'Detecting project type',
            selecting: 'Selecting key files',
            inferring: 'Analyzing architecture',
            building: 'Building graph',
            saving: 'Saving .archc file',
            complete: 'Complete',
          };

          let lastPhase = '';

          const onProgress = (event: import('@/analyze/pipeline').AnalyzeProgress) => {
            if (opts.quiet) return;

            // Only print phase transitions (avoid flooding for sub-progress)
            if (event.phase !== lastPhase) {
              lastPhase = event.phase;
              const label = phaseLabels[event.phase] ?? event.phase;

              if (event.phase === 'complete') {
                // Complete is printed separately below
                return;
              }

              // Use simple text progress output
              const pctStr = `[${event.percent}%]`;
              console.error(`${pctStr} ${label}...`);
            }

            // In verbose mode, also print sub-messages
            if (cmdOpts.verbose && event.message) {
              console.error(`       ${event.message}`);
            }
          };

          // ─── Merge mode: load existing .archc ─────────────────
          if (cmdOpts.merge) {
            // In merge mode, we run the pipeline in dry-run to get inference,
            // then merge into existing graph
            const result = await analyzeCodebase(resolvedDir, {
              outputPath,
              analysisDepth,
              architectureName: cmdOpts.name,
              dryRun: true, // Always dry-run in merge mode to get inference
              verbose: cmdOpts.verbose,
              aiSender,
              onProgress,
            });

            if (!result.inferenceResult) {
              throw new Error(
                'Merge mode requires an inference result, but inference returned nothing.',
              );
            }

            // Validate strategy
            const validStrategies = ['ai-wins', 'manual-wins', 'prompt'];
            if (!validStrategies.includes(cmdOpts.strategy)) {
              throw new Error(
                `Invalid strategy "${cmdOpts.strategy}". Must be one of: ${validStrategies.join(', ')}`,
              );
            }

            // Load existing .archc file
            if (!fs.existsSync(outputPath)) {
              throw new Error(
                `Merge mode requires an existing .archc file at: ${outputPath}\n` +
                  `Run without --merge first to create the initial architecture.`,
              );
            }

            const { GraphContext } = await import('@/cli/context');
            const ctx = await GraphContext.loadFromFile(outputPath);
            const existingGraph = ctx.getGraph();

            // Merge
            const { mergeAnalysis, applyMerge } = await import('@/analyze/merge');
            const mergeResult = mergeAnalysis(existingGraph, result.inferenceResult, {
              conflictStrategy: cmdOpts.strategy as 'ai-wins' | 'manual-wins' | 'prompt',
              addChangeNotes: true,
            });

            // Apply merge to get the new graph
            const mergedGraph = applyMerge(existingGraph, mergeResult, {
              conflictStrategy: cmdOpts.strategy as 'ai-wins' | 'manual-wins' | 'prompt',
              addChangeNotes: true,
            });

            // Save the merged graph
            ctx.textApi.setGraph(mergedGraph);
            ctx.markModified();
            await ctx.save(true);

            // Generate sidecar
            try {
              await ctx.saveSidecar();
            } catch {
              // Sidecar generation is optional
            }

            // ─── Output merge results ─────────────────────────────
            const { summary } = mergeResult;

            if (opts.format === 'json') {
              console.log(
                JSON.stringify(
                  {
                    mode: 'merge',
                    outputPath,
                    summary,
                    warnings: [...result.warnings, ...mergeResult.warnings],
                    duration: result.duration,
                  },
                  null,
                  2,
                ),
              );
            } else if (!opts.quiet) {
              console.error('');
              console.error('=== Merge Complete ===');
              console.error(`  Nodes matched:     ${summary.nodesMatched}`);
              console.error(`  Nodes added:       ${summary.nodesAdded}`);
              console.error(`  Nodes flagged:     ${summary.nodesFlagged} (possibly removed)`);
              console.error(`  Edges added:       ${summary.edgesAdded}`);
              console.error(`  Edges flagged:     ${summary.edgesFlagged} (possibly removed)`);
              console.error(`  Edges preserved:   ${summary.edgesPreserved}`);
              console.error(`  Type changes:      ${summary.typeChanges}`);
              console.error(`  Code ref updates:  ${summary.codeRefUpdates}`);
              console.error(`  Strategy:          ${cmdOpts.strategy}`);
              console.error(`  Output file:       ${outputPath}`);
              console.error(`  Duration:          ${(result.duration / 1000).toFixed(1)}s`);

              const allWarnings = [...result.warnings, ...mergeResult.warnings];
              if (allWarnings.length > 0) {
                console.error('');
                console.error(`  Warnings (${allWarnings.length}):`);
                for (const w of allWarnings) {
                  console.error(`    - ${w}`);
                }
              }
            }

            return; // Exit early — merge mode handled
          }

          // ─── Run pipeline (non-merge mode) ─────────────────────
          const result = await analyzeCodebase(resolvedDir, {
            outputPath,
            analysisDepth,
            architectureName: cmdOpts.name,
            dryRun: cmdOpts.dryRun,
            verbose: cmdOpts.verbose,
            aiSender,
            onProgress,
          });

          // ─── Output results ────────────────────────────────────

          if (cmdOpts.dryRun) {
            // Dry-run: print inference result
            if (opts.format === 'json') {
              console.log(
                JSON.stringify(
                  {
                    dryRun: true,
                    stats: result.stats,
                    projectProfile: {
                      projectType: result.projectProfile.projectType,
                      languages: result.projectProfile.languages.map((l) => l.name),
                      frameworks: result.projectProfile.frameworks.map((f) => f.name),
                    },
                    inferenceResult: result.inferenceResult,
                    warnings: result.warnings,
                    duration: result.duration,
                  },
                  null,
                  2,
                ),
              );
            } else {
              if (!opts.quiet) {
                console.error('');
                console.error('=== Dry Run Results ===');
                console.error(`Project type: ${result.projectProfile.projectType}`);
                console.error(
                  `Languages: ${result.projectProfile.languages.map((l) => l.name).join(', ')}`,
                );
                console.error(
                  `Frameworks: ${result.projectProfile.frameworks.map((f) => f.name).join(', ') || '(none detected)'}`,
                );
                console.error('');
              }
              console.log(JSON.stringify(result.inferenceResult, null, 2));
            }
          } else {
            // Normal mode: print summary
            if (opts.format === 'json') {
              console.log(
                JSON.stringify(
                  {
                    outputPath: result.outputPath,
                    stats: result.stats,
                    projectProfile: {
                      projectType: result.projectProfile.projectType,
                      languages: result.projectProfile.languages.map((l) => l.name),
                      frameworks: result.projectProfile.frameworks.map((f) => f.name),
                    },
                    warnings: result.warnings,
                    duration: result.duration,
                  },
                  null,
                  2,
                ),
              );
            } else if (!opts.quiet) {
              console.error('');
              console.error('=== Analysis Complete ===');
              console.error(`  Nodes created:     ${result.stats.nodes}`);
              console.error(`  Edges created:     ${result.stats.edges}`);
              console.error(`  Code refs linked:  ${result.stats.codeRefs}`);
              console.error(`  Output file:       ${result.outputPath}`);
              console.error(`  Duration:          ${(result.duration / 1000).toFixed(1)}s`);

              if (result.warnings.length > 0) {
                console.error('');
                console.error(`  Warnings (${result.warnings.length}):`);
                for (const w of result.warnings) {
                  console.error(`    - ${w}`);
                }
              }
            }
          }
        } finally {
          restore();
        }
      }),
    );
}
