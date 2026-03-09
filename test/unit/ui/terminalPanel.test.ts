/**
 * Tests for Terminal Panel - error state display, connection status indicators,
 * and actionable error messages for bridge server/Claude Code/WebSocket/PTY errors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalStore } from '@/store/terminalStore';
import type { TerminalLine } from '@/store/terminalStore';
import {
  BRIDGE_ERROR_MESSAGES,
  classifyError,
  parseServerError,
  type BridgeError,
  type BridgeErrorType,
} from '@/services/bridgeConnection';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read source files for structural verification
const terminalPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/components/panels/TerminalPanel.tsx'),
  'utf-8',
);
const terminalStoreSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/store/terminalStore.ts'),
  'utf-8',
);
const bridgeConnectionSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/services/bridgeConnection.ts'),
  'utf-8',
);
const nodeDetailPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/components/panels/NodeDetailPanel.tsx'),
  'utf-8',
);
const constantsSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/utils/constants.ts'),
  'utf-8',
);

describe('Terminal Panel - Error State Display', () => {
  beforeEach(() => {
    // Reset terminal store
    useTerminalStore.setState({
      connectionStatus: 'disconnected',
      currentError: null,
      reconnectAttempt: 0,
      maxReconnectAttempts: 0,
      lines: [],
    });
  });

  describe('Feature Step 1: Bridge not running shows actionable message', () => {
    it('bridge_not_running error message tells user to start bridge server', () => {
      const msg = BRIDGE_ERROR_MESSAGES.bridge_not_running;
      expect(msg.action).toBe('Start bridge server with npm run bridge');
    });

    it('classifyError for connection failure produces bridge_not_running', () => {
      const error = classifyError(new Error('WebSocket connection to ws://localhost:3100 failed'));
      expect(error.type).toBe('bridge_not_running');
      expect(error.actionMessage).toContain('npm run bridge');
    });

    it('terminal panel renders error banner with data-error-type attribute', () => {
      expect(terminalPanelSource).toContain('data-error-type={currentError.type}');
    });

    it('terminal panel renders error message text', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-error-message"');
      expect(terminalPanelSource).toContain('currentError.message');
    });

    it('terminal panel renders actionable error instruction', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-error-action"');
      expect(terminalPanelSource).toContain('currentError.actionMessage');
    });
  });

  describe('Feature Step 2: Claude not installed shows install instructions', () => {
    it('claude_not_installed error has install instructions', () => {
      const msg = BRIDGE_ERROR_MESSAGES.claude_not_installed;
      expect(msg.action).toContain('npm install -g');
      expect(msg.action).toContain('@anthropic-ai/claude-code');
    });

    it('classifyError for ENOENT / command not found produces claude_not_installed', () => {
      const error1 = classifyError(new Error('claude: command not found'));
      expect(error1.type).toBe('claude_not_installed');

      const error2 = classifyError(new Error('ENOENT: no such file'));
      expect(error2.type).toBe('claude_not_installed');
    });
  });

  describe('Feature Step 3: Claude auth expired shows re-authenticate instructions', () => {
    it('claude_auth_expired error tells user to run claude login', () => {
      const msg = BRIDGE_ERROR_MESSAGES.claude_auth_expired;
      expect(msg.action).toBe('Run claude login to re-authenticate');
    });

    it('classifyError for auth errors produces claude_auth_expired', () => {
      const error = classifyError(new Error('Claude Code authentication has expired'));
      expect(error.type).toBe('claude_auth_expired');
      expect(error.actionMessage).toContain('claude login');
    });
  });

  describe('Feature Step 4: WebSocket drops shows reconnect attempt', () => {
    it('websocket_dropped error mentions reconnect', () => {
      const msg = BRIDGE_ERROR_MESSAGES.websocket_dropped;
      expect(msg.action.toLowerCase()).toContain('reconnect');
    });

    it('terminal store tracks reconnect attempts', () => {
      const store = useTerminalStore.getState();
      expect(store.reconnectAttempt).toBe(0);
      expect(store.maxReconnectAttempts).toBe(0);

      // Simulate reconnect attempt
      useTerminalStore.setState({
        connectionStatus: 'reconnecting',
        reconnectAttempt: 2,
        maxReconnectAttempts: 5,
      });

      const updated = useTerminalStore.getState();
      expect(updated.connectionStatus).toBe('reconnecting');
      expect(updated.reconnectAttempt).toBe(2);
    });

    it('terminal panel has reconnect banner UI', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-reconnect-banner"');
      expect(terminalPanelSource).toContain('reconnectAttempt');
      expect(terminalPanelSource).toContain('maxReconnectAttempts');
    });
  });

  describe('Feature Step 5: PTY spawn fails shows error with details', () => {
    it('pty_spawn_failed error has actionable message', () => {
      const msg = BRIDGE_ERROR_MESSAGES.pty_spawn_failed;
      expect(msg.message).toBeTruthy();
      expect(msg.action).toBeTruthy();
    });

    it('classifyError for PTY/spawn errors produces pty_spawn_failed', () => {
      const error = classifyError(new Error('Failed to spawn PTY process'));
      expect(error.type).toBe('pty_spawn_failed');
      expect(error.details).toContain('PTY');
    });

    it('terminal panel shows error details when available', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-error-details"');
      expect(terminalPanelSource).toContain('currentError.details');
    });
  });

  describe('Feature Step 6: No unhandled exceptions crash the web app', () => {
    it('bridge connection service has try/catch around WebSocket creation', () => {
      expect(bridgeConnectionSource).toContain('try {');
      expect(bridgeConnectionSource).toContain('new WebSocket(url)');
      expect(bridgeConnectionSource).toContain('} catch');
    });

    it('bridge connection handles WebSocket error events', () => {
      expect(bridgeConnectionSource).toContain('ws.onerror');
    });

    it('bridge connection handles WebSocket close events', () => {
      expect(bridgeConnectionSource).toContain('ws.onclose');
    });

    it('parseServerError handles non-JSON data gracefully', () => {
      expect(bridgeConnectionSource).toContain('catch');
      // Verify it doesn't throw on non-JSON
      expect(() => parseServerError('not json')).not.toThrow();
      expect(() => parseServerError('')).not.toThrow();
      expect(() => parseServerError('{invalid')).not.toThrow();
    });

    it('terminal store addLine handles rapid additions without crash', () => {
      const store = useTerminalStore.getState();
      // Add 100 lines rapidly
      for (let i = 0; i < 100; i++) {
        store.addLine('output', `Line ${i}`);
      }
      const lines = useTerminalStore.getState().lines;
      expect(lines.length).toBe(100);
      expect(lines[99].content).toBe('Line 99');
    });

    it('terminal panel has clipboard copy with error fallback', () => {
      expect(terminalPanelSource).toContain('navigator.clipboard.writeText');
      expect(terminalPanelSource).toContain('.catch(');
    });
  });

  describe('Terminal Store State Management', () => {
    it('initial state is disconnected with no error', () => {
      const state = useTerminalStore.getState();
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.currentError).toBeNull();
      expect(state.lines).toHaveLength(0);
    });

    it('addLine creates a terminal line with id and timestamp', () => {
      const store = useTerminalStore.getState();
      store.addLine('output', 'Hello from PTY');

      const lines = useTerminalStore.getState().lines;
      expect(lines).toHaveLength(1);
      expect(lines[0].type).toBe('output');
      expect(lines[0].content).toBe('Hello from PTY');
      expect(lines[0].id).toBeTruthy();
      expect(lines[0].timestamp).toBeGreaterThan(0);
    });

    it('clearTerminal removes all lines', () => {
      const store = useTerminalStore.getState();
      store.addLine('output', 'Line 1');
      store.addLine('output', 'Line 2');
      expect(useTerminalStore.getState().lines).toHaveLength(2);

      store.clearTerminal();
      expect(useTerminalStore.getState().lines).toHaveLength(0);
    });

    it('clearError removes currentError', () => {
      useTerminalStore.setState({
        currentError: {
          type: 'bridge_not_running',
          message: 'Test error',
          actionMessage: 'Fix it',
        },
      });
      expect(useTerminalStore.getState().currentError).not.toBeNull();

      useTerminalStore.getState().clearError();
      expect(useTerminalStore.getState().currentError).toBeNull();
    });

    it('supports all terminal line types', () => {
      const store = useTerminalStore.getState();
      store.addLine('output', 'Output line');
      store.addLine('error', 'Error line');
      store.addLine('status', 'Status line');
      store.addLine('system', 'System line');

      const lines = useTerminalStore.getState().lines;
      expect(lines).toHaveLength(4);
      expect(lines[0].type).toBe('output');
      expect(lines[1].type).toBe('error');
      expect(lines[2].type).toBe('status');
      expect(lines[3].type).toBe('system');
    });
  });

  describe('Terminal Panel Component Structure', () => {
    it('has terminal panel root with data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-panel"');
    });

    it('has header with connection status indicator', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-header"');
      expect(terminalPanelSource).toContain('data-testid="terminal-status-indicator"');
      expect(terminalPanelSource).toContain('data-testid="terminal-status-label"');
    });

    it('has connect and disconnect buttons', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-connect-btn"');
      expect(terminalPanelSource).toContain('data-testid="terminal-disconnect-btn"');
    });

    it('has error banner with retry button', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-error-banner"');
      expect(terminalPanelSource).toContain('data-testid="terminal-retry-btn"');
    });

    it('has terminal output area', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-output"');
    });

    it('has empty state with connect button', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-empty-state"');
      expect(terminalPanelSource).toContain('data-testid="terminal-connect-empty-btn"');
    });

    it('renders different line type prefixes', () => {
      expect(terminalPanelSource).toContain('[system]');
      expect(terminalPanelSource).toContain('[error]');
      expect(terminalPanelSource).toContain('[status]');
    });
  });

  describe('Integration: Terminal tab in right panel', () => {
    it('constants include terminal tab', () => {
      expect(constantsSource).toContain("'terminal'");
      expect(constantsSource).toContain('RIGHT_PANEL_TABS');
    });

    it('NodeDetailPanel imports TerminalPanel', () => {
      expect(nodeDetailPanelSource).toContain("import { TerminalPanel } from './TerminalPanel'");
    });

    it('NodeDetailPanel has terminal tab button', () => {
      expect(nodeDetailPanelSource).toContain("'terminal' as Tab");
      expect(nodeDetailPanelSource).toContain("label: 'Terminal'");
    });

    it('NodeDetailPanel renders TerminalPanel for terminal tab', () => {
      expect(nodeDetailPanelSource).toContain('<TerminalPanel />');
      expect(nodeDetailPanelSource).toContain("activeTab === 'terminal'");
    });

    it('Tab type includes terminal', () => {
      expect(nodeDetailPanelSource).toContain("'terminal'");
    });
  });

  describe('Error state visual styling', () => {
    it('has status colors for all connection states', () => {
      expect(terminalPanelSource).toContain('disconnected');
      expect(terminalPanelSource).toContain('connecting');
      expect(terminalPanelSource).toContain('connected');
      expect(terminalPanelSource).toContain('reconnecting');
      expect(terminalPanelSource).toContain("'error'");
    });

    it('error banner has type-specific styling', () => {
      expect(terminalPanelSource).toContain('ERROR_COLORS');
      expect(terminalPanelSource).toContain('bridge_not_running');
      expect(terminalPanelSource).toContain('claude_not_installed');
      expect(terminalPanelSource).toContain('claude_auth_expired');
      expect(terminalPanelSource).toContain('pty_spawn_failed');
    });

    it('uses different icons for different error types', () => {
      expect(terminalPanelSource).toContain('ERROR_ICONS');
      expect(terminalPanelSource).toContain('WifiOff');
      expect(terminalPanelSource).toContain('XCircle');
      expect(terminalPanelSource).toContain('AlertCircle');
    });

    it('terminal output area has dark background (terminal-like)', () => {
      expect(terminalPanelSource).toContain('bg-gray-900');
      expect(terminalPanelSource).toContain('font-mono');
    });
  });
});
