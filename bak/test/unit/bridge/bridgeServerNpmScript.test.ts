/**
 * Bridge Server Vite Plugin Integration Tests
 *
 * Feature #549: Integrate bridge server into Vite dev server as plugin.
 * Verifies the Vite plugin setup, WebSocket path, health endpoint,
 * removal of standalone bridge script, and dev workflow integration.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source references ───────────────────────────────────────

const PACKAGE_JSON_PATH = resolve('package.json');
const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const VITE_PLUGIN_PATH = resolve('src/bridge/viteBridgePlugin.ts');
const VITE_CONFIG_PATH = resolve('vite.config.ts');
const BRIDGE_CONNECTION_PATH = resolve('src/services/bridgeConnection.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');
const VITE_PLUGIN_SOURCE = readFileSync(VITE_PLUGIN_PATH, 'utf-8');
const VITE_CONFIG_SOURCE = readFileSync(VITE_CONFIG_PATH, 'utf-8');
const BRIDGE_CONNECTION_SOURCE = readFileSync(BRIDGE_CONNECTION_PATH, 'utf-8');
const PKG = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

// ─── Step 1: Vite plugin creates WebSocket on dev server ─────

describe('Step 1: Vite plugin (viteBridgePlugin) sets up WebSocket on the Vite dev server', () => {
  it('viteBridgePlugin.ts file exists', () => {
    expect(existsSync(VITE_PLUGIN_PATH)).toBe(true);
  });

  it('exports a viteBridgePlugin function', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('export function viteBridgePlugin');
  });

  it('plugin returns a Vite Plugin object with name archcanvas-bridge', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("name: 'archcanvas-bridge'");
  });

  it('plugin only applies during serve (dev mode)', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("apply: 'serve'");
  });

  it('plugin uses configureServer hook', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('configureServer(server');
  });

  it('plugin creates WebSocketServer in noServer mode', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('noServer: true');
  });

  it('plugin handles HTTP upgrade for /bridge path', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("on('upgrade'");
    expect(VITE_PLUGIN_SOURCE).toContain('BRIDGE_WS_PATH');
    expect(VITE_PLUGIN_SOURCE).toContain('handleUpgrade');
  });

  it('exports BRIDGE_WS_PATH constant as /bridge', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("BRIDGE_WS_PATH = '/bridge'");
  });
});

// ─── Step 2: PTY/Claude Code spawning in plugin configureServer hook ─────

describe('Step 2: Move PTY/Claude Code spawning logic into the plugin configureServer hook', () => {
  it('plugin imports handleConnection from server module', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("import");
    expect(VITE_PLUGIN_SOURCE).toContain('handleConnection');
    expect(VITE_PLUGIN_SOURCE).toContain("from './server'");
  });

  it('plugin imports detectClaudeCode from server module', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('detectClaudeCode');
  });

  it('plugin detects Claude Code on server startup', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('claudeDetection = detectClaudeCode()');
  });

  it('plugin passes detection result to handleConnection', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('handleConnection(ws, archcFile, claudeDetection');
  });

  it('plugin logs Claude Code detection result', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('[Bridge] Claude Code detected');
    expect(VITE_PLUGIN_SOURCE).toContain('[Bridge] WARNING');
  });

  it('server.ts exports handleConnection', () => {
    expect(BRIDGE_SOURCE).toContain('export function handleConnection');
  });

  it('server.ts exports detectClaudeCode', () => {
    expect(BRIDGE_SOURCE).toContain('export function detectClaudeCode');
  });
});

// ─── Step 3: Terminal panel connects to Vite server WebSocket path ─────

describe('Step 3: Update terminal panel WebSocket URL to derive from window.location', () => {
  it('bridgeConnection exports getBridgeUrl function', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('export function getBridgeUrl()');
  });

  it('getBridgeUrl derives protocol from window.location.protocol', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("window.location.protocol === 'https:'");
    expect(BRIDGE_CONNECTION_SOURCE).toContain("'wss:'");
    expect(BRIDGE_CONNECTION_SOURCE).toContain("'ws:'");
  });

  it('getBridgeUrl derives host from window.location.host', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('window.location.host');
  });

  it('getBridgeUrl appends BRIDGE_WS_PATH', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('BRIDGE_WS_PATH');
  });

  it('getBridgeUrl has fallback for non-browser environments', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("typeof window !== 'undefined'");
  });

  it('BRIDGE_WS_PATH is /bridge', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("BRIDGE_WS_PATH = '/bridge'");
  });

  it('no hardcoded localhost:3100 or localhost:5173 in bridge WebSocket URL', () => {
    // DEFAULT_BRIDGE_URL is now derived from getBridgeUrl(), not hardcoded
    expect(BRIDGE_CONNECTION_SOURCE).not.toMatch(/DEFAULT_BRIDGE_URL\s*=\s*'wss?:\/\/localhost:\d+/);
  });
});

// ─── Step 4: Standalone bridge entry point removed ─────

describe('Step 4: Remove the standalone bridge server entry point', () => {
  it('server.ts no longer has a main() CLI entry point function', () => {
    expect(BRIDGE_SOURCE).not.toContain('async function main()');
  });

  it('server.ts no longer has shebang line', () => {
    expect(BRIDGE_SOURCE.startsWith('#!/usr/bin/env node')).toBe(false);
  });

  it('server.ts no longer has _isDirectRun check', () => {
    expect(BRIDGE_SOURCE).not.toContain('_isDirectRun');
  });

  it('server.ts contains note about Vite plugin migration', () => {
    expect(BRIDGE_SOURCE).toContain('viteBridgePlugin');
  });

  it('server.ts still exports core functions for the plugin', () => {
    expect(BRIDGE_SOURCE).toContain('export function detectClaudeCode');
    expect(BRIDGE_SOURCE).toContain('export function createBridgeServer');
    expect(BRIDGE_SOURCE).toContain('export function handleConnection');
  });
});

// ─── Step 5: npm run bridge script removed ─────

describe('Step 5: Remove npm run bridge script from package.json', () => {
  it('package.json does not have a "bridge" script', () => {
    expect(PKG.scripts.bridge).toBeUndefined();
  });

  it('dev script still exists and uses vite', () => {
    expect(PKG.scripts.dev).toBeDefined();
    expect(PKG.scripts.dev).toContain('vite');
  });

  it('dev:ensure script still exists', () => {
    expect(PKG.scripts['dev:ensure']).toBeDefined();
  });
});

// ─── Step 6: npm run dev automatically starts bridge ─────

describe('Step 6: npm run dev starts with bridge automatically available', () => {
  it('vite.config.ts imports viteBridgePlugin', () => {
    expect(VITE_CONFIG_SOURCE).toContain("import { viteBridgePlugin }");
    expect(VITE_CONFIG_SOURCE).toContain("from './src/bridge/viteBridgePlugin'");
  });

  it('vite.config.ts includes viteBridgePlugin in plugins array', () => {
    expect(VITE_CONFIG_SOURCE).toContain('viteBridgePlugin(');
  });

  it('vite.config.ts passes ARCHCANVAS_FILE env var to plugin', () => {
    expect(VITE_CONFIG_SOURCE).toContain('process.env.ARCHCANVAS_FILE');
  });

  it('plugin is excluded during test mode', () => {
    // Both basicSsl and viteBridgePlugin are excluded during test
    expect(VITE_CONFIG_SOURCE).toContain("process.env.NODE_ENV !== 'test'");
  });
});

// ─── Step 7: Terminal panel connects without manual bridge startup ─────

describe('Step 7: Terminal panel connects without manual bridge startup', () => {
  it('terminal store uses getBridgeUrl which derives URL from window.location', () => {
    const terminalStoreSource = readFileSync(resolve('src/store/terminalStore.ts'), 'utf-8');
    expect(terminalStoreSource).toContain('getBridgeUrl');
  });

  it('bridge connection derives URL dynamically (no hardcoded localhost URL)', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('getBridgeUrl');
    expect(BRIDGE_CONNECTION_SOURCE).toContain('window.location.host');
  });
});

// ─── Step 8: Capacitor dev mode compatibility ─────

describe('Step 8: Capacitor dev mode (dev:ios) also has bridge available', () => {
  it('dev:ios script exists and uses cap run', () => {
    expect(PKG.scripts['dev:ios']).toBeDefined();
    expect(PKG.scripts['dev:ios']).toContain('cap run');
  });

  it('plugin applies only during serve mode (vite dev)', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("apply: 'serve'");
  });

  it('Vite config has port 5173 for consistency across modes', () => {
    expect(VITE_CONFIG_SOURCE).toContain('port: 5173');
  });
});

// ─── Step 9: Updated error message for bridge unavailable ─────

describe('Step 9: Updated error message suggests restarting dev server', () => {
  it('bridge_not_running message says to restart dev server', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('Restart the dev server with npm run dev');
  });

  it('bridge_not_running action says Restart: npm run dev', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("action: 'Restart: npm run dev'");
  });

  it('error message does not reference npm run bridge', () => {
    expect(BRIDGE_CONNECTION_SOURCE).not.toContain('npm run bridge');
  });
});

// ─── Integration: Plugin health endpoint and WebSocket ─────

describe('Integration: Vite bridge plugin completeness', () => {
  it('plugin adds /bridge/health middleware endpoint', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('/bridge/health');
    expect(VITE_PLUGIN_SOURCE).toContain('application/json');
  });

  it('health endpoint returns status, archcFile, uptime, and claude info', () => {
    expect(VITE_PLUGIN_SOURCE).toContain("status: 'ok'");
    expect(VITE_PLUGIN_SOURCE).toContain('archcFile');
    expect(VITE_PLUGIN_SOURCE).toContain('uptime');
    expect(VITE_PLUGIN_SOURCE).toContain('claude:');
  });

  it('plugin logs WebSocket endpoint URL when server starts', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('[Bridge] WebSocket endpoint');
  });

  it('plugin logs health check URL when server starts', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('[Bridge] Health check');
  });

  it('plugin supports enabled option to disable bridge', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('enabled');
    expect(VITE_PLUGIN_SOURCE).toContain('if (!enabled) return');
  });

  it('plugin supports archcFile option', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('archcFile');
  });

  it('plugin exports ViteBridgePluginOptions interface', () => {
    expect(VITE_PLUGIN_SOURCE).toContain('export interface ViteBridgePluginOptions');
  });
});
