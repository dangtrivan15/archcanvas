/**
 * Bridge Connection Service
 *
 * Manages WebSocket connection to the bridge server that proxies
 * Claude Code PTY sessions. Handles all error scenarios:
 * - Bridge server not running
 * - Claude Code not installed
 * - Claude Code auth expired
 * - WebSocket disconnection/reconnection
 * - PTY spawn failures
 */

export type BridgeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type BridgeErrorType =
  | 'bridge_not_running'
  | 'claude_not_installed'
  | 'claude_auth_expired'
  | 'websocket_dropped'
  | 'pty_spawn_failed'
  | 'unknown';

export interface BridgeError {
  type: BridgeErrorType;
  message: string;
  details?: string;
  actionMessage: string;
}

export interface BridgeMessage {
  type: 'output' | 'error' | 'status' | 'exit';
  data?: string;
  code?: number;
  errorType?: string;
}

/** User-facing error messages for each error type */
export const BRIDGE_ERROR_MESSAGES: Record<BridgeErrorType, { message: string; action: string }> = {
  bridge_not_running: {
    message: 'Bridge server not running. Start it with npm run bridge',
    action: 'Run: npm run bridge',
  },
  claude_not_installed: {
    message: 'Claude Code is not installed',
    action: 'Install Claude Code: npm install -g @anthropic-ai/claude-code',
  },
  claude_auth_expired: {
    message: 'Claude Code authentication has expired',
    action: 'Run claude login to re-authenticate',
  },
  websocket_dropped: {
    message: 'Connection to bridge server was lost',
    action: 'Attempting to reconnect...',
  },
  pty_spawn_failed: {
    message: 'Failed to start terminal session',
    action: 'Check terminal configuration and try again',
  },
  unknown: {
    message: 'An unexpected error occurred',
    action: 'Check the bridge server logs for details',
  },
};

/** Max reconnect attempts before giving up */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** Initial reconnect delay in ms (doubles each attempt) */
export const INITIAL_RECONNECT_DELAY = 1000;

/** Default bridge server URL */
export const DEFAULT_BRIDGE_URL = 'ws://localhost:3100';

export interface BridgeConnectionCallbacks {
  onStatusChange: (status: BridgeConnectionStatus) => void;
  onMessage: (message: BridgeMessage) => void;
  onError: (error: BridgeError) => void;
  onReconnectAttempt: (attempt: number, maxAttempts: number) => void;
}

/**
 * Classifies an error into a BridgeErrorType based on error details.
 */
export function classifyError(error: unknown, context?: string): BridgeError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const combinedContext = `${errorMessage} ${context ?? ''}`.toLowerCase();

  // Connection refused / server not running
  if (
    combinedContext.includes('econnrefused') ||
    combinedContext.includes('connection refused') ||
    combinedContext.includes('failed to connect') ||
    combinedContext.includes('websocket connection to') ||
    (error instanceof Event && (error.target as WebSocket)?.readyState === WebSocket.CLOSED)
  ) {
    const info = BRIDGE_ERROR_MESSAGES.bridge_not_running;
    return {
      type: 'bridge_not_running',
      message: info.message,
      details: errorMessage,
      actionMessage: info.action,
    };
  }

  // Claude Code not installed
  if (
    combinedContext.includes('claude not found') ||
    combinedContext.includes('not installed') ||
    combinedContext.includes('command not found') ||
    combinedContext.includes('enoent')
  ) {
    const info = BRIDGE_ERROR_MESSAGES.claude_not_installed;
    return {
      type: 'claude_not_installed',
      message: info.message,
      details: errorMessage,
      actionMessage: info.action,
    };
  }

  // Authentication expired
  if (
    combinedContext.includes('auth') ||
    combinedContext.includes('authentication') ||
    combinedContext.includes('expired') ||
    combinedContext.includes('unauthorized') ||
    combinedContext.includes('401')
  ) {
    const info = BRIDGE_ERROR_MESSAGES.claude_auth_expired;
    return {
      type: 'claude_auth_expired',
      message: info.message,
      details: errorMessage,
      actionMessage: info.action,
    };
  }

  // PTY spawn failure
  if (
    combinedContext.includes('pty') ||
    combinedContext.includes('spawn') ||
    combinedContext.includes('terminal') ||
    combinedContext.includes('process')
  ) {
    const info = BRIDGE_ERROR_MESSAGES.pty_spawn_failed;
    return {
      type: 'pty_spawn_failed',
      message: info.message,
      details: errorMessage,
      actionMessage: info.action,
    };
  }

  // Unknown error
  const info = BRIDGE_ERROR_MESSAGES.unknown;
  return {
    type: 'unknown',
    message: info.message,
    details: errorMessage,
    actionMessage: info.action,
  };
}

/**
 * Parses a server-sent error message (JSON from bridge) and classifies it.
 */
export function parseServerError(data: string): BridgeError | null {
  try {
    const parsed = JSON.parse(data) as BridgeMessage;
    if (parsed.type === 'error' && parsed.errorType) {
      const errorType = parsed.errorType as BridgeErrorType;
      if (errorType in BRIDGE_ERROR_MESSAGES) {
        const info = BRIDGE_ERROR_MESSAGES[errorType];
        return {
          type: errorType,
          message: info.message,
          details: parsed.data,
          actionMessage: info.action,
        };
      }
    }
    if (parsed.type === 'error') {
      return classifyError(parsed.data ?? 'Unknown server error');
    }
  } catch {
    // Not JSON, try to classify the raw string
    return classifyError(data);
  }
  return null;
}

/**
 * Creates a bridge connection manager.
 * Manages WebSocket lifecycle, reconnection, and error classification.
 */
export function createBridgeConnection(
  url: string,
  callbacks: BridgeConnectionCallbacks,
): {
  connect: () => void;
  disconnect: () => void;
  send: (data: string) => void;
  getStatus: () => BridgeConnectionStatus;
} {
  let ws: WebSocket | null = null;
  let status: BridgeConnectionStatus = 'disconnected';
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  function setStatus(newStatus: BridgeConnectionStatus) {
    status = newStatus;
    callbacks.onStatusChange(newStatus);
  }

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      callbacks.onError({
        type: 'websocket_dropped',
        message: 'Failed to reconnect after multiple attempts',
        actionMessage: BRIDGE_ERROR_MESSAGES.bridge_not_running.action,
      });
      return;
    }

    reconnectAttempts++;
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
    setStatus('reconnecting');
    callbacks.onReconnectAttempt(reconnectAttempts, MAX_RECONNECT_ATTEMPTS);

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function connect() {
    // Clean up existing connection
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }

    intentionalClose = false;
    setStatus('connecting');

    try {
      ws = new WebSocket(url);
    } catch (err) {
      const bridgeError = classifyError(err);
      setStatus('error');
      callbacks.onError(bridgeError);
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      setStatus('connected');
      callbacks.onMessage({ type: 'status', data: 'Connected to bridge server' });
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : '';

      // Check if it's a server-sent error
      const serverError = parseServerError(data);
      if (serverError) {
        callbacks.onError(serverError);
        return;
      }

      // Try to parse as BridgeMessage JSON
      try {
        const msg = JSON.parse(data) as BridgeMessage;
        callbacks.onMessage(msg);
      } catch {
        // Raw text output from PTY
        callbacks.onMessage({ type: 'output', data });
      }
    };

    ws.onerror = () => {
      // WebSocket error events don't include useful info; onclose will fire next
      // We handle the error classification in onclose
    };

    ws.onclose = (event) => {
      ws = null;

      if (intentionalClose) {
        setStatus('disconnected');
        return;
      }

      // Classify the close reason
      if (event.code === 1000) {
        // Normal close
        setStatus('disconnected');
        callbacks.onMessage({ type: 'status', data: 'Connection closed normally' });
        return;
      }

      // Connection was never established (bridge not running)
      if (status === 'connecting') {
        const bridgeError = classifyError(
          new Error(`WebSocket connection to ${url} failed`),
          event.reason,
        );
        setStatus('error');
        callbacks.onError(bridgeError);
        return;
      }

      // Connection dropped mid-session
      const wsDropInfo = BRIDGE_ERROR_MESSAGES.websocket_dropped;
      callbacks.onError({
        type: 'websocket_dropped',
        message: wsDropInfo.message,
        details: event.reason || `Close code: ${event.code}`,
        actionMessage: wsDropInfo.action,
      });
      scheduleReconnect();
    };
  }

  function disconnect() {
    intentionalClose = true;
    clearReconnectTimer();
    reconnectAttempts = 0;

    if (ws) {
      ws.close(1000, 'Client disconnected');
      ws = null;
    }
    setStatus('disconnected');
  }

  function send(data: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  function getStatus() {
    return status;
  }

  return { connect, disconnect, send, getStatus };
}
