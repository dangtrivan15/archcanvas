#!/usr/bin/env node
/**
 * ArchCanvas Bridge Server
 *
 * A thin local server that spawns a Claude Code CLI process and exposes a
 * WebSocket endpoint for bidirectional streaming between the browser and the
 * Claude Code process. The Claude Code instance is configured with an MCP
 * server pointing to the current .archc file so it can read/modify the
 * architecture.
 *
 * Architecture:
 *   Browser <--WebSocket--> BridgeServer <--stdin/stdout--> Claude Code CLI
 *
 * Usage:
 *   npx tsx src/bridge/server.ts [options]
 *   npm run bridge -- --file myarch.archc --port 3001
 *
 * Environment:
 *   BRIDGE_PORT  – Server port (default: 3001)
 *   ARCHCANVAS_FILE – Path to .archc file
 */

import { createServer, type Server as HttpServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';

// ─── Types ────────────────────────────────────────────────────

export interface BridgeServerOptions {
  /** Port for the HTTP/WebSocket server (default: 3001) */
  port: number;
  /** Hostname to bind to (default: localhost) */
  host: string;
  /** Path to the .archc file for the MCP server */
  archcFile?: string;
  /** Enable CORS headers (default: true) */
  cors: boolean;
}

/** Message sent from browser to bridge over WebSocket */
export interface BridgeInputMessage {
  type: 'stdin' | 'resize' | 'signal';
  /** Text to write to claude CLI stdin (for type: 'stdin') */
  data?: string;
  /** Terminal dimensions (for type: 'resize') */
  cols?: number;
  rows?: number;
  /** Signal name (for type: 'signal') */
  signal?: 'SIGINT' | 'SIGTERM';
}

/** Message sent from bridge to browser over WebSocket */
export interface BridgeOutputMessage {
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'ready';
  /** Output data (for type: 'stdout' or 'stderr') */
  data?: string;
  /** Exit code (for type: 'exit') */
  code?: number | null;
  /** Error message (for type: 'error') */
  message?: string;
}

// ─── MCP Configuration ───────────────────────────────────────

/**
 * Build the MCP server configuration JSON for Claude Code.
 * Points the archcanvas MCP server at the given .archc file.
 */
function buildMcpConfig(archcFilePath: string): Record<string, unknown> {
  // Resolve the CLI entry point - use tsx to run TypeScript directly in dev
  const cliEntryPoint = resolve(dirname(new URL(import.meta.url).pathname), '..', 'cli', 'index.ts');
  const cliDistEntryPoint = resolve(dirname(new URL(import.meta.url).pathname), '..', '..', 'dist', 'cli', 'index.js');

  // Prefer the built CLI if it exists, otherwise use tsx + source
  const useBuilt = existsSync(cliDistEntryPoint);
  const command = useBuilt ? 'node' : 'npx';
  const args = useBuilt
    ? [cliDistEntryPoint, 'mcp', '--file', archcFilePath]
    : ['tsx', cliEntryPoint, 'mcp', '--file', archcFilePath];

  return {
    mcpServers: {
      archcanvas: {
        command,
        args,
      },
    },
  };
}

// ─── Claude Code Process ─────────────────────────────────────

/**
 * Spawn a Claude Code CLI process with MCP server configuration.
 * Returns the child process for stdin/stdout piping.
 */
function spawnClaudeCode(archcFile?: string): ChildProcess {
  const args: string[] = [
    '--allowedTools', 'mcp__archcanvas__*',
  ];

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    // Disable interactive prompts
    CLAUDE_CODE_NON_INTERACTIVE: '1',
  };

  // Add MCP config if an .archc file is specified
  if (archcFile) {
    const resolvedPath = resolve(archcFile);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Architecture file not found: ${resolvedPath}`);
    }
    const mcpConfig = buildMcpConfig(resolvedPath);
    args.push('--mcp-config', JSON.stringify(mcpConfig));
  }

  const child = spawn('claude', args, {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    // Use shell on Windows for PATH resolution
    shell: process.platform === 'win32',
  });

  return child;
}

// ─── WebSocket Handler ───────────────────────────────────────

/**
 * Handle a single WebSocket connection.
 * Spawns a Claude Code process and pipes data bidirectionally.
 */
function handleConnection(ws: WebSocket, archcFile?: string): void {
  let claudeProcess: ChildProcess | null = null;

  try {
    claudeProcess = spawnClaudeCode(archcFile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errorMsg: BridgeOutputMessage = { type: 'error', message };
    ws.send(JSON.stringify(errorMsg));
    ws.close();
    return;
  }

  const proc = claudeProcess;

  // Send ready message
  const readyMsg: BridgeOutputMessage = { type: 'ready' };
  ws.send(JSON.stringify(readyMsg));

  // Pipe stdout to WebSocket
  proc.stdout?.on('data', (chunk: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      const msg: BridgeOutputMessage = { type: 'stdout', data: chunk.toString('utf-8') };
      ws.send(JSON.stringify(msg));
    }
  });

  // Pipe stderr to WebSocket
  proc.stderr?.on('data', (chunk: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      const msg: BridgeOutputMessage = { type: 'stderr', data: chunk.toString('utf-8') };
      ws.send(JSON.stringify(msg));
    }
  });

  // Process exit
  proc.on('exit', (code: number | null) => {
    if (ws.readyState === WebSocket.OPEN) {
      const msg: BridgeOutputMessage = { type: 'exit', code };
      ws.send(JSON.stringify(msg));
      ws.close();
    }
  });

  proc.on('error', (err: Error) => {
    if (ws.readyState === WebSocket.OPEN) {
      const msg: BridgeOutputMessage = { type: 'error', message: err.message };
      ws.send(JSON.stringify(msg));
      ws.close();
    }
  });

  // Handle incoming messages from browser
  ws.on('message', (raw: Buffer | string) => {
    try {
      const message: BridgeInputMessage = JSON.parse(
        typeof raw === 'string' ? raw : raw.toString('utf-8'),
      );

      switch (message.type) {
        case 'stdin':
          if (message.data && proc.stdin?.writable) {
            proc.stdin.write(message.data);
          }
          break;

        case 'signal':
          if (message.signal === 'SIGINT') {
            proc.kill('SIGINT');
          } else if (message.signal === 'SIGTERM') {
            proc.kill('SIGTERM');
          }
          break;

        case 'resize':
          // Resize is a no-op for child_process.spawn (would require node-pty)
          // Kept for API compatibility if node-pty is added later
          break;

        default:
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  });

  // Clean up on WebSocket close
  ws.on('close', () => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      // Force kill after 3 seconds if still alive
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 3000);
    }
  });
}

// ─── Server Factory ──────────────────────────────────────────

/**
 * Create and return the bridge server (HTTP + WebSocket).
 */
export function createBridgeServer(options: BridgeServerOptions): {
  httpServer: HttpServer;
  wss: WebSocketServer;
} {
  const { cors, archcFile } = options;

  // Create HTTP server for health checks and CORS preflight
  const httpServer = createServer((req, res) => {
    // CORS headers
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        archcFile: archcFile ?? null,
        uptime: process.uptime(),
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use WebSocket at /ws' }));
  });

  // Create WebSocket server on /ws path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    process.stderr.write(`[Bridge] New WebSocket connection\n`);
    handleConnection(ws, archcFile);
  });

  wss.on('error', (err: Error) => {
    process.stderr.write(`[Bridge] WebSocket server error: ${err.message}\n`);
  });

  return { httpServer, wss };
}

// ─── Start Server ────────────────────────────────────────────

/**
 * Start the bridge server and listen on the configured port.
 */
export async function startBridgeServer(options: BridgeServerOptions): Promise<HttpServer> {
  const { httpServer, wss } = createBridgeServer(options);

  return new Promise((resolve, reject) => {
    httpServer.on('error', (err: Error) => {
      reject(err);
    });

    httpServer.listen(options.port, options.host, () => {
      const url = `http://${options.host}:${options.port}`;
      process.stderr.write(`\nArchCanvas Bridge Server\n`);
      process.stderr.write(`  URL:       ${url}\n`);
      process.stderr.write(`  WebSocket: ws://${options.host}:${options.port}/ws\n`);
      process.stderr.write(`  Health:    ${url}/health\n`);
      process.stderr.write(`  File:      ${options.archcFile ?? '(none)'}\n\n`);
      process.stderr.write(`The bridge spawns a Claude Code process per WebSocket connection.\n`);
      process.stderr.write(`Claude Code is configured with the ArchCanvas MCP server.\n\n`);
      process.stderr.write(`Press Ctrl+C to stop.\n\n`);

      // Graceful shutdown
      const shutdown = (signal: string) => {
        process.stderr.write(`\n${signal} received. Shutting down...\n`);

        // Close all WebSocket connections
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            const msg: BridgeOutputMessage = { type: 'exit', code: null };
            client.send(JSON.stringify(msg));
            client.close();
          }
        });

        wss.close(() => {
          httpServer.close(() => {
            process.stderr.write(`Bridge server stopped.\n`);
            process.exit(0);
          });
        });

        // Force exit after 5 seconds
        setTimeout(() => process.exit(1), 5000);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      resolve(httpServer);
    });
  });
}

// ─── CLI Entry Point ─────────────────────────────────────────

async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  let port = parseInt(process.env['BRIDGE_PORT'] ?? '3001', 10);
  let host = 'localhost';
  let archcFile: string | undefined;
  let cors = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
      case '-p':
        port = parseInt(args[++i] ?? '3001', 10);
        break;
      case '--host':
        host = args[++i] ?? 'localhost';
        break;
      case '--file':
      case '-f':
        archcFile = args[++i];
        break;
      case '--no-cors':
        cors = false;
        break;
      case '--help':
      case '-h':
        process.stdout.write(`
ArchCanvas Bridge Server

Spawns Claude Code processes with MCP access to .archc files.
Exposes a WebSocket endpoint for bidirectional streaming.

Usage:
  npx tsx src/bridge/server.ts [options]
  npm run bridge [-- options]

Options:
  -p, --port <port>    Server port (default: 3001, env: BRIDGE_PORT)
  -h, --host <host>    Server host (default: localhost)
  -f, --file <path>    Path to .archc file for MCP server
  --no-cors            Disable CORS headers
  --help               Show this help message

Environment:
  BRIDGE_PORT          Server port (overridden by --port)
  ARCHCANVAS_FILE      Path to .archc file (overridden by --file)

WebSocket Protocol:
  Connect to ws://host:port/ws

  Browser -> Server (JSON):
    { "type": "stdin", "data": "user input text" }
    { "type": "signal", "signal": "SIGINT" }
    { "type": "resize", "cols": 80, "rows": 24 }

  Server -> Browser (JSON):
    { "type": "ready" }
    { "type": "stdout", "data": "output text" }
    { "type": "stderr", "data": "error text" }
    { "type": "exit", "code": 0 }
    { "type": "error", "message": "description" }
`);
        process.exit(0);
    }
  }

  // Allow ARCHCANVAS_FILE env var as fallback
  if (!archcFile && process.env['ARCHCANVAS_FILE']) {
    archcFile = process.env['ARCHCANVAS_FILE'];
  }

  await startBridgeServer({ port, host, archcFile, cors });
}

// Only run main() when this file is executed directly
const _isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const resolved = new URL('file://' + realpathSync(process.argv[1])).href;
    return (
      import.meta.url === resolved ||
      import.meta.url.endsWith(resolved.split('/').pop()!)
    );
  } catch {
    return import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
  }
})();

if (_isDirectRun) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fatal: ${message}\n`);
    process.exit(1);
  });
}
