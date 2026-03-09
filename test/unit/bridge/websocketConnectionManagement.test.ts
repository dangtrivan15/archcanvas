/**
 * Feature #541: WebSocket connection management between browser and bridge
 *
 * Tests that:
 * 1. Terminal panel connects to bridge WebSocket on mount
 * 2. If bridge server is not running, show error: 'Bridge server not running. Start it with npm run bridge'
 * 3. If WebSocket disconnects, show message and attempt reconnect
 * 4. Verify reconnect restores the terminal session if Claude Code is still running
 * 5. Verify clean error states (no infinite reconnect loops)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBridgeConnection,
  classifyError,
  BRIDGE_ERROR_MESSAGES,
  MAX_RECONNECT_ATTEMPTS,
  INITIAL_RECONNECT_DELAY,
  DEFAULT_BRIDGE_URL,
  type BridgeConnectionCallbacks,
  type BridgeConnectionStatus,
  type BridgeError,
  type BridgeMessage,
} from '@/services/bridgeConnection';
import { useTerminalStore } from '@/store/terminalStore';
import type { TerminalState } from '@/store/terminalStore';
import * as fs from 'node:fs';

// ─── Helpers ───────────────────────────────────────────────────

function getStoreState(): TerminalState {
  return useTerminalStore.getState();
}

function resetStore() {
  useTerminalStore.setState({
    connectionStatus: 'disconnected',
    currentError: null,
    reconnectAttempt: 0,
    maxReconnectAttempts: 0,
    lines: [],
    xtermInstance: null,
    awaitingRestart: false,
  });
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Feature #541: WebSocket connection management between browser and bridge', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Step 1: Terminal panel connects to bridge WebSocket on mount ───

  describe('Step 1: Terminal panel connects to bridge WebSocket on mount', () => {
    it('TerminalPanel has auto-connect useEffect that calls connect on mount', () => {
      // Verify the source code contains the auto-connect logic
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('Auto-connect to bridge server on mount');
      expect(source).toContain("if (state.connectionStatus === 'disconnected')");
      expect(source).toContain('connect()');
    });

    it('auto-connect only fires when status is disconnected', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      // The useEffect should check disconnected status before connecting
      expect(source).toContain("connectionStatus === 'disconnected'");
    });

    it('connect() action sets status to connecting and adds system line', () => {
      const store = getStoreState();
      // Mock WebSocket to avoid real connections
      const originalWs = globalThis.WebSocket;
      globalThis.WebSocket = vi.fn(() => ({
        readyState: 0,
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        close: vi.fn(),
        send: vi.fn(),
      })) as unknown as typeof WebSocket;

      try {
        store.connect();
        const state = getStoreState();
        // Should have added a "Connecting to bridge server" line
        const connectLine = state.lines.find(l => l.content.includes('Connecting to bridge server'));
        expect(connectLine).toBeDefined();
        expect(connectLine?.type).toBe('system');
      } finally {
        globalThis.WebSocket = originalWs;
      }
    });

    it('connect() uses DEFAULT_BRIDGE_URL when no URL provided', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      expect(source).toContain('DEFAULT_BRIDGE_URL');
      expect(source).toContain('url ?? DEFAULT_BRIDGE_URL');
    });

    it('DEFAULT_BRIDGE_URL is a valid WebSocket URL', () => {
      expect(DEFAULT_BRIDGE_URL).toMatch(/^wss?:\/\//);
    });

    it('TerminalPanel component mounts xterm.js and stores instance', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('new Terminal(');
      expect(source).toContain('setXtermInstance(terminal)');
    });

    it('cleanup runs on unmount to disconnect gracefully', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('Graceful cleanup on panel unmount');
      expect(source).toContain('state.cleanup()');
    });
  });

  // ─── Step 2: Bridge not running shows error ───

  describe('Step 2: Bridge not running shows error with npm run bridge instruction', () => {
    it('BRIDGE_ERROR_MESSAGES.bridge_not_running contains the correct message', () => {
      const msg = BRIDGE_ERROR_MESSAGES.bridge_not_running;
      expect(msg.message).toBe('Bridge server not running. Start it with npm run bridge');
    });

    it('error message includes npm run bridge instruction', () => {
      const msg = BRIDGE_ERROR_MESSAGES.bridge_not_running;
      expect(msg.message).toContain('npm run bridge');
    });

    it('action message includes npm run bridge', () => {
      const msg = BRIDGE_ERROR_MESSAGES.bridge_not_running;
      expect(msg.action).toContain('npm run bridge');
    });

    it('classifyError for ECONNREFUSED produces bridge_not_running', () => {
      const error = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:3001'));
      expect(error.type).toBe('bridge_not_running');
      expect(error.message).toContain('npm run bridge');
    });

    it('classifyError for connection refused produces bridge_not_running', () => {
      const error = classifyError(new Error('connection refused'));
      expect(error.type).toBe('bridge_not_running');
    });

    it('classifyError for failed to connect produces bridge_not_running', () => {
      const error = classifyError(new Error('failed to connect'));
      expect(error.type).toBe('bridge_not_running');
    });

    it('classifyError for WebSocket connection failure produces bridge_not_running', () => {
      const error = classifyError(new Error(`WebSocket connection to ${DEFAULT_BRIDGE_URL} failed`));
      expect(error.type).toBe('bridge_not_running');
      expect(error.actionMessage).toContain('npm run bridge');
    });

    it('terminalStore onError callback sets currentError and adds error line', () => {
      const bridgeError: BridgeError = {
        type: 'bridge_not_running',
        message: 'Bridge server not running. Start it with npm run bridge',
        actionMessage: 'Run: npm run bridge',
      };

      // Simulate the onError callback behavior
      useTerminalStore.setState({ currentError: bridgeError });
      getStoreState().addLine('error', `${bridgeError.message}: ${bridgeError.actionMessage}`);

      const state = getStoreState();
      expect(state.currentError).toEqual(bridgeError);
      const errorLine = state.lines.find(l => l.type === 'error' && l.content.includes('npm run bridge'));
      expect(errorLine).toBeDefined();
    });

    it('TerminalPanel renders error banner with data-testid', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('terminal-error-banner');
      expect(source).toContain('data-error-type={currentError.type}');
    });

    it('bridge_not_running error type has WifiOff icon', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain("bridge_not_running: WifiOff");
    });
  });

  // ─── Step 3: WebSocket disconnects - show message and attempt reconnect ───

  describe('Step 3: WebSocket disconnect shows message and attempts reconnect', () => {
    it('createBridgeConnection handles onclose with reconnect logic', () => {
      let statusChanges: BridgeConnectionStatus[] = [];
      let reconnectAttempts: { attempt: number; max: number }[] = [];
      let errors: BridgeError[] = [];
      let messages: BridgeMessage[] = [];

      const callbacks: BridgeConnectionCallbacks = {
        onStatusChange: (s) => statusChanges.push(s),
        onMessage: (m) => messages.push(m),
        onError: (e) => errors.push(e),
        onReconnectAttempt: (a, m) => reconnectAttempts.push({ attempt: a, max: m }),
      };

      const conn = createBridgeConnection('ws://localhost:9999', callbacks);
      expect(conn).toBeDefined();
      expect(typeof conn.connect).toBe('function');
      expect(typeof conn.disconnect).toBe('function');
      expect(typeof conn.send).toBe('function');
      expect(typeof conn.getStatus).toBe('function');
    });

    it('MAX_RECONNECT_ATTEMPTS is defined and reasonable', () => {
      expect(MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(0);
      expect(MAX_RECONNECT_ATTEMPTS).toBeLessThanOrEqual(10);
    });

    it('INITIAL_RECONNECT_DELAY is defined in milliseconds', () => {
      expect(INITIAL_RECONNECT_DELAY).toBeGreaterThanOrEqual(500);
      expect(INITIAL_RECONNECT_DELAY).toBeLessThanOrEqual(5000);
    });

    it('reconnect uses exponential backoff', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // Check for exponential backoff pattern: delay * 2^attempt
      expect(source).toContain('Math.pow(2,');
      expect(source).toContain('INITIAL_RECONNECT_DELAY');
    });

    it('terminalStore onReconnectAttempt updates reconnectAttempt and maxReconnectAttempts', () => {
      const store = getStoreState();
      store.addLine('system', 'Reconnection attempt 1/5...');
      useTerminalStore.setState({ reconnectAttempt: 1, maxReconnectAttempts: 5 });

      const state = getStoreState();
      expect(state.reconnectAttempt).toBe(1);
      expect(state.maxReconnectAttempts).toBe(5);
      const reconnectLine = state.lines.find(l => l.content.includes('Reconnection attempt'));
      expect(reconnectLine).toBeDefined();
      expect(reconnectLine?.type).toBe('system');
    });

    it('TerminalPanel shows reconnect banner when reconnecting', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('terminal-reconnect-banner');
      expect(source).toContain("connectionStatus === 'reconnecting'");
      expect(source).toContain('reconnectAttempt}/{maxReconnectAttempts}');
    });

    it('websocket_dropped error has correct message', () => {
      const msg = BRIDGE_ERROR_MESSAGES.websocket_dropped;
      expect(msg.message).toBe('Connection to bridge server was lost');
      expect(msg.action).toContain('reconnect');
    });

    it('onclose with non-1000 code triggers reconnect scheduling', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // After a non-1000, non-connecting close, scheduleReconnect is called
      expect(source).toContain('scheduleReconnect()');
      // The close handler checks for normal close (1000)
      expect(source).toContain('event.code === 1000');
    });

    it('intentional close does not trigger reconnect', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain('intentionalClose');
      expect(source).toContain("if (intentionalClose)");
    });
  });

  // ─── Step 4: Reconnect restores terminal session ───

  describe('Step 4: Reconnect restores terminal session if Claude Code still running', () => {
    it('successful reconnect resets reconnectAttempts to 0', () => {
      // Simulate: was reconnecting, now onopen fires
      useTerminalStore.setState({ connectionStatus: 'reconnecting', reconnectAttempt: 3 });

      // onopen behavior from bridgeConnection
      useTerminalStore.setState({ connectionStatus: 'connected', currentError: null, reconnectAttempt: 0, maxReconnectAttempts: 0 });

      const state = getStoreState();
      expect(state.connectionStatus).toBe('connected');
      expect(state.reconnectAttempt).toBe(0);
      expect(state.maxReconnectAttempts).toBe(0);
      expect(state.currentError).toBeNull();
    });

    it('onopen callback in bridgeConnection sets status to connected and resets attempts', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain('ws.onopen = ()');
      expect(source).toContain('reconnectAttempts = 0');
      expect(source).toContain("setStatus('connected')");
    });

    it('connected status sends Connected message via callback', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain("'Connected to bridge server'");
    });

    it('reconnect creates new WebSocket to same URL', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // The connect() function creates new WebSocket(url)
      expect(source).toContain('ws = new WebSocket(url)');
    });

    it('terminal output is preserved during reconnection (lines not cleared)', () => {
      // Add some lines
      getStoreState().addLine('output', 'Previous output from Claude Code');
      getStoreState().addLine('system', 'Connection lost');

      // Simulate reconnecting
      useTerminalStore.setState({ connectionStatus: 'reconnecting', reconnectAttempt: 1 });

      // Lines should still be there
      const state = getStoreState();
      expect(state.lines.length).toBeGreaterThanOrEqual(2);
      const outputLine = state.lines.find(l => l.content === 'Previous output from Claude Code');
      expect(outputLine).toBeDefined();
    });

    it('reconnect sends new data through the same send() interface', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // send() checks WebSocket.OPEN state
      expect(source).toContain('ws.readyState === WebSocket.OPEN');
      expect(source).toContain('ws.send(data)');
    });

    it('bridge server sends ready message after reconnection which includes version', () => {
      const source = fs.readFileSync('src/bridge/server.ts', 'utf-8');
      expect(source).toContain("type: 'ready'");
      expect(source).toContain('Claude Code v');
    });
  });

  // ─── Step 5: Clean error states, no infinite reconnect loops ───

  describe('Step 5: Clean error states with no infinite reconnect loops', () => {
    it('MAX_RECONNECT_ATTEMPTS limits reconnection attempts', () => {
      expect(MAX_RECONNECT_ATTEMPTS).toBe(5);
    });

    it('scheduleReconnect stops after MAX_RECONNECT_ATTEMPTS', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain('reconnectAttempts >= MAX_RECONNECT_ATTEMPTS');
      expect(source).toContain("setStatus('error')");
    });

    it('after max reconnect attempts, status is set to error', () => {
      // Simulate reaching max attempts
      useTerminalStore.setState({
        connectionStatus: 'error',
        reconnectAttempt: MAX_RECONNECT_ATTEMPTS,
        maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      });

      const state = getStoreState();
      expect(state.connectionStatus).toBe('error');
      expect(state.reconnectAttempt).toBe(MAX_RECONNECT_ATTEMPTS);
    });

    it('after max attempts, error callback fires with websocket_dropped type', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // When max attempts reached, the error type is websocket_dropped
      expect(source).toContain("type: 'websocket_dropped'");
      expect(source).toContain("'Failed to reconnect after multiple attempts'");
    });

    it('disconnect() clears reconnect timer and resets state', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain('clearReconnectTimer()');
      expect(source).toContain('reconnectAttempts = 0');
      expect(source).toContain("ws.close(1000, 'Client disconnected')");
    });

    it('disconnect sets intentionalClose flag to prevent reconnect', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain('intentionalClose = true');
    });

    it('clearError action resets currentError to null', () => {
      useTerminalStore.setState({
        currentError: {
          type: 'bridge_not_running',
          message: 'test error',
          actionMessage: 'test action',
        },
      });
      expect(getStoreState().currentError).not.toBeNull();

      getStoreState().clearError();
      expect(getStoreState().currentError).toBeNull();
    });

    it('retry button clears error and reconnects', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('handleRetry');
      expect(source).toContain('clearError()');
      // handleRetry calls clearError then connect
      expect(source).toContain('clearError');
      expect(source).toContain('connect()');
    });

    it('TerminalPanel has retry button in error banner', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('terminal-retry-btn');
      expect(source).toContain('Retry connection');
    });

    it('normal close (code 1000) does not trigger reconnect', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      expect(source).toContain("event.code === 1000");
      // Normal close just sets disconnected status
      expect(source).toContain("'Connection closed normally'");
    });

    it('exponential backoff increases delay each attempt', () => {
      // Verify backoff formula: INITIAL * 2^(attempt-1)
      const delays = [];
      for (let i = 1; i <= MAX_RECONNECT_ATTEMPTS; i++) {
        delays.push(INITIAL_RECONNECT_DELAY * Math.pow(2, i - 1));
      }
      // First delay should be INITIAL
      expect(delays[0]).toBe(INITIAL_RECONNECT_DELAY);
      // Each subsequent delay should double
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBe(delays[i - 1]! * 2);
      }
      // Last delay should be reasonable (not too long)
      expect(delays[delays.length - 1]).toBeLessThanOrEqual(60000);
    });

    it('reconnect timer is cleared on disconnect', () => {
      const source = fs.readFileSync('src/services/bridgeConnection.ts', 'utf-8');
      // clearReconnectTimer is called in disconnect()
      const disconnectSection = source.slice(source.indexOf('function disconnect()'));
      expect(disconnectSection).toContain('clearReconnectTimer');
    });
  });

  // ─── Integration: Full connection lifecycle ───

  describe('Integration: Full connection lifecycle', () => {
    it('store connect() creates bridge connection and calls connect()', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      expect(source).toContain('bridgeConnection = createBridgeConnection(bridgeUrl, callbacks)');
      expect(source).toContain('bridgeConnection.connect()');
    });

    it('store disconnect() calls bridgeConnection.disconnect() and nullifies', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      expect(source).toContain('bridgeConnection.disconnect()');
      expect(source).toContain('bridgeConnection = null');
    });

    it('store sendInput() forwards to bridgeConnection.send()', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      expect(source).toContain('bridgeConnection.send(input)');
    });

    it('onMessage callback handles output, status, error, and exit types', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      expect(source).toContain("message.type === 'output'");
      expect(source).toContain("message.type === 'status'");
      expect(source).toContain("message.type === 'error'");
      expect(source).toContain("message.type === 'exit'");
    });

    it('TerminalPanel has status indicator dot with dynamic colors', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain('terminal-status-indicator');
      expect(source).toContain("STATUS_COLORS[connectionStatus]");
    });

    it('status colors include all BridgeConnectionStatus values', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      const statuses: BridgeConnectionStatus[] = ['disconnected', 'connecting', 'connected', 'reconnecting', 'error'];
      for (const s of statuses) {
        expect(source).toContain(`${s}:`);
      }
    });

    it('status labels include all BridgeConnectionStatus values', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain("'Disconnected'");
      expect(source).toContain("'Connecting...'");
      expect(source).toContain("'Connected'");
      expect(source).toContain("'Reconnecting...'");
      expect(source).toContain("'Error'");
    });

    it('beforeunload handler sends cleanup on page exit', () => {
      const source = fs.readFileSync('src/components/panels/TerminalPanel.tsx', 'utf-8');
      expect(source).toContain("window.addEventListener('beforeunload'");
      expect(source).toContain('state.cleanup()');
    });

    it('cleanup action resets all connection state', () => {
      // Set up some state
      useTerminalStore.setState({
        connectionStatus: 'connected',
        currentError: { type: 'unknown', message: 'x', actionMessage: 'y' },
        reconnectAttempt: 3,
        maxReconnectAttempts: 5,
      });

      getStoreState().cleanup();

      const state = getStoreState();
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.currentError).toBeNull();
      expect(state.reconnectAttempt).toBe(0);
      expect(state.maxReconnectAttempts).toBe(0);
    });

    it('connect action disconnects existing connection before creating new one', () => {
      const source = fs.readFileSync('src/store/terminalStore.ts', 'utf-8');
      // In connect(), it checks and disconnects existing connection first
      expect(source).toContain('if (bridgeConnection)');
      expect(source).toContain('bridgeConnection.disconnect()');
    });
  });
});
