/**
 * CLI `info` Command
 *
 * Displays metadata about an .archc file including architecture name,
 * description, owners, format version, tool version, timestamps,
 * node/edge counts (including nested nodes), file size, and checksum status.
 *
 * Usage:
 *   archcanvas info --file project.archc
 *   archcanvas info --file project.archc --format json
 */

import { Command } from 'commander';
import {
  type GlobalOptions,
  withErrorHandler,
  suppressDiagnosticLogs,
  printOutput,
} from '@/cli/index';
import { writeOutput, formatOutput } from '@/cli/formatter';
import { decode, IntegrityError } from '@/core/storage/codec';
import { protoToGraph } from '@/core/storage/fileIO';
import { NodeFileSystemAdapter } from '@/core/platform/nodeFileSystemAdapter';
import type { ArchNode } from '@/types/graph';

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Count all nodes including recursively nested children.
 */
function countNodesDeep(nodes: ArchNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children && node.children.length > 0) {
      count += countNodesDeep(node.children);
    }
  }
  return count;
}

/**
 * Format a millisecond timestamp to an ISO string, or return a fallback.
 */
function formatTimestamp(ms: number | undefined): string {
  if (!ms || ms === 0) return '(unknown)';
  return new Date(ms).toISOString();
}

/**
 * Format byte size to human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Info Data ────────────────────────────────────────────────

interface ArchInfo {
  name: string;
  description: string;
  owners: string;
  formatVersion: number;
  toolVersion: string;
  createdAt: string;
  updatedAt: string;
  totalNodes: number;
  topLevelNodes: number;
  edges: number;
  fileSize: string;
  fileSizeBytes: number;
  checksumStatus: string;
  file: string;
}

// ─── Command Registration ────────────────────────────────────

/**
 * Register the `info` subcommand on the given Commander program.
 */
export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('Display metadata about an .archc file')
    .action(
      withErrorHandler(async () => {
        const opts = program.opts<GlobalOptions>();

        if (!opts.file) {
          console.error('Error: --file <path> is required for this command.');
          process.exit(1);
        }

        const pathModule = await import('node:path');
        const fsModule = await import('node:fs');
        const resolvedPath = pathModule.resolve(opts.file);

        // Get file size
        let fileSizeBytes: number;
        try {
          const stats = fsModule.statSync(resolvedPath);
          fileSizeBytes = stats.size;
        } catch {
          throw new Error(`Cannot stat file: ${resolvedPath}`);
        }

        // Read the raw binary
        const adapter = new NodeFileSystemAdapter(resolvedPath);
        const pickResult = await adapter.readFile(resolvedPath);

        // Decode with checksum verification to determine integrity status
        const restore = suppressDiagnosticLogs();
        let checksumStatus = 'valid';
        let decoded;
        try {
          // First try with checksum verification
          try {
            decoded = await decode(pickResult.data);
          } catch (err) {
            if (err instanceof IntegrityError) {
              // Checksum failed — decode again without verification to still get metadata
              checksumStatus = 'INVALID';
              decoded = await decode(pickResult.data, { skipChecksumVerification: true });
            } else {
              throw err;
            }
          }
        } finally {
          restore();
        }

        // Convert to graph for architecture data
        const graph = protoToGraph(decoded);

        // Extract header metadata
        const header = decoded.header;
        const formatVersion = header?.formatVersion ?? 0;
        const toolVersion = header?.toolVersion || '(unknown)';
        const createdAtMs = header?.createdAtMs ? Number(header.createdAtMs) : undefined;
        const updatedAtMs = header?.updatedAtMs ? Number(header.updatedAtMs) : undefined;

        const totalNodes = countNodesDeep(graph.nodes);

        const info: ArchInfo = {
          name: graph.name || '(untitled)',
          description: graph.description || '(none)',
          owners: graph.owners.length > 0 ? graph.owners.join(', ') : '(none)',
          formatVersion,
          toolVersion,
          createdAt: formatTimestamp(createdAtMs),
          updatedAt: formatTimestamp(updatedAtMs),
          totalNodes,
          topLevelNodes: graph.nodes.length,
          edges: graph.edges.length,
          fileSize: formatSize(fileSizeBytes),
          fileSizeBytes,
          checksumStatus,
          file: resolvedPath,
        };

        printOutput(info, opts.format, humanFormatInfo);
      }),
    );
}

// ─── Human Formatter ──────────────────────────────────────────

function humanFormatInfo(data: unknown): string {
  const info = data as ArchInfo;
  const lines = [
    `Architecture: ${info.name}`,
    `Description:  ${info.description}`,
    `Owners:       ${info.owners}`,
    '',
    `Format version: ${info.formatVersion}`,
    `Tool version:   ${info.toolVersion}`,
    `Created:        ${info.createdAt}`,
    `Updated:        ${info.updatedAt}`,
    '',
    `Nodes:          ${info.totalNodes} total (${info.topLevelNodes} top-level)`,
    `Edges:          ${info.edges}`,
    '',
    `File:           ${info.file}`,
    `File size:      ${info.fileSize}`,
    `Checksum:       ${info.checksumStatus}`,
  ];
  return lines.join('\n');
}
