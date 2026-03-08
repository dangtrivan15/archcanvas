/**
 * Built-in AI Initialization Flow (API key path)
 *
 * Orchestrates the full agentic architecture-building flow:
 *   1. Scan the project directory for files and structure
 *   2. Detect project type, frameworks, languages, infrastructure
 *   3. Select key files for context
 *   4. Build system + user prompts from initArchitecture.ts
 *   5. Wire MCP tool handlers to a fresh TextApi
 *   6. Run the agentic loop (agentLoop.ts) so Claude iteratively builds the graph
 *   7. Return the resulting ArchGraph with progress events throughout
 *
 * This module is the "API key path" - it uses the Anthropic SDK directly
 * (via runAgentLoop) rather than the passive inference engine.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { ArchGraph } from '@/types/graph';
import type { TextApi } from '@/api/textApi';
import type { RegistryManager } from '@/core/registry/registryManager';
import type { ScanResult, DirectoryEntry } from '@/analyze/scanner';
import type { ProjectProfile } from '@/analyze/detector';
import type { KeyFileSet } from '@/analyze/fileSelector';
import type { ToolCallLog, ToolRegistryEntry } from './agentLoop';
import type { ToolHandlerContext } from '@/mcp/handlers';

// ── Public types ──────────────────────────────────────────────────────────────

/** Progress event emitted during the initialization flow */
export interface InitWithAIProgress {
  /** Current phase of the initialization */
  phase: InitPhase;
  /** Human-readable status message */
  message: string;
  /** Overall progress percentage (0-100) */
  percent: number;
  /** Optional detail payload */
  detail?: Record<string, unknown>;
}

/** Phases of the AI initialization flow */
export type InitPhase =
  | 'scanning'
  | 'detecting'
  | 'selecting'
  | 'prompting'
  | 'building'
  | 'complete'
  | 'error';

/** Options for the AI initialization flow */
export interface InitWithAIOptions {
  /** FileSystemDirectoryHandle for the project folder */
  directoryHandle: FileSystemDirectoryHandle;
  /** Anthropic SDK client instance (already configured with API key) */
  client: Anthropic;
  /** TextApi instance - the agentic loop will mutate this to build the graph */
  textApi: TextApi;
  /** Registry for node type lookups */
  registry: RegistryManager;
  /** Architecture name (default: folder name) */
  architectureName?: string;
  /** Model to use (default: from aiConfig) */
  model?: string;
  /** Max tokens per response (default: 4096) */
  maxTokens?: number;
  /** Maximum agentic loop iterations (default: 50) */
  maxIterations?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Progress callback */
  onProgress?: (event: InitWithAIProgress) => void;
  /** Called after each tool call (for logging / UI updates) */
  onToolCall?: (log: ToolCallLog) => void;
}

/** Result of the AI initialization flow */
export interface InitWithAIResult {
  /** The built architecture graph */
  graph: ArchGraph;
  /** Statistics about what was created */
  stats: {
    nodes: number;
    edges: number;
    codeRefs: number;
  };
  /** Detected project profile */
  projectProfile: ProjectProfile;
  /** Log of all tool calls made during the agentic loop */
  toolCalls: ToolCallLog[];
  /** Number of agentic loop iterations */
  iterations: number;
  /** Whether the loop hit the max iteration guard */
  hitMaxIterations: boolean;
  /** Total duration in milliseconds */
  duration: number;
  /** Warnings collected during the flow */
  warnings: string[];
}

// ── Tool names exposed to the agentic loop ────────────────────────────────────

/**
 * The subset of MCP tools that are useful for architecture initialization.
 * We exclude file-system, save, and analysis tools (not relevant in-browser).
 */
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

// ── Main orchestration ────────────────────────────────────────────────────────

/**
 * Run the full AI-powered initialization flow.
 *
 * Scans the project directory, detects project characteristics, builds
 * prompts, and runs an agentic loop where Claude uses MCP tools to
 * iteratively construct a connected architecture graph.
 *
 * @returns InitWithAIResult with the built graph and metadata
 */
export async function initWithAI(options: InitWithAIOptions): Promise<InitWithAIResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    directoryHandle,
    client,
    textApi,
    registry,
    model,
    maxTokens,
    maxIterations,
    signal,
    onProgress,
    onToolCall,
  } = options;

  const architectureName = options.architectureName ?? directoryHandle.name;

  // Helper to emit progress events
  function emitProgress(
    phase: InitPhase,
    message: string,
    percent: number,
    detail?: Record<string, unknown>,
  ) {
    onProgress?.({ phase, message, percent, detail });
  }

  // ─── Phase 1: Scanning ────────────────────────────────────────────────

  emitProgress('scanning', `Scanning folder: ${directoryHandle.name}`, 5);
  checkAbort(signal);

  const { scanDirectoryBrowser } = await import('@/analyze/browserScanner');

  let scanResult: ScanResult;
  try {
    scanResult = await scanDirectoryBrowser(
      directoryHandle,
      { maxFiles: 10_000, maxDepth: 10 },
      signal,
    );
  } catch (e) {
    throw new Error(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'scanning',
    `Scan complete: ${scanResult.totalFiles} files, ${scanResult.totalDirs} directories`,
    15,
    { totalFiles: scanResult.totalFiles, totalDirs: scanResult.totalDirs },
  );

  // ─── Phase 2: Detecting ───────────────────────────────────────────────

  emitProgress('detecting', 'Detecting project type, frameworks, and infrastructure...', 20);
  checkAbort(signal);

  const { detectProject } = await import('@/analyze/detector');

  let projectProfile: ProjectProfile;
  try {
    projectProfile = detectProject(scanResult);
  } catch (e) {
    throw new Error(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'detecting',
    `Detection complete: ${projectProfile.projectType} project, ${projectProfile.frameworks.length} frameworks`,
    30,
    {
      projectType: projectProfile.projectType,
      languages: projectProfile.languages.map((l) => l.name),
      frameworks: projectProfile.frameworks.map((f) => f.name),
    },
  );

  // ─── Phase 3: Selecting key files ─────────────────────────────────────

  emitProgress('selecting', 'Selecting architecturally significant files...', 35);
  checkAbort(signal);

  const { selectKeyFilesBrowser } = await import('@/analyze/browserFileSelector');

  let keyFiles: KeyFileSet;
  try {
    keyFiles = await selectKeyFilesBrowser(scanResult, projectProfile, directoryHandle, {
      maxLinesPerFile: 500,
      totalTokenBudget: 100_000,
    });
  } catch (e) {
    throw new Error(`File selection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'selecting',
    `Selected ${keyFiles.files.length} key files (~${keyFiles.totalTokenEstimate} tokens)`,
    40,
    { selectedFiles: keyFiles.files.length, tokenEstimate: keyFiles.totalTokenEstimate },
  );

  // ─── Phase 4: Build prompts & run agentic loop ────────────────────────

  emitProgress('prompting', 'Building prompts and starting AI agent...', 45);
  checkAbort(signal);

  const { buildSystemPrompt, buildUserPrompt } = await import('@/ai/prompts/initArchitecture');
  const { runAgentLoop } = await import('@/ai/agentLoop');
  const { TOOL_DEFINITIONS } = await import('@/mcp/tools');
  const { dispatchToolCall } = await import('@/mcp/handlers');

  // Build project metadata for the user prompt
  const projectMetadata = buildProjectMetadata(
    architectureName,
    scanResult,
    projectProfile,
    keyFiles,
  );

  const systemPrompt = buildSystemPrompt(registry);
  const userPrompt = buildUserPrompt(projectMetadata);

  // Build the tool registry: wire MCP tool definitions to handlers
  const toolHandlerContext: ToolHandlerContext = { textApi, registry };
  const toolRegistry = buildToolRegistry(TOOL_DEFINITIONS, toolHandlerContext, dispatchToolCall);

  // Track node/edge creation for progress updates
  let nodesCreated = 0;
  let edgesCreated = 0;
  let codeRefsLinked = 0;

  emitProgress('building', 'AI agent is building the architecture graph...', 50);

  const result = await runAgentLoop({
    systemPrompt,
    userPrompt,
    client,
    toolRegistry,
    model,
    maxTokens,
    maxIterations,
    signal,
    onToolCall: (log) => {
      // Track creation stats from successful tool calls
      if (!log.isError) {
        if (log.name === 'add_node') nodesCreated++;
        else if (log.name === 'add_edge') edgesCreated++;
        else if (log.name === 'add_code_ref') codeRefsLinked++;
      }

      // Emit progress with tool call info
      const totalCalls = nodesCreated + edgesCreated + codeRefsLinked;
      const buildPercent = Math.min(50 + Math.round(totalCalls * 1.5), 95);
      emitProgress(
        'building',
        `AI agent working: ${nodesCreated} nodes, ${edgesCreated} edges, ${codeRefsLinked} code refs`,
        buildPercent,
        {
          toolName: log.name,
          nodesCreated,
          edgesCreated,
          codeRefsLinked,
          isError: log.isError,
        },
      );

      // Forward to caller's onToolCall if provided
      onToolCall?.(log);
    },
  });

  if (result.hitMaxIterations) {
    warnings.push(
      `Agent loop terminated after ${result.iterations} iterations (max iteration guard). ` +
      `Graph may be incomplete.`,
    );
  }

  // Collect error tool calls as warnings
  for (const call of result.toolCalls) {
    if (call.isError) {
      warnings.push(`Tool error (${call.name}): ${call.result}`);
    }
  }

  // ─── Complete ──────────────────────────────────────────────────────────

  const graph = textApi.getGraph();
  const duration = Date.now() - startTime;

  // Recount from the actual graph (more accurate than incrementing counters)
  const actualNodes = graph.nodes.length;
  const actualEdges = graph.edges.length;
  const actualCodeRefs = graph.nodes.reduce(
    (sum, n) => sum + (n.codeRefs?.length ?? 0),
    0,
  );

  emitProgress(
    'complete',
    `AI initialization complete in ${(duration / 1000).toFixed(1)}s: ${actualNodes} nodes, ${actualEdges} edges`,
    100,
    {
      nodes: actualNodes,
      edges: actualEdges,
      codeRefs: actualCodeRefs,
      iterations: result.iterations,
      duration,
    },
  );

  return {
    graph,
    stats: {
      nodes: actualNodes,
      edges: actualEdges,
      codeRefs: actualCodeRefs,
    },
    projectProfile,
    toolCalls: result.toolCalls,
    iterations: result.iterations,
    hitMaxIterations: result.hitMaxIterations,
    duration,
    warnings,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if the signal has been aborted and throw if so.
 */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Pipeline aborted');
  }
}

/**
 * Build ProjectMetadata from scan results for the user prompt.
 */
function buildProjectMetadata(
  name: string,
  scanResult: ScanResult,
  profile: ProjectProfile,
  keyFiles: KeyFileSet,
) {
  // Build a flat directory listing from the scan result
  const directoryListing = buildDirectoryListing(scanResult);

  // Convert KeyFileSet files to KeyFileContent format
  const keyFileContents = keyFiles.files.map((f) => ({
    path: f.path,
    content: f.content,
  }));

  return {
    name,
    directoryListing,
    keyFiles: keyFileContents,
    languages: profile.languages.map((l) => ({
      name: l.name,
      percentage: l.percentage,
    })),
    frameworks: profile.frameworks.map((f) => f.name),
    infraSignals: profile.infraSignals.map((s) => s.type),
  };
}

/**
 * Build a simple directory listing string from a ScanResult's file tree.
 */
function buildDirectoryListing(scanResult: ScanResult): string {
  const lines: string[] = [];

  function walkDir(dir: DirectoryEntry, prefix: string) {
    // Combine files and subdirectories into a sorted list
    const entries: Array<{ name: string; isDir: boolean }> = [
      ...dir.files.map((f) => ({ name: f.name, isDir: false })),
      ...dir.directories.map((d) => ({ name: d.name, isDir: true })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
      lines.push(`${prefix}${connector}${entry.name}${entry.isDir ? '/' : ''}`);

      if (entry.isDir) {
        const childPrefix = prefix + (isLast ? '    ' : '\u2502   ');
        // Limit depth to keep listing manageable
        if (childPrefix.length < 40) {
          const subDir = dir.directories.find((d) => d.name === entry.name);
          if (subDir) {
            walkDir(subDir, childPrefix);
          }
        }
      }
    });
  }

  if (scanResult.fileTree) {
    walkDir(scanResult.fileTree.root, '');
  }

  return lines.length > 0 ? lines.join('\n') : '(no directory listing available)';
}

/**
 * Build a ToolRegistry from TOOL_DEFINITIONS, wiring each tool to the
 * dispatchToolCall function with the given handler context.
 *
 * Only includes tools in INIT_TOOL_NAMES (excludes save, analyze_codebase, file_info).
 */
function buildToolRegistry(
  toolDefs: typeof import('@/mcp/tools').TOOL_DEFINITIONS,
  ctx: ToolHandlerContext,
  dispatch: typeof import('@/mcp/handlers').dispatchToolCall,
): Map<string, ToolRegistryEntry> {
  const reg = new Map<string, ToolRegistryEntry>();

  for (const [key, def] of Object.entries(toolDefs)) {
    if (!INIT_TOOL_NAMES.has(key)) continue;

    reg.set(def.name, {
      description: def.description,
      inputSchema: def.inputSchema,
      handler: (input: Record<string, unknown>) => {
        return dispatch(ctx, def.name, input);
      },
    });
  }

  return reg;
}
