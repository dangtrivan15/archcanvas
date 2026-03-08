#!/usr/bin/env node
/**
 * npm postinstall hook for archcanvas.
 *
 * When installed globally (`npm install -g archcanvas`), this script
 * automatically registers the archcanvas MCP server in ~/.mcp.json
 * so it's immediately available in Claude Code.
 *
 * When installed as a local devDependency, this script does nothing.
 *
 * Errors are logged as warnings but NEVER cause the install to fail.
 */

import { execFile } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  // Only run for global installs
  const isGlobal = process.env.npm_config_global === 'true';
  if (!isGlobal) {
    return;
  }

  try {
    // Use the built CLI entry point directly (available after prepublishOnly build)
    const cliPath = resolve(__dirname, '..', 'dist', 'cli', 'index.js');

    execFile(process.execPath, [cliPath, 'mcp', 'install', '--global'], (err, stdout, stderr) => {
      if (err) {
        console.warn(`archcanvas: Could not auto-register MCP server: ${err.message}`);
        console.warn('archcanvas: You can register manually with: archcanvas mcp install --global');
        return;
      }
      if (stdout) {
        // Prefix output for clarity during npm install
        console.log(`archcanvas: ${stdout.trim()}`);
      }
    });
  } catch (err) {
    // Never fail the install — just warn
    console.warn(`archcanvas: Could not auto-register MCP server: ${err.message || err}`);
    console.warn('archcanvas: You can register manually with: archcanvas mcp install --global');
  }
}

main();
