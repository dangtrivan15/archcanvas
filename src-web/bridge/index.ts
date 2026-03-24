/**
 * Standalone bridge server entry point.
 *
 * Runs the AI bridge as an independent HTTP + WebSocket server,
 * decoupled from Vite. Used by the Tauri sidecar for desktop mode.
 *
 * The Claude Agent SDK is imported statically so bun build --compile bundles it.
 * At runtime, the sidecar resolves the user's `claude` CLI path and passes it
 * to the SDK as pathToClaudeCodeExecutable, avoiding the need for node/bun on
 * PATH to run the SDK's embedded cli.js.
 *
 * Note: When launched from Tauri, the Rust host already resolves the user's
 * login shell PATH and passes it via env. So `which` here uses the full PATH
 * without needing to spawn a login shell.
 *
 * Usage: archcanvas-bridge [--port <port>] [--cwd <path>]
 */

import { createBridgeServer } from '../core/ai/bridgeServer.js';
import type { SDKQueryFn } from '../core/ai/claudeCodeBridge.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFileSync } from 'child_process';

// Strip env vars that make the SDK think it's running inside a nested
// Claude Code session. Common when the Tauri app is launched from within
// Claude Code during development.
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

// Resolve the installed `claude` CLI path. The SDK spawns it as a subprocess.
// The Tauri Rust host already injects the user's full login shell PATH into
// our environment, so a plain `which` is sufficient — no need to spawn another
// login shell (which would add ~200ms of startup latency).
function resolveClaudePath(): string | undefined {
  try {
    return execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const claudePath = resolveClaudePath();
if (claudePath) {
  console.error(`[bridge] Claude CLI found: ${claudePath}`);
} else {
  console.error('[bridge] WARNING: Claude CLI not found on PATH. Claude Code provider will not work.');
  console.error('[bridge] Install with: npm install -g @anthropic-ai/claude-code');
}

// ---------------------------------------------------------------------------
// Wrapped query — injects the resolved Claude CLI path.
// MCP servers and allowedTools are handled by bridgeServer internally.
//
// Typed as SDKQueryFn so createBridgeServer accepts it without casts.
// Internally delegates to the SDK's `query` — the prompt is passed through
// unchanged, so the simplified SDKQueryFn prompt type is safe at runtime.
// ---------------------------------------------------------------------------

const wrappedQuery: SDKQueryFn = ({ prompt, options }) => {
  // Fail fast if claude CLI was not found — otherwise the SDK hangs for 30s
  if (!claudePath) {
    const errorQuery = {
      [Symbol.asyncIterator]() {
        let done = false;
        return {
          async next() {
            if (done) return { done: true, value: undefined };
            done = true;
            return {
              done: false,
              value: {
                type: 'result' as const,
                subtype: 'error' as const,
                errors: [
                  'Claude CLI not found on PATH. Install it with: npm install -g @anthropic-ai/claude-code\n' +
                  'Then restart ArchCanvas.',
                ],
                duration_ms: 0,
                duration_api_ms: 0,
                is_error: true,
                num_turns: 0,
                session_id: '',
              },
            };
          },
        };
      },
      abort() {},
      interrupt() {},
      on() { return errorQuery; },
    };
    return errorQuery as unknown as ReturnType<typeof query>;
  }

  return query({
    prompt: prompt as Parameters<typeof query>[0]['prompt'],
    options: {
      ...options,
      pathToClaudeCodeExecutable: claudePath,
    },
  });
};

// ---------------------------------------------------------------------------
// Parse CLI arguments and start server
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
const portIdx = cliArgs.indexOf('--port');
const cwdIdx = cliArgs.indexOf('--cwd');

const port = portIdx !== -1 ? parseInt(cliArgs[portIdx + 1]) : 17248;
const cwd = cwdIdx !== -1 ? cliArgs[cwdIdx + 1] : process.cwd();

const IDLE_TIMEOUT_MS = 15_000; // Exit after 15s with no connected clients

const server = createBridgeServer({
  port,
  cwd,
  queryFn: wrappedQuery,
  idleTimeoutMs: IDLE_TIMEOUT_MS,
  onIdleTimeout: async () => {
    console.log('[bridge] No clients connected for 15s — shutting down');
    await server.stop();
    process.exit(0);
  },
});
const { port: actualPort } = await server.start();

// Structured first line for Tauri sidecar port discovery
console.log(`BRIDGE_PORT=${actualPort}`);

process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
