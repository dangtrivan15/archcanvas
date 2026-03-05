/**
 * Analysis Pipeline Orchestrator
 *
 * Orchestrates the full codebase-to-archc pipeline:
 *   scan -> detect -> select -> infer -> build -> save
 *
 * Provides a single high-level function `analyzeCodebase()` that takes a
 * directory path and options, runs all steps in sequence, and produces a
 * .archc file. Emits progress events for each phase so CLI and MCP
 * consumers can report status. Handles errors gracefully with partial
 * results (e.g., if AI inference fails, still save what was detected
 * structurally).
 */

import * as path from 'node:path';
import { scanDirectory, type ScanResult, type ScanOptions } from './scanner';
import { detectProject, type ProjectProfile, type DetectedFramework } from './detector';
import { selectKeyFiles, type KeyFileSet, type FileSelectionOptions } from './fileSelector';
import {
  inferArchitecture,
  type InferenceResult,
  type InferenceOptions,
  type AIMessageSender,
  type AnalysisDepth,
  InferenceError,
} from './inferEngine';
import { buildGraph, type BuildResult, type BuildGraphOptions } from './graphBuilder';

// ── Types ────────────────────────────────────────────────────────────────────

/** Pipeline phase names */
export type PipelinePhase =
  | 'scanning'
  | 'detecting'
  | 'selecting'
  | 'inferring'
  | 'building'
  | 'saving'
  | 'complete';

/** Progress event emitted during pipeline execution */
export interface AnalyzeProgress {
  phase: PipelinePhase;
  message: string;
  /** 0-100 overall progress percentage */
  percent: number;
  /** Phase-specific data (e.g., file counts, node counts) */
  detail?: Record<string, unknown>;
}

/** Options for the analysis pipeline */
export interface AnalyzeOptions {
  /** Output path for the .archc file (default: <rootPath>/architecture.archc) */
  outputPath?: string;
  /** Analysis depth: 'quick' (single AI prompt), 'standard' (multi-step), 'deep' (refinement) */
  analysisDepth?: AnalysisDepth;
  /** Maximum files to scan (default: 10000) */
  maxFiles?: number;
  /** Maximum token budget for file content sent to AI (default: 100000) */
  maxTokenBudget?: number;
  /** Architecture name (default: derived from directory name) */
  architectureName?: string;
  /** Whether to include AI-generated notes on nodes (default: true) */
  includeNotes?: boolean;
  /** If true, return the inference result without writing files */
  dryRun?: boolean;
  /** If true, log each step's input/output for debugging */
  verbose?: boolean;
  /** Callback for progress events */
  onProgress?: (event: AnalyzeProgress) => void;
  /** AI message sender (required unless dryRun with no infer step) */
  aiSender?: AIMessageSender;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/** Result of the analysis pipeline */
export interface AnalyzeResult {
  /** Output file path (undefined in dry-run mode) */
  outputPath?: string;
  /** Statistics about what was created */
  stats: {
    nodes: number;
    edges: number;
    codeRefs: number;
  };
  /** Detected project profile */
  projectProfile: ProjectProfile;
  /** Warnings collected during the pipeline */
  warnings: string[];
  /** Total pipeline duration in milliseconds */
  duration: number;
  /** The inference result (available in dry-run mode) */
  inferenceResult?: InferenceResult;
}

// ── Structural Fallback ──────────────────────────────────────────────────────

/**
 * Build a structural-only inference result from detected project profile.
 * Used when AI inference fails — creates nodes from detected frameworks,
 * languages, data stores, and infra signals. No AI-inferred edges.
 */
function buildStructuralFallback(
  profile: ProjectProfile,
  architectureName: string,
): InferenceResult {
  const nodes: InferenceResult['nodes'] = [];
  let nodeIndex = 0;

  // Create nodes from detected frameworks
  for (const fw of profile.frameworks) {
    if (fw.confidence === 'low') continue; // skip low-confidence detections
    const id = `structural-${nodeIndex++}`;
    const type = frameworkToNodeType(fw);
    nodes.push({
      id,
      type,
      displayName: fw.name,
      description: `Detected ${fw.name} framework (${fw.confidence} confidence, evidence: ${fw.evidence})`,
      codeRefs: fw.evidence ? [{ path: fw.evidence, role: 'CONFIG' }] : [],
      children: [],
    });
  }

  // Create nodes from detected data stores
  for (const ds of profile.dataStores) {
    const id = `structural-${nodeIndex++}`;
    nodes.push({
      id,
      type: 'database',
      displayName: ds.type,
      description: `Detected ${ds.type} data store (evidence: ${ds.evidence})`,
      codeRefs: ds.evidence ? [{ path: ds.evidence, role: 'CONFIG' }] : [],
      children: [],
    });
  }

  // Create nodes from detected infra signals
  for (const sig of profile.infraSignals) {
    if (sig.type.startsWith('ci-')) continue; // skip CI signals (not architecture nodes)
    const id = `structural-${nodeIndex++}`;
    const type = infraSignalToNodeType(sig.type);
    if (!type) continue;
    nodes.push({
      id,
      type,
      displayName: sig.type,
      description: `Detected ${sig.type} infrastructure (evidence: ${sig.evidence})`,
      codeRefs: sig.evidence ? [{ path: sig.evidence, role: 'DEPLOYMENT' }] : [],
      children: [],
    });
  }

  // If no nodes detected at all, add a generic service node
  if (nodes.length === 0) {
    nodes.push({
      id: 'structural-app',
      type: 'service',
      displayName: architectureName,
      description: 'Main application (no specific architecture detected)',
      codeRefs: profile.entryPoints.map(ep => ({ path: ep, role: 'SOURCE' as const })),
      children: [],
    });
  }

  return {
    architectureName,
    architectureDescription: `Structural analysis of ${architectureName} (${profile.projectType} project)`,
    nodes,
    edges: [], // No edges in structural-only mode
  };
}

/**
 * Map a detected framework to an ArchCanvas node type.
 */
function frameworkToNodeType(fw: DetectedFramework): string {
  const name = fw.name.toLowerCase();
  if (['next.js', 'nuxt', 'sveltekit', 'remix', 'astro', 'gatsby', 'angular', 'react', 'vue', 'svelte'].includes(name) || name === 'next.js') {
    return 'web-app';
  }
  if (['expo', 'capacitor'].includes(name)) {
    return 'mobile-app';
  }
  if (['express', 'fastapi', 'flask', 'django', 'rails', 'gin', 'spring boot', 'actix web'].includes(name)) {
    return 'service';
  }
  if (['serverless framework'].includes(name)) {
    return 'function';
  }
  if (['aws cdk', 'pulumi', 'terraform'].includes(name)) {
    return 'service'; // infra-as-code, closest to service
  }
  return 'service';
}

/**
 * Map an infra signal type to an ArchCanvas node type (or null if not applicable).
 */
function infraSignalToNodeType(signalType: string): string | null {
  switch (signalType) {
    case 'docker':
    case 'docker-compose':
      return 'container';
    case 'kubernetes':
      return 'container';
    case 'terraform':
      return null; // IaC, not a runtime component
    default:
      return null;
  }
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Run the full codebase analysis pipeline.
 *
 * Pipeline stages:
 *   1. **Scanning**: Walk the filesystem, collect file metadata
 *   2. **Detecting**: Identify languages, frameworks, project type, infra signals
 *   3. **Selecting**: Choose architecturally significant files, extract content
 *   4. **Inferring**: Send to AI for architecture inference (or structural fallback)
 *   5. **Building**: Convert inference result to ArchCanvas graph via TextApi
 *   6. **Saving**: Write .archc binary file and .summary.md sidecar
 *
 * If AI inference fails, the pipeline falls back to structural-only analysis
 * using detector results (nodes from detected services/packages, no AI-inferred edges).
 *
 * @param rootPath - Directory to analyze
 * @param options - Pipeline configuration
 * @returns AnalyzeResult with output path, stats, profile, warnings, and duration
 */
export async function analyzeCodebase(
  rootPath: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    analysisDepth = 'standard',
    maxFiles = 10000,
    maxTokenBudget = 100_000,
    includeNotes = true,
    dryRun = false,
    verbose = false,
    onProgress,
    aiSender,
    signal,
  } = options;

  const resolvedRoot = path.resolve(rootPath);
  const architectureName = options.architectureName ?? path.basename(resolvedRoot);
  const outputPath = options.outputPath ?? path.join(resolvedRoot, 'architecture.archc');

  function emitProgress(phase: PipelinePhase, message: string, percent: number, detail?: Record<string, unknown>) {
    if (verbose) {
      console.log(`[pipeline:${phase}] ${message}`, detail ? JSON.stringify(detail) : '');
    }
    onProgress?.({ phase, message, percent, detail });
  }

  // ─── Phase 1: Scanning ────────────────────────────────────────

  emitProgress('scanning', `Scanning directory: ${resolvedRoot}`, 5);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  const scanOptions: ScanOptions = {
    maxFiles,
    maxDepth: 10,
  };

  let scanResult: ScanResult;
  try {
    scanResult = await scanDirectory(resolvedRoot, scanOptions);
  } catch (e) {
    throw new Error(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress('scanning', `Scan complete: ${scanResult.totalFiles} files, ${scanResult.totalDirs} directories`, 15, {
    totalFiles: scanResult.totalFiles,
    totalDirs: scanResult.totalDirs,
    languageCount: Object.keys(scanResult.languageBreakdown).length,
  });

  if (verbose) {
    console.log('[pipeline:scanning] Language breakdown:', scanResult.languageBreakdown);
  }

  // ─── Phase 2: Detecting ───────────────────────────────────────

  emitProgress('detecting', 'Detecting project type, frameworks, and infrastructure...', 20);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  let projectProfile: ProjectProfile;
  try {
    projectProfile = detectProject(scanResult);
  } catch (e) {
    throw new Error(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress('detecting', `Detection complete: ${projectProfile.projectType} project, ${projectProfile.languages.length} languages, ${projectProfile.frameworks.length} frameworks`, 30, {
    projectType: projectProfile.projectType,
    languages: projectProfile.languages.map(l => l.name),
    frameworks: projectProfile.frameworks.map(f => f.name),
    dataStores: projectProfile.dataStores.map(d => d.type),
    infraSignals: projectProfile.infraSignals.map(s => s.type),
  });

  if (verbose) {
    console.log('[pipeline:detecting] Project profile:', JSON.stringify(projectProfile, null, 2));
  }

  // ─── Phase 3: Selecting ───────────────────────────────────────

  emitProgress('selecting', 'Selecting architecturally significant files...', 35);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  const selectionOptions: FileSelectionOptions = {
    maxLinesPerFile: 500,
    totalTokenBudget: maxTokenBudget,
    rootDir: resolvedRoot,
  };

  let keyFiles: KeyFileSet;
  try {
    keyFiles = selectKeyFiles(scanResult, projectProfile, selectionOptions);
  } catch (e) {
    throw new Error(`File selection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress('selecting', `Selected ${keyFiles.files.length} key files (~${keyFiles.totalTokenEstimate} tokens)`, 45, {
    selectedFiles: keyFiles.files.length,
    tokenEstimate: keyFiles.totalTokenEstimate,
    tiers: {
      tier1: keyFiles.files.filter(f => f.tier === 1).length,
      tier2: keyFiles.files.filter(f => f.tier === 2).length,
      tier3: keyFiles.files.filter(f => f.tier === 3).length,
      tier4: keyFiles.files.filter(f => f.tier === 4).length,
    },
  });

  if (verbose) {
    console.log('[pipeline:selecting] Selected files:', keyFiles.files.map(f => `${f.path} (tier ${f.tier})`));
  }

  // ─── Phase 4: Inferring ───────────────────────────────────────

  emitProgress('inferring', `Running AI inference (${analysisDepth} mode)...`, 50);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  let inferenceResult: InferenceResult;
  let usedFallback = false;

  if (aiSender) {
    try {
      const inferenceOptions: InferenceOptions = {
        depth: analysisDepth,
        signal,
        onProgress: (event) => {
          // Map inference progress to pipeline progress (50-75%)
          const inferPercent = 50 + Math.round((event.step / event.totalSteps) * 25);
          emitProgress('inferring', event.description, inferPercent);
        },
      };

      inferenceResult = await inferArchitecture(aiSender, projectProfile, keyFiles, inferenceOptions);

      emitProgress('inferring', `Inference complete: ${inferenceResult.nodes.length} nodes, ${inferenceResult.edges.length} edges`, 75, {
        nodes: inferenceResult.nodes.length,
        edges: inferenceResult.edges.length,
        architectureName: inferenceResult.architectureName,
      });
    } catch (e) {
      // AI inference failed — fall back to structural analysis
      const errorMsg = e instanceof InferenceError
        ? `${e.code}: ${e.message}`
        : (e instanceof Error ? e.message : String(e));

      warnings.push(`AI inference failed (falling back to structural analysis): ${errorMsg}`);
      emitProgress('inferring', `AI inference failed, using structural fallback: ${errorMsg}`, 75);

      inferenceResult = buildStructuralFallback(projectProfile, architectureName);
      usedFallback = true;
    }
  } else {
    // No AI sender provided — use structural fallback
    warnings.push('No AI sender provided — using structural-only analysis');
    emitProgress('inferring', 'No AI sender provided, using structural fallback', 75);
    inferenceResult = buildStructuralFallback(projectProfile, architectureName);
    usedFallback = true;
  }

  // Override architecture name if user specified one
  if (options.architectureName) {
    inferenceResult.architectureName = options.architectureName;
  }

  if (verbose) {
    console.log('[pipeline:inferring] Inference result:', JSON.stringify(inferenceResult, null, 2));
    if (usedFallback) {
      console.log('[pipeline:inferring] Used structural fallback (no AI)');
    }
  }

  // If dry-run, return early
  if (dryRun) {
    const duration = Date.now() - startTime;
    emitProgress('complete', `Dry run complete in ${duration}ms`, 100, {
      nodes: inferenceResult.nodes.length,
      edges: inferenceResult.edges.length,
    });

    return {
      outputPath: undefined,
      stats: {
        nodes: inferenceResult.nodes.length,
        edges: inferenceResult.edges.length,
        codeRefs: inferenceResult.nodes.reduce(
          (sum, n) => sum + n.codeRefs.length + n.children.reduce((cs, c) => cs + c.codeRefs.length, 0),
          0,
        ),
      },
      projectProfile,
      warnings,
      duration,
      inferenceResult,
    };
  }

  // ─── Phase 5: Building ────────────────────────────────────────

  emitProgress('building', 'Building ArchCanvas graph...', 80);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  // Import GraphContext dynamically to avoid circular dependency issues
  // GraphContext creates the TextApi + registry needed for graph building
  const { GraphContext } = await import('@/cli/context');

  const ctx = GraphContext.createNew(inferenceResult.architectureName);

  const buildOptions: BuildGraphOptions = {
    autoLayout: true,
    layoutDirection: 'horizontal',
    noteAuthor: 'ai-analyzer',
    addDescriptionNotes: includeNotes,
  };

  let buildResult: BuildResult;
  try {
    buildResult = await buildGraph(inferenceResult, ctx.textApi, ctx.registry, buildOptions);
  } catch (e) {
    throw new Error(`Graph building failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Collect build warnings
  warnings.push(...buildResult.warnings);

  emitProgress('building', `Graph built: ${buildResult.nodesCreated} nodes, ${buildResult.edgesCreated} edges, ${buildResult.codeRefsAttached} code refs`, 90, {
    nodesCreated: buildResult.nodesCreated,
    edgesCreated: buildResult.edgesCreated,
    codeRefsAttached: buildResult.codeRefsAttached,
    warnings: buildResult.warnings.length,
  });

  if (verbose) {
    console.log('[pipeline:building] Build result:', {
      nodesCreated: buildResult.nodesCreated,
      edgesCreated: buildResult.edgesCreated,
      codeRefsAttached: buildResult.codeRefsAttached,
      warnings: buildResult.warnings,
    });
  }

  // ─── Phase 6: Saving ──────────────────────────────────────────

  emitProgress('saving', `Saving to ${outputPath}...`, 92);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  try {
    await ctx.saveAs(outputPath);
  } catch (e) {
    throw new Error(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress('saving', 'Saved .archc file', 95);

  // Generate sidecar .summary.md
  try {
    await ctx.saveSidecar();
    emitProgress('saving', 'Generated .summary.md sidecar', 98);
  } catch (e) {
    warnings.push(`Sidecar generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Complete ─────────────────────────────────────────────────

  const duration = Date.now() - startTime;

  emitProgress('complete', `Analysis complete in ${duration}ms: ${buildResult.nodesCreated} nodes, ${buildResult.edgesCreated} edges`, 100, {
    outputPath,
    nodes: buildResult.nodesCreated,
    edges: buildResult.edgesCreated,
    codeRefs: buildResult.codeRefsAttached,
    duration,
    warnings: warnings.length,
  });

  return {
    outputPath,
    stats: {
      nodes: buildResult.nodesCreated,
      edges: buildResult.edgesCreated,
      codeRefs: buildResult.codeRefsAttached,
    },
    projectProfile,
    warnings,
    duration,
    inferenceResult,
  };
}
