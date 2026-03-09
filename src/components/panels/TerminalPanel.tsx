/**
 * TerminalPanel - Terminal interface for bridge server connection.
 *
 * Displays bridge connection status, terminal output, and error states
 * with clear, actionable error messages for each failure scenario:
 * - Bridge server not running
 * - Claude Code not installed
 * - Claude Code auth expired
 * - WebSocket connection dropped
 * - PTY spawn failure
 */

import { useEffect, useRef, useCallback } from 'react';
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
  ArrowDownCircle,
} from 'lucide-react';
import { useTerminalStore } from '@/store/terminalStore';
import type { BridgeConnectionStatus, BridgeErrorType } from '@/services/bridgeConnection';

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

/** Line type colors for terminal output */
const LINE_COLORS: Record<string, string> = {
  output: 'text-gray-200',
  error: 'text-red-400',
  status: 'text-green-400',
  system: 'text-blue-400',
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

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines appear
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        className="px-3 py-2 border-b flex items-center justify-between bg-gray-50 dark:bg-gray-900"
        data-testid="terminal-header"
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Terminal</span>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${STATUS_COLORS[connectionStatus]}`}
              data-testid="terminal-status-indicator"
            />
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
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
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Connect to bridge server"
              data-testid="terminal-connect-btn"
            >
              <Plug className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
          {(isConnected || isConnecting) && (
            <button
              onClick={handleDisconnect}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Disconnect from bridge server"
              data-testid="terminal-disconnect-btn"
            >
              <PlugZap className="w-3.5 h-3.5 text-red-500" />
            </button>
          )}
          <button
            onClick={clearTerminal}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear terminal"
            data-testid="terminal-clear-btn"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-500" />
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

      {/* Terminal output area */}
      <div
        ref={terminalContainerRef}
        className="flex-1 overflow-y-auto bg-gray-900 p-2 font-mono text-xs min-h-0"
        data-testid="terminal-output"
      >
        {lines.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-gray-500"
            data-testid="terminal-empty-state"
          >
            <TerminalIcon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No terminal output</p>
            <p className="text-xs mt-1">
              {connectionStatus === 'disconnected'
                ? 'Click Connect to start a bridge session'
                : 'Waiting for output...'}
            </p>
            {connectionStatus === 'disconnected' && (
              <button
                onClick={handleConnect}
                className="mt-3 px-3 py-1.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                data-testid="terminal-connect-empty-btn"
              >
                <Wifi className="w-3 h-3" />
                Connect to Bridge
              </button>
            )}
          </div>
        ) : (
          <>
            {lines.map((line) => (
              <div
                key={line.id}
                className={`${LINE_COLORS[line.type] ?? 'text-gray-200'} leading-5 whitespace-pre-wrap break-all`}
                data-testid={`terminal-line-${line.type}`}
              >
                {line.type === 'system' && <span className="text-gray-500">[system] </span>}
                {line.type === 'error' && <span className="text-red-600">[error] </span>}
                {line.type === 'status' && <span className="text-green-600">[status] </span>}
                {line.content}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </>
        )}
      </div>

      {/* Scroll-to-bottom button (shown when not at bottom) */}
      {lines.length > 20 && (
        <button
          onClick={() => terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-2 right-4 p-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors shadow-lg"
          title="Scroll to bottom"
          data-testid="terminal-scroll-bottom-btn"
        >
          <ArrowDownCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
