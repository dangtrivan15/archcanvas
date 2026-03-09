/**
 * Terminal Store
 *
 * Zustand store for managing terminal panel state including
 * bridge connection status, messages, and error states.
 * Supports both line-based output (for system/status messages)
 * and direct xterm.js writes (for streaming PTY output).
 */

import { create } from 'zustand';
import type {
  BridgeConnectionStatus,
  BridgeError,
  BridgeMessage,
  BridgeConnectionCallbacks,
} from '@/services/bridgeConnection';
import {
  createBridgeConnection,
  DEFAULT_BRIDGE_URL,
} from '@/services/bridgeConnection';
import type { Terminal } from '@xterm/xterm';

export interface TerminalLine {
  id: string;
  type: 'output' | 'error' | 'status' | 'system';
  content: string;
  timestamp: number;
}

export interface TerminalState {
  // Connection state
  connectionStatus: BridgeConnectionStatus;
  currentError: BridgeError | null;
  reconnectAttempt: number;
  maxReconnectAttempts: number;

  // Terminal output (line-based for system/status messages)
  lines: TerminalLine[];

  // xterm.js instance reference (set by TerminalPanel component)
  xtermInstance: Terminal | null;

  // Process restart state
  /** True when Claude Code exited and we're waiting for user to press Enter to restart */
  awaitingRestart: boolean;

  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  sendInput: (input: string) => void;
  clearTerminal: () => void;
  clearError: () => void;
  addLine: (type: TerminalLine['type'], content: string) => void;
  setXtermInstance: (instance: Terminal | null) => void;
  writeToXterm: (data: string) => void;
  /** Gracefully shut down: disconnect bridge and clean up state */
  cleanup: () => void;
  /** Restart the Claude Code session after exit */
  restartSession: () => void;
}

/** Maximum lines to keep in terminal buffer */
const MAX_TERMINAL_LINES = 1000;

let bridgeConnection: ReturnType<typeof createBridgeConnection> | null = null;

export const useTerminalStore = create<TerminalState>((set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  currentError: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 0,
  lines: [],
  xtermInstance: null,
  awaitingRestart: false,

  connect: (url?: string) => {
    const bridgeUrl = url ?? DEFAULT_BRIDGE_URL;

    // Disconnect existing connection
    if (bridgeConnection) {
      bridgeConnection.disconnect();
    }

    // Add system message
    get().addLine('system', `Connecting to bridge server at ${bridgeUrl}...`);

    const callbacks: BridgeConnectionCallbacks = {
      onStatusChange: (status: BridgeConnectionStatus) => {
        set({ connectionStatus: status });
        if (status === 'connected') {
          set({ currentError: null, reconnectAttempt: 0, maxReconnectAttempts: 0 });
        }
      },
      onMessage: (message: BridgeMessage) => {
        const state = get();
        if (message.type === 'output' && message.data) {
          // Write directly to xterm for character-by-character streaming
          state.writeToXterm(message.data);
        } else if (message.type === 'status' && message.data) {
          state.addLine('status', message.data);
        } else if (message.type === 'error' && message.data) {
          state.addLine('error', message.data);
        } else if (message.type === 'exit') {
          state.addLine('system', `Process exited with code ${message.code ?? 0}`);
          // Show restart prompt and enter awaiting-restart mode
          const exitMsg = `\r\n\x1b[33mClaude Code exited. Press Enter to restart.\x1b[0m\r\n`;
          state.writeToXterm(exitMsg);
          set({ awaitingRestart: true });
        }
      },
      onError: (error: BridgeError) => {
        set({ currentError: error });
        get().addLine('error', `${error.message}: ${error.actionMessage}`);
      },
      onReconnectAttempt: (attempt: number, maxAttempts: number) => {
        set({ reconnectAttempt: attempt, maxReconnectAttempts: maxAttempts });
        get().addLine('system', `Reconnection attempt ${attempt}/${maxAttempts}...`);
      },
    };

    bridgeConnection = createBridgeConnection(bridgeUrl, callbacks);
    bridgeConnection.connect();
  },

  disconnect: () => {
    if (bridgeConnection) {
      bridgeConnection.disconnect();
      bridgeConnection = null;
    }
    set({ connectionStatus: 'disconnected', currentError: null, reconnectAttempt: 0 });
    get().addLine('system', 'Disconnected from bridge server');
  },

  sendInput: (input: string) => {
    // If awaiting restart and user presses Enter, restart the session
    if (get().awaitingRestart && (input === '\r' || input === '\n')) {
      get().restartSession();
      return;
    }
    if (bridgeConnection) {
      bridgeConnection.send(input);
    }
  },

  clearTerminal: () => {
    set({ lines: [] });
  },

  clearError: () => {
    set({ currentError: null });
  },

  addLine: (type, content) => {
    set((state) => {
      const newLine: TerminalLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        content,
        timestamp: Date.now(),
      };
      const lines = [...state.lines, newLine];
      // Trim to max lines
      if (lines.length > MAX_TERMINAL_LINES) {
        return { lines: lines.slice(lines.length - MAX_TERMINAL_LINES) };
      }
      return { lines };
    });
  },

  setXtermInstance: (instance: Terminal | null) => {
    set({ xtermInstance: instance });
  },

  writeToXterm: (data: string) => {
    const { xtermInstance } = get();
    if (xtermInstance) {
      // Write directly to xterm for character-by-character rendering
      xtermInstance.write(data);
    } else {
      // Fallback: add as line-based output if xterm not mounted yet
      get().addLine('output', data);
    }
  },

  restartSession: () => {
    const state = get();
    // Clear awaiting restart flag
    set({ awaitingRestart: false });
    // Clear the xterm display for a clean start
    if (state.xtermInstance) {
      state.xtermInstance.clear();
      state.xtermInstance.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to top
    }
    // Clear line-based output
    set({ lines: [] });
    // Disconnect existing connection if any
    if (bridgeConnection) {
      bridgeConnection.disconnect();
      bridgeConnection = null;
    }
    // Reconnect — this spawns a new Claude Code process with the same MCP config
    state.connect();
  },

  cleanup: () => {
    // Gracefully disconnect the bridge connection (sends close frame → server kills process)
    if (bridgeConnection) {
      bridgeConnection.disconnect();
      bridgeConnection = null;
    }
    set({
      connectionStatus: 'disconnected',
      currentError: null,
      reconnectAttempt: 0,
      maxReconnectAttempts: 0,
      awaitingRestart: false,
    });
  },
}));
