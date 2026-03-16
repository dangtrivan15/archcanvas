/**
 * Standalone bridge server entry point.
 *
 * Runs the AI bridge as an independent HTTP + WebSocket server,
 * decoupled from Vite. Used by the Tauri sidecar for desktop mode.
 *
 * The Claude Agent SDK is imported statically so bun build --compile bundles it.
 * At runtime, the sidecar resolves the user's `claude` CLI path via login shell
 * and passes it to the SDK as pathToClaudeCodeExecutable, avoiding the need for
 * node/bun on PATH to run the SDK's embedded cli.js.
 *
 * Usage: archcanvas-bridge [--port <port>] [--cwd <path>]
 */

import { createBridgeServer } from '../core/ai/bridgeServer.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFileSync } from 'child_process';

// Strip env vars that make the SDK think it's running inside a nested
// Claude Code session. Common when the Tauri app is launched from within
// Claude Code during development.
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

// Resolve the installed `claude` CLI path. The SDK spawns it as a subprocess.
// We resolve via the user's login shell so it works even when launched from
// Finder (which has a minimal PATH that doesn't include ~/.local/bin).
function resolveClaudePath(): string | undefined {
  const shell = process.env.SHELL || '/bin/zsh';
  try {
    return execFileSync(shell, ['-l', '-c', 'which claude'], { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const claudePath = resolveClaudePath();

// ---------------------------------------------------------------------------
// Wrapped query — injects the resolved Claude CLI path
// MCP servers and allowedTools are handled by bridgeServer internally.
// ---------------------------------------------------------------------------

function wrappedQuery({ prompt, options }: Parameters<typeof query>[0]) {
  return query({
    prompt,
    options: {
      ...options,
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Parse CLI arguments and start server
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
const portIdx = cliArgs.indexOf('--port');
const cwdIdx = cliArgs.indexOf('--cwd');

const port = portIdx !== -1 ? parseInt(cliArgs[portIdx + 1]) : 17248;
const cwd = cwdIdx !== -1 ? cliArgs[cwdIdx + 1] : process.cwd();

const server = createBridgeServer({ port, cwd, queryFn: wrappedQuery as any });
const { port: actualPort } = await server.start();

// Structured first line for Tauri sidecar port discovery
console.log(`BRIDGE_PORT=${actualPort}`);

process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
