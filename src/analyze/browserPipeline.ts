/**
 * Browser Analysis Pipeline Orchestrator
 *
 * Browser-compatible version of the analysis pipeline that uses the
 * File System Access API instead of Node.js fs/path. Chains:
 *   browser-scan -> detect -> browser-select -> infer -> build -> save
 *
 * All phases that don't depend on Node.js (detect, infer, build) are
 * reused unchanged from the CLI pipeline.
 */

import { scanDirectoryBrowser } from './browserScanner';
import { selectKeyFilesBrowser } from './browserFileSelector';
import { detectProject, type ProjectProfile } from './detector';
import {
  inferArchitecture,
  type InferenceResult,
  type InferenceOptions,
  type AIMessageSender,
  type AnalysisDepth,
  InferenceError,
} from './inferEngine';
import { buildGraph, type BuildResult, type BuildGraphOptions } from './graphBuilder';
import type { ScanResult, ScanOptions } from './scanner';
import type { KeyFileSet } from './fileSelector';
import type { PipelinePhase, AnalyzeProgress, AnalyzeResult } from './pipeline';
import type { TextApi } from '@/api/textApi';
import type { RegistryManagerCore } from '@/core/registry/registryCore';
import type { ArchGraph } from '@/types/graph';

// Re-export types for consumers
export type { PipelinePhase, AnalyzeProgress, AnalyzeResult };

// ── Browser Pipeline Options ────────────────────────────────────────────────

export interface BrowserAnalyzeOptions {
  /** Analysis depth: 'quick' | 'standard' | 'deep' */
  analysisDepth?: AnalysisDepth;
  /** Maximum files to scan (default: 10000) */
  maxFiles?: number;
  /** Maximum token budget for file content sent to AI (default: 100000) */
  maxTokenBudget?: number;
  /** Architecture name (default: derived from folder name) */
  architectureName?: string;
  /** Whether to include AI-generated notes on nodes (default: true) */
  includeNotes?: boolean;
  /** Callback for progress events */
  onProgress?: (event: AnalyzeProgress) => void;
  /** AI message sender (required for AI inference; falls back to structural if absent) */
  aiSender?: AIMessageSender;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** TextApi instance to use for graph building (avoids importing GraphContext) */
  textApi: TextApi;
  /** Registry instance to use for node type lookups */
  registry: RegistryManagerCore;
}

export interface BrowserAnalyzeResult {
  /** The built graph (ready to load into the canvas) */
  graph: ArchGraph;
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
  /** The inference result (for debugging/display) */
  inferenceResult?: InferenceResult;
}

// ── Structural Fallback (same as pipeline.ts) ───────────────────────────────

function buildStructuralFallback(
  profile: ProjectProfile,
  architectureName: string,
): InferenceResult {
  const nodes: InferenceResult['nodes'] = [];
  let nodeIndex = 0;

  for (const fw of profile.frameworks) {
    if (fw.confidence === 'low') continue;
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

  for (const sig of profile.infraSignals) {
    if (sig.type.startsWith('ci-')) continue;
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

  if (nodes.length === 0) {
    nodes.push({
      id: 'structural-app',
      type: 'service',
      displayName: architectureName,
      description: 'Main application (no specific architecture detected)',
      codeRefs: profile.entryPoints.map((ep) => ({ path: ep, role: 'SOURCE' as const })),
      children: [],
    });
  }

  return {
    architectureName,
    architectureDescription: `Structural analysis of ${architectureName} (${profile.projectType} project)`,
    nodes,
    edges: [],
  };
}

function frameworkToNodeType(fw: { name: string }): string {
  const name = fw.name.toLowerCase();
  if (['next.js', 'nuxt', 'sveltekit', 'remix', 'astro', 'gatsby', 'angular', 'react', 'vue', 'svelte'].includes(name)) {
    return 'web-app';
  }
  if (['expo', 'capacitor'].includes(name)) return 'mobile-app';
  if (['express', 'fastapi', 'flask', 'django', 'rails', 'gin', 'spring boot', 'actix web'].includes(name)) {
    return 'service';
  }
  if (['serverless framework'].includes(name)) return 'function';
  return 'service';
}

function infraSignalToNodeType(signalType: string): string | null {
  switch (signalType) {
    case 'docker':
    case 'docker-compose':
    case 'kubernetes':
      return 'container';
    default:
      return null;
  }
}

// ── Browser Pipeline ────────────────────────────────────────────────────────

/**
 * Run the full codebase analysis pipeline in the browser.
 *
 * Uses FileSystemDirectoryHandle to scan and read files, then chains through
 * the same detect -> select -> infer -> build stages as the CLI pipeline.
 * Instead of writing to disk, returns the built graph directly so it can
 * be loaded into the canvas.
 *
 * @param dirHandle - FileSystemDirectoryHandle for the project folder
 * @param options - Pipeline configuration
 * @returns BrowserAnalyzeResult with the built graph and stats
 */
export async function analyzeCodebaseBrowser(
  dirHandle: FileSystemDirectoryHandle,
  options: BrowserAnalyzeOptions,
): Promise<BrowserAnalyzeResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const {
    analysisDepth = 'standard',
    maxFiles = 10000,
    maxTokenBudget = 100_000,
    includeNotes = true,
    onProgress,
    aiSender,
    signal,
    textApi,
    registry,
  } = options;

  const architectureName = options.architectureName ?? dirHandle.name;

  function emitProgress(
    phase: PipelinePhase,
    message: string,
    percent: number,
    detail?: Record<string, unknown>,
  ) {
    onProgress?.({ phase, message, percent, detail });
  }

  // ─── Phase 1: Scanning ────────────────────────────────────────

  emitProgress('scanning', `Scanning folder: ${dirHandle.name}`, 5);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  const scanOptions: ScanOptions = {
    maxFiles,
    maxDepth: 10,
  };

  let scanResult: ScanResult;
  try {
    scanResult = await scanDirectoryBrowser(dirHandle, scanOptions, signal);
  } catch (e) {
    throw new Error(`Scan failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'scanning',
    `Scan complete: ${scanResult.totalFiles} files, ${scanResult.totalDirs} directories`,
    15,
    {
      totalFiles: scanResult.totalFiles,
      totalDirs: scanResult.totalDirs,
      languageCount: Object.keys(scanResult.languageBreakdown).length,
    },
  );

  // ─── Phase 2: Detecting ───────────────────────────────────────

  emitProgress('detecting', 'Detecting project type, frameworks, and infrastructure...', 20);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  let projectProfile: ProjectProfile;
  try {
    projectProfile = detectProject(scanResult);
  } catch (e) {
    throw new Error(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'detecting',
    `Detection complete: ${projectProfile.projectType} project, ${projectProfile.languages.length} languages, ${projectProfile.frameworks.length} frameworks`,
    30,
    {
      projectType: projectProfile.projectType,
      languages: projectProfile.languages.map((l) => l.name),
      frameworks: projectProfile.frameworks.map((f) => f.name),
    },
  );

  // ─── Phase 3: Selecting ───────────────────────────────────────

  emitProgress('selecting', 'Selecting architecturally significant files...', 35);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  let keyFiles: KeyFileSet;
  try {
    keyFiles = await selectKeyFilesBrowser(scanResult, projectProfile, dirHandle, {
      maxLinesPerFile: 500,
      totalTokenBudget: maxTokenBudget,
    });
  } catch (e) {
    throw new Error(`File selection failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress(
    'selecting',
    `Selected ${keyFiles.files.length} key files (~${keyFiles.totalTokenEstimate} tokens)`,
    45,
    {
      selectedFiles: keyFiles.files.length,
      tokenEstimate: keyFiles.totalTokenEstimate,
    },
  );

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
          const inferPercent = 50 + Math.round((event.step / event.totalSteps) * 25);
          emitProgress('inferring', event.description, inferPercent);
        },
      };

      inferenceResult = await inferArchitecture(
        aiSender,
        projectProfile,
        keyFiles,
        inferenceOptions,
      );

      emitProgress(
        'inferring',
        `Inference complete: ${inferenceResult.nodes.length} nodes, ${inferenceResult.edges.length} edges`,
        75,
        {
          nodes: inferenceResult.nodes.length,
          edges: inferenceResult.edges.length,
        },
      );
    } catch (e) {
      const errorMsg =
        e instanceof InferenceError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);

      warnings.push(`AI inference failed (falling back to structural analysis): ${errorMsg}`);
      emitProgress('inferring', `AI inference failed, using structural fallback: ${errorMsg}`, 75);

      inferenceResult = buildStructuralFallback(projectProfile, architectureName);
      usedFallback = true;
    }
  } else {
    warnings.push('No AI sender provided — using structural-only analysis');
    emitProgress('inferring', 'No AI sender provided, using structural fallback', 75);
    inferenceResult = buildStructuralFallback(projectProfile, architectureName);
    usedFallback = true;
  }

  if (options.architectureName) {
    inferenceResult.architectureName = options.architectureName;
  }

  // ─── Phase 5: Building ────────────────────────────────────────

  emitProgress('building', 'Building ArchCanvas graph...', 80);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  // Set the architecture name and description on the textApi graph
  const currentGraph = textApi.getGraph();
  textApi.setGraph({
    ...currentGraph,
    name: inferenceResult.architectureName,
    description: inferenceResult.architectureDescription,
  });

  const buildOptions: BuildGraphOptions = {
    autoLayout: true,
    layoutDirection: 'horizontal',
    noteAuthor: 'ai-analyzer',
    addDescriptionNotes: includeNotes,
  };

  let buildResult: BuildResult;
  try {
    buildResult = await buildGraph(inferenceResult, textApi, registry, buildOptions);
  } catch (e) {
    throw new Error(`Graph building failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  warnings.push(...buildResult.warnings);

  emitProgress(
    'building',
    `Graph built: ${buildResult.nodesCreated} nodes, ${buildResult.edgesCreated} edges, ${buildResult.codeRefsAttached} code refs`,
    90,
    {
      nodesCreated: buildResult.nodesCreated,
      edgesCreated: buildResult.edgesCreated,
      codeRefsAttached: buildResult.codeRefsAttached,
    },
  );

  // ─── Phase 6: Saving ──────────────────────────────────────────

  emitProgress('saving', 'Saving .archc file to project folder...', 92);

  if (signal?.aborted) throw new Error('Pipeline aborted');

  // Get the final graph from the TextApi
  const graph = textApi.getGraph();

  // Save to the project folder via File System Access API
  const { graphToProto } = await import('@/core/storage/fileIO');
  const { encode } = await import('@/core/storage/codec');
  const { writeArchcToFolder } = await import('@/core/project/scanner');

  const protoFile = graphToProto(graph);
  const binaryData = await encode(protoFile);
  const fileName = 'architecture.archc';

  try {
    await writeArchcToFolder(dirHandle, fileName, binaryData);
  } catch (e) {
    warnings.push(`File save failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  emitProgress('saving', 'Saved architecture.archc', 98);

  // ─── Complete ─────────────────────────────────────────────────

  const duration = Date.now() - startTime;

  emitProgress(
    'complete',
    `Analysis complete in ${(duration / 1000).toFixed(1)}s: ${buildResult.nodesCreated} nodes, ${buildResult.edgesCreated} edges`,
    100,
    {
      nodes: buildResult.nodesCreated,
      edges: buildResult.edgesCreated,
      codeRefs: buildResult.codeRefsAttached,
      duration,
      usedFallback,
    },
  );

  return {
    graph,
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
