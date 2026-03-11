/**
 * Reconnect or Restart Claude Code if Process Dies
 *
 * Feature #540: If the Claude Code process crashes or exits unexpectedly,
 * detect this via the PTY exit event and show a message in the terminal:
 * "Claude Code exited. Press Enter to restart." Allow the user to restart
 * the session.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source code ──────────────────────────────────────────────

const TERMINAL_STORE_PATH = resolve('src/store/terminalStore.ts');
const TERMINAL_STORE_SOURCE = readFileSync(TERMINAL_STORE_PATH, 'utf-8');

const TERMINAL_PANEL_PATH = resolve('src/components/panels/TerminalPanel.tsx');
const TERMINAL_PANEL_SOURCE = readFileSync(TERMINAL_PANEL_PATH, 'utf-8');

const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SERVER_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');

const BRIDGE_CONNECTION_PATH = resolve('src/services/bridgeConnection.ts');
const BRIDGE_CONNECTION_SOURCE = readFileSync(BRIDGE_CONNECTION_PATH, 'utf-8');

// ─── Step 1: Kill claude process — terminal shows exit message ────

describe('Step 1: Kill the claude process externally while terminal is open', () => {
  it('should have an awaitingRestart state in the terminal store', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('awaitingRestart: boolean');
    expect(TERMINAL_STORE_SOURCE).toContain('awaitingRestart: false');
  });

  it('bridge server sends exit message with code when process exits', () => {
    // proc.on('exit') sends { type: 'exit', code } to WebSocket
    expect(BRIDGE_SERVER_SOURCE).toMatch(/proc\.on\(\s*'exit'[\s\S]*?type:\s*'exit'/);
    expect(BRIDGE_SERVER_SOURCE).toMatch(/proc\.on\(\s*'exit'[\s\S]*?code/);
  });

  it('bridge server sends exit message to client when process errors', () => {
    expect(BRIDGE_SERVER_SOURCE).toMatch(/proc\.on\(\s*'error'[\s\S]*?type:\s*'error'/);
  });

  it('terminal store onMessage handler handles exit type', () => {
    expect(TERMINAL_STORE_SOURCE).toContain("message.type === 'exit'");
  });

  it('terminal store sets awaitingRestart on exit', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/message\.type\s*===\s*'exit'[\s\S]*?awaitingRestart:\s*true/);
  });
});

// ─── Step 2: Terminal shows exit message with restart prompt ────

describe('Step 2: Verify terminal shows exit message with restart prompt', () => {
  it('should write restart prompt message to xterm on exit', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('Claude Code exited. Press Enter to restart.');
  });

  it('restart prompt should be written via writeToXterm', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/message\.type\s*===\s*'exit'[\s\S]*?writeToXterm\(/);
  });

  it('restart prompt should use yellow ANSI color for visibility', () => {
    // \x1b[33m is yellow
    expect(TERMINAL_STORE_SOURCE).toContain('\\x1b[33m');
    expect(TERMINAL_STORE_SOURCE).toContain('\\x1b[0m');
  });

  it('should also add system line for exit code', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/addLine\(\s*'system'[\s\S]*?Process exited with code/);
  });

  it('exit message includes the exit code', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('message.code ?? 0');
  });
});

// ─── Step 3: Press Enter — verify new Claude Code process spawns ────

describe('Step 3: Press Enter — verify new Claude Code process spawns', () => {
  it('sendInput checks awaitingRestart before sending to bridge', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/sendInput[\s\S]*?awaitingRestart/);
  });

  it('sendInput triggers restartSession on Enter when awaiting', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/awaitingRestart[\s\S]*?input\s*===\s*'\\r'/);
    expect(TERMINAL_STORE_SOURCE).toMatch(/awaitingRestart[\s\S]*?restartSession\(\)/);
  });

  it('restartSession clears awaitingRestart flag', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?awaitingRestart:\s*false/);
  });

  it('restartSession disconnects existing connection', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?bridgeConnection\.disconnect\(\)/);
  });

  it('restartSession calls connect() to spawn a new process', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?connect\(\)/);
  });

  it('TerminalPanel onData handler checks awaitingRestart', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('awaitingRestart');
    expect(TERMINAL_PANEL_SOURCE).toMatch(/terminal\.onData[\s\S]*?awaitingRestart/);
  });

  it('TerminalPanel sends input even when not connected if awaitingRestart', () => {
    // When awaitingRestart, the onData handler should call sendInput regardless of connection status
    expect(TERMINAL_PANEL_SOURCE).toMatch(/awaitingRestart[\s\S]*?send\(data\)/);
  });

  it('restartSession is defined on the terminal store interface', () => {
    expect(TERMINAL_STORE_SOURCE).toContain('restartSession: () => void');
  });
});

// ─── Step 4: Verify new session has MCP access to same .archc file ────

describe('Step 4: Verify the new session has MCP access to the same .archc file', () => {
  it('bridge server stores archcFile for reuse across connections', () => {
    // handleConnection receives archcFile parameter each time
    expect(BRIDGE_SERVER_SOURCE).toMatch(/handleConnection\(ws,\s*archcFile/);
  });

  it('restartSession calls connect() without changing the URL', () => {
    // connect() uses the stored/default URL — same bridge server
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?state\.connect\(\)/);
  });

  it('bridge server passes archcFile to spawnClaudeCode for MCP config', () => {
    expect(BRIDGE_SERVER_SOURCE).toContain('spawnClaudeCode(archcFile)');
  });

  it('spawnClaudeCode builds MCP config with the archc file path', () => {
    expect(BRIDGE_SERVER_SOURCE).toContain('buildMcpConfig(resolvedPath)');
  });

  it('each new WebSocket connection to bridge server gets a new Claude Code process', () => {
    expect(BRIDGE_SERVER_SOURCE).toContain('claudeProcess = spawnClaudeCode');
  });

  it('bridge server wss.on(connection) calls handleConnection with archcFile', () => {
    expect(BRIDGE_SERVER_SOURCE).toMatch(/wss\.on\(\s*'connection'[\s\S]*?handleConnection\(ws,\s*archcFile/);
  });
});

// ─── Step 5: Terminal output is clean after restart ────

describe('Step 5: Verify terminal output is clean after restart (no garbled state)', () => {
  it('restartSession clears xterm screen', () => {
    // Uses clear() + escape sequence to reset terminal
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?xtermInstance[\s\S]*?\.clear\(\)/);
  });

  it('restartSession sends ANSI clear screen escape sequence', () => {
    // \x1b[2J clears screen, \x1b[H moves cursor to home
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?\\x1b\[2J\\x1b\[H/);
  });

  it('restartSession clears line-based output', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?lines:\s*\[\]/);
  });

  it('connect() adds a system line for new connection attempt', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/connect:[\s\S]*?addLine\(\s*'system'[\s\S]*?Connecting to bridge server/);
  });

  it('restartSession sets bridgeConnection to null before reconnecting', () => {
    expect(TERMINAL_STORE_SOURCE).toMatch(/restartSession:\s*\(\)\s*=>\s*\{[\s\S]*?bridgeConnection\s*=\s*null/);
  });
});

// ─── Integration: Store actions ────

describe('Integration: Terminal store awaitingRestart behavior', () => {
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

    vi.resetModules();
    terminalStoreModule = await import('@/store/terminalStore');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('awaitingRestart starts as false', () => {
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.awaitingRestart).toBe(false);
  });

  it('sendInput does not trigger restart when awaitingRestart is false', () => {
    const store = terminalStoreModule.useTerminalStore.getState();
    const restartSpy = vi.spyOn(terminalStoreModule.useTerminalStore.getState(), 'restartSession');
    store.sendInput('\r');
    expect(restartSpy).not.toHaveBeenCalled();
  });

  it('sendInput triggers restartSession when awaitingRestart is true and Enter pressed', async () => {
    const store = terminalStoreModule.useTerminalStore.getState();

    // Connect first
    store.connect('ws://localhost:9999');
    await new Promise((r) => setTimeout(r, 10));

    // Simulate exit: set awaitingRestart to true
    terminalStoreModule.useTerminalStore.setState({ awaitingRestart: true });

    // Now send Enter — should trigger restart
    store.sendInput('\r');

    // awaitingRestart should be cleared
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.awaitingRestart).toBe(false);
  });

  it('sendInput does NOT restart on non-Enter input when awaiting', () => {
    terminalStoreModule.useTerminalStore.setState({ awaitingRestart: true });
    const store = terminalStoreModule.useTerminalStore.getState();
    store.sendInput('a');

    // awaitingRestart should still be true
    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.awaitingRestart).toBe(true);
  });

  it('restartSession resets awaitingRestart and reconnects', async () => {
    const store = terminalStoreModule.useTerminalStore.getState();

    // Set up awaiting restart
    terminalStoreModule.useTerminalStore.setState({ awaitingRestart: true });

    // Call restartSession
    store.restartSession();
    await new Promise((r) => setTimeout(r, 10));

    const state = terminalStoreModule.useTerminalStore.getState();
    expect(state.awaitingRestart).toBe(false);
    // Should be connected after restart (mock WebSocket opens immediately)
    expect(state.connectionStatus).toBe('connected');
  });

  it('cleanup resets awaitingRestart', () => {
    terminalStoreModule.useTerminalStore.setState({ awaitingRestart: true });
    const store = terminalStoreModule.useTerminalStore.getState();
    store.cleanup();
    expect(terminalStoreModule.useTerminalStore.getState().awaitingRestart).toBe(false);
  });

  it('restartSession clears old lines and starts fresh', () => {
    // Add some lines first
    const store = terminalStoreModule.useTerminalStore.getState();
    store.addLine('system', 'old test line');
    store.addLine('error', 'old error line');
    expect(terminalStoreModule.useTerminalStore.getState().lines.length).toBe(2);

    // Restart clears old lines then connect() adds a new "Connecting..." line
    store.restartSession();
    const lines = terminalStoreModule.useTerminalStore.getState().lines;
    // Should only have the new "Connecting..." line, not the old ones
    expect(lines.every((l) => !l.content.includes('old'))).toBe(true);
    expect(lines.length).toBe(1);
    expect(lines[0]!.content).toContain('Connecting to bridge server');
  });
});
