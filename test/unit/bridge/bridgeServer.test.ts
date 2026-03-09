/**
 * Bridge Server Tests
 *
 * Feature #534: Local bridge server with PTY spawning Claude Code process.
 * Tests the bridge server entry point, WebSocket handling, and process spawning.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source code path ────────────────────────────────────────

const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');

// ─── Step 1: Bridge server entry point exists ────────────────

describe('Step 1: Bridge server entry point', () => {
  it('should exist at src/bridge/server.ts', () => {
    expect(BRIDGE_SOURCE).toBeTruthy();
    expect(BRIDGE_SOURCE.length).toBeGreaterThan(100);
  });

  it('should export createBridgeServer function', () => {
    expect(BRIDGE_SOURCE).toContain('export function createBridgeServer');
  });

  it('should export startBridgeServer function', () => {
    expect(BRIDGE_SOURCE).toContain('export async function startBridgeServer');
  });

  it('should export BridgeServerOptions interface', () => {
    expect(BRIDGE_SOURCE).toContain('export interface BridgeServerOptions');
  });

  it('should have a CLI entry point with argument parsing', () => {
    expect(BRIDGE_SOURCE).toContain('async function main()');
    expect(BRIDGE_SOURCE).toContain('process.argv');
    expect(BRIDGE_SOURCE).toContain("'--port'");
    expect(BRIDGE_SOURCE).toContain("'--file'");
    expect(BRIDGE_SOURCE).toContain("'--host'");
  });
});

// ─── Step 2: ws (WebSocket) dependency ───────────────────────

describe('Step 2: WebSocket dependency', () => {
  it('should import WebSocketServer and WebSocket from ws', () => {
    expect(BRIDGE_SOURCE).toContain("import { WebSocketServer, WebSocket } from 'ws'");
  });

  it('ws package should be in dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.dependencies.ws).toBeDefined();
  });

  it('@types/ws should be in devDependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.devDependencies['@types/ws']).toBeDefined();
  });
});

// ─── Step 3: Spawns claude CLI process ───────────────────────

describe('Step 3: Spawns claude CLI process', () => {
  it('should import spawn from child_process', () => {
    expect(BRIDGE_SOURCE).toContain("import { spawn, type ChildProcess } from 'node:child_process'");
  });

  it('should have a spawnClaudeCode function', () => {
    expect(BRIDGE_SOURCE).toContain('function spawnClaudeCode');
  });

  it('should spawn the claude CLI command', () => {
    expect(BRIDGE_SOURCE).toContain("spawn('claude'");
  });

  it('should pipe stdin, stdout, stderr', () => {
    expect(BRIDGE_SOURCE).toContain("stdio: ['pipe', 'pipe', 'pipe']");
  });

  it('should pass --allowedTools flag for MCP tools', () => {
    expect(BRIDGE_SOURCE).toContain("'--allowedTools'");
    expect(BRIDGE_SOURCE).toContain("'mcp__archcanvas__*'");
  });
});

// ─── Step 4: MCP server configuration ───────────────────────

describe('Step 4: Configure Claude Code with MCP server for .archc file', () => {
  it('should have buildMcpConfig function', () => {
    expect(BRIDGE_SOURCE).toContain('function buildMcpConfig');
  });

  it('should create MCP config with archcanvas server', () => {
    expect(BRIDGE_SOURCE).toContain('mcpServers');
    expect(BRIDGE_SOURCE).toContain('archcanvas');
  });

  it('should pass --mcp-config to claude CLI', () => {
    expect(BRIDGE_SOURCE).toContain("'--mcp-config'");
  });

  it('should reference the CLI mcp command for the MCP server', () => {
    // The MCP config should use the CLI index.ts with mcp subcommand
    expect(BRIDGE_SOURCE).toContain("'mcp'");
    expect(BRIDGE_SOURCE).toContain("'--file'");
  });

  it('should resolve the archc file path', () => {
    expect(BRIDGE_SOURCE).toContain('resolve(archcFile)');
  });
});

// ─── Step 5: WebSocket bidirectional streaming ───────────────

describe('Step 5: WebSocket sends PTY stdout to browser and browser stdin to PTY', () => {
  it('should handle stdout data from process to WebSocket', () => {
    expect(BRIDGE_SOURCE).toContain("proc.stdout?.on('data'");
    expect(BRIDGE_SOURCE).toContain("type: 'stdout'");
  });

  it('should handle stderr data from process to WebSocket', () => {
    expect(BRIDGE_SOURCE).toContain("proc.stderr?.on('data'");
    expect(BRIDGE_SOURCE).toContain("type: 'stderr'");
  });

  it('should handle stdin from WebSocket to process', () => {
    expect(BRIDGE_SOURCE).toContain("case 'stdin':");
    expect(BRIDGE_SOURCE).toContain('proc.stdin?.writable');
    expect(BRIDGE_SOURCE).toContain('proc.stdin.write(message.data)');
  });

  it('should handle process exit events', () => {
    expect(BRIDGE_SOURCE).toContain("proc.on('exit'");
    expect(BRIDGE_SOURCE).toContain("type: 'exit'");
  });

  it('should handle signal forwarding (SIGINT, SIGTERM)', () => {
    expect(BRIDGE_SOURCE).toContain("case 'signal':");
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGINT')");
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGTERM')");
  });

  it('should send ready message on connection', () => {
    expect(BRIDGE_SOURCE).toContain("type: 'ready'");
  });

  it('should clean up process on WebSocket close', () => {
    expect(BRIDGE_SOURCE).toContain("ws.on('close'");
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGTERM')");
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGKILL')");
  });

  it('should export message type interfaces', () => {
    expect(BRIDGE_SOURCE).toContain('export interface BridgeInputMessage');
    expect(BRIDGE_SOURCE).toContain('export interface BridgeOutputMessage');
  });
});

// ─── Step 6: Configurable port ───────────────────────────────

describe('Step 6: Bridge server starts on configurable port', () => {
  it('should default to port 3001', () => {
    expect(BRIDGE_SOURCE).toContain("'3001'");
  });

  it('should support BRIDGE_PORT environment variable', () => {
    expect(BRIDGE_SOURCE).toContain("process.env['BRIDGE_PORT']");
  });

  it('should support --port CLI flag', () => {
    expect(BRIDGE_SOURCE).toContain("'--port'");
    expect(BRIDGE_SOURCE).toContain("'-p'");
  });

  it('should have a health endpoint', () => {
    expect(BRIDGE_SOURCE).toContain("/health");
    expect(BRIDGE_SOURCE).toContain("status: 'ok'");
  });

  it('should create WebSocket server on /ws path', () => {
    expect(BRIDGE_SOURCE).toContain("path: '/ws'");
  });

  it('should support CORS headers', () => {
    expect(BRIDGE_SOURCE).toContain('Access-Control-Allow-Origin');
  });

  it('should handle graceful shutdown', () => {
    expect(BRIDGE_SOURCE).toContain('SIGINT');
    expect(BRIDGE_SOURCE).toContain('SIGTERM');
    expect(BRIDGE_SOURCE).toContain('shutdown');
  });
});

// ─── Step 7: npm script ─────────────────────────────────────

describe('Step 7: npm script to start the bridge server', () => {
  it('should have a "bridge" script in package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.scripts.bridge).toBeDefined();
  });

  it('bridge script should run the bridge server via tsx', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.scripts.bridge).toContain('tsx');
    expect(pkg.scripts.bridge).toContain('src/bridge/server.ts');
  });
});

// ─── Integration: createBridgeServer ─────────────────────────

describe('Integration: createBridgeServer creates HTTP + WS server', () => {
  let mod: typeof import('@/bridge/server');

  beforeEach(async () => {
    mod = await import('@/bridge/server');
  });

  it('should export createBridgeServer', () => {
    expect(typeof mod.createBridgeServer).toBe('function');
  });

  it('should create httpServer and wss from createBridgeServer', () => {
    const { httpServer, wss } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
    });

    expect(httpServer).toBeDefined();
    expect(wss).toBeDefined();

    // Clean up
    wss.close();
    httpServer.close();
  });

  it('should respond to health check on HTTP', async () => {
    const { httpServer, wss } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
      archcFile: undefined,
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, 'localhost', () => resolve());
      httpServer.on('error', reject);
    });

    const addr = httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('No address');

    const res = await fetch(`http://localhost:${addr.port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');

    // Clean up
    wss.close();
    httpServer.close();
  });

  it('should return 404 for unknown paths', async () => {
    const { httpServer, wss } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, 'localhost', () => resolve());
      httpServer.on('error', reject);
    });

    const addr = httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('No address');

    const res = await fetch(`http://localhost:${addr.port}/unknown`);
    expect(res.status).toBe(404);

    // Clean up
    wss.close();
    httpServer.close();
  });
});
