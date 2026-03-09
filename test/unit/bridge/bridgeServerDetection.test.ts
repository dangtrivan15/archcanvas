/**
 * Bridge Server Claude Code Detection Tests
 *
 * Feature #535: Auto-detect Claude Code installation.
 * Tests that the bridge server checks for the claude CLI on startup,
 * reports version/ready status via WebSocket if found, and sends
 * a clear error message if not found.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Source code path ────────────────────────────────────────

const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');

const BRIDGE_CONNECTION_PATH = resolve('src/services/bridgeConnection.ts');
const BRIDGE_CONNECTION_SOURCE = readFileSync(BRIDGE_CONNECTION_PATH, 'utf-8');

const TERMINAL_PANEL_PATH = resolve('src/components/panels/TerminalPanel.tsx');
const TERMINAL_PANEL_SOURCE = readFileSync(TERMINAL_PANEL_PATH, 'utf-8');

// ─── Step 1: Bridge server checks for claude CLI on startup ──

describe('Step 1: Bridge server checks for claude CLI on startup', () => {
  it('should export a detectClaudeCode function', () => {
    expect(BRIDGE_SOURCE).toContain('export function detectClaudeCode');
  });

  it('should export ClaudeDetectionResult interface', () => {
    expect(BRIDGE_SOURCE).toContain('export interface ClaudeDetectionResult');
  });

  it('should use which command on macOS/Linux', () => {
    expect(BRIDGE_SOURCE).toContain("'which claude'");
  });

  it('should use where command on Windows', () => {
    expect(BRIDGE_SOURCE).toContain("'where claude'");
  });

  it('should check process.platform for OS detection', () => {
    expect(BRIDGE_SOURCE).toContain("process.platform === 'win32'");
  });

  it('should import execSync from child_process', () => {
    expect(BRIDGE_SOURCE).toContain('execSync');
    expect(BRIDGE_SOURCE).toContain("from 'node:child_process'");
  });

  it('should run detection during createBridgeServer', () => {
    expect(BRIDGE_SOURCE).toContain('const claudeDetection = detectClaudeCode()');
  });

  it('should log detection result to stderr on startup', () => {
    expect(BRIDGE_SOURCE).toContain('[Bridge] Claude Code detected:');
    expect(BRIDGE_SOURCE).toContain('[Bridge] WARNING:');
  });

  it('should have a timeout for detection commands', () => {
    expect(BRIDGE_SOURCE).toContain('timeout: 5000');
  });

  it('should return found: false when claude is not installed', () => {
    expect(BRIDGE_SOURCE).toContain('found: false');
    expect(BRIDGE_SOURCE).toContain("error: 'Claude Code not found. Install it from https://claude.ai/code'");
  });

  it('should return found: true with path and version when installed', () => {
    expect(BRIDGE_SOURCE).toContain('found: true');
    expect(BRIDGE_SOURCE).toContain('version');
    expect(BRIDGE_SOURCE).toContain('path: claudePath');
  });
});

// ─── Step 2: If found, report version and ready status via WebSocket ──

describe('Step 2: If found, report version and ready status via WebSocket', () => {
  it('should run claude --version to get version', () => {
    expect(BRIDGE_SOURCE).toContain("'claude --version'");
  });

  it('should extract version number from output', () => {
    expect(BRIDGE_SOURCE).toContain('match');
    expect(BRIDGE_SOURCE).toMatch(/\\d\+\\.\\d\+/);
  });

  it('should send ready message with version data on successful detection', () => {
    // When claude is found, the ready message includes version info
    expect(BRIDGE_SOURCE).toContain("type: 'ready'");
    expect(BRIDGE_SOURCE).toContain('Claude Code v');
    expect(BRIDGE_SOURCE).toContain('detection.version');
  });

  it('should include claude info in health endpoint', () => {
    expect(BRIDGE_SOURCE).toContain('claude: {');
    expect(BRIDGE_SOURCE).toContain('claudeDetection.found');
    expect(BRIDGE_SOURCE).toContain('claudeDetection.version');
    expect(BRIDGE_SOURCE).toContain('claudeDetection.path');
  });

  it('should return claudeDetection from createBridgeServer', () => {
    expect(BRIDGE_SOURCE).toContain('claudeDetection: ClaudeDetectionResult');
    expect(BRIDGE_SOURCE).toContain('return { httpServer, wss, claudeDetection }');
  });

  it('should display Claude version in startup banner', () => {
    expect(BRIDGE_SOURCE).toContain('Claude:');
    expect(BRIDGE_SOURCE).toContain('claudeDetection.found');
  });

  it('should fall back to unknown version if --version fails', () => {
    expect(BRIDGE_SOURCE).toContain("version = 'unknown'");
  });
});

// ─── Step 3: If not found, send error message via WebSocket ──

describe('Step 3: If not found, send error message with install URL', () => {
  it('should check detection result before spawning claude process', () => {
    // handleConnection checks detection before spawning
    expect(BRIDGE_SOURCE).toContain('if (!detection.found)');
  });

  it('should send error message with install URL', () => {
    expect(BRIDGE_SOURCE).toContain("'Claude Code not found. Install it from https://claude.ai/code'");
  });

  it('should close WebSocket after sending error', () => {
    // After sending error, ws.close() is called
    const handleConnectionSection = BRIDGE_SOURCE.slice(
      BRIDGE_SOURCE.indexOf('function handleConnection'),
      BRIDGE_SOURCE.indexOf('// ─── Server Factory'),
    );
    expect(handleConnectionSection).toContain('ws.close()');
  });

  it('should pass detection result to handleConnection', () => {
    expect(BRIDGE_SOURCE).toContain('handleConnection(ws, archcFile, claudeDetection)');
  });

  it('should show WARNING in startup banner when not found', () => {
    expect(BRIDGE_SOURCE).toContain('WARNING: Claude Code not found');
    expect(BRIDGE_SOURCE).toContain('WebSocket connections will receive an error');
  });

  it('should include error in health endpoint when not found', () => {
    expect(BRIDGE_SOURCE).toContain('claudeDetection.error');
  });
});

// ─── Step 4: Web app displays the error in the terminal panel ──

describe('Step 4: Web app displays the error in the terminal panel area', () => {
  it('should have claude_not_installed error type in bridgeConnection', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("'claude_not_installed'");
  });

  it('should classify "not found" errors as claude_not_installed', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain("combinedContext.includes('not installed')");
    expect(BRIDGE_CONNECTION_SOURCE).toContain("combinedContext.includes('command not found')");
  });

  it('should have user-facing message for claude_not_installed', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('Claude Code is not installed');
  });

  it('should have action message for claude_not_installed', () => {
    expect(BRIDGE_CONNECTION_SOURCE).toContain('Install Claude Code');
  });

  it('should display error banner in TerminalPanel', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('terminal-error-banner');
    expect(TERMINAL_PANEL_SOURCE).toContain('terminal-error-message');
    expect(TERMINAL_PANEL_SOURCE).toContain('terminal-error-action');
  });

  it('should show error-specific icon for claude_not_installed (XCircle)', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('claude_not_installed: XCircle');
  });

  it('should show red error color for claude_not_installed', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('claude_not_installed:');
    expect(TERMINAL_PANEL_SOURCE).toMatch(/claude_not_installed.*red/);
  });

  it('should have Copy and Retry buttons in error banner', () => {
    expect(TERMINAL_PANEL_SOURCE).toContain('terminal-copy-error-btn');
    expect(TERMINAL_PANEL_SOURCE).toContain('terminal-retry-btn');
  });
});

// ─── Step 5: Verify detection works on macOS and Linux ──

describe('Step 5: Verify detection works on macOS and Linux', () => {
  it('should use platform-dependent command (which vs where)', () => {
    expect(BRIDGE_SOURCE).toContain("process.platform === 'win32' ? 'where claude' : 'which claude'");
  });

  it('should handle multi-line output from which/where (take first line)', () => {
    // `where` on Windows can return multiple paths; take first
    expect(BRIDGE_SOURCE).toContain(".split('\\n')[0]");
  });

  it('should trim whitespace from path output', () => {
    expect(BRIDGE_SOURCE).toContain('.trim()');
  });

  it('should handle execSync errors gracefully (catch block)', () => {
    // If which/where fails, catch block returns found: false
    const detectSection = BRIDGE_SOURCE.slice(
      BRIDGE_SOURCE.indexOf('export function detectClaudeCode'),
      BRIDGE_SOURCE.indexOf('// ─── Types'),
    );
    expect(detectSection).toContain('catch');
    expect(detectSection).toContain('found: false');
  });

  it('should use pipe for all stdio to suppress output', () => {
    expect(BRIDGE_SOURCE).toContain("stdio: ['pipe', 'pipe', 'pipe']");
  });
});

// ─── Integration: detectClaudeCode function ──────────────────

describe('Integration: detectClaudeCode function', () => {
  let mod: typeof import('@/bridge/server');

  beforeEach(async () => {
    mod = await import('@/bridge/server');
  });

  it('should export detectClaudeCode function', () => {
    expect(typeof mod.detectClaudeCode).toBe('function');
  });

  it('should return an object with found property', () => {
    const result = mod.detectClaudeCode();
    expect(typeof result.found).toBe('boolean');
  });

  it('should return version and path when claude is found', () => {
    const result = mod.detectClaudeCode();
    if (result.found) {
      expect(result.version).toBeDefined();
      expect(result.path).toBeDefined();
      expect(typeof result.version).toBe('string');
      expect(typeof result.path).toBe('string');
    }
  });

  it('should return error message when claude is not found', () => {
    const result = mod.detectClaudeCode();
    if (!result.found) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Claude Code not found');
      expect(result.error).toContain('https://claude.ai/code');
    }
  });

  it('should export ClaudeDetectionResult type (via createBridgeServer return)', () => {
    const { httpServer, wss, claudeDetection } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
    });

    expect(claudeDetection).toBeDefined();
    expect(typeof claudeDetection.found).toBe('boolean');

    // Clean up
    wss.close();
    httpServer.close();
  });

  it('should include claude info in health endpoint response', async () => {
    const { httpServer, wss, claudeDetection } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, 'localhost', () => resolve());
      httpServer.on('error', reject);
    });

    const addr = httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('No address');

    const res = await fetch(`http://localhost:${addr.port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claude).toBeDefined();
    expect(typeof body.claude.found).toBe('boolean');
    expect(body.claude.found).toBe(claudeDetection.found);
    if (claudeDetection.found) {
      expect(body.claude.version).toBe(claudeDetection.version);
      expect(body.claude.path).toBe(claudeDetection.path);
    } else {
      expect(body.claude.error).toContain('Claude Code not found');
    }

    // Clean up
    wss.close();
    httpServer.close();
  });
});
