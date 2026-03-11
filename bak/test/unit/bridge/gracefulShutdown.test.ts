/**
 * Graceful Claude Code Session Shutdown Tests
 *
 * Feature #539: When the terminal panel is closed, navigated away from,
 * or the app is closed, gracefully terminate the Claude Code process
 * and clean up the PTY. Avoid orphaned processes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source code ──────────────────────────────────────────────

const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');

const TERMINAL_PANEL_PATH = resolve('src/components/panels/TerminalPanel.tsx');
const TERMINAL_PANEL_SOURCE = readFileSync(TERMINAL_PANEL_PATH, 'utf-8');

const TERMINAL_STORE_PATH = resolve('src/store/terminalStore.ts');
const TERMINAL_STORE_SOURCE = readFileSync(TERMINAL_STORE_PATH, 'utf-8');

const BRIDGE_CONNECTION_PATH = resolve('src/services/bridgeConnection.ts');
const BRIDGE_CONNECTION_SOURCE = readFileSync(BRIDGE_CONNECTION_PATH, 'utf-8');

// ─── Step 1: Close terminal panel tab — process terminated ────

describe('Step 1: Close terminal panel tab — process terminated', () => {
  it('should have a cleanup action in the terminal store', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('cleanup:');
    expect(TERMINAL_STORE_SOURCE).toContain('cleanup: () =>');
  });

  it('cleanup should disconnect the bridge connection', () => {
    // cleanup should call bridgeConnection.disconnect()
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?bridgeConnection\.disconnect\(\)/);
  });

  it('cleanup should set bridgeConnection to null', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?bridgeConnection\s*=\s*null/);
  });

  it('cleanup should reset connection status to disconnected', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?connectionStatus:\s*'disconnected'/);
  });

  it('cleanup should clear error state', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?currentError:\s*null/);
  });

  it('TerminalPanel should import cleanup from the store', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('s.cleanup');
  });

  it('TerminalPanel should call cleanup on unmount via useEffect return', () => {
    // There should be a useEffect that calls cleanup on unmount
    expect(TERMINAL_PANEL_SOURCE).toContain('state.cleanup()');
    // The cleanup is called inside a return function (cleanup callback)
    expect(TERMINAL_PANEL_SOURCE).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{[\s\S]*?cleanup\(\)/);
  });

  it('TerminalPanel should check connection status before cleanup on unmount', () => {
    // Should only cleanup if actually connected/connecting/reconnecting
    expect(TERMINAL_PANEL_SOURCE).toContain("connectionStatus === 'connected'");
    expect(TERMINAL_PANEL_SOURCE).toContain("connectionStatus === 'connecting'");
    expect(TERMINAL_PANEL_SOURCE).toContain("connectionStatus === 'reconnecting'");
  });

  it('bridge server should kill process with SIGTERM on WebSocket close', () => {
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGTERM')");
    expect(BRIDGE_SOURCE).toContain("ws.on('close'");
  });

  it('bridge server should force SIGKILL after 3 seconds if process not terminated', () => {
    expect(BRIDGE_SOURCE).toContain("proc.kill('SIGKILL')");
    expect(BRIDGE_SOURCE).toMatch(/setTimeout\([\s\S]*?SIGKILL[\s\S]*?3000/);
  });

  it('bridge server should log WebSocket close with reason', () => {
    expect(BRIDGE_SOURCE).toContain('WebSocket closed');
    expect(BRIDGE_SOURCE).toContain('Terminating Claude Code process');
  });

  it('bridge server should clear force-kill timer if process exits gracefully', () => {
    // proc.once('exit', ...) should clearTimeout
    expect(BRIDGE_SOURCE).toMatch(/proc\.once\(\s*'exit'/);
    expect(BRIDGE_SOURCE).toContain('clearTimeout(forceKillTimer)');
  });
});

// ─── Step 2: Close browser tab — beforeunload handler ────────

describe('Step 2: Close browser tab — beforeunload cleanup', () => {
  it('TerminalPanel should add a beforeunload event listener', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain("addEventListener('beforeunload'");
  });

  it('beforeunload handler should call cleanup on the store', () => {
    // The handleBeforeUnload function should call state.cleanup()
    expect(TERMINAL_PANEL_SOURCE).toContain('handleBeforeUnload');
    expect(TERMINAL_PANEL_SOURCE).toMatch(/handleBeforeUnload[\s\S]*?cleanup\(\)/);
  });

  it('beforeunload handler should check connection status before cleanup', () => {
    // Should not cleanup if already disconnected
    expect(TERMINAL_PANEL_SOURCE).toMatch(/handleBeforeUnload[\s\S]*?connectionStatus\s*===\s*'connected'/);
  });

  it('TerminalPanel should remove beforeunload listener on unmount', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain("removeEventListener('beforeunload'");
  });

  it('beforeunload useEffect should be separate from terminal init useEffect', () => {
    // Count separate useEffect calls - should have multiple
    const effectMatches = TERMINAL_PANEL_SOURCE.match(/useEffect\(/g);
    expect(effectMatches).toBeTruthy();
    expect(effectMatches!.length).toBeGreaterThanOrEqual(4); // init, beforeunload, unmount cleanup, resize, lines, theme
  });
});

// ─── Step 3: Navigate away and back — session state ──────────

describe('Step 3: Navigate away from terminal tab and back', () => {
  it('disconnecting on unmount resets connection status', () => {
    // cleanup sets connectionStatus to 'disconnected'
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?connectionStatus:\s*'disconnected'/);
  });

  it('disconnect also resets reconnect attempts', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?reconnectAttempt:\s*0/);
  });

  it('disconnect resets max reconnect attempts', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/cleanup:\s*\(\)\s*=>\s*\{[\s\S]*?maxReconnectAttempts:\s*0/);
  });

  it('store connect() can be called again after cleanup for new session', () => {
    // The connect function creates a new bridgeConnection each time
    expect(TERMINAL_STORE_SOURCE).toMatch(/connect:\s*\(url\?\:\s*string\)\s*=>\s*\{/);
    expect(TERMINAL_STORE_SOURCE).toContain('bridgeConnection = createBridgeConnection');
    expect(TERMINAL_STORE_SOURCE).toContain('bridgeConnection.connect()');
  });

  it('connect() disconnects existing connection before creating new one', () => {
    // Inside connect, if bridgeConnection exists, disconnect first
    expect(TERMINAL_STORE_SOURCE).toMatch(/connect:\s*\(url\?\:\s*string\)\s*=>\s*\{[\s\S]*?if\s*\(bridgeConnection\)\s*\{[\s\S]*?bridgeConnection\.disconnect\(\)/);
  });

  it('xterm instance is set to null on unmount and re-set on mount', () => {
    // setXtermInstance(null) in cleanup
    expect(TERMINAL_PANEL_SOURCE).toContain('setXtermInstance(null)');
    // setXtermInstance(terminal) when initializing
    expect(TERMINAL_PANEL_SOURCE).toContain('setXtermInstance(terminal)');
  });
});

// ─── Step 4: No orphaned processes after app exit ────────────

describe('Step 4: No orphaned claude processes after app exit', () => {
  it('bridge server has SIGTERM process kill in ws.on close handler', () => {
    expect(BRIDGE_SOURCE).toMatch(/ws\.on\(\s*'close'[\s\S]*?proc\.kill\(\s*'SIGTERM'\s*\)/);
  });

  it('bridge server has force SIGKILL fallback', () => {
    expect(BRIDGE_SOURCE).toMatch(/proc\.kill\(\s*'SIGKILL'\s*\)/);
  });

  it('bridge server shutdown handler closes all WS clients', () => {
    expect(BRIDGE_SOURCE).toContain('wss.clients.forEach');
    expect(BRIDGE_SOURCE).toContain('client.close()');
  });

  it('bridge server listens for SIGINT and SIGTERM for graceful shutdown', () => {
    expect(BRIDGE_SOURCE).toContain("process.on('SIGINT'");
    expect(BRIDGE_SOURCE).toContain("process.on('SIGTERM'");
  });

  it('bridge server sends exit message to clients before closing', () => {
    // During shutdown, sends { type: 'exit' } to each client
    expect(BRIDGE_SOURCE).toMatch(/shutdown[\s\S]*?type:\s*'exit'/);
  });

  it('bridge server has a force-exit timeout during shutdown', () => {
    // setTimeout to force process.exit(1) after 5 seconds
    expect(BRIDGE_SOURCE).toMatch(/setTimeout\(\s*\(\)\s*=>\s*process\.exit\(1\)\s*,\s*5000\s*\)/);
  });

  it('bridgeConnection disconnect sends close code 1000', () => {
    // Client-side: ws.close(1000, ...) for intentional close
    expect(BRIDGE_CONNECTION_SOURCE).toContain("ws.close(1000, 'Client disconnected')");
  });

  it('bridgeConnection disconnect clears reconnect timer', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('clearReconnectTimer()');
  });

  it('bridgeConnection sets intentionalClose flag on disconnect', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('intentionalClose = true');
  });

  it('bridge server logs process termination', () => {
    expect(BRIDGE_SOURCE).toContain('Claude Code process terminated');
  });
});

// ─── Step 5: Multiple connect/disconnect cycles ──────────────

describe('Step 5: Bridge server handles multiple connect/disconnect cycles', () => {
  it('each WebSocket connection spawns a separate Claude Code process', () => {
    // handleConnection creates its own claudeProcess per connection
    expect(BRIDGE_SOURCE).toContain('let claudeProcess: ChildProcess | null = null');
    expect(BRIDGE_SOURCE).toContain('claudeProcess = spawnClaudeCode');
  });

  it('bridge server logs active connection count', () => {
    expect(BRIDGE_SOURCE).toContain('wss.clients.size');
  });

  it('WebSocket close kills only the associated process (scoped to handler)', () => {
    // proc is scoped to handleConnection, not global
    expect(BRIDGE_SOURCE).toContain('const proc = claudeProcess');
    // ws.on('close') references the local proc variable
    expect(BRIDGE_SOURCE).toMatch(/ws\.on\(\s*'close'[\s\S]*?if\s*\(\s*proc\s*&&\s*!proc\.killed\s*\)/);
  });

  it('client-side connect() creates a fresh bridgeConnection each time', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('bridgeConnection = createBridgeConnection(bridgeUrl, callbacks)');
  });

  it('client-side createBridgeConnection starts with clean state', () => {
    // Each call to createBridgeConnection starts fresh
    expect(BRIDGE_CONNECTION_SOURCE).toContain("let ws: WebSocket | null = null");
    expect(BRIDGE_CONNECTION_SOURCE).toContain("let status: BridgeConnectionStatus = 'disconnected'");
    expect(BRIDGE_CONNECTION_SOURCE).toContain("let reconnectAttempts = 0");
  });

  it('process exit closes the WebSocket from server side', () => {
    // proc.on('exit') sends exit message and closes ws
    expect(BRIDGE_SOURCE).toMatch(/proc\.on\(\s*'exit'[\s\S]*?ws\.close\(\)/);
  });

  it('process error closes the WebSocket from server side', () => {
    // proc.on('error') sends error message and closes ws
    expect(BRIDGE_SOURCE).toMatch(/proc\.on\(\s*'error'[\s\S]*?ws\.close\(\)/);
  });
});

// ─── Integration: Cleanup store action ───────────────────────

describe('Integration: cleanup store action', () => {
  let terminalStoreModule: typeof import('@/store/terminalStore');

  beforeEach(async () => {
    // Mock WebSocket
    vi.stubGlobal('WebSocket', class MockWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      static CONNECTING = 0;
      readyState = 1;
      onopen: ((ev: Event) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      close = vi.fn();
      send = vi.fn();
      constructor() {
        setTimeout(() => this.onopen?.(new Event('open')), 0);
      }
    });

    // Reset module state
    vi.resetModules();
    terminalStoreModule = await import('@/store/terminalStore');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cleanup resets state when disconnected (no-op on bridge)', () => {
    const store = terminalStoreModule.useTerminalStore.getState();
    // When disconnected, cleanup should be safe to call
    store.cleanup();
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.currentError).toBeNull();
    expect(state.reconnectAttempt).toBe(0);
  });

  it('cleanup after connect resets status to disconnected', async () => {
    const store = terminalStoreModule.useTerminalStore.getState();
    store.connect('ws://localhost:9999');

    // Wait for async connect
    await new Promise((r) => setTimeout(r, 10));

    // Should be connected (mock WebSocket calls onopen)
    const connected = terminalStoreModule.useTerminalStore.getState().connectionStatus;
    expect(connected).toBe('connected');

    // Now cleanup
    store.cleanup();
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.connectionStatus).toBe('disconnected');
  });

  it('connect works after cleanup (new session)', async () => {
    const store = terminalStoreModule.useTerminalStore.getState();
    store.connect('ws://localhost:9999');
    await new Promise((r) => setTimeout(r, 10));
    store.cleanup();

    // Connect again
    store.connect('ws://localhost:9999');
    await new Promise((r) => setTimeout(r, 10));
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.connectionStatus).toBe('connected');
  });

  it('cleanup action is exported from the store interface', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('cleanup: () => void');
  });
});
