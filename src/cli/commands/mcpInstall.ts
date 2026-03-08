/**
 * CLI: archcanvas mcp install
 *
 * Registers the archcanvas MCP server in a project's .mcp.json file.
 * Supports --global flag to write to ~/.mcp.json instead.
 * Uses the merge-aware writer and updates the MCP registry.
 *
 * Usage:
 *   archcanvas mcp install          → writes .mcp.json in CWD
 *   archcanvas mcp install --global → writes ~/.mcp.json
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { withErrorHandler } from '@/cli/index';
import { writeMcpJsonEntry, ARCHCANVAS_SERVER_KEY } from '@/mcp/mcpJson';
import { addProject, setGlobal } from '@/mcp/registry';
import type { McpServerEntry } from '@/mcp/mcpJson';

/** The MCP server entry written by `archcanvas mcp install` */
export function buildInstallEntry(): McpServerEntry {
  return {
    command: 'archcanvas',
    args: ['mcp'],
  };
}

/** Resolve the .mcp.json path for local or global install */
export function resolveMcpJsonPath(global: boolean): string {
  if (global) {
    return join(homedir(), '.mcp.json');
  }
  return resolve(process.cwd(), '.mcp.json');
}

/**
 * Register the `install` subcommand on the given `mcp` parent command.
 */
export function registerMcpInstallCommand(mcpCmd: Command): void {
  mcpCmd
    .command('install')
    .description('Register archcanvas MCP server in .mcp.json')
    .option('--global', 'Write to ~/.mcp.json instead of project-local', false)
    .action(
      withErrorHandler(async (cmdOpts: { global: boolean }) => {
        const isGlobal = cmdOpts.global;
        const mcpJsonPath = resolveMcpJsonPath(isGlobal);
        const entry = buildInstallEntry();

        // Write/merge the archcanvas entry into .mcp.json
        await writeMcpJsonEntry(mcpJsonPath, entry);

        // Update the MCP registry
        if (isGlobal) {
          await setGlobal(true);
        } else {
          const projectPath = resolve(process.cwd());
          await addProject(projectPath);
        }

        // Print confirmation with path
        console.log(`Registered ${ARCHCANVAS_SERVER_KEY} MCP server in ${mcpJsonPath}`);
      }),
    );
}
