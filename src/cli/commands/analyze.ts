/**
 * CLI `analyze` Command
 *
 * Analyzes a codebase directory and produces a .archc architecture file.
 * This is the primary user-facing entry point for the codebase analysis feature.
 *
 * When an API key is available, uses the agentic loop engine (agentLoop.ts)
 * which lets Claude iteratively build the architecture via MCP tool calls.
 * When no API key is set, falls back to the structural-only analysis pipeline.
 *
 * Output defaults to .archcanvas/main.archc inside the analyzed directory,
 * consistent with the .archcanvas/ folder convention.
 *
 * Usage:
 *   archcanvas analyze <directory>
 *   archcanvas analyze ./my-project --output project.archc --depth deep --name "My App"
 *   archcanvas analyze . --dry-run --verbose
 */

import { Command } from 'commander';
import { type GlobalOptions, withErrorHandler, suppressDiagnosticLogs } from '@/cli/index';
import { ARCHCANVAS_DIR_NAME, ARCHCANVAS_MAIN_FILE } from '@/types/project';

interface AnalyzeCommandOptions {
  output?: string;
  name?: string;
  depth: string;
  dryRun: boolean;
  verbose: boolean;
  merge: boolean;
  strategy: string;
}

/** Analysis depth option (kept for backward compat) */
type AnalysisDepth = 'quick' | 'standard' | 'deep';

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
      `Output .archc file path (default: <directory>/${ARCHCANVAS_DIR_NAME}/${ARCHCANVAS_MAIN_FILE})`,
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

        // ─── Resolve output path ─────────────────────────────────
        // Default: .archcanvas/main.archc inside the analyzed directory
        const outputPath = cmdOpts.output
          ? path.resolve(cmdOpts.output)
          : path.join(resolvedDir, ARCHCANVAS_DIR_NAME, ARCHCANVAS_MAIN_FILE);

        // ─── Suppress diagnostic logs unless verbose ──────────────
        const restore = cmdOpts.verbose ? () => {} : suppressDiagnosticLogs();

        try {
          // ─── Merge mode ─────────────────────────────────────────
          if (cmdOpts.merge) {
            await handleMergeMode(resolvedDir, outputPath, analysisDepth, apiKey, cmdOpts, opts, fs);
            return;
          }

          // ─── Try agentic loop when API key is available ─────────
          if (apiKey && !cmdOpts.dryRun) {
            const agenticResult = await runAgenticAnalysis(
              resolvedDir,
              outputPath,
              apiKey,
              cmdOpts,
              opts,
              fs,
              path,
            );
            if (agenticResult) return; // Success — exit
            // If agentic analysis failed, fall through to legacy pipeline
          }

          // ─── Legacy pipeline (structural fallback or dry-run) ───
          await runLegacyPipeline(resolvedDir, outputPath, analysisDepth, apiKey, cmdOpts, opts);
        } finally {
          restore();
        }
      }),
    );
}

// ── Agentic Loop Analysis ────────────────────────────────────────────────────

/**
 * Run the agentic loop analysis: scan → detect → select → prompt → agent loop → save.
 * Returns true on success, false if setup/initialization fails (caller should fallback).
 * Throws on pipeline-level errors.
 */
async function runAgenticAnalysis(
  resolvedDir: string,
  outputPath: string,
  apiKey: string,
  cmdOpts: AnalyzeCommandOptions,
  opts: GlobalOptions,
  fsModule: typeof import('node:fs'),
  pathModule: typeof import('node:path'),
): Promise<boolean> {
  const startTime = Date.now();

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    // Import analysis modules
    const { scanDirectory } = await import('@/analyze/scanner');
    const { detectProject } = await import('@/analyze/detector');
    const { selectKeyFiles } = await import('@/analyze/fileSelector');
    const { buildSystemPrompt, buildUserPrompt } = await import(
      '@/ai/prompts/initArchitecture'
    );
    const { runAgentLoop } = await import('@/ai/agentLoop');
    const { TOOL_DEFINITIONS, dispatchToolCall } = await import('@/mcp/index');
    const { GraphContext } = await import('@/cli/context');

    const architectureName = cmdOpts.name ?? pathModule.basename(resolvedDir);

    // Phase 1: Scan
    if (!opts.quiet) console.error('[5%] Scanning files...');
    const scanResult = await scanDirectory(resolvedDir, { maxFiles: 10000, maxDepth: 10 });
    if (!opts.quiet) {
      console.error(
        `[15%] Scan complete: ${scanResult.totalFiles} files, ${scanResult.totalDirs} directories`,
      );
    }

    // Phase 2: Detect
    if (!opts.quiet) console.error('[20%] Detecting project type...');
    const projectProfile = detectProject(scanResult);
    if (!opts.quiet) {
      console.error(
        `[30%] Detection complete: ${projectProfile.projectType} project, ` +
          `${projectProfile.languages.length} languages, ${projectProfile.frameworks.length} frameworks`,
      );
    }

    // Phase 3: Select key files
    if (!opts.quiet) console.error('[35%] Selecting key files...');
    const keyFiles = selectKeyFiles(scanResult, projectProfile, {
      maxLinesPerFile: 500,
      totalTokenBudget: 100_000,
      rootDir: resolvedDir,
    });
    if (!opts.quiet) {
      console.error(
        `[45%] Selected ${keyFiles.files.length} key files (~${keyFiles.totalTokenEstimate} tokens)`,
      );
    }

    // Phase 4: Build agentic context
    if (!opts.quiet) console.error('[50%] Building agentic architecture...');

    // Create a fresh graph context
    const ctx = GraphContext.createNew(architectureName);
    const { textApi, registry } = ctx;

    // Build prompts
    const systemPrompt = buildSystemPrompt(registry);
    const userPrompt = buildUserPrompt({
      name: architectureName,
      directoryListing: buildDirectoryTree(scanResult),
      keyFiles: keyFiles.files.map((f) => ({ path: f.path, content: f.content })),
      languages: projectProfile.languages.map((l) => ({
        name: l.name,
        percentage: l.percentage,
      })),
      frameworks: projectProfile.frameworks.map((f) => f.name),
      infraSignals: projectProfile.infraSignals.map((s) => s.type),
    });

    // Build tool registry for the agentic loop
    // Cast RegistryManagerCore → RegistryManager (dispatchToolCall only uses
    // methods from RegistryManagerCore, so this is safe)
    const toolRegistry = buildCliToolRegistry(
      TOOL_DEFINITIONS,
      dispatchToolCall,
      textApi,
      registry as unknown as import('@/core/registry/registryManager').RegistryManager,
    );

    // Phase 5: Run agentic loop
    const depth = cmdOpts.depth ?? 'standard';
    const maxIter = depth === 'deep' ? 80 : depth === 'quick' ? 20 : 50;

    let toolCallCount = 0;
    const loopResult = await runAgentLoop({
      systemPrompt,
      userPrompt,
      client,
      toolRegistry,
      maxIterations: maxIter,
      onToolCall: (log) => {
        toolCallCount++;
        if (cmdOpts.verbose) {
          console.error(
            `       [tool] ${log.name}(${JSON.stringify(log.input).slice(0, 100)}) → ${log.isError ? 'ERROR' : 'ok'}`,
          );
        } else if (!opts.quiet && toolCallCount % 5 === 0) {
          // Show progress every 5 tool calls
          console.error(`[${Math.min(50 + toolCallCount, 90)}%] Building graph (${toolCallCount} tool calls)...`);
        }
      },
    });

    const graph = textApi.getGraph();
    const nodeCount = countNodes(graph);
    const edgeCount = graph.edges.length;
    const codeRefCount = countCodeRefs(graph);

    if (!opts.quiet) {
      console.error(
        `[92%] Agentic loop complete: ${loopResult.iterations} iterations, ${loopResult.toolCalls.length} tool calls`,
      );
    }

    if (loopResult.hitMaxIterations) {
      if (!opts.quiet) {
        console.error('  Warning: hit max iteration limit — graph may be incomplete');
      }
    }

    // Phase 6: Save
    if (!opts.quiet) console.error(`[95%] Saving to ${outputPath}...`);

    // Ensure .archcanvas/ directory exists
    const outputDir = pathModule.dirname(outputPath);
    if (!fsModule.existsSync(outputDir)) {
      fsModule.mkdirSync(outputDir, { recursive: true });
    }

    ctx.textApi.setGraph(graph);
    ctx.markModified();
    await ctx.saveAs(outputPath);

    // Generate sidecar
    try {
      await ctx.saveSidecar();
    } catch {
      // Sidecar generation is optional
    }

    const duration = Date.now() - startTime;

    // ─── Output results ──────────────────────────────────────
    if (opts.format === 'json') {
      console.log(
        JSON.stringify(
          {
            mode: 'agentic',
            outputPath,
            stats: { nodes: nodeCount, edges: edgeCount, codeRefs: codeRefCount },
            projectProfile: {
              projectType: projectProfile.projectType,
              languages: projectProfile.languages.map((l) => l.name),
              frameworks: projectProfile.frameworks.map((f) => f.name),
            },
            agentLoop: {
              iterations: loopResult.iterations,
              toolCalls: loopResult.toolCalls.length,
              hitMaxIterations: loopResult.hitMaxIterations,
            },
            warnings: loopResult.hitMaxIterations
              ? ['Hit max iteration limit — graph may be incomplete']
              : [],
            duration,
          },
          null,
          2,
        ),
      );
    } else if (!opts.quiet) {
      console.error('');
      console.error('=== Analysis Complete (agentic) ===');
      console.error(`  Nodes created:     ${nodeCount}`);
      console.error(`  Edges created:     ${edgeCount}`);
      console.error(`  Code refs linked:  ${codeRefCount}`);
      console.error(`  Tool calls:        ${loopResult.toolCalls.length}`);
      console.error(`  Iterations:        ${loopResult.iterations}`);
      console.error(`  Output file:       ${outputPath}`);
      console.error(`  Duration:          ${(duration / 1000).toFixed(1)}s`);
    }

    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!opts.quiet) {
      console.error(`Warning: Agentic analysis failed: ${msg}`);
      console.error('Falling back to structural-only analysis.');
    }
    return false;
  }
}

// ── Legacy Pipeline (structural fallback / dry-run) ──────────────────────────

async function runLegacyPipeline(
  resolvedDir: string,
  outputPath: string,
  analysisDepth: AnalysisDepth,
  apiKey: string | undefined,
  cmdOpts: AnalyzeCommandOptions,
  opts: GlobalOptions,
): Promise<void> {
  const { analyzeCodebase } = await import('@/analyze/pipeline');

  // Build AI sender for legacy single-shot inference (used in dry-run and no-API-key modes)
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

  // Progress reporting
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

    if (event.phase !== lastPhase) {
      lastPhase = event.phase;
      const label = phaseLabels[event.phase] ?? event.phase;

      if (event.phase === 'complete') return;

      const pctStr = `[${event.percent}%]`;
      console.error(`${pctStr} ${label}...`);
    }

    if (cmdOpts.verbose && event.message) {
      console.error(`       ${event.message}`);
    }
  };

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
    if (opts.format === 'json') {
      console.log(
        JSON.stringify(
          {
            mode: 'legacy',
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
      console.error('=== Analysis Complete (structural) ===');
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
}

// ── Merge Mode ───────────────────────────────────────────────────────────────

async function handleMergeMode(
  resolvedDir: string,
  outputPath: string,
  analysisDepth: AnalysisDepth,
  apiKey: string | undefined,
  cmdOpts: AnalyzeCommandOptions,
  opts: GlobalOptions,
  fsModule: typeof import('node:fs'),
): Promise<void> {
  const { analyzeCodebase } = await import('@/analyze/pipeline');

  // Build AI sender for merge mode inference
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
    } catch {
      // Fall through to pipeline without AI
    }
  }

  const result = await analyzeCodebase(resolvedDir, {
    outputPath,
    analysisDepth,
    architectureName: cmdOpts.name,
    dryRun: true, // Always dry-run in merge mode to get inference
    verbose: cmdOpts.verbose,
    aiSender,
    onProgress: () => {},
  });

  if (!result.inferenceResult) {
    throw new Error('Merge mode requires an inference result, but inference returned nothing.');
  }

  const validStrategies = ['ai-wins', 'manual-wins', 'prompt'];
  if (!validStrategies.includes(cmdOpts.strategy)) {
    throw new Error(
      `Invalid strategy "${cmdOpts.strategy}". Must be one of: ${validStrategies.join(', ')}`,
    );
  }

  if (!fsModule.existsSync(outputPath)) {
    throw new Error(
      `Merge mode requires an existing .archc file at: ${outputPath}\n` +
        `Run without --merge first to create the initial architecture.`,
    );
  }

  const { GraphContext } = await import('@/cli/context');
  const ctx = await GraphContext.loadFromFile(outputPath);
  const existingGraph = ctx.getGraph();

  const { mergeAnalysis, applyMerge } = await import('@/analyze/merge');
  const mergeResult = mergeAnalysis(existingGraph, result.inferenceResult, {
    conflictStrategy: cmdOpts.strategy as 'ai-wins' | 'manual-wins' | 'prompt',
    addChangeNotes: true,
  });

  const mergedGraph = applyMerge(existingGraph, mergeResult, {
    conflictStrategy: cmdOpts.strategy as 'ai-wins' | 'manual-wins' | 'prompt',
    addChangeNotes: true,
  });

  ctx.textApi.setGraph(mergedGraph);
  ctx.markModified();
  await ctx.save(true);

  try {
    await ctx.saveSidecar();
  } catch {
    // Sidecar generation is optional
  }

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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tools relevant for CLI analysis (same set as initWithAI) */
const INIT_TOOL_NAMES = new Set([
  'init_architecture',
  'add_node',
  'add_edge',
  'add_note',
  'add_code_ref',
  'update_node',
  'update_edge',
  'remove_node',
  'remove_edge',
  'remove_note',
  'describe',
  'search',
  'get_edges',
  'list_nodedefs',
  'export_markdown',
  'export_mermaid',
]);

/**
 * Build a tool registry for the CLI agentic loop.
 * Wires each tool's handler to dispatchToolCall with the current TextApi + registry.
 */
function buildCliToolRegistry(
  toolDefinitions: Record<string, { description: string; inputSchema: Record<string, import('zod').ZodTypeAny> }>,
  dispatchToolCallFn: typeof import('@/mcp/handlers').dispatchToolCall,
  textApi: import('@/api/textApi').TextApi,
  registry: import('@/core/registry/registryManager').RegistryManager,
): import('@/ai/agentLoop').ToolRegistry {
  const toolRegistry: import('@/ai/agentLoop').ToolRegistry = new Map();

  const ctx = { textApi, registry } as import('@/mcp/handlers').ToolHandlerContext;

  for (const [name, def] of Object.entries(toolDefinitions)) {
    if (!INIT_TOOL_NAMES.has(name)) continue;

    toolRegistry.set(name, {
      description: def.description,
      inputSchema: def.inputSchema,
      handler: (input: Record<string, unknown>) => {
        return dispatchToolCallFn(ctx, name, input);
      },
    });
  }

  return toolRegistry;
}

/**
 * Build a simple directory tree string from scan results.
 */
function buildDirectoryTree(scanResult: import('@/analyze/scanner').ScanResult): string {
  const lines: string[] = [];
  let count = 0;
  const maxEntries = 200;

  function walk(dir: import('@/analyze/scanner').DirectoryEntry, depth: number) {
    if (count >= maxEntries) return;

    for (const subDir of dir.directories) {
      if (count >= maxEntries) break;
      count++;
      const indent = '  '.repeat(depth);
      lines.push(`${indent}${subDir.name}/`);
      walk(subDir, depth + 1);
    }

    for (const file of dir.files) {
      if (count >= maxEntries) break;
      count++;
      const indent = '  '.repeat(depth);
      lines.push(`${indent}${file.name}`);
    }
  }

  const root = scanResult.fileTree?.root;
  if (!root) {
    return '(no directory listing available)';
  }

  walk(root, 0);

  if (count >= maxEntries) {
    lines.push(`  ... (truncated, ${scanResult.totalFiles} total files)`);
  }

  return lines.join('\n');
}

/**
 * Count nodes recursively in a graph.
 */
function countNodes(graph: import('@/types/graph').ArchGraph): number {
  let count = 0;
  const walk = (nodes: import('@/types/graph').ArchNode[]) => {
    for (const node of nodes) {
      count++;
      if (node.children) walk(node.children);
    }
  };
  walk(graph.nodes);
  return count;
}

/**
 * Count code refs recursively in a graph.
 */
function countCodeRefs(graph: import('@/types/graph').ArchGraph): number {
  let count = 0;
  const walk = (nodes: import('@/types/graph').ArchNode[]) => {
    for (const node of nodes) {
      count += node.codeRefs?.length ?? 0;
      if (node.children) walk(node.children);
    }
  };
  walk(graph.nodes);
  return count;
}
