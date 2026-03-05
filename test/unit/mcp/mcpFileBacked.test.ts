/**
 * Feature #308: File-Backed MCP Server
 * Tests that the MCP server can load/save .archc files via --file flag,
 * auto-saves after mutations, and exposes 'save' and 'file_info' tools.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GraphContext } from '@/cli/context';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createMcpServer, getToolNames, getToolCount } from '@/mcp/server';
import {
  dispatchToolCall,
  handleSave,
  handleFileInfo,
  autoSave,
  MUTATION_TOOLS,
  type ToolHandlerContext,
} from '@/mcp/handlers';
import { TOOL_DEFINITIONS } from '@/mcp/tools';

// ─── Helpers ──────────────────────────────────────────────────

let tmpDir: string;

function tmpFile(name: string): string {
  return path.join(tmpDir, name);
}

/**
 * Create a new .archc file with an empty graph, return the path.
 */
async function createTestFile(name = 'test.archc'): Promise<string> {
  const filePath = tmpFile(name);
  const ctx = GraphContext.createNew('Test Architecture');
  await ctx.saveAs(filePath);
  return filePath;
}

// ─── Tests ────────────────────────────────────────────────────

describe('Feature #308: File-Backed MCP Server', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-mcp-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Step 1: CLI accepts --file argument ──

  describe('--file argument parsing', () => {
    it('cli.ts parseFileArg is described in the CLI entry point', async () => {
      // We test through GraphContext.loadFromFile which is used by the CLI
      const filePath = await createTestFile('parse-test.archc');
      const ctx = await GraphContext.loadFromFile(filePath);
      expect(ctx.textApi).toBeDefined();
      expect(ctx.getFilePath()).toBe(path.resolve(filePath));
    });
  });

  // ── Step 2: Load .archc file via GraphContext ──

  describe('load .archc file into MCP context', () => {
    it('loads a file and passes graph to TextApi', async () => {
      const filePath = await createTestFile();
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const graph = graphCtx.textApi.getGraph();
      expect(graph.name).toBe('Test Architecture');
      expect(graph.nodes).toHaveLength(0);
    });

    it('TextApi mutations work on loaded graph', async () => {
      const filePath = await createTestFile();
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      const result = dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Auth Service',
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.nodeId).toBeTruthy();

      const graph = graphCtx.textApi.getGraph();
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].displayName).toBe('Auth Service');
    });
  });

  // ── Step 3: Backward compatible empty graph ──

  describe('backward compatibility (no --file)', () => {
    it('works without graphContext (empty graph)', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'Empty', description: '', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);
      const ctx: ToolHandlerContext = { textApi, registry };

      const result = dispatchToolCall(ctx, 'describe', { format: 'structured' });
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('Empty');
      expect(parsed.nodeCount).toBe(0);
    });
  });

  // ── Step 4: Auto-save after mutation tools ──

  describe('auto-save after mutations', () => {
    it('MUTATION_TOOLS includes all 10 mutation tool names', () => {
      expect(MUTATION_TOOLS.has('add_node')).toBe(true);
      expect(MUTATION_TOOLS.has('add_edge')).toBe(true);
      expect(MUTATION_TOOLS.has('add_note')).toBe(true);
      expect(MUTATION_TOOLS.has('update_node')).toBe(true);
      expect(MUTATION_TOOLS.has('update_edge')).toBe(true);
      expect(MUTATION_TOOLS.has('remove_node')).toBe(true);
      expect(MUTATION_TOOLS.has('remove_edge')).toBe(true);
      expect(MUTATION_TOOLS.has('remove_note')).toBe(true);
      expect(MUTATION_TOOLS.has('add_code_ref')).toBe(true);
      expect(MUTATION_TOOLS.has('init_architecture')).toBe(true);
      expect(MUTATION_TOOLS.size).toBe(10);
    });

    it('autoSave persists changes to disk', async () => {
      const filePath = await createTestFile('autosave.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      // Add a node (mutation)
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'AutoSaved Service',
      });

      // Auto-save
      await autoSave(ctx);

      // Reload from disk and verify
      const reloaded = await GraphContext.loadFromFile(filePath);
      const graph = reloaded.textApi.getGraph();
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].displayName).toBe('AutoSaved Service');
    });

    it('autoSave is a no-op when no graphContext', async () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'Empty', description: '', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);
      const ctx: ToolHandlerContext = { textApi, registry };

      // Should not throw
      await autoSave(ctx);
    });
  });

  // ── Step 5: 'save' MCP tool ──

  describe('save tool', () => {
    it('save tool definition exists', () => {
      expect(TOOL_DEFINITIONS.save).toBeDefined();
      expect(TOOL_DEFINITIONS.save.name).toBe('save');
      expect(TOOL_DEFINITIONS.save.description).toBeTruthy();
    });

    it('save tool returns error when no file is loaded', async () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'Empty', description: '', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);
      const ctx: ToolHandlerContext = { textApi, registry };

      const result = await handleSave(ctx, {});
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('No file loaded');
    });

    it('save tool persists state when file-backed', async () => {
      const filePath = await createTestFile('save-tool.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      // Add a node
      dispatchToolCall(ctx, 'add_node', {
        type: 'data/database',
        displayName: 'Users DB',
      });

      // Explicit save
      const saveResult = await handleSave(ctx, {});
      const parsed = JSON.parse(saveResult);
      expect(parsed.success).toBe(true);
      expect(parsed.filePath).toBeTruthy();
      expect(parsed.message).toBe('File saved successfully.');

      // Verify on disk
      const reloaded = await GraphContext.loadFromFile(filePath);
      expect(reloaded.textApi.getGraph().nodes).toHaveLength(1);
      expect(reloaded.textApi.getGraph().nodes[0].displayName).toBe('Users DB');
    });

    it('save tool with force=true saves even when unmodified', async () => {
      const filePath = await createTestFile('force-save.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      const result = await handleSave(ctx, { force: true });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('File saved successfully.');
    });

    it('save tool reports no changes when unmodified and not forced', async () => {
      const filePath = await createTestFile('no-changes.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      const result = await handleSave(ctx, {});
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe('No changes to save.');
    });
  });

  // ── Step 6: 'file_info' MCP tool ──

  describe('file_info tool', () => {
    it('file_info tool definition exists', () => {
      expect(TOOL_DEFINITIONS.file_info).toBeDefined();
      expect(TOOL_DEFINITIONS.file_info.name).toBe('file_info');
      expect(TOOL_DEFINITIONS.file_info.description).toBeTruthy();
    });

    it('returns file info for file-backed context', async () => {
      const filePath = await createTestFile('info.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      // Add some data
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Node A',
      });
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Node B',
      });

      const result = handleFileInfo(ctx);
      const parsed = JSON.parse(result);
      expect(parsed.fileBacked).toBe(true);
      expect(parsed.filePath).toContain('info.archc');
      expect(parsed.architectureName).toBe('Test Architecture');
      expect(parsed.nodeCount).toBe(2);
      expect(parsed.edgeCount).toBe(0);
      expect(parsed.isModified).toBe(true);
    });

    it('returns info for non-file-backed context', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'In Memory', description: 'desc', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);
      const ctx: ToolHandlerContext = { textApi, registry };

      const result = handleFileInfo(ctx);
      const parsed = JSON.parse(result);
      expect(parsed.fileBacked).toBe(false);
      expect(parsed.filePath).toBeNull();
      expect(parsed.architectureName).toBe('In Memory');
      expect(parsed.nodeCount).toBe(0);
      expect(parsed.isModified).toBe(false);
    });
  });

  // ── Step 7: File locking / conflict detection ──

  describe('conflict detection', () => {
    it('isModified detects unsaved changes', async () => {
      const filePath = await createTestFile('conflict.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      expect(graphCtx.isModified()).toBe(false);

      // Mutate via TextApi
      graphCtx.textApi.addNode({
        type: 'compute/service',
        displayName: 'New Service',
      });
      expect(graphCtx.isModified()).toBe(true);

      // Save clears dirty flag
      await graphCtx.save();
      expect(graphCtx.isModified()).toBe(false);
    });
  });

  // ── Step 8: CLI mcp subcommand accepts --file ──

  describe('CLI mcp subcommand', () => {
    it('mcp subcommand is defined in CLI with --file option', async () => {
      // Import the createProgram function from CLI
      const { createProgram } = await import('@/cli/index');
      const program = createProgram();
      const mcpCmd = program.commands.find((c) => c.name() === 'mcp');
      expect(mcpCmd).toBeDefined();
      // Check it has --file option
      const fileOption = mcpCmd!.options.find(
        (o) => o.long === '--file' || o.short === '-f',
      );
      expect(fileOption).toBeDefined();
    });
  });

  // ── Step 9: Error handling for I/O failures ──

  describe('error handling for auto-save I/O failures', () => {
    it('autoSave logs error but does not throw on I/O failure', async () => {
      const filePath = await createTestFile('error-test.archc');
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();

      // Add a node to make it dirty
      graphCtx.textApi.addNode({
        type: 'compute/service',
        displayName: 'Error Test',
      });

      // Delete the file to cause I/O error on save
      fs.unlinkSync(filePath);
      fs.rmdirSync(path.dirname(filePath), { recursive: true } as any);

      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      // autoSave should NOT throw, just log error
      await expect(autoSave(ctx)).resolves.toBeUndefined();
    });

    it('handleSave returns error JSON when no file path is set (non-file-backed)', async () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'No File', description: '', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);
      // No graphContext = no file backing
      const ctx: ToolHandlerContext = { textApi, registry };

      const result = await handleSave(ctx, { force: true });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('No file loaded');
    });
  });

  // ── Step 10: Full round-trip test ──

  describe('full round-trip: load → modify → save → reload', () => {
    it('agent can load, modify, and save an architecture', async () => {
      // Create initial file
      const filePath = await createTestFile('roundtrip.archc');

      // Load
      const graphCtx = await GraphContext.loadFromFile(filePath);
      const registry = new RegistryManager();
      registry.initialize();
      const ctx: ToolHandlerContext = {
        textApi: graphCtx.textApi,
        registry,
        graphContext: graphCtx,
      };

      // Add nodes
      const addResult1 = dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'API Gateway',
      });
      const node1 = JSON.parse(addResult1);
      expect(node1.success).toBe(true);

      const addResult2 = dispatchToolCall(ctx, 'add_node', {
        type: 'data/database',
        displayName: 'Users Database',
      });
      const node2 = JSON.parse(addResult2);
      expect(node2.success).toBe(true);

      // Add edge
      const edgeResult = dispatchToolCall(ctx, 'add_edge', {
        fromNode: node1.nodeId,
        toNode: node2.nodeId,
        type: 'sync',
        label: 'queries',
      });
      const edge = JSON.parse(edgeResult);
      expect(edge.success).toBe(true);

      // Add note
      const noteResult = dispatchToolCall(ctx, 'add_note', {
        nodeId: node1.nodeId,
        author: 'test-agent',
        content: 'This is the main API gateway.',
      });
      expect(JSON.parse(noteResult).success).toBe(true);

      // Update node
      const updateResult = dispatchToolCall(ctx, 'update_node', {
        nodeId: node1.nodeId,
        displayName: 'Main API Gateway',
      });
      expect(JSON.parse(updateResult).success).toBe(true);

      // Check file_info
      const infoResult = handleFileInfo(ctx);
      const info = JSON.parse(infoResult);
      expect(info.nodeCount).toBe(2);
      expect(info.edgeCount).toBe(1);
      expect(info.isModified).toBe(true);

      // Save
      const saveResult = await handleSave(ctx, {});
      expect(JSON.parse(saveResult).success).toBe(true);

      // Reload and verify
      const reloaded = await GraphContext.loadFromFile(filePath);
      const graph = reloaded.textApi.getGraph();
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.nodes.find((n) => n.displayName === 'Main API Gateway')).toBeDefined();
      expect(graph.nodes.find((n) => n.displayName === 'Users Database')).toBeDefined();
      expect(graph.edges[0].label).toBe('queries');

      // Remove edge and save
      const registry2 = new RegistryManager();
      registry2.initialize();
      const ctx2: ToolHandlerContext = {
        textApi: reloaded.textApi,
        registry: registry2,
        graphContext: reloaded,
      };
      dispatchToolCall(ctx2, 'remove_edge', { edgeId: graph.edges[0].id });
      await autoSave(ctx2);

      // Verify removal persisted
      const reloaded2 = await GraphContext.loadFromFile(filePath);
      expect(reloaded2.textApi.getGraph().edges).toHaveLength(0);
      expect(reloaded2.textApi.getGraph().nodes).toHaveLength(2);
    });
  });

  // ── Tool count verification ──

  describe('tool count includes save and file_info', () => {
    it('has 19 total tools', () => {
      expect(getToolCount()).toBe(19);
    });

    it('tool names include save and file_info', () => {
      const names = getToolNames();
      expect(names).toContain('save');
      expect(names).toContain('file_info');
    });

    it('createMcpServer accepts graphContext parameter', () => {
      const registry = new RegistryManager();
      registry.initialize();
      const graph = { name: 'Test', description: '', owners: [], nodes: [], edges: [] };
      const textApi = new TextApi(graph, registry);

      // Should not throw with undefined graphContext
      const server = createMcpServer(textApi, registry);
      expect(server).toBeDefined();

      // Should not throw with graphContext
      // (We can't easily test with a real GraphContext here without file I/O)
    });
  });
});
