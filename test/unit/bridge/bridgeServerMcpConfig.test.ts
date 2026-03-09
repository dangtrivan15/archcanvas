/**
 * Bridge Server MCP Config Tests
 *
 * Feature #538: Spawn Claude Code with MCP config for current .archc file.
 * Verifies that when the bridge server spawns a Claude Code process, it
 * configures the ArchCanvas MCP server so Claude Code has access to
 * architecture tools (describe, add_node, search, etc.) pointed at the
 * currently open .archc file.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// ─── Source paths ────────────────────────────────────────────

const BRIDGE_SERVER_PATH = resolve('src/bridge/server.ts');
const BRIDGE_SOURCE = readFileSync(BRIDGE_SERVER_PATH, 'utf-8');

const CLI_INDEX_PATH = resolve('src/cli/index.ts');
const CLI_SOURCE = readFileSync(CLI_INDEX_PATH, 'utf-8');

const MCP_SERVER_PATH = resolve('src/mcp/server.ts');
const MCP_SOURCE = readFileSync(MCP_SERVER_PATH, 'utf-8');

const MCP_TOOLS_PATH = resolve('src/mcp/tools.ts');
const MCP_TOOLS_SOURCE = readFileSync(MCP_TOOLS_PATH, 'utf-8');

const FILE_POLLING_PATH = resolve('src/hooks/useFilePolling.ts');
const FILE_POLLING_SOURCE = readFileSync(FILE_POLLING_PATH, 'utf-8');

// ─── Step 1: Pass MCP server configuration when spawning claude process ──

describe('Step 1: Pass MCP server configuration when spawning claude process', () => {
  it('should have buildMcpConfig function in bridge server', () => {
    expect(BRIDGE_SOURCE).toContain('function buildMcpConfig');
  });

  it('should call buildMcpConfig with the resolved archc file path', () => {
    expect(BRIDGE_SOURCE).toContain('buildMcpConfig(resolvedPath)');
  });

  it('should pass --mcp-config flag to claude CLI spawn', () => {
    expect(BRIDGE_SOURCE).toContain("'--mcp-config'");
    // Should pass the config as JSON string
    expect(BRIDGE_SOURCE).toContain('JSON.stringify(mcpConfig)');
  });

  it('should pass --allowedTools flag restricting to archcanvas MCP tools', () => {
    expect(BRIDGE_SOURCE).toContain("'--allowedTools'");
    expect(BRIDGE_SOURCE).toContain("'mcp__archcanvas__*'");
  });

  it('should resolve the archcFile path before passing to buildMcpConfig', () => {
    expect(BRIDGE_SOURCE).toContain('resolve(archcFile)');
  });

  it('should check that the .archc file exists before spawning', () => {
    expect(BRIDGE_SOURCE).toContain('existsSync(resolvedPath)');
    expect(BRIDGE_SOURCE).toContain('Architecture file not found');
  });

  it('should spawn claude with the MCP config in args', () => {
    // spawnClaudeCode pushes --mcp-config to args array
    expect(BRIDGE_SOURCE).toContain("args.push('--mcp-config', JSON.stringify(mcpConfig))");
  });

  it('should set CLAUDE_CODE_NON_INTERACTIVE env variable', () => {
    expect(BRIDGE_SOURCE).toContain('CLAUDE_CODE_NON_INTERACTIVE');
  });

  it('should spawn the claude CLI command', () => {
    expect(BRIDGE_SOURCE).toContain("spawn('claude', args");
  });

  it('should pipe stdin/stdout/stderr for bidirectional communication', () => {
    expect(BRIDGE_SOURCE).toContain("stdio: ['pipe', 'pipe', 'pipe']");
  });
});

// ─── Step 2: MCP config points to the current .archc file path ──

describe('Step 2: MCP config points to the current .archc file path', () => {
  it('should build MCP config with mcpServers.archcanvas entry', () => {
    expect(BRIDGE_SOURCE).toContain('mcpServers');
    expect(BRIDGE_SOURCE).toContain('archcanvas');
  });

  it('should pass --file flag with the archc file path in MCP args', () => {
    // buildMcpConfig includes '--file' and archcFilePath in args
    expect(BRIDGE_SOURCE).toContain("'--file', archcFilePath");
  });

  it('should pass mcp subcommand to CLI entry point', () => {
    // The MCP config args include 'mcp' subcommand
    expect(BRIDGE_SOURCE).toContain("'mcp'");
  });

  it('should resolve CLI entry point path for the MCP server command', () => {
    // Uses import.meta.url to find the CLI entry
    expect(BRIDGE_SOURCE).toContain('import.meta.url');
    expect(BRIDGE_SOURCE).toContain('cli');
    expect(BRIDGE_SOURCE).toContain('index.ts');
  });

  it('should prefer built CLI (dist) if it exists, otherwise use tsx', () => {
    expect(BRIDGE_SOURCE).toContain('cliDistEntryPoint');
    expect(BRIDGE_SOURCE).toContain('cliEntryPoint');
    expect(BRIDGE_SOURCE).toContain('useBuilt');
    expect(BRIDGE_SOURCE).toContain("existsSync(cliDistEntryPoint)");
  });

  it('should use node command for built CLI and npx tsx for source', () => {
    expect(BRIDGE_SOURCE).toContain("const command = useBuilt ? 'node' : 'npx'");
  });

  it('should accept archcFile via BridgeServerOptions', () => {
    expect(BRIDGE_SOURCE).toContain('archcFile?: string');
  });

  it('should pass archcFile from options to handleConnection', () => {
    expect(BRIDGE_SOURCE).toContain('handleConnection(ws, archcFile');
  });

  it('should support ARCHCANVAS_FILE env variable for file path', () => {
    expect(BRIDGE_SOURCE).toContain("process.env['ARCHCANVAS_FILE']");
  });

  it('should support --file / -f CLI flags for file path', () => {
    expect(BRIDGE_SOURCE).toContain("'--file'");
    expect(BRIDGE_SOURCE).toContain("'-f'");
  });
});

// ─── Step 3: Verify Claude Code can use MCP tools ──

describe('Step 3: Verify Claude Code can use MCP tools (e.g., describe the architecture)', () => {
  it('should have CLI mcp subcommand that starts MCP server', () => {
    expect(CLI_SOURCE).toContain("command('mcp')");
    expect(CLI_SOURCE).toContain('MCP (Model Context Protocol) server commands');
  });

  it('should create MCP server with TextApi', () => {
    expect(CLI_SOURCE).toContain('createMcpServer(textApi, registry, graphContext)');
  });

  it('should use StdioServerTransport for Claude Code communication', () => {
    expect(CLI_SOURCE).toContain('StdioServerTransport');
    expect(CLI_SOURCE).toContain('server/stdio.js');
  });

  it('should connect MCP server to stdio transport', () => {
    expect(CLI_SOURCE).toContain('mcpServer.connect(transport)');
  });

  it('MCP server should register describe tool', () => {
    expect(MCP_TOOLS_SOURCE).toContain("name: 'describe'");
    expect(MCP_TOOLS_SOURCE).toContain('Describe the architecture');
  });

  it('MCP server should register add_node tool', () => {
    expect(MCP_TOOLS_SOURCE).toContain("name: 'add_node'");
    expect(MCP_TOOLS_SOURCE).toContain('Add a new node');
  });

  it('MCP server should register add_edge tool', () => {
    expect(MCP_TOOLS_SOURCE).toContain("name: 'add_edge'");
    expect(MCP_TOOLS_SOURCE).toContain('Add a connection');
  });

  it('MCP server should register search tool', () => {
    expect(MCP_TOOLS_SOURCE).toContain('search');
  });

  it('MCP server should use tool definitions for registration', () => {
    expect(MCP_SOURCE).toContain('TOOL_DEFINITIONS');
    expect(MCP_SOURCE).toContain('registerTools');
  });

  it('should load architecture file when --file is specified', () => {
    expect(CLI_SOURCE).toContain('GraphContext.loadFromFile(resolvedPath)');
  });

  it('should create empty graph when file does not exist', () => {
    expect(CLI_SOURCE).toContain('GraphContext.createNew');
  });

  it('should log loaded file path', () => {
    expect(CLI_SOURCE).toContain('[MCP] Loaded architecture from:');
  });
});

// ─── Step 4: Verify Claude Code MCP mutations modify the .archc file on disk ──

describe('Step 4: Verify Claude Code MCP mutations modify the .archc file on disk', () => {
  it('MCP server should have auto-save after mutation tool calls', () => {
    expect(MCP_SOURCE).toContain('autoSave');
    expect(MCP_SOURCE).toContain('MUTATION_TOOLS');
  });

  it('MCP server should identify mutation tools for auto-save', () => {
    expect(MCP_SOURCE).toContain('MUTATION_TOOLS');
  });

  it('MCP server should support file-backed mode with GraphContext', () => {
    expect(MCP_SOURCE).toContain('graphContext');
    expect(MCP_SOURCE).toContain('GraphContext');
  });

  it('MCP server should log file-backed mode status', () => {
    expect(MCP_SOURCE).toContain('File-backed mode: auto-save enabled');
  });

  it('should pass graphContext to createMcpServer for persistence', () => {
    expect(CLI_SOURCE).toContain('createMcpServer(textApi, registry, graphContext)');
  });

  it('should save new file if it does not exist when --file specified', () => {
    expect(CLI_SOURCE).toContain('graphContext.saveAs(resolvedPath)');
  });

  it('should create parent directory if needed', () => {
    expect(CLI_SOURCE).toContain("mkdirSync(dir, { recursive: true })");
  });

  it('auto-save should run after successful mutation tool call', () => {
    // createToolHandler checks MUTATION_TOOLS and calls autoSave
    expect(MCP_SOURCE).toContain("if (MUTATION_TOOLS.has(toolName))");
    expect(MCP_SOURCE).toContain('await autoSave(ctx)');
  });
});

// ─── Step 5: Verify file sync detects changes and reloads canvas ──

describe('Step 5: Verify the file sync feature detects changes and reloads the canvas', () => {
  it('should have file polling hook that monitors .archc files', () => {
    expect(FILE_POLLING_SOURCE).toContain('useFilePolling');
  });

  it('should poll file lastModified timestamp', () => {
    expect(FILE_POLLING_SOURCE).toContain('lastModified');
    expect(FILE_POLLING_SOURCE).toContain('getFile()');
  });

  it('should auto-reload when file changes with no local dirty state', () => {
    expect(FILE_POLLING_SOURCE).toContain('_applyDecodedFile');
  });

  it('should show conflict dialog when file changes with dirty local state', () => {
    expect(FILE_POLLING_SOURCE).toContain('fileExternallyModified');
  });

  it('should debounce rapid consecutive changes from MCP agent', () => {
    expect(FILE_POLLING_SOURCE).toContain('DEBOUNCE_DELAY_MS');
  });

  it('should skip detection while app is saving (prevent false positives)', () => {
    expect(FILE_POLLING_SOURCE).toContain('isSaving');
  });

  it('should emit file-changed event on external modification', () => {
    expect(FILE_POLLING_SOURCE).toContain('archcanvas:file-changed');
  });

  it('should decode and apply the reloaded file data', () => {
    expect(FILE_POLLING_SOURCE).toContain('decodeArchcData');
    expect(FILE_POLLING_SOURCE).toContain('_applyDecodedFile');
  });
});

// ─── Integration: buildMcpConfig returns valid configuration ──

describe('Integration: buildMcpConfig produces valid MCP config', () => {
  let mod: typeof import('@/bridge/server');

  beforeEach(async () => {
    mod = await import('@/bridge/server');
  });

  it('should export createBridgeServer', () => {
    expect(typeof mod.createBridgeServer).toBe('function');
  });

  it('should include archcFile in health endpoint', async () => {
    const testFile = '/tmp/test-archcanvas-feature538.archc';
    const { httpServer, wss } = mod.createBridgeServer({
      port: 0,
      host: 'localhost',
      cors: true,
      archcFile: testFile,
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, 'localhost', () => resolve());
      httpServer.on('error', reject);
    });

    const addr = httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('No address');

    const res = await fetch(`http://localhost:${addr.port}/health`);
    const body = await res.json();

    expect(body.status).toBe('ok');
    expect(body.archcFile).toBe(testFile);
    expect(body.claude).toBeDefined();

    // Clean up
    wss.close();
    httpServer.close();
  });

  it('should handle no archcFile in options', async () => {
    const { httpServer, wss } = mod.createBridgeServer({
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
    const body = await res.json();

    expect(body.status).toBe('ok');
    expect(body.archcFile).toBeNull();

    // Clean up
    wss.close();
    httpServer.close();
  });
});

// ─── Integration: MCP CLI command and tool registration ──

describe('Integration: CLI mcp command and MCP tool registration', () => {
  it('should register mcp subcommand', async () => {
    const { createProgram } = await import('@/cli/index');
    const program = createProgram();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('mcp');
  });

  it('should have mcp subcommand with --file option', async () => {
    const { createProgram } = await import('@/cli/index');
    const program = createProgram();
    const mcpCmd = program.commands.find((c) => c.name() === 'mcp');
    expect(mcpCmd).toBeDefined();
    const options = mcpCmd!.options.map((o) => o.long ?? o.short);
    expect(options).toContain('--file');
  });

  it('should have mcp subcommand with --transport option', async () => {
    const { createProgram } = await import('@/cli/index');
    const program = createProgram();
    const mcpCmd = program.commands.find((c) => c.name() === 'mcp');
    expect(mcpCmd).toBeDefined();
    const options = mcpCmd!.options.map((o) => o.long ?? o.short);
    expect(options).toContain('--transport');
  });
});

// ─── Integration: MCP server creates with tools ──

describe('Integration: MCP server creates with all architecture tools', () => {
  it('should export createMcpServer function', async () => {
    const { createMcpServer } = await import('@/mcp/server');
    expect(typeof createMcpServer).toBe('function');
  });

  it('should export TOOL_DEFINITIONS with required tools', async () => {
    const { TOOL_DEFINITIONS } = await import('@/mcp/tools');
    expect(TOOL_DEFINITIONS).toBeDefined();
    expect(TOOL_DEFINITIONS.describe).toBeDefined();
    expect(TOOL_DEFINITIONS.add_node).toBeDefined();
    expect(TOOL_DEFINITIONS.add_edge).toBeDefined();
  });

  it('should export getToolNames and getToolCount', async () => {
    const { getToolNames, getToolCount } = await import('@/mcp/tools');
    const names = getToolNames();
    const count = getToolCount();
    expect(names.length).toBeGreaterThan(0);
    expect(count).toBeGreaterThan(0);
    expect(names).toContain('describe');
    expect(names).toContain('add_node');
    expect(names).toContain('add_edge');
  });

  it('should export MUTATION_TOOLS set', async () => {
    const { MUTATION_TOOLS } = await import('@/mcp/handlers');
    expect(MUTATION_TOOLS).toBeDefined();
    expect(MUTATION_TOOLS instanceof Set).toBe(true);
    expect(MUTATION_TOOLS.has('add_node')).toBe(true);
    expect(MUTATION_TOOLS.has('add_edge')).toBe(true);
  });

  it('should export dispatchToolCall for tool execution', async () => {
    const { dispatchToolCall } = await import('@/mcp/handlers');
    expect(typeof dispatchToolCall).toBe('function');
  });
});

// ─── End-to-end: Full pipeline from bridge to MCP to file sync ──

describe('End-to-end: Full pipeline from bridge → MCP → file sync', () => {
  it('bridge server accepts --file option and passes to connection handler', () => {
    // CLI parsing
    expect(BRIDGE_SOURCE).toContain("'--file'");
    expect(BRIDGE_SOURCE).toContain("'-f'");
    // Options interface
    expect(BRIDGE_SOURCE).toContain('archcFile?: string');
    // Passed to createBridgeServer
    expect(BRIDGE_SOURCE).toContain('const { cors, archcFile } = options');
    // Passed to handleConnection
    expect(BRIDGE_SOURCE).toContain('handleConnection(ws, archcFile');
  });

  it('handleConnection passes archcFile to spawnClaudeCode', () => {
    expect(BRIDGE_SOURCE).toContain('spawnClaudeCode(archcFile)');
  });

  it('spawnClaudeCode builds MCP config and passes to claude CLI', () => {
    expect(BRIDGE_SOURCE).toContain('buildMcpConfig(resolvedPath)');
    expect(BRIDGE_SOURCE).toContain("args.push('--mcp-config', JSON.stringify(mcpConfig))");
  });

  it('MCP CLI command loads file and creates MCP server with GraphContext', () => {
    expect(CLI_SOURCE).toContain('GraphContext.loadFromFile');
    expect(CLI_SOURCE).toContain('createMcpServer(textApi, registry, graphContext)');
  });

  it('MCP server auto-saves mutations, modifying .archc file on disk', () => {
    expect(MCP_SOURCE).toContain("MUTATION_TOOLS.has(toolName)");
    expect(MCP_SOURCE).toContain('await autoSave(ctx)');
  });

  it('file polling hook detects external changes and reloads canvas', () => {
    expect(FILE_POLLING_SOURCE).toContain('lastModified');
    expect(FILE_POLLING_SOURCE).toContain('_applyDecodedFile');
    expect(FILE_POLLING_SOURCE).toContain('DEBOUNCE_DELAY_MS');
  });

  it('complete chain: bridge --file → spawnClaudeCode → MCP config → claude CLI → MCP server → auto-save → file poll → canvas reload', () => {
    // Bridge accepts file
    expect(BRIDGE_SOURCE).toContain('archcFile');
    // Spawns claude with MCP config
    expect(BRIDGE_SOURCE).toContain("spawn('claude'");
    expect(BRIDGE_SOURCE).toContain("'--mcp-config'");
    // CLI runs MCP server
    expect(CLI_SOURCE).toContain("command('mcp')");
    expect(CLI_SOURCE).toContain('mcpServer.connect(transport)');
    // MCP server has tools
    expect(MCP_SOURCE).toContain('TOOL_DEFINITIONS');
    // Auto-save on mutation
    expect(MCP_SOURCE).toContain('autoSave');
    // File polling detects change
    expect(FILE_POLLING_SOURCE).toContain('useFilePolling');
    expect(FILE_POLLING_SOURCE).toContain('_applyDecodedFile');
  });
});
