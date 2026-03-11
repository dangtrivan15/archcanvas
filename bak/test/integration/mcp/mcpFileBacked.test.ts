/**
 * MCP Integration Tests (Feature #315).
 *
 * Tests MCP server in file-backed mode:
 *   - Load file → mutate via tools → verify save
 *   - Backward compatibility: no --file flag starts with empty graph
 *   - Auto-save after mutations in file-backed mode
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  dispatchToolCall,
  handleSave,
  handleFileInfo,
  autoSave,
  MUTATION_TOOLS,
  type ToolHandlerContext,
} from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { GraphContext } from '@/cli/context';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Helper to run CLI init for setting up .archc files
async function initArchcFile(filePath: string, name = 'MCP Test'): Promise<void> {
  const ctx = GraphContext.createNew(name);
  await ctx.saveAs(filePath);
}

describe('MCP Integration: File-Backed Mode', () => {
  let tmpDir: string;
  let archcFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-mcp-integration-'));
    archcFile = path.join(tmpDir, 'test.archc');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Step 1: Load file, mutate via tools, verify save ───

  it('file-backed mode: load file, mutate via tools, verify save', async () => {
    // Create initial .archc file
    await initArchcFile(archcFile, 'File-Backed Test');

    // Load into GraphContext
    const graphContext = await GraphContext.loadFromFile(archcFile);
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: graphContext.textApi,
      registry,
      graphContext,
    };

    // Add a node via MCP tool
    const addResult = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'MCP Service',
      }),
    );
    expect(addResult.success).toBe(true);
    const nodeId = addResult.nodeId;

    // Auto-save (simulates what MCP server does after mutation)
    await autoSave(ctx);

    // Reload the file from disk and verify node persisted
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const reloadedGraph = reloaded.getGraph();
    expect(reloadedGraph.nodes).toHaveLength(1);
    expect(reloadedGraph.nodes[0].displayName).toBe('MCP Service');
    expect(reloadedGraph.nodes[0].id).toBe(nodeId);
  });

  it('file-backed mode: add-node → add-edge → verify both persist', async () => {
    await initArchcFile(archcFile, 'Edge Test');
    const graphContext = await GraphContext.loadFromFile(archcFile);
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: graphContext.textApi,
      registry,
      graphContext,
    };

    // Add two nodes
    const node1 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Frontend',
      }),
    );
    const node2 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Backend',
      }),
    );

    // Add edge
    const edge = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: node1.nodeId,
        toNode: node2.nodeId,
        type: 'sync',
        label: 'HTTP',
      }),
    );
    expect(edge.success).toBe(true);

    // Save
    await autoSave(ctx);

    // Reload and verify
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const graph = reloaded.getGraph();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].label).toBe('HTTP');
  });

  it('file-backed mode: save tool returns file path info', async () => {
    await initArchcFile(archcFile);
    const graphContext = await GraphContext.loadFromFile(archcFile);
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: graphContext.textApi,
      registry,
      graphContext,
    };

    // Mutate to create changes
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'SaveTest',
    });

    // Explicit save via save tool
    const saveResult = JSON.parse(await handleSave(ctx, {}));
    expect(saveResult.success).toBe(true);
    expect(saveResult.filePath).toBe(archcFile);
  });

  it('file_info tool returns correct metadata', async () => {
    await initArchcFile(archcFile, 'Info Test Arch');
    const graphContext = await GraphContext.loadFromFile(archcFile);
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: graphContext.textApi,
      registry,
      graphContext,
    };

    // Add a node so we have data
    dispatchToolCall(ctx, 'add_node', {
      type: 'compute/service',
      displayName: 'InfoNode',
    });

    const info = JSON.parse(handleFileInfo(ctx));
    expect(info.fileBacked).toBe(true);
    expect(info.filePath).toBe(archcFile);
    expect(info.architectureName).toBe('Info Test Arch');
    expect(info.nodeCount).toBe(1);
    expect(info.isModified).toBe(true);
  });

  // ─── Step 2: Backward compatibility — no --file starts empty graph ───

  it('backward compatibility: no --file flag starts with empty graph', () => {
    const registry = new RegistryManager();
    registry.initialize();
    const graph = createEmptyGraph('Untitled Architecture');
    const textApi = new TextApi(graph, registry);
    const ctx: ToolHandlerContext = {
      textApi,
      registry,
      // No graphContext — simulates no --file
    };

    // Describe should work with empty graph
    const descResult = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(descResult.nodeCount).toBe(0);

    // Mutations should work (in-memory only)
    const addResult = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'MemoryNode',
      }),
    );
    expect(addResult.success).toBe(true);

    // Verify node exists
    const descAfter = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
    expect(descAfter.nodeCount).toBe(1);
    expect(descAfter.nodes[0].displayName).toBe('MemoryNode');
  });

  it('backward compatibility: save tool returns error without file', async () => {
    const registry = new RegistryManager();
    registry.initialize();
    const graph = createEmptyGraph('No-File Test');
    const textApi = new TextApi(graph, registry);
    const ctx: ToolHandlerContext = { textApi, registry };

    const saveResult = JSON.parse(await handleSave(ctx, {}));
    expect(saveResult.success).toBe(false);
    expect(saveResult.error).toContain('No file loaded');
  });

  it('backward compatibility: file_info shows not file-backed', () => {
    const registry = new RegistryManager();
    registry.initialize();
    const graph = createEmptyGraph('No-File Info');
    const textApi = new TextApi(graph, registry);
    const ctx: ToolHandlerContext = { textApi, registry };

    const info = JSON.parse(handleFileInfo(ctx));
    expect(info.fileBacked).toBe(false);
    expect(info.filePath).toBeNull();
  });

  // ─── Step 3: Mutation tools list is correct ───

  it('MUTATION_TOOLS set contains expected tools', () => {
    expect(MUTATION_TOOLS.has('add_node')).toBe(true);
    expect(MUTATION_TOOLS.has('add_edge')).toBe(true);
    expect(MUTATION_TOOLS.has('remove_node')).toBe(true);
    expect(MUTATION_TOOLS.has('remove_edge')).toBe(true);
    expect(MUTATION_TOOLS.has('add_note')).toBe(true);
    expect(MUTATION_TOOLS.has('update_node')).toBe(true);
    expect(MUTATION_TOOLS.has('update_edge')).toBe(true);
    // Non-mutation tools
    expect(MUTATION_TOOLS.has('describe')).toBe(false);
    expect(MUTATION_TOOLS.has('search')).toBe(false);
    expect(MUTATION_TOOLS.has('list_nodedefs')).toBe(false);
  });

  // ─── Step 4: Multiple mutations then reload ───

  it('multiple mutations accumulate and persist correctly', async () => {
    await initArchcFile(archcFile, 'Multi-Mutate');
    const graphContext = await GraphContext.loadFromFile(archcFile);
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: graphContext.textApi,
      registry,
      graphContext,
    };

    // Add 3 nodes
    const n1 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Svc1',
      }),
    );
    const n2 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'data/database',
        displayName: 'DB1',
      }),
    );
    const n3 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'messaging/message-queue',
        displayName: 'Queue1',
      }),
    );

    // Add 2 edges
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: n1.nodeId,
      toNode: n2.nodeId,
      type: 'sync',
    });
    dispatchToolCall(ctx, 'add_edge', {
      fromNode: n1.nodeId,
      toNode: n3.nodeId,
      type: 'async',
    });

    // Add a note
    dispatchToolCall(ctx, 'add_note', {
      nodeId: n1.nodeId,
      author: 'test',
      content: 'Integration test note',
    });

    // Update a node
    dispatchToolCall(ctx, 'update_node', {
      nodeId: n2.nodeId,
      displayName: 'UsersDB',
    });

    // Save and reload
    await autoSave(ctx);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const graph = reloaded.getGraph();

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);

    // Verify updated name
    const db = graph.nodes.find((n) => n.id === n2.nodeId);
    expect(db?.displayName).toBe('UsersDB');

    // Verify note
    const svc = graph.nodes.find((n) => n.id === n1.nodeId);
    expect(svc?.notes).toHaveLength(1);
    expect(svc?.notes[0].content).toBe('Integration test note');
  });

  // ─── Step 5: MCP startup with non-existent --file ───

  it('non-existent --file: creates parent directory and .archc file with empty graph', async () => {
    // Simulate what the MCP command does when --file points to a non-existent path
    const nestedDir = path.join(tmpDir, 'deeply', 'nested', 'dir');
    const nonExistentFile = path.join(nestedDir, 'new-project.archc');

    // Verify path does not exist
    expect(fs.existsSync(nonExistentFile)).toBe(false);
    expect(fs.existsSync(nestedDir)).toBe(false);

    // Replicate the MCP startup logic for non-existent file:
    // 1. Create parent directory
    fs.mkdirSync(path.dirname(nonExistentFile), { recursive: true });
    // 2. Create new GraphContext and save
    const graphContext = GraphContext.createNew('Untitled Architecture');
    await graphContext.saveAs(nonExistentFile);

    // Verify directory was created
    expect(fs.existsSync(nestedDir)).toBe(true);

    // Verify .archc file was created
    expect(fs.existsSync(nonExistentFile)).toBe(true);

    // Verify file is loadable and contains empty graph
    const reloaded = await GraphContext.loadFromFile(nonExistentFile);
    const graph = reloaded.getGraph();
    expect(graph.name).toBe('Untitled Architecture');
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);

    // Verify the server context works (can add nodes)
    const registry = new RegistryManager();
    registry.initialize();
    const ctx: ToolHandlerContext = {
      textApi: reloaded.textApi,
      registry,
      graphContext: reloaded,
    };

    const addResult = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'PostStartupNode',
      }),
    );
    expect(addResult.success).toBe(true);

    // Save and verify persistence
    await autoSave(ctx);
    const final = await GraphContext.loadFromFile(nonExistentFile);
    expect(final.getGraph().nodes).toHaveLength(1);
    expect(final.getGraph().nodes[0].displayName).toBe('PostStartupNode');
  });

  it('non-existent --file: handles existing parent directory gracefully', async () => {
    // When parent dir already exists but file doesn't
    const existingDir = path.join(tmpDir, 'existing-dir');
    fs.mkdirSync(existingDir, { recursive: true });
    const newFile = path.join(existingDir, 'brand-new.archc');

    expect(fs.existsSync(newFile)).toBe(false);

    // mkdirSync with recursive:true is idempotent
    fs.mkdirSync(path.dirname(newFile), { recursive: true });
    const graphContext = GraphContext.createNew('Untitled Architecture');
    await graphContext.saveAs(newFile);

    expect(fs.existsSync(newFile)).toBe(true);
    const reloaded = await GraphContext.loadFromFile(newFile);
    expect(reloaded.getGraph().nodes).toHaveLength(0);
  });
});
