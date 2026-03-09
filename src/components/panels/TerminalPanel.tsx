/**
 * TerminalPanel - xterm.js-based terminal interface for bridge server connection.
 *
 * Uses xterm.js for proper terminal emulation with character-by-character streaming.
 * Displays bridge connection status and error states with clear, actionable messages.
 * The terminal connects to the local bridge server via WebSocket for streaming I/O.
 *
 * Error scenarios handled:
 * - Bridge server not running
 * - Claude Code not installed
 * - Claude Code auth expired
 * - WebSocket connection dropped
 * - PTY spawn failure
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  AlertCircle,
  RefreshCw,
  Plug,
  PlugZap,
  Trash2,
  XCircle,
  Wifi,
  WifiOff,
  Copy,
} from 'lucide-react';
import { useTerminalStore } from '@/store/terminalStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/theme/types';
import type { BridgeConnectionStatus, BridgeErrorType } from '@/services/bridgeConnection';
import type { ITheme } from '@xterm/xterm';

/**
 * Convert an HSL string (e.g. "240 10% 3.9%") to a hex color string.
 * Theme colors are stored as bare HSL values without the hsl() wrapper.
 */
export function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length < 3) return '#000000';

  const h = parseFloat(parts[0] ?? '0') / 360;
  const s = parseFloat(parts[1] ?? '0') / 100;
  const l = parseFloat(parts[2] ?? '0') / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    const hex = val.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Build an xterm.js ITheme from the current ArchCanvas theme.
 * Maps semantic theme tokens to xterm terminal colors.
 */
export function buildXtermTheme(theme: Theme): ITheme {
  const colors = theme.colors;
  return {
    background: hslToHex(colors.background),
    foreground: hslToHex(colors.text),
    cursor: hslToHex(colors.iris),
    cursorAccent: hslToHex(colors.background),
    selectionBackground: hslToHex(colors['highlight-med']),
    selectionForeground: hslToHex(colors.text),
    // ANSI standard colors — mapped to theme semantic colors
    black: hslToHex(colors.overlay),
    red: hslToHex(colors.love),
    green: hslToHex(colors.pine),
    yellow: hslToHex(colors.gold),
    blue: hslToHex(colors.foam),
    magenta: hslToHex(colors.iris),
    cyan: hslToHex(colors.foam),
    white: hslToHex(colors.text),
    // Bright variants — slightly brighter using highlight colors
    brightBlack: hslToHex(colors.subtle),
    brightRed: hslToHex(colors.love),
    brightGreen: hslToHex(colors.pine),
    brightYellow: hslToHex(colors.gold),
    brightBlue: hslToHex(colors.foam),
    brightMagenta: hslToHex(colors.iris),
    brightCyan: hslToHex(colors.foam),
    brightWhite: hslToHex(colors.text),
    // Extended colors
    selectionInactiveBackground: hslToHex(colors['highlight-low']),
  };
}

/** Monospace font stack — consistent with app's code font */
export const TERMINAL_FONT_FAMILY = 'Menlo, Monaco, "Cascadia Code", "Fira Code", "Courier New", monospace';

/** Status indicator colors */
const STATUS_COLORS: Record<BridgeConnectionStatus, string> = {
  disconnected: 'bg-gray-400',
  connecting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-400',
  reconnecting: 'bg-yellow-400 animate-pulse',
  error: 'bg-red-400',
};

/** Status labels */
const STATUS_LABELS: Record<BridgeConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  error: 'Error',
};

/** Error-specific icons */
const ERROR_ICONS: Record<BridgeErrorType, typeof AlertCircle> = {
  bridge_not_running: WifiOff,
  claude_not_installed: XCircle,
  claude_auth_expired: AlertCircle,
  websocket_dropped: WifiOff,
  pty_spawn_failed: XCircle,
  unknown: AlertCircle,
};

/** Error-specific colors */
const ERROR_COLORS: Record<BridgeErrorType, string> = {
  bridge_not_running: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  claude_not_installed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  claude_auth_expired: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
  websocket_dropped: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  pty_spawn_failed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  unknown: 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200',
};


export function TerminalPanel() {
  const connectionStatus = useTerminalStore((s) => s.connectionStatus);
  const currentError = useTerminalStore((s) => s.currentError);
  const reconnectAttempt = useTerminalStore((s) => s.reconnectAttempt);
  const maxReconnectAttempts = useTerminalStore((s) => s.maxReconnectAttempts);
  const lines = useTerminalStore((s) => s.lines);
  const connect = useTerminalStore((s) => s.connect);
  const disconnect = useTerminalStore((s) => s.disconnect);
  const clearTerminal = useTerminalStore((s) => s.clearTerminal);
  const clearError = useTerminalStore((s) => s.clearError);

  // Get current theme for xterm styling
  const { theme } = useTheme();

  // Memoize the xterm theme to avoid unnecessary re-renders
  const xtermTheme = useMemo(() => buildXtermTheme(theme), [theme]);

  const cleanup = useTerminalStore((s) => s.cleanup);

  // xterm.js refs
  const xtermContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Auto-connect to bridge server on mount
  useEffect(() => {
    // Only auto-connect if currently disconnected (not already connecting/connected)
    const state = useTerminalStore.getState();
    if (state.connectionStatus === 'disconnected') {
      connect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- auto-connect once on mount

  // Graceful cleanup on panel unmount (tab closed, navigated away)
  useEffect(() => {
    return () => {
      // When the TerminalPanel unmounts, gracefully disconnect the bridge
      // so the server can terminate the Claude Code process
      const state = useTerminalStore.getState();
      if (state.connectionStatus === 'connected' || state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') {
        state.cleanup();
      }
    };
  }, []);

  // Handle browser tab close / page unload — terminate session gracefully
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use cleanup to send WebSocket close frame before the page unloads
      // The bridge server's ws.on('close') handler will then SIGTERM the process
      const state = useTerminalStore.getState();
      if (state.connectionStatus === 'connected' || state.connectionStatus === 'connecting' || state.connectionStatus === 'reconnecting') {
        state.cleanup();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!xtermContainerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: TERMINAL_FONT_FAMILY,
      theme: xtermTheme,
      scrollback: 5000,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(xtermContainerRef.current);

    // Initial fit
    try {
      fitAddon.fit();
    } catch {
      // Container may not have dimensions yet
    }

    // Forward typed input to bridge server via sendInput
    // Also handles Enter-to-restart when Claude Code process has exited
    terminal.onData((data: string) => {
      const { sendInput: send, connectionStatus: status, awaitingRestart } = useTerminalStore.getState();
      if (awaitingRestart) {
        // sendInput will detect Enter and trigger restartSession
        send(data);
        return;
      }
      if (status === 'connected') {
        send(data);
      }
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Store xterm instance in terminal store for direct writes
    useTerminalStore.getState().setXtermInstance(terminal);

    return () => {
      useTerminalStore.getState().setXtermInstance(null);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally init once

  // Update xterm theme when app theme changes
  useEffect(() => {
    const terminal = xtermRef.current;
    if (terminal) {
      terminal.options.theme = xtermTheme;
    }
  }, [xtermTheme]);

  // Handle panel resize with ResizeObserver + FitAddon
  useEffect(() => {
    const container = xtermContainerRef.current;
    if (!container || !fitAddonRef.current) return;

    const observer = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore fit errors during layout transitions
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Write new lines to xterm terminal (for system/status/error messages)
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal || lines.length === 0) return;

    // Only write the latest line to avoid duplicates
    const lastLine = lines[lines.length - 1];
    if (!lastLine) return;

    // Use ANSI color codes for different line types
    const ANSI_COLORS: Record<string, string> = {
      output: '',          // default foreground
      error: '\x1b[31m',   // red
      status: '\x1b[32m',  // green
      system: '\x1b[34m',  // blue
    };
    const ANSI_RESET = '\x1b[0m';

    const prefix = lastLine.type === 'system' ? '[system] '
      : lastLine.type === 'error' ? '[error] '
      : lastLine.type === 'status' ? '[status] '
      : '';

    const color = ANSI_COLORS[lastLine.type] ?? '';
    terminal.writeln(`${color}${prefix}${lastLine.content}${ANSI_RESET}`);
  }, [lines]);

  const handleConnect = useCallback(() => {
    connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleRetry = useCallback(() => {
    clearError();
    connect();
  }, [clearError, connect]);

  const handleClearTerminal = useCallback(() => {
    clearTerminal();
    xtermRef.current?.clear();
  }, [clearTerminal]);

  const handleCopyError = useCallback(() => {
    if (currentError) {
      const text = `${currentError.message}\n${currentError.details ?? ''}\n\nAction: ${currentError.actionMessage}`;
      navigator.clipboard.writeText(text).catch(() => {
        // Clipboard access may fail in some contexts
      });
    }
  }, [currentError]);

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  return (
    <div className="flex flex-col h-full" data-testid="terminal-panel">
      {/* Header with connection status */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between bg-surface"
        data-testid="terminal-header"
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-text">Terminal</span>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${STATUS_COLORS[connectionStatus]}`}
              data-testid="terminal-status-indicator"
            />
            <span
              className="text-xs text-muted-foreground"
              data-testid="terminal-status-label"
            >
              {STATUS_LABELS[connectionStatus]}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {!isConnected && !isConnecting && (
            <button
              onClick={handleConnect}
              className="p-1 rounded hover:bg-highlight-low transition-colors"
              title="Connect to bridge server"
              data-testid="terminal-connect-btn"
            >
              <Plug className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {(isConnected || isConnecting) && (
            <button
              onClick={handleDisconnect}
              className="p-1 rounded hover:bg-highlight-low transition-colors"
              title="Disconnect from bridge server"
              data-testid="terminal-disconnect-btn"
            >
              <PlugZap className="w-3.5 h-3.5 text-love" />
            </button>
          )}
          <button
            onClick={handleClearTerminal}
            className="p-1 rounded hover:bg-highlight-low transition-colors"
            title="Clear terminal"
            data-testid="terminal-clear-btn"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {currentError && (
        <div
          className={`mx-2 mt-2 p-3 rounded-lg border ${ERROR_COLORS[currentError.type]}`}
          data-testid="terminal-error-banner"
          data-error-type={currentError.type}
        >
          <div className="flex items-start gap-2">
            {(() => {
              const Icon = ERROR_ICONS[currentError.type];
              return <Icon className="w-4 h-4 shrink-0 mt-0.5" />;
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" data-testid="terminal-error-message">
                {currentError.message}
              </p>
              {currentError.details && (
                <p className="text-xs mt-0.5 opacity-75" data-testid="terminal-error-details">
                  {currentError.details}
                </p>
              )}
              <p
                className="text-xs mt-1.5 font-mono bg-black/10 dark:bg-white/10 rounded px-2 py-1"
                data-testid="terminal-error-action"
              >
                {currentError.actionMessage}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopyError}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title="Copy error details"
                data-testid="terminal-copy-error-btn"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRetry}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title="Retry connection"
                data-testid="terminal-retry-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconnect progress */}
      {connectionStatus === 'reconnecting' && reconnectAttempt > 0 && (
        <div
          className="mx-2 mt-2 px-3 py-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
          data-testid="terminal-reconnect-banner"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-yellow-600 animate-spin" />
            <span className="text-xs text-yellow-700 dark:text-yellow-300">
              Reconnection attempt {reconnectAttempt}/{maxReconnectAttempts}
            </span>
          </div>
        </div>
      )}

      {/* xterm.js terminal container */}
      <div
        ref={terminalContainerRef}
        className="flex-1 overflow-hidden bg-background min-h-0 relative"
        data-testid="terminal-output"
      >
        {/* xterm.js mount point */}
        <div
          ref={xtermContainerRef}
          className="w-full h-full"
          data-testid="xterm-container"
        />

        {/* Empty state overlay (shown when disconnected and no output) */}
        {connectionStatus === 'disconnected' && lines.length === 0 && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-background"
            data-testid="terminal-empty-state"
          >
            <TerminalIcon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No terminal output</p>
            <p className="text-xs mt-1">Click Connect to start a bridge session</p>
            <button
              onClick={handleConnect}
              className="mt-3 px-3 py-1.5 rounded bg-iris text-background text-xs hover:opacity-90 transition-colors flex items-center gap-1.5"
              data-testid="terminal-connect-empty-btn"
            >
              <Wifi className="w-3 h-3" />
              Connect to Bridge
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
