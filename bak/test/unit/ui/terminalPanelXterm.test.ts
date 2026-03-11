/**
 * Tests for Feature #536: xterm.js terminal component in right panel
 *
 * Verifies that the terminal panel uses xterm.js for proper terminal emulation,
 * connects to bridge server via WebSocket, streams I/O character-by-character,
 * and resizes properly with the FitAddon.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalStore } from '@/store/terminalStore';
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
const nodeDetailPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/components/panels/NodeDetailPanel.tsx'),
  'utf-8',
);
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf-8'),
);

describe('Feature #536: xterm.js terminal component in right panel', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      connectionStatus: 'disconnected',
      currentError: null,
      reconnectAttempt: 0,
      maxReconnectAttempts: 0,
      lines: [],
      xtermInstance: null,
    });
  });

  describe('Step 1: Install xterm and @xterm/addon-fit dependencies', () => {
    it('@xterm/xterm is listed in package.json dependencies', () => {
      expect(packageJson.dependencies['@xterm/xterm']).toBeTruthy();
    });

    it('@xterm/addon-fit is listed in package.json dependencies', () => {
      expect(packageJson.dependencies['@xterm/addon-fit']).toBeTruthy();
    });

    it('@xterm/xterm package is installed in node_modules', () => {
      const xtermPath = path.resolve(__dirname, '../../../node_modules/@xterm/xterm');
      expect(fs.existsSync(xtermPath)).toBe(true);
    });

    it('@xterm/addon-fit package is installed in node_modules', () => {
      const fitPath = path.resolve(__dirname, '../../../node_modules/@xterm/addon-fit');
      expect(fs.existsSync(fitPath)).toBe(true);
    });
  });

  describe('Step 2: Create TerminalPanel component with xterm.js instance', () => {
    it('imports Terminal from @xterm/xterm', () => {
      expect(terminalPanelSource).toContain("import { Terminal } from '@xterm/xterm'");
    });

    it('imports FitAddon from @xterm/addon-fit', () => {
      expect(terminalPanelSource).toContain("import { FitAddon } from '@xterm/addon-fit'");
    });

    it('imports xterm CSS for proper rendering', () => {
      expect(terminalPanelSource).toContain("@xterm/xterm/css/xterm.css");
    });

    it('creates a new Terminal instance with configuration', () => {
      expect(terminalPanelSource).toContain('new Terminal(');
      expect(terminalPanelSource).toContain('cursorBlink');
      expect(terminalPanelSource).toContain('fontSize');
      expect(terminalPanelSource).toContain('fontFamily');
    });

    it('creates and loads FitAddon', () => {
      expect(terminalPanelSource).toContain('new FitAddon()');
      expect(terminalPanelSource).toContain('terminal.loadAddon(fitAddon)');
    });

    it('opens terminal in a DOM container ref', () => {
      expect(terminalPanelSource).toContain('terminal.open(');
      expect(terminalPanelSource).toContain('xtermContainerRef');
    });

    it('has an xterm container div with data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="xterm-container"');
    });

    it('disposes terminal on cleanup', () => {
      expect(terminalPanelSource).toContain('terminal.dispose()');
    });

    it('stores xterm instance ref for later use', () => {
      expect(terminalPanelSource).toContain('xtermRef.current = terminal');
    });

    it('has a dark theme matching the panel background', () => {
      expect(terminalPanelSource).toContain('theme:');
      expect(terminalPanelSource).toContain('background:');
      expect(terminalPanelSource).toContain('foreground:');
    });
  });

  describe('Step 3: Add Terminal tab to the right panel tab list', () => {
    it('NodeDetailPanel imports TerminalPanel', () => {
      expect(nodeDetailPanelSource).toContain("import { TerminalPanel } from './TerminalPanel'");
    });

    it('NodeDetailPanel has terminal tab button', () => {
      expect(nodeDetailPanelSource).toContain("'terminal' as Tab");
      expect(nodeDetailPanelSource).toContain("label: 'Terminal'");
    });

    it('NodeDetailPanel renders TerminalPanel for terminal tab', () => {
      expect(nodeDetailPanelSource).toContain('<TerminalPanel />');
    });
  });

  describe('Step 4: Connect terminal to bridge server WebSocket on mount', () => {
    it('terminal store has connect action', () => {
      const store = useTerminalStore.getState();
      expect(typeof store.connect).toBe('function');
    });

    it('terminal store has sendInput action', () => {
      const store = useTerminalStore.getState();
      expect(typeof store.sendInput).toBe('function');
    });

    it('terminal store has setXtermInstance action for component binding', () => {
      const store = useTerminalStore.getState();
      expect(typeof store.setXtermInstance).toBe('function');
    });

    it('terminal store has writeToXterm action for direct xterm writes', () => {
      const store = useTerminalStore.getState();
      expect(typeof store.writeToXterm).toBe('function');
    });

    it('TerminalPanel sets xterm instance in store on mount', () => {
      expect(terminalPanelSource).toContain('setXtermInstance(terminal)');
    });

    it('TerminalPanel clears xterm instance in store on unmount', () => {
      expect(terminalPanelSource).toContain('setXtermInstance(null)');
    });

    it('terminal store supports xtermInstance state', () => {
      expect(terminalStoreSource).toContain('xtermInstance: Terminal | null');
      expect(terminalStoreSource).toContain('xtermInstance: null');
    });
  });

  describe('Step 5: Verify typed input is sent to bridge server', () => {
    it('TerminalPanel registers onData handler for terminal input', () => {
      expect(terminalPanelSource).toContain('terminal.onData(');
    });

    it('onData handler calls sendInput from terminal store', () => {
      // The component should forward typed data to the bridge connection
      expect(terminalPanelSource).toContain('sendInput');
      expect(terminalPanelSource).toContain('send(data)');
    });

    it('sendInput only sends when connected', () => {
      // The onData handler should check connection status before sending
      expect(terminalPanelSource).toContain("status === 'connected'");
    });

    it('terminal store sendInput forwards to bridge connection as JSON', () => {
      expect(terminalStoreSource).toContain("bridgeConnection.send(JSON.stringify({ type: 'stdin', data: input }))");
    });
  });

  describe('Step 6: Verify Claude Code output streams character-by-character in the terminal', () => {
    it('terminal store writeToXterm calls xtermInstance.write() directly', () => {
      expect(terminalStoreSource).toContain('xtermInstance.write(data)');
    });

    it('output messages are routed through writeToXterm (not addLine)', () => {
      // In the onMessage callback, output type should use writeToXterm
      expect(terminalStoreSource).toContain('state.writeToXterm(message.data)');
    });

    it('writeToXterm falls back to addLine when xterm not available', () => {
      expect(terminalStoreSource).toContain("get().addLine('output', data)");
    });

    it('writeToXterm writes directly without line buffering', () => {
      // The write call should use terminal.write() not terminal.writeln()
      // terminal.write() preserves character-by-character streaming
      expect(terminalStoreSource).toContain('xtermInstance.write(data)');
      // Should not use writeln for raw output data
      const writeToXtermBlock = terminalStoreSource.substring(
        terminalStoreSource.indexOf('writeToXterm:'),
        terminalStoreSource.indexOf('},', terminalStoreSource.indexOf('writeToXterm:')) + 2,
      );
      expect(writeToXtermBlock).not.toContain('writeln');
    });

    it('system/status/error messages written to xterm with ANSI colors', () => {
      // The component effect writes lines to xterm with ANSI color codes
      expect(terminalPanelSource).toContain('ANSI_COLORS');
      expect(terminalPanelSource).toContain('\\x1b[31m'); // red for errors
      expect(terminalPanelSource).toContain('\\x1b[32m'); // green for status
      expect(terminalPanelSource).toContain('\\x1b[34m'); // blue for system
      expect(terminalPanelSource).toContain('\\x1b[0m');  // reset
    });

    it('terminal has scrollback buffer', () => {
      expect(terminalPanelSource).toContain('scrollback:');
    });

    it('terminal has convertEol enabled for proper line rendering', () => {
      expect(terminalPanelSource).toContain('convertEol: true');
    });
  });

  describe('Step 7: Verify terminal resizes properly when panel is resized', () => {
    it('uses ResizeObserver to detect container size changes', () => {
      expect(terminalPanelSource).toContain('new ResizeObserver(');
    });

    it('calls fitAddon.fit() on resize', () => {
      expect(terminalPanelSource).toContain('fitAddonRef.current?.fit()');
    });

    it('performs initial fit after terminal.open()', () => {
      expect(terminalPanelSource).toContain('fitAddon.fit()');
    });

    it('disconnects observer on cleanup', () => {
      expect(terminalPanelSource).toContain('observer.disconnect()');
    });

    it('handles fit errors gracefully during layout transitions', () => {
      // fitAddon.fit() can throw if container has 0 dimensions
      expect(terminalPanelSource).toContain('} catch');
    });

    it('observes the xterm container element', () => {
      expect(terminalPanelSource).toContain('observer.observe(container)');
    });

    it('stores fitAddon in a ref for resize handling', () => {
      expect(terminalPanelSource).toContain('fitAddonRef');
      expect(terminalPanelSource).toContain('useRef<FitAddon');
    });
  });

  describe('Terminal store xterm integration', () => {
    it('setXtermInstance stores the terminal reference', () => {
      const mockTerminal = { write: () => {}, dispose: () => {} } as unknown as import('@xterm/xterm').Terminal;
      useTerminalStore.getState().setXtermInstance(mockTerminal);
      expect(useTerminalStore.getState().xtermInstance).toBe(mockTerminal);
    });

    it('setXtermInstance(null) clears the reference', () => {
      const mockTerminal = { write: () => {}, dispose: () => {} } as unknown as import('@xterm/xterm').Terminal;
      useTerminalStore.getState().setXtermInstance(mockTerminal);
      useTerminalStore.getState().setXtermInstance(null);
      expect(useTerminalStore.getState().xtermInstance).toBeNull();
    });

    it('writeToXterm calls write on stored instance', () => {
      let writtenData = '';
      const mockTerminal = {
        write: (data: string) => { writtenData = data; },
        dispose: () => {},
      } as unknown as import('@xterm/xterm').Terminal;

      useTerminalStore.getState().setXtermInstance(mockTerminal);
      useTerminalStore.getState().writeToXterm('Hello, World!');
      expect(writtenData).toBe('Hello, World!');
    });

    it('writeToXterm falls back to addLine when no xterm instance', () => {
      useTerminalStore.getState().setXtermInstance(null);
      useTerminalStore.getState().writeToXterm('fallback data');
      const lines = useTerminalStore.getState().lines;
      expect(lines.length).toBe(1);
      expect(lines[0].type).toBe('output');
      expect(lines[0].content).toBe('fallback data');
    });

    it('clearTerminal action still works', () => {
      useTerminalStore.getState().addLine('output', 'test');
      expect(useTerminalStore.getState().lines.length).toBe(1);
      useTerminalStore.getState().clearTerminal();
      expect(useTerminalStore.getState().lines.length).toBe(0);
    });

    it('TerminalPanel clear button also clears xterm', () => {
      // The clear handler in TerminalPanel should call both clearTerminal and xterm.clear()
      expect(terminalPanelSource).toContain('clearTerminal()');
      expect(terminalPanelSource).toContain('xtermRef.current?.clear()');
    });
  });

  describe('Backward compatibility', () => {
    it('preserves terminal-panel data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-panel"');
    });

    it('preserves terminal-header data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-header"');
    });

    it('preserves terminal-output data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-output"');
    });

    it('preserves terminal-empty-state data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-empty-state"');
    });

    it('preserves terminal-connect-btn data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-connect-btn"');
    });

    it('preserves terminal-disconnect-btn data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-disconnect-btn"');
    });

    it('preserves error banner data-testids', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-error-banner"');
      expect(terminalPanelSource).toContain('data-testid="terminal-error-message"');
      expect(terminalPanelSource).toContain('data-testid="terminal-error-action"');
    });

    it('preserves status indicator and label data-testids', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-status-indicator"');
      expect(terminalPanelSource).toContain('data-testid="terminal-status-label"');
    });

    it('preserves reconnect banner data-testid', () => {
      expect(terminalPanelSource).toContain('data-testid="terminal-reconnect-banner"');
    });

    it('terminal store still supports addLine for backward compat', () => {
      const store = useTerminalStore.getState();
      store.addLine('output', 'Hello from PTY');
      const lines = useTerminalStore.getState().lines;
      expect(lines).toHaveLength(1);
      expect(lines[0].type).toBe('output');
      expect(lines[0].content).toBe('Hello from PTY');
    });
  });
});
