/**
 * CLI: archcanvas mcp uninstall
 *
 * Removes archcanvas MCP config from all tracked projects and global config.
 * Reads the registry, iterates all tracked locations, removes the archcanvas
 * entry (merge-aware), and cleans up the registry file.
 *
 * Usage:
 *   archcanvas mcp uninstall → removes archcanvas from all tracked .mcp.json files
 */

import { Command } from 'commander';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { withErrorHandler } from '@/cli/index';

/** Result of the uninstall operation */
export interface UninstallResult {
  projectsCleaned: number;
  projectsSkipped: number;
  globalCleaned: boolean;
  registryDeleted: boolean;
}

/**
 * Run the MCP uninstall logic.
 *
 * 1. Read ~/.archcanvas/mcp-registry.json
 * 2. For each tracked project, remove archcanvas from .mcp.json
 * 3. If global flag set, remove from ~/.mcp.json
 * 4. Delete the registry file
 * 5. Return summary
 *
 * No-op if registry doesn't exist.
 */
export async function mcpUninstall(): Promise<UninstallResult> {
  const fs = await import('node:fs/promises');
  const { readRegistry, getRegistryPath } = await import('@/mcp/registry');
  const { removeMcpJson } = await import('@/mcp/mcpJson');

  const result: UninstallResult = {
    projectsCleaned: 0,
    projectsSkipped: 0,
    globalCleaned: false,
    registryDeleted: false,
  };

  // Check if registry file exists at all
  const registryPath = getRegistryPath();
  try {
    await fs.access(registryPath);
  } catch {
    // No registry file — nothing to do (no-op)
    return result;
  }

  const registry = await readRegistry();

  // Process each tracked project
  for (const projectPath of registry.projects) {
    const mcpJsonPath = join(projectPath, '.mcp.json');

    try {
      // Check if directory still exists
      await fs.access(projectPath);
    } catch {
      // Directory no longer exists — skip silently
      result.projectsSkipped++;
      continue;
    }

    try {
      const removeResult = await removeMcpJson(mcpJsonPath);
      if (removeResult.removed) {
        result.projectsCleaned++;
      } else {
        // File didn't exist or didn't have archcanvas entry
        result.projectsSkipped++;
      }
    } catch {
      // File unreadable or other error — skip silently
      result.projectsSkipped++;
    }
  }

  // Handle global config
  if (registry.global) {
    const globalMcpJsonPath = join(homedir(), '.mcp.json');
    try {
      const removeResult = await removeMcpJson(globalMcpJsonPath);
      result.globalCleaned = removeResult.removed;
    } catch {
      // Skip silently on error
    }
  }

  // Delete the registry file after cleanup
  try {
    await fs.unlink(registryPath);
    result.registryDeleted = true;
  } catch {
    // Ignore deletion errors
  }

  return result;
}

/**
 * Format the uninstall result as a human-readable summary.
 */
export function formatUninstallSummary(result: UninstallResult): string {
  const lines: string[] = [];

  if (result.projectsCleaned === 0 && !result.globalCleaned && result.projectsSkipped === 0) {
    return 'Nothing to clean up.';
  }

  if (result.projectsCleaned > 0) {
    lines.push(
      `${result.projectsCleaned} project${result.projectsCleaned === 1 ? '' : 's'} cleaned`,
    );
  }

  if (result.projectsSkipped > 0) {
    lines.push(
      `${result.projectsSkipped} project${result.projectsSkipped === 1 ? '' : 's'} skipped`,
    );
  }

  if (result.globalCleaned) {
    lines.push('Global ~/.mcp.json cleaned');
  }

  if (result.registryDeleted) {
    lines.push('Registry removed');
  }

  return lines.join(', ') + '.';
}

/**
 * Register the `uninstall` subcommand on the given `mcp` parent command.
 */
export function registerMcpUninstallCommand(mcpCmd: Command): void {
  mcpCmd
    .command('uninstall')
    .description('Remove archcanvas MCP config from all tracked projects and global config')
    .action(
      withErrorHandler(async () => {
        const result = await mcpUninstall();
        const summary = formatUninstallSummary(result);
        console.log(summary);
      }),
    );
}
