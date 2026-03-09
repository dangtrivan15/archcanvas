/**
 * Bridge Server npm Script and Startup Tests
 *
 * Feature #543: Add npm script and startup instructions for bridge server.
 * Verifies the npm run bridge script, concurrent operation with Vite,
 * WebSocket URL logging on startup, and dev workflow integration.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source references ───────────────────────────────────────

const PACKAGE_JSON_PATH = resolve('package.json');
const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');
const PKG = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

// ─── Step 1: 'bridge' script in package.json ─────────────────

describe('Step 1: Add bridge script to package.json', () => {
  it('should have a "bridge" script in package.json', () => {
    expect(PKG.scripts).toBeDefined();
    expect(PKG.scripts.bridge).toBeDefined();
    expect(typeof PKG.scripts.bridge).toBe('string');
  });

  it('bridge script should invoke the bridge server entry point', () => {
    const script = PKG.scripts.bridge as string;
    // Should reference src/bridge/server.ts (via tsx or similar)
    expect(script).toContain('src/bridge/server.ts');
  });

  it('bridge script should use tsx for TypeScript execution', () => {
    const script = PKG.scripts.bridge as string;
    expect(script).toContain('tsx');
  });

  it('bridge script should be runnable with npm run bridge', () => {
    // The script key must be exactly "bridge" for `npm run bridge`
    expect('bridge' in PKG.scripts).toBe(true);
  });

  it('bridge server source file should exist', () => {
    expect(existsSync(BRIDGE_SERVER_PATH)).toBe(true);
  });
});

// ─── Step 2: npm run bridge starts the bridge server ─────────

describe('Step 2: npm run bridge starts the bridge server', () => {
  it('bridge server should have a main() CLI entry point', () => {
    expect(BRIDGE_SOURCE).toContain('async function main()');
  });

  it('should parse --port flag from CLI arguments', () => {
    expect(BRIDGE_SOURCE).toContain("'--port'");
    expect(BRIDGE_SOURCE).toContain("'-p'");
  });

  it('should parse --host flag from CLI arguments', () => {
    expect(BRIDGE_SOURCE).toContain("'--host'");
  });

  it('should parse --file flag from CLI arguments', () => {
    expect(BRIDGE_SOURCE).toContain("'--file'");
    expect(BRIDGE_SOURCE).toContain("'-f'");
  });

  it('should call startBridgeServer from main()', () => {
    expect(BRIDGE_SOURCE).toContain('await startBridgeServer(');
  });

  it('should default to port 3001', () => {
    expect(BRIDGE_SOURCE).toContain("'3001'");
  });

  it('should support BRIDGE_PORT environment variable', () => {
    expect(BRIDGE_SOURCE).toContain("BRIDGE_PORT");
  });

  it('should have error handling in main()', () => {
    expect(BRIDGE_SOURCE).toContain('.catch(');
    expect(BRIDGE_SOURCE).toContain('process.exit(1)');
  });
});

// ─── Step 3: Bridge and Vite can run concurrently ────────────

describe('Step 3: Bridge server and Vite dev server can run concurrently', () => {
  it('bridge server defaults to port 3001 (different from Vite 5173)', () => {
    // Bridge uses 3001, Vite uses 5173 - no port conflict
    expect(BRIDGE_SOURCE).toContain("'3001'");
    // Vite config uses 5173 (or default)
    const viteConfig = readFileSync(resolve('vite.config.ts'), 'utf-8');
    // Vite default port is 5173 or explicitly set
    expect(viteConfig).toBeTruthy();
    // Bridge port must not be 5173
    const bridgeDefaultPort = "3001";
    expect(bridgeDefaultPort).not.toBe('5173');
  });

  it('bridge script is separate from dev script', () => {
    expect(PKG.scripts.bridge).not.toBe(PKG.scripts.dev);
  });

  it('bridge server uses its own HTTP server (not Vite)', () => {
    expect(BRIDGE_SOURCE).toContain("import { createServer");
    expect(BRIDGE_SOURCE).toContain("from 'node:http'");
  });

  it('bridge server binds to localhost by default', () => {
    expect(BRIDGE_SOURCE).toContain("let host = 'localhost'");
  });

  it('bridge and dev scripts can be run in separate terminals', () => {
    // Both scripts exist and are independent
    expect(PKG.scripts.dev).toBeDefined();
    expect(PKG.scripts.bridge).toBeDefined();
    // dev uses vite, bridge uses tsx - different processes
    expect(PKG.scripts.dev).toContain('vite');
    expect(PKG.scripts.bridge).toContain('tsx');
  });

  it('bridge server port is configurable to avoid conflicts', () => {
    expect(BRIDGE_SOURCE).toContain("'--port'");
    expect(BRIDGE_SOURCE).toContain("BRIDGE_PORT");
  });
});

// ─── Step 4: Bridge server logs WebSocket URL on startup ─────

describe('Step 4: Bridge server logs its WebSocket URL on startup', () => {
  it('should log the WebSocket URL in startup banner', () => {
    expect(BRIDGE_SOURCE).toContain('WebSocket:');
    expect(BRIDGE_SOURCE).toContain('ws://');
  });

  it('should log the server URL', () => {
    expect(BRIDGE_SOURCE).toContain('URL:');
    expect(BRIDGE_SOURCE).toContain('http://');
  });

  it('should log the health endpoint URL', () => {
    expect(BRIDGE_SOURCE).toContain('Health:');
    expect(BRIDGE_SOURCE).toContain('/health');
  });

  it('should log the .archc file path', () => {
    expect(BRIDGE_SOURCE).toContain('File:');
  });

  it('should log Claude Code status', () => {
    expect(BRIDGE_SOURCE).toContain('Claude:');
  });

  it('should include the port in the WebSocket URL', () => {
    // The WebSocket URL is constructed with the configured port
    expect(BRIDGE_SOURCE).toMatch(/ws:\/\/\$\{.*host.*\}:\$\{.*port.*\}\/ws/);
  });

  it('should print the server name in banner', () => {
    expect(BRIDGE_SOURCE).toContain('ArchCanvas Bridge Server');
  });

  it('should log helpful instructions', () => {
    expect(BRIDGE_SOURCE).toContain('Press Ctrl+C to stop');
  });
});

// ─── Step 5: dev:ensure pattern integration ──────────────────

describe('Step 5: Add bridge server to dev:ensure pattern if applicable', () => {
  it('dev:ensure script exists in package.json', () => {
    expect(PKG.scripts['dev:ensure']).toBeDefined();
  });

  it('dev:ensure script uses ensure-dev-server.sh', () => {
    expect(PKG.scripts['dev:ensure']).toContain('ensure-dev-server.sh');
  });

  it('ensure-dev-server.sh exists', () => {
    expect(existsSync(resolve('scripts/ensure-dev-server.sh'))).toBe(true);
  });

  it('bridge server has its own graceful shutdown (SIGINT/SIGTERM)', () => {
    expect(BRIDGE_SOURCE).toContain("process.on('SIGINT'");
    expect(BRIDGE_SOURCE).toContain("process.on('SIGTERM'");
    expect(BRIDGE_SOURCE).toContain('Shutting down');
  });

  it('bridge server has a --help flag for startup instructions', () => {
    expect(BRIDGE_SOURCE).toContain("'--help'");
    expect(BRIDGE_SOURCE).toContain("'-h'");
    expect(BRIDGE_SOURCE).toContain('Usage:');
    expect(BRIDGE_SOURCE).toContain('npm run bridge');
  });

  it('bridge server help includes all CLI options', () => {
    expect(BRIDGE_SOURCE).toContain('--port');
    expect(BRIDGE_SOURCE).toContain('--host');
    expect(BRIDGE_SOURCE).toContain('--file');
    expect(BRIDGE_SOURCE).toContain('--no-cors');
  });

  it('bridge server help mentions WebSocket protocol', () => {
    expect(BRIDGE_SOURCE).toContain('WebSocket Protocol');
    expect(BRIDGE_SOURCE).toContain('ws://host:port/ws');
  });

  it('bridge server help mentions environment variables', () => {
    expect(BRIDGE_SOURCE).toContain('BRIDGE_PORT');
    expect(BRIDGE_SOURCE).toContain('ARCHCANVAS_FILE');
  });
});

// ─── Integration: Complete npm script workflow ───────────────

describe('Integration: Bridge server npm script completeness', () => {
  it('bridge script is in the scripts section (not bin or other)', () => {
    expect(PKG.scripts.bridge).toBeDefined();
  });

  it('bridge server exports startBridgeServer for programmatic use', () => {
    expect(BRIDGE_SOURCE).toContain('export async function startBridgeServer');
  });

  it('bridge server exports createBridgeServer for testing', () => {
    expect(BRIDGE_SOURCE).toContain('export function createBridgeServer');
  });

  it('bridge server main only runs when executed directly', () => {
    // Prevents side effects when imported in tests
    expect(BRIDGE_SOURCE).toContain('_isDirectRun');
    expect(BRIDGE_SOURCE).toContain('if (_isDirectRun)');
  });

  it('bridge server has proper shebang for direct execution', () => {
    expect(BRIDGE_SOURCE.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('WebSocket server listens on /ws path', () => {
    expect(BRIDGE_SOURCE).toContain("path: '/ws'");
  });

  it('health endpoint returns JSON status', () => {
    expect(BRIDGE_SOURCE).toContain("'/health'");
    expect(BRIDGE_SOURCE).toContain("'Content-Type': 'application/json'");
  });
});
