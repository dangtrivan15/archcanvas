/**
 * Tests for bridge connection service - error classification, message parsing,
 * and bridge error message constants.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyError,
  parseServerError,
  BRIDGE_ERROR_MESSAGES,
  MAX_RECONNECT_ATTEMPTS,
  INITIAL_RECONNECT_DELAY,
  DEFAULT_BRIDGE_URL,
  getBridgeUrl,
  BRIDGE_WS_PATH,
  type BridgeErrorType,
  type BridgeError,
  type BridgeMessage,
} from '@/services/bridgeConnection';

describe('Bridge Connection Service', () => {
  describe('BRIDGE_ERROR_MESSAGES constants', () => {
    it('has messages for all error types', () => {
      const errorTypes: BridgeErrorType[] = [
        'bridge_not_running',
        'claude_not_installed',
        'claude_auth_expired',
        'websocket_dropped',
        'pty_spawn_failed',
        'unknown',
      ];

      for (const type of errorTypes) {
        const msg = BRIDGE_ERROR_MESSAGES[type];
        expect(msg).toBeDefined();
        expect(msg.message).toBeTruthy();
        expect(msg.action).toBeTruthy();
      }
    });

    it('bridge_not_running message mentions npm run dev', () => {
      expect(BRIDGE_ERROR_MESSAGES.bridge_not_running.action).toContain('npm run dev');
    });

    it('claude_not_installed message mentions install instructions', () => {
      expect(BRIDGE_ERROR_MESSAGES.claude_not_installed.action).toContain('install');
    });

    it('claude_auth_expired message mentions claude login', () => {
      expect(BRIDGE_ERROR_MESSAGES.claude_auth_expired.action).toContain('claude login');
    });

    it('websocket_dropped message mentions reconnect', () => {
      expect(BRIDGE_ERROR_MESSAGES.websocket_dropped.action).toContain('reconnect');
    });

    it('pty_spawn_failed message mentions terminal', () => {
      expect(BRIDGE_ERROR_MESSAGES.pty_spawn_failed.action.toLowerCase()).toContain('terminal');
    });
  });

  describe('Configuration constants', () => {
    it('MAX_RECONNECT_ATTEMPTS is a positive number', () => {
      expect(MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(0);
    });

    it('INITIAL_RECONNECT_DELAY is at least 500ms', () => {
      expect(INITIAL_RECONNECT_DELAY).toBeGreaterThanOrEqual(500);
    });

    it('DEFAULT_BRIDGE_URL is a valid WebSocket URL', () => {
      expect(DEFAULT_BRIDGE_URL).toMatch(/^wss?:\/\//);
    });

    it('getBridgeUrl() returns a valid WebSocket URL', () => {
      const url = getBridgeUrl();
      expect(url).toMatch(/^wss?:\/\//);
      expect(url).toContain(BRIDGE_WS_PATH);
    });

    it('BRIDGE_WS_PATH is /bridge', () => {
      expect(BRIDGE_WS_PATH).toBe('/bridge');
    });

    it('getBridgeUrl() derives URL from window.location when available', () => {
      // In test environment, window.location should be available (jsdom)
      // or fallback should return a valid URL
      const url = getBridgeUrl();
      expect(url).toMatch(/^wss?:\/\/.+\/bridge$/);
    });
  });

  describe('classifyError', () => {
    it('classifies ECONNREFUSED as bridge_not_running', () => {
      const result = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:3100'));
      expect(result.type).toBe('bridge_not_running');
      expect(result.actionMessage).toContain('npm run dev');
    });

    it('classifies connection refused as bridge_not_running', () => {
      const result = classifyError(new Error('Connection refused'));
      expect(result.type).toBe('bridge_not_running');
    });

    it('classifies WebSocket connection failure as bridge_not_running', () => {
      const result = classifyError(new Error('WebSocket connection to wss://localhost:5173/bridge failed'));
      expect(result.type).toBe('bridge_not_running');
    });

    it('classifies "command not found" as claude_not_installed', () => {
      const result = classifyError(new Error('claude: command not found'));
      expect(result.type).toBe('claude_not_installed');
      expect(result.actionMessage).toContain('install');
    });

    it('classifies "not installed" as claude_not_installed', () => {
      const result = classifyError(new Error('Claude Code is not installed'));
      expect(result.type).toBe('claude_not_installed');
    });

    it('classifies ENOENT as claude_not_installed', () => {
      const result = classifyError(new Error('ENOENT: no such file or directory'));
      expect(result.type).toBe('claude_not_installed');
    });

    it('classifies auth expired as claude_auth_expired', () => {
      const result = classifyError(new Error('Authentication token has expired'));
      expect(result.type).toBe('claude_auth_expired');
      expect(result.actionMessage).toContain('claude login');
    });

    it('classifies 401 unauthorized as claude_auth_expired', () => {
      const result = classifyError(new Error('401 Unauthorized'));
      expect(result.type).toBe('claude_auth_expired');
    });

    it('classifies PTY spawn failure as pty_spawn_failed', () => {
      const result = classifyError(new Error('Failed to spawn PTY process'));
      expect(result.type).toBe('pty_spawn_failed');
    });

    it('classifies spawn errors as pty_spawn_failed', () => {
      const result = classifyError(new Error('spawn error: could not start process'));
      expect(result.type).toBe('pty_spawn_failed');
    });

    it('classifies unknown errors as unknown', () => {
      const result = classifyError(new Error('Something completely unexpected'));
      expect(result.type).toBe('unknown');
    });

    it('handles string errors', () => {
      const result = classifyError('Connection refused');
      expect(result.type).toBe('bridge_not_running');
    });

    it('uses context parameter for classification', () => {
      const result = classifyError(new Error('General error'), 'auth failed');
      expect(result.type).toBe('claude_auth_expired');
    });

    it('includes details in the error object', () => {
      const result = classifyError(new Error('Specific error message'));
      expect(result.details).toBe('Specific error message');
    });

    it('all classified errors have required fields', () => {
      const testCases = [
        new Error('ECONNREFUSED'),
        new Error('command not found'),
        new Error('auth expired'),
        new Error('spawn failure'),
        new Error('random error'),
      ];

      for (const err of testCases) {
        const result = classifyError(err);
        expect(result.type).toBeTruthy();
        expect(result.message).toBeTruthy();
        expect(result.actionMessage).toBeTruthy();
      }
    });
  });

  describe('parseServerError', () => {
    it('parses JSON error with known errorType', () => {
      const data = JSON.stringify({
        type: 'error',
        errorType: 'claude_not_installed',
        data: 'Claude binary not found in PATH',
      });
      const result = parseServerError(data);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('claude_not_installed');
      expect(result!.details).toBe('Claude binary not found in PATH');
    });

    it('parses JSON error with unknown errorType and classifies from data', () => {
      const data = JSON.stringify({
        type: 'error',
        data: 'Authentication expired',
      });
      const result = parseServerError(data);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('claude_auth_expired');
    });

    it('parses raw string errors', () => {
      const result = parseServerError('Connection refused');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('bridge_not_running');
    });

    it('returns null for non-error JSON messages', () => {
      const data = JSON.stringify({
        type: 'output',
        data: 'Hello, world!',
      });
      const result = parseServerError(data);
      expect(result).toBeNull();
    });

    it('handles all known errorType values from server', () => {
      const errorTypes: BridgeErrorType[] = [
        'bridge_not_running',
        'claude_not_installed',
        'claude_auth_expired',
        'websocket_dropped',
        'pty_spawn_failed',
      ];

      for (const errorType of errorTypes) {
        const data = JSON.stringify({
          type: 'error',
          errorType,
          data: `Error of type ${errorType}`,
        });
        const result = parseServerError(data);
        expect(result).not.toBeNull();
        expect(result!.type).toBe(errorType);
      }
    });

    it('parses PTY spawn error from server', () => {
      const data = JSON.stringify({
        type: 'error',
        errorType: 'pty_spawn_failed',
        data: 'Could not allocate PTY: permission denied',
      });
      const result = parseServerError(data);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pty_spawn_failed');
      expect(result!.details).toContain('permission denied');
      expect(result!.actionMessage).toBeTruthy();
    });
  });
});
