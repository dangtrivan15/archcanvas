/**
 * CLI Graph Context Manager.
 *
 * A shared context manager that loads an .archc file into an ArchGraph,
 * provides a TextApi instance for mutations, and saves the modified graph
 * back to disk. This is the bridge between file I/O and the API layer,
 * used by CLI commands, MCP server, and HTTP server.
 *
 * Usage:
 *   // Load an existing file
 *   const ctx = await GraphContext.loadFromFile('./project.archc');
 *   ctx.textApi.addNode({ type: 'compute/service', displayName: 'Auth' });
 *   await ctx.save();
 *
 *   // Create a new project
 *   const ctx = GraphContext.createNew('My Architecture');
 *   ctx.textApi.addNode({ type: 'compute/service', displayName: 'API' });
 *   await ctx.saveAs('./project.archc');
 */

import type { ArchGraph } from '@/types/graph';
import { TextApi } from '@/api/textApi';
import { ExportApi } from '@/api/exportApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { encode, decode } from '@/core/storage/codec';
import { graphToProto, protoToGraph, deriveSummaryFileName } from '@/core/storage/fileIO';
import { NodeFileSystemAdapter } from '@/core/platform/nodeFileSystemAdapter';

// ─── Types ──────────────────────────────────────────────────────

/**
 * Options for loading a file.
 */
export interface LoadOptions {
  /** If true, skip SHA-256 checksum verification (for recovery of corrupted files). */
  skipChecksumVerification?: boolean;
}

// ─── GraphContext ───────────────────────────────────────────────

export class GraphContext {
  /** The TextApi instance for reading/mutating the architecture graph. */
  readonly textApi: TextApi;

  /** The ExportApi instance for generating markdown and mermaid content. */
  readonly exportApi: ExportApi;

  /** The registry of built-in node definitions. */
  readonly registry: RegistryManager;

  /** File path of the loaded .archc file (undefined for new unsaved files). */
  private filePath?: string;

  /** File system adapter for read/write operations. */
  private adapter: NodeFileSystemAdapter;

  /** Graph reference at the time of last save or load — used for modification tracking. */
  private savedGraphRef: ArchGraph;

  /** Explicit dirty flag (set by markModified). */
  private dirtyFlag = false;

  /** Original file creation timestamp (preserved across re-saves). */
  private createdAtMs?: number;

  // ─── Private Constructor ────────────────────────────────────

  private constructor(
    graph: ArchGraph,
    registry: RegistryManager,
    filePath?: string,
    createdAtMs?: number,
  ) {
    this.registry = registry;
    this.textApi = new TextApi(graph, registry);
    this.exportApi = new ExportApi();
    this.filePath = filePath;
    this.adapter = new NodeFileSystemAdapter(filePath);
    this.savedGraphRef = graph;
    this.createdAtMs = createdAtMs;
  }

  // ─── Factory Methods ────────────────────────────────────────

  /**
   * Load an .archc file from disk into a GraphContext.
   *
   * Reads the binary file, decodes the protobuf payload, verifies the
   * SHA-256 checksum, and converts the proto to an ArchGraph. Initializes
   * the RegistryManager with built-in nodedefs.
   *
   * @param filePath - Path to the .archc file
   * @param options - Optional load settings (e.g., skip checksum)
   * @returns A GraphContext ready for queries and mutations
   * @throws If the file cannot be read, is corrupt, or has invalid format
   */
  static async loadFromFile(filePath: string, options?: LoadOptions): Promise<GraphContext> {
    const pathModule = await import('node:path');
    const resolvedPath = pathModule.resolve(filePath);

    // Read the binary file
    const adapter = new NodeFileSystemAdapter(resolvedPath);
    const pickResult = await adapter.readFile(resolvedPath);

    // Decode the .archc binary (validates magic bytes, version, checksum)
    const decoded = await decode(pickResult.data, {
      skipChecksumVerification: options?.skipChecksumVerification,
    });

    // Convert protobuf to internal ArchGraph
    const graph = protoToGraph(decoded);

    // Extract header timestamps
    const createdAtMs = decoded.header?.createdAtMs
      ? Number(decoded.header.createdAtMs)
      : undefined;

    // Initialize registry with built-in nodedefs
    const registry = new RegistryManager();
    registry.initialize();

    return new GraphContext(graph, registry, resolvedPath, createdAtMs);
  }

  /**
   * Create a new empty GraphContext for `init` scenarios.
   *
   * Creates an empty ArchGraph with the given name and initializes the
   * RegistryManager. The context has no file path — use saveAs() to
   * persist to disk.
   *
   * @param name - Architecture name (default: "Untitled Architecture")
   * @returns A GraphContext with an empty graph
   */
  static createNew(name?: string): GraphContext {
    const graph = createEmptyGraph(name);
    const registry = new RegistryManager();
    registry.initialize();
    return new GraphContext(graph, registry);
  }

  // ─── Graph Access ───────────────────────────────────────────

  /**
   * Get the current architecture graph.
   *
   * Always returns the latest state from TextApi (mutations create new
   * graph references via the immutable graph engine).
   */
  getGraph(): ArchGraph {
    return this.textApi.getGraph();
  }

  /**
   * Get the file path of the loaded .archc file.
   * Returns undefined for new unsaved files.
   */
  getFilePath(): string | undefined {
    return this.filePath;
  }

  // ─── Modification Tracking ─────────────────────────────────

  /**
   * Check if the graph has been modified since the last load or save.
   *
   * Uses two strategies:
   * 1. Explicit dirty flag (set by markModified)
   * 2. Reference comparison (graph engine creates new objects on mutation)
   */
  isModified(): boolean {
    return this.dirtyFlag || this.textApi.getGraph() !== this.savedGraphRef;
  }

  /**
   * Explicitly mark the graph as modified.
   * Use this when modifications are made outside of TextApi.
   */
  markModified(): void {
    this.dirtyFlag = true;
  }

  /**
   * Mark the graph as clean (not modified).
   * Called automatically after successful save.
   */
  private markClean(): void {
    this.dirtyFlag = false;
    this.savedGraphRef = this.textApi.getGraph();
  }

  // ─── Content Generation ────────────────────────────────────

  /**
   * Generate a markdown summary of the current architecture.
   * Delegates to ExportApi.generateMarkdownSummary().
   */
  generateMarkdownSummary(): string {
    return this.exportApi.generateMarkdownSummary(this.getGraph());
  }

  /**
   * Generate a Mermaid diagram of the current architecture.
   * Delegates to ExportApi.generateMermaid().
   */
  generateMermaid(): string {
    return this.exportApi.generateMermaid(this.getGraph());
  }

  /**
   * Generate the full .summary.md content with both markdown and Mermaid.
   * Delegates to ExportApi.generateSummaryWithMermaid().
   */
  generateSummaryWithMermaid(): string {
    return this.exportApi.generateSummaryWithMermaid(this.getGraph());
  }

  // ─── Persistence ───────────────────────────────────────────

  /**
   * Save the current graph back to the original .archc file.
   *
   * If the graph has not been modified, this is a no-op (unless force=true).
   * Encodes the graph to protobuf, computes SHA-256 checksum, writes to disk.
   *
   * @param force - If true, save even if the graph hasn't been modified
   * @throws If no file path is set (use saveAs instead)
   * @throws If the file cannot be written
   */
  async save(force = false): Promise<void> {
    if (!this.filePath) {
      throw new Error(
        'No file path set. Use saveAs() to save to a new location, or load a file first.',
      );
    }

    if (!force && !this.isModified()) {
      return; // No changes to save
    }

    const graph = this.getGraph();
    const protoFile = graphToProto(graph, undefined, undefined, undefined, this.createdAtMs);
    const binaryData = await encode(protoFile);
    await this.adapter.saveFile(binaryData, this.filePath);

    this.markClean();
  }

  /**
   * Save the current graph to a new .archc file path.
   *
   * Always writes regardless of modification state. Updates the internal
   * file path so subsequent save() calls write to the new location.
   *
   * @param filePath - The new file path to save to
   * @throws If the file cannot be written
   */
  async saveAs(filePath: string): Promise<void> {
    const pathModule = await import('node:path');
    const resolvedPath = pathModule.resolve(filePath);

    const graph = this.getGraph();
    const protoFile = graphToProto(graph, undefined, undefined, undefined, this.createdAtMs);
    const binaryData = await encode(protoFile);

    await this.adapter.saveFileAs(binaryData, resolvedPath);

    // Update internal state to point to the new file
    this.filePath = resolvedPath;
    this.adapter = new NodeFileSystemAdapter(resolvedPath);
    this.markClean();
  }

  /**
   * Generate and save the .summary.md sidecar file alongside the .archc file.
   *
   * The sidecar filename is derived from the .archc filename:
   * e.g., "project.archc" → "project.summary.md"
   *
   * @throws If no file path is set (must save the .archc file first)
   * @throws If the sidecar file cannot be written
   */
  async saveSidecar(): Promise<void> {
    if (!this.filePath) {
      throw new Error(
        'No file path set. Save the .archc file first before generating the sidecar.',
      );
    }

    const pathModule = await import('node:path');
    const archcFileName = pathModule.basename(this.filePath);
    const summaryFileName = deriveSummaryFileName(archcFileName);
    const summaryPath = pathModule.join(pathModule.dirname(this.filePath), summaryFileName);

    const content = this.generateSummaryWithMermaid();
    await this.adapter.shareFile(content, summaryPath, 'text/markdown');
  }
}
