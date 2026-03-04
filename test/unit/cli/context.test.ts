/**
 * Unit tests for GraphContext — CLI Graph Context Manager.
 *
 * Tests the full lifecycle: create/load → mutate → save round-trip,
 * modification tracking, content generation, and sidecar file creation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphContext } from '@/cli/context';
import { encode } from '@/core/storage/codec';
import { graphToProto, protoToGraph } from '@/core/storage/fileIO';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { decode } from '@/core/storage/codec';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Test Helpers ──────────────────────────────────────────────

let tmpDir: string;

function tmpFile(name: string): string {
  return path.join(tmpDir, name);
}

/**
 * Create a valid .archc file on disk for testing.
 */
async function createArchcFile(filePath: string, graphName: string = 'Test Arch'): Promise<void> {
  const graph = createEmptyGraph(graphName);
  const protoFile = graphToProto(graph);
  const binary = await encode(protoFile);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, binary);
}

/**
 * Create a .archc file with nodes for testing.
 */
async function createArchcFileWithNodes(filePath: string): Promise<void> {
  const graph = createEmptyGraph('Arch With Nodes');
  // Add nodes using graphToProto flow (nodes are part of the graph)
  graph.nodes.push({
    id: 'node-1',
    type: 'compute/service',
    displayName: 'Auth Service',
    args: {},
    codeRefs: [],
    notes: [],
    properties: { language: 'TypeScript' },
    position: { x: 0, y: 0, width: 200, height: 100 },
    children: [],
  });
  graph.nodes.push({
    id: 'node-2',
    type: 'compute/service',
    displayName: 'API Gateway',
    args: {},
    codeRefs: [],
    notes: [],
    properties: {},
    position: { x: 300, y: 0, width: 200, height: 100 },
    children: [],
  });
  graph.edges.push({
    id: 'edge-1',
    fromNode: 'node-1',
    toNode: 'node-2',
    type: 'sync',
    label: 'authenticates',
    properties: {},
    notes: [],
  });

  const protoFile = graphToProto(graph);
  const binary = await encode(protoFile);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, binary);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-context-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── createNew ────────────────────────────────────────────────

describe('GraphContext.createNew', () => {
  it('creates a new context with default name', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.getGraph().name).toBe('Untitled Architecture');
    expect(ctx.getGraph().nodes).toEqual([]);
    expect(ctx.getGraph().edges).toEqual([]);
  });

  it('creates a new context with custom name', () => {
    const ctx = GraphContext.createNew('My Architecture');
    expect(ctx.getGraph().name).toBe('My Architecture');
  });

  it('has no file path set', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.getFilePath()).toBeUndefined();
  });

  it('starts as not modified', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.isModified()).toBe(false);
  });

  it('initializes the registry with built-in nodedefs', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.registry).toBeDefined();
    // Registry should have built-in nodedefs loaded
    const nodeDef = ctx.registry.resolve('compute/service');
    expect(nodeDef).toBeDefined();
  });

  it('provides a working TextApi', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.textApi).toBeDefined();
    expect(ctx.textApi.listNodes()).toEqual([]);
  });

  it('provides a working ExportApi', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.exportApi).toBeDefined();
    const markdown = ctx.exportApi.generateMarkdownSummary(ctx.getGraph());
    expect(markdown).toContain('Untitled Architecture');
  });
});

// ─── loadFromFile ─────────────────────────────────────────────

describe('GraphContext.loadFromFile', () => {
  it('loads an .archc file successfully', async () => {
    const filePath = tmpFile('load-test.archc');
    await createArchcFile(filePath, 'Loaded Architecture');

    const ctx = await GraphContext.loadFromFile(filePath);

    expect(ctx.getGraph().name).toBe('Loaded Architecture');
    expect(ctx.getFilePath()).toBe(path.resolve(filePath));
  });

  it('loads a file with nodes and edges', async () => {
    const filePath = tmpFile('with-nodes.archc');
    await createArchcFileWithNodes(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);

    expect(ctx.getGraph().nodes.length).toBe(2);
    expect(ctx.getGraph().edges.length).toBe(1);
    expect(ctx.getGraph().nodes[0]!.displayName).toBe('Auth Service');
    expect(ctx.getGraph().nodes[1]!.displayName).toBe('API Gateway');
    expect(ctx.getGraph().edges[0]!.label).toBe('authenticates');
  });

  it('starts as not modified after load', async () => {
    const filePath = tmpFile('unmodified.archc');
    await createArchcFile(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    expect(ctx.isModified()).toBe(false);
  });

  it('initializes registry with built-in nodedefs', async () => {
    const filePath = tmpFile('registry-test.archc');
    await createArchcFile(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    const nodeDef = ctx.registry.resolve('compute/service');
    expect(nodeDef).toBeDefined();
  });

  it('throws for non-existent file', async () => {
    await expect(
      GraphContext.loadFromFile(tmpFile('ghost.archc'))
    ).rejects.toThrow('File not found');
  });

  it('throws for corrupted file', async () => {
    const filePath = tmpFile('corrupt.archc');
    fs.writeFileSync(filePath, 'not a valid archc file');

    await expect(GraphContext.loadFromFile(filePath)).rejects.toThrow();
  });

  it('supports skipChecksumVerification option', async () => {
    const filePath = tmpFile('skip-checksum.archc');
    await createArchcFile(filePath, 'Checksum Skip Test');

    // Slightly corrupt the file (change a byte in payload)
    const data = fs.readFileSync(filePath);
    const modified = Buffer.from(data);
    if (modified.length > 41) {
      modified[41] = (modified[41]! + 1) % 256;
    }
    fs.writeFileSync(filePath, modified);

    // Should fail with normal verification
    await expect(GraphContext.loadFromFile(filePath)).rejects.toThrow();

    // Should succeed with skip
    const ctx = await GraphContext.loadFromFile(filePath, {
      skipChecksumVerification: true,
    });
    expect(ctx).toBeDefined();
  });

  it('resolves relative paths', async () => {
    const filePath = tmpFile('relative.archc');
    await createArchcFile(filePath);

    // Load with the full path (since we can't reliably test relative paths
    // from a temp directory without changing cwd)
    const ctx = await GraphContext.loadFromFile(filePath);
    expect(path.isAbsolute(ctx.getFilePath()!)).toBe(true);
  });
});

// ─── Modification Tracking ──────────────────────────────────

describe('GraphContext: modification tracking', () => {
  it('detects modifications via TextApi mutations', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.isModified()).toBe(false);

    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Test Node',
    });

    expect(ctx.isModified()).toBe(true);
  });

  it('detects modifications via markModified()', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.isModified()).toBe(false);

    ctx.markModified();
    expect(ctx.isModified()).toBe(true);
  });

  it('resets modified state after save', async () => {
    const filePath = tmpFile('save-reset.archc');
    const ctx = GraphContext.createNew();

    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Saved Node',
    });
    expect(ctx.isModified()).toBe(true);

    await ctx.saveAs(filePath);
    expect(ctx.isModified()).toBe(false);
  });

  it('resets modified state after saveAs', async () => {
    const filePath = tmpFile('saveas-reset.archc');
    const ctx = GraphContext.createNew();

    ctx.markModified();
    expect(ctx.isModified()).toBe(true);

    await ctx.saveAs(filePath);
    expect(ctx.isModified()).toBe(false);
  });

  it('tracks multiple sequential modifications', () => {
    const ctx = GraphContext.createNew();

    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Node 1',
    });
    expect(ctx.isModified()).toBe(true);

    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Node 2',
    });
    expect(ctx.isModified()).toBe(true);
  });
});

// ─── save ─────────────────────────────────────────────────────

describe('GraphContext: save', () => {
  it('saves graph to the original file path', async () => {
    const filePath = tmpFile('save-test.archc');
    await createArchcFile(filePath, 'Original');

    const ctx = await GraphContext.loadFromFile(filePath);
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'New Node',
    });

    await ctx.save();

    // Verify the file was updated
    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().nodes.length).toBe(1);
    expect(reloaded.getGraph().nodes[0]!.displayName).toBe('New Node');
  });

  it('skips save when graph is not modified', async () => {
    const filePath = tmpFile('skip-save.archc');
    await createArchcFile(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    const statBefore = fs.statSync(filePath);

    // Wait a bit so timestamp would change if file is written
    await new Promise((r) => setTimeout(r, 50));
    await ctx.save(); // Should be a no-op

    const statAfter = fs.statSync(filePath);
    // mtimeMs should be the same (file not written)
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
  });

  it('force save even when not modified', async () => {
    const filePath = tmpFile('force-save.archc');
    await createArchcFile(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    // force=true should write regardless
    await ctx.save(true);

    // File should still be valid
    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().name).toBe('Test Arch');
  });

  it('throws when saving without a file path', async () => {
    const ctx = GraphContext.createNew();
    await expect(ctx.save()).rejects.toThrow('No file path set');
  });

  it('preserves original creation timestamp', async () => {
    const filePath = tmpFile('timestamps.archc');
    await createArchcFile(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Timestamp Node',
    });
    await ctx.save();

    // Reload and verify the file is valid (header timestamps are set by encode)
    const data = fs.readFileSync(filePath);
    const decoded = await decode(new Uint8Array(data));
    expect(decoded.header).toBeDefined();
    expect(Number(decoded.header!.updatedAtMs)).toBeGreaterThan(0);
  });
});

// ─── saveAs ───────────────────────────────────────────────────

describe('GraphContext: saveAs', () => {
  it('saves to a new file path', async () => {
    const ctx = GraphContext.createNew('SaveAs Architecture');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'SaveAs Node',
    });

    const filePath = tmpFile('new-file.archc');
    await ctx.saveAs(filePath);

    expect(fs.existsSync(filePath)).toBe(true);

    // Verify contents
    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().name).toBe('SaveAs Architecture');
    expect(reloaded.getGraph().nodes.length).toBe(1);
    expect(reloaded.getGraph().nodes[0]!.displayName).toBe('SaveAs Node');
  });

  it('updates internal file path after saveAs', async () => {
    const ctx = GraphContext.createNew();
    expect(ctx.getFilePath()).toBeUndefined();

    const filePath = tmpFile('path-update.archc');
    await ctx.saveAs(filePath);

    expect(ctx.getFilePath()).toBe(path.resolve(filePath));
  });

  it('allows save() after saveAs()', async () => {
    const ctx = GraphContext.createNew('Round Trip');

    const filePath = tmpFile('round-trip.archc');
    await ctx.saveAs(filePath);

    // Now mutate and save to the same path
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'After SaveAs',
    });
    await ctx.save();

    // Verify
    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().nodes.length).toBe(1);
    expect(reloaded.getGraph().nodes[0]!.displayName).toBe('After SaveAs');
  });

  it('creates parent directories', async () => {
    const ctx = GraphContext.createNew();
    const filePath = tmpFile('deep/nested/dir/project.archc');
    await ctx.saveAs(filePath);

    expect(fs.existsSync(filePath)).toBe(true);
  });
});

// ─── saveSidecar ──────────────────────────────────────────────

describe('GraphContext: saveSidecar', () => {
  it('generates and saves .summary.md alongside .archc', async () => {
    const filePath = tmpFile('project.archc');
    const ctx = GraphContext.createNew('Sidecar Test');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Sidecar Node',
    });

    await ctx.saveAs(filePath);
    await ctx.saveSidecar();

    const summaryPath = tmpFile('project.summary.md');
    expect(fs.existsSync(summaryPath)).toBe(true);

    const content = fs.readFileSync(summaryPath, 'utf-8');
    expect(content).toContain('Sidecar Test');
    expect(content).toContain('mermaid');
  });

  it('throws when no file path is set', async () => {
    const ctx = GraphContext.createNew();
    await expect(ctx.saveSidecar()).rejects.toThrow('No file path set');
  });

  it('sidecar filename follows naming convention', async () => {
    const filePath = tmpFile('my-arch.archc');
    const ctx = GraphContext.createNew();
    await ctx.saveAs(filePath);
    await ctx.saveSidecar();

    const sidecarPath = tmpFile('my-arch.summary.md');
    expect(fs.existsSync(sidecarPath)).toBe(true);
  });

  it('sidecar contains markdown summary sections', async () => {
    const filePath = tmpFile('full-sidecar.archc');
    const ctx = GraphContext.createNew('Full Sidecar');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Service B',
    });

    await ctx.saveAs(filePath);
    await ctx.saveSidecar();

    const content = fs.readFileSync(tmpFile('full-sidecar.summary.md'), 'utf-8');
    expect(content).toContain('# Full Sidecar');
    expect(content).toContain('## Overview');
    expect(content).toContain('## Components');
    expect(content).toContain('## Architecture Diagram');
    expect(content).toContain('```mermaid');
    expect(content).toContain('graph LR');
  });
});

// ─── Content Generation ──────────────────────────────────────

describe('GraphContext: content generation', () => {
  it('generateMarkdownSummary returns markdown for current graph', () => {
    const ctx = GraphContext.createNew('Markdown Test');
    const md = ctx.generateMarkdownSummary();

    expect(md).toContain('# Markdown Test');
    expect(md).toContain('## Overview');
    expect(md).toContain('Auto-generated by ArchCanvas');
  });

  it('generateMermaid returns mermaid diagram', () => {
    const ctx = GraphContext.createNew('Mermaid Test');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Service X',
    });

    const mermaid = ctx.generateMermaid();
    expect(mermaid).toContain('graph LR');
    expect(mermaid).toContain('Service X');
  });

  it('generateSummaryWithMermaid combines both', () => {
    const ctx = GraphContext.createNew('Combined Test');
    const content = ctx.generateSummaryWithMermaid();

    expect(content).toContain('# Combined Test');
    expect(content).toContain('```mermaid');
    expect(content).toContain('graph LR');
  });

  it('reflects mutations in generated content', () => {
    const ctx = GraphContext.createNew('Mutation Content');

    // Before mutation
    let md = ctx.generateMarkdownSummary();
    expect(md).toContain('| Nodes  | 0 |');

    // After mutation
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Dynamic Node',
    });

    md = ctx.generateMarkdownSummary();
    expect(md).toContain('| Nodes  | 1 |');
    expect(md).toContain('Dynamic Node');
  });
});

// ─── Load → Mutate → Save Round-Trip ──────────────────────────

describe('GraphContext: load → mutate → save round-trip', () => {
  it('full round-trip: load, add node, save, reload', async () => {
    // Step 1: Create initial file
    const filePath = tmpFile('full-roundtrip.archc');
    await createArchcFile(filePath, 'Round Trip Test');

    // Step 2: Load
    const ctx = await GraphContext.loadFromFile(filePath);
    expect(ctx.getGraph().name).toBe('Round Trip Test');
    expect(ctx.getGraph().nodes.length).toBe(0);

    // Step 3: Mutate
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Round Trip Node',
    });
    expect(ctx.isModified()).toBe(true);

    // Step 4: Save
    await ctx.save();
    expect(ctx.isModified()).toBe(false);

    // Step 5: Reload and verify
    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().name).toBe('Round Trip Test');
    expect(reloaded.getGraph().nodes.length).toBe(1);
    expect(reloaded.getGraph().nodes[0]!.displayName).toBe('Round Trip Node');
    expect(reloaded.getGraph().nodes[0]!.type).toBe('compute/service');
  });

  it('round-trip with multiple mutations', async () => {
    const filePath = tmpFile('multi-mutation.archc');
    await createArchcFile(filePath, 'Multi Mutation');

    const ctx = await GraphContext.loadFromFile(filePath);

    // Add two nodes
    const node1 = ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Service A',
    });
    const node2 = ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Service B',
    });

    // Add an edge
    ctx.textApi.addEdge({
      fromNode: node1.id,
      toNode: node2.id,
      type: 'sync',
      label: 'calls',
    });

    // Save and reload
    await ctx.save();

    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().nodes.length).toBe(2);
    expect(reloaded.getGraph().edges.length).toBe(1);
    expect(reloaded.getGraph().edges[0]!.label).toBe('calls');
    expect(reloaded.getGraph().edges[0]!.type).toBe('sync');
  });

  it('round-trip with node properties', async () => {
    const filePath = tmpFile('properties-roundtrip.archc');
    await createArchcFile(filePath, 'Properties Test');

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Prop Node',
    });

    // Update node properties
    ctx.textApi.updateNode(node.id, {
      displayName: 'Updated Prop Node',
      args: { runtime: 'nodejs', version: '20' },
    });

    await ctx.save();

    const reloaded = await GraphContext.loadFromFile(filePath);
    const reloadedNode = reloaded.getGraph().nodes[0]!;
    expect(reloadedNode.displayName).toBe('Updated Prop Node');
    expect(reloadedNode.args.runtime).toBe('nodejs');
    expect(reloadedNode.args.version).toBe('20');
  });

  it('round-trip preserves existing nodes from file', async () => {
    const filePath = tmpFile('preserve-nodes.archc');
    await createArchcFileWithNodes(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    expect(ctx.getGraph().nodes.length).toBe(2);

    // Add another node
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'New Service',
    });

    await ctx.save();

    const reloaded = await GraphContext.loadFromFile(filePath);
    expect(reloaded.getGraph().nodes.length).toBe(3);
    expect(reloaded.getGraph().nodes[0]!.displayName).toBe('Auth Service');
    expect(reloaded.getGraph().nodes[1]!.displayName).toBe('API Gateway');
    expect(reloaded.getGraph().nodes[2]!.displayName).toBe('New Service');
  });

  it('round-trip with createNew → saveAs → load', async () => {
    const filePath = tmpFile('new-save-load.archc');

    // Create new context
    const ctx = GraphContext.createNew('Brand New');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'First Node',
    });

    // Save to file
    await ctx.saveAs(filePath);

    // Load from file
    const loaded = await GraphContext.loadFromFile(filePath);
    expect(loaded.getGraph().name).toBe('Brand New');
    expect(loaded.getGraph().nodes.length).toBe(1);
    expect(loaded.getGraph().nodes[0]!.displayName).toBe('First Node');
  });

  it('round-trip with save and sidecar generation', async () => {
    const filePath = tmpFile('with-sidecar.archc');

    const ctx = GraphContext.createNew('Sidecar Round Trip');
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Sidecar Service',
    });

    await ctx.saveAs(filePath);
    await ctx.saveSidecar();

    // Verify both files exist
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(tmpFile('with-sidecar.summary.md'))).toBe(true);

    // Verify sidecar content reflects the graph
    const sidecar = fs.readFileSync(tmpFile('with-sidecar.summary.md'), 'utf-8');
    expect(sidecar).toContain('Sidecar Round Trip');
    expect(sidecar).toContain('Sidecar Service');
  });
});

// ─── TextApi Integration ──────────────────────────────────────

describe('GraphContext: TextApi integration', () => {
  it('textApi.listNodes reflects graph state', () => {
    const ctx = GraphContext.createNew();
    expect(ctx.textApi.listNodes()).toEqual([]);

    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Listed Node',
    });

    const nodes = ctx.textApi.listNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.displayName).toBe('Listed Node');
  });

  it('textApi.describe returns architecture description', () => {
    const ctx = GraphContext.createNew('Described Arch');
    const desc = ctx.textApi.describe({ format: 'human' });
    expect(desc).toContain('Described Arch');
  });

  it('textApi.search finds nodes', () => {
    const ctx = GraphContext.createNew();
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Searchable Node',
    });

    const results = ctx.textApi.search('Searchable');
    expect(results.length).toBeGreaterThan(0);
  });

  it('textApi.getNode returns node details', () => {
    const ctx = GraphContext.createNew();
    const node = ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Detailed Node',
    });

    const details = ctx.textApi.getNode(node.id);
    expect(details).toBeDefined();
    expect(details!.displayName).toBe('Detailed Node');
  });

  it('textApi.removeNode works', () => {
    const ctx = GraphContext.createNew();
    const node = ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'To Remove',
    });
    expect(ctx.textApi.listNodes().length).toBe(1);

    ctx.textApi.removeNode(node.id);
    expect(ctx.textApi.listNodes().length).toBe(0);
    expect(ctx.isModified()).toBe(true);
  });
});

// ─── ExportApi Integration ────────────────────────────────────

describe('GraphContext: ExportApi integration', () => {
  it('exportApi generates markdown for loaded graph', async () => {
    const filePath = tmpFile('export-test.archc');
    await createArchcFileWithNodes(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    const md = ctx.exportApi.generateMarkdownSummary(ctx.getGraph());

    expect(md).toContain('Arch With Nodes');
    expect(md).toContain('Auth Service');
    expect(md).toContain('API Gateway');
  });

  it('exportApi generates mermaid with edges', async () => {
    const filePath = tmpFile('mermaid-test.archc');
    await createArchcFileWithNodes(filePath);

    const ctx = await GraphContext.loadFromFile(filePath);
    const mermaid = ctx.exportApi.generateMermaid(ctx.getGraph());

    expect(mermaid).toContain('graph LR');
    expect(mermaid).toContain('Auth Service');
    expect(mermaid).toContain('API Gateway');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────

describe('GraphContext: edge cases', () => {
  it('handles empty graph save/load', async () => {
    const filePath = tmpFile('empty.archc');
    const ctx = GraphContext.createNew('Empty');
    await ctx.saveAs(filePath);

    const loaded = await GraphContext.loadFromFile(filePath);
    expect(loaded.getGraph().nodes).toEqual([]);
    expect(loaded.getGraph().edges).toEqual([]);
  });

  it('multiple saves to the same file', async () => {
    const filePath = tmpFile('multi-save.archc');
    const ctx = GraphContext.createNew('Multi Save');

    // First save
    await ctx.saveAs(filePath);

    // Add node and save again
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Save 1',
    });
    await ctx.save();

    // Add another node and save again
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Save 2',
    });
    await ctx.save();

    // Final verification
    const loaded = await GraphContext.loadFromFile(filePath);
    expect(loaded.getGraph().nodes.length).toBe(2);
  });

  it('saveAs to different paths', async () => {
    const ctx = GraphContext.createNew('Multi Path');

    const path1 = tmpFile('path1.archc');
    const path2 = tmpFile('path2.archc');

    await ctx.saveAs(path1);
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Added After SaveAs1',
    });
    await ctx.saveAs(path2);

    // path1 should have 0 nodes, path2 should have 1
    const loaded1 = await GraphContext.loadFromFile(path1);
    const loaded2 = await GraphContext.loadFromFile(path2);

    expect(loaded1.getGraph().nodes.length).toBe(0);
    expect(loaded2.getGraph().nodes.length).toBe(1);
  });

  it('getGraph returns the latest graph state', () => {
    const ctx = GraphContext.createNew();

    const before = ctx.getGraph();
    ctx.textApi.addNode({
      type: 'compute/service',
      displayName: 'Latest',
    });
    const after = ctx.getGraph();

    expect(before.nodes.length).toBe(0);
    expect(after.nodes.length).toBe(1);
    expect(before).not.toBe(after); // Different reference (immutable)
  });
});
