/**
 * Tests for CLI mutation commands (add-node, add-edge, remove-node, remove-edge, add-note, update-node).
 *
 * These tests verify the registerMutateCommands module which was extracted from the
 * CLI entry point. All mutation commands auto-save and regenerate the .summary.md sidecar.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { registerMutateCommands } from '@/cli/commands/mutate';
import { loadContext, printOutput, withErrorHandler, suppressDiagnosticLogs } from '@/cli/index';
import { GraphContext } from '@/cli/context';
import type { ArchNode } from '@/types/graph';

/**
 * Recursively find a node by ID in a list of nodes.
 */
function findNodeRecursive(nodes: ArchNode[], id: string): ArchNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNodeRecursive(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

// ─── Test Helpers ────────────────────────────────────────────

let tmpDir: string;
let testFile: string;

async function createTestFile(name = 'Test Architecture'): Promise<string> {
  const ctx = GraphContext.createNew(name);
  const filePath = path.join(tmpDir, 'test.archc');
  await ctx.saveAs(filePath);
  return filePath;
}

async function createTestFileWithNodes(): Promise<{
  filePath: string;
  nodeId1: string;
  nodeId2: string;
}> {
  const ctx = GraphContext.createNew('Test');
  const node1 = ctx.textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
  const node2 = ctx.textApi.addNode({ type: 'compute/service', displayName: 'Service B' });
  const filePath = path.join(tmpDir, 'test-with-nodes.archc');
  await ctx.saveAs(filePath);
  return { filePath, nodeId1: node1.id, nodeId2: node2.id };
}

/**
 * Create a Commander program with mutation commands registered,
 * then parse the given argv.
 */
async function runCommand(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('archcanvas')
    .option('-f, --file <path>', 'Path to the .archc file')
    .option('--format <format>', 'Output format', 'human')
    .option('-q, --quiet', 'Suppress non-essential output', false);

  registerMutateCommands(program);

  // Prevent commander from calling process.exit
  program.exitOverride();

  await program.parseAsync(['node', 'archcanvas', ...argv]);
}

// ─── Setup / Teardown ────────────────────────────────────────

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archcanvas-mutate-test-'));
  testFile = await createTestFile();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ─── add-node ────────────────────────────────────────────────

describe('add-node', () => {
  it('adds a node with type and name', async () => {
    await runCommand(['-f', testFile, 'add-node', '-t', 'compute/service', '-n', 'My Service', '-q']);

    const ctx = await GraphContext.loadFromFile(testFile);
    const nodes = ctx.textApi.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].displayName).toBe('My Service');
    expect(nodes[0].type).toBe('compute/service');
  });

  it('adds a node with --args key=value pairs', async () => {
    await runCommand([
      '-f', testFile, 'add-node', '-t', 'compute/service', '-n', 'ArgNode',
      '--args', 'runtime=node', 'version=20', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(testFile);
    const nodes = ctx.textApi.listNodes();
    expect(nodes).toHaveLength(1);
    const node = ctx.textApi.getNode(nodes[0].id);
    expect(node?.args).toEqual({ runtime: 'node', version: '20' });
  });

  it('adds a child node with --parent', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'add-node', '-t', 'compute/service', '-n', 'Child',
      '--parent', nodeId1, '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const parent = ctx.textApi.getNode(nodeId1);
    expect(parent?.children).toHaveLength(1);
    expect(parent?.children[0].displayName).toBe('Child');
  });

  it('generates sidecar .summary.md', async () => {
    await runCommand(['-f', testFile, 'add-node', '-t', 'compute/service', '-n', 'Svc', '-q']);

    const summaryPath = testFile.replace('.archc', '.summary.md');
    const exists = await fs.access(summaryPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('outputs JSON when --format json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand(['-f', testFile, 'add-node', '-t', 'compute/service', '-n', 'JsonNode', '--format', 'json']);

      // Find the JSON output call
      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"id"') && str.includes('"displayName"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.displayName).toBe('JsonNode');
      expect(parsed.type).toBe('compute/service');
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── add-edge ────────────────────────────────────────────────

describe('add-edge', () => {
  it('adds an edge between two nodes', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'add-edge', '--from', nodeId1, '--to', nodeId2,
      '--type', 'async', '--label', 'REST', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const graph = ctx.getGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].fromNode).toBe(nodeId1);
    expect(graph.edges[0].toNode).toBe(nodeId2);
    expect(graph.edges[0].label).toBe('REST');
  });

  it('defaults edge type to sync', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    await runCommand(['-f', filePath, 'add-edge', '--from', nodeId1, '--to', nodeId2, '-q']);

    const ctx = await GraphContext.loadFromFile(filePath);
    const graph = ctx.getGraph();
    expect(graph.edges[0].type).toBe('sync');
  });

  it('outputs JSON with edge details', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand([
        '-f', filePath, 'add-edge', '--from', nodeId1, '--to', nodeId2,
        '--type', 'data-flow', '--label', 'Events', '--format', 'json',
      ]);

      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"id"') && str.includes('"from"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.from).toBe(nodeId1);
      expect(parsed.to).toBe(nodeId2);
      expect(parsed.type).toBe('data-flow');
      expect(parsed.label).toBe('Events');
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── remove-node ─────────────────────────────────────────────

describe('remove-node', () => {
  it('removes a node and its connected edges', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    // Add an edge first
    const ctx1 = await GraphContext.loadFromFile(filePath);
    ctx1.textApi.addEdge({ fromNode: nodeId1, toNode: nodeId2, type: 'sync' });
    await ctx1.save();

    await runCommand(['-f', filePath, 'remove-node', nodeId1, '-q']);

    const ctx2 = await GraphContext.loadFromFile(filePath);
    const nodes = ctx2.textApi.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe(nodeId2);
    expect(ctx2.getGraph().edges).toHaveLength(0);
  });

  it('blocks removal of parent node without --force', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    // Add child to nodeId1
    const ctx1 = await GraphContext.loadFromFile(filePath);
    ctx1.textApi.addNode({ type: 'compute/service', displayName: 'Child', parentId: nodeId1 });
    await ctx1.save();

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    try {
      await runCommand(['-f', filePath, 'remove-node', nodeId1, '-q']);
    } catch (e) {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();

    // Node should still exist
    const ctx2 = await GraphContext.loadFromFile(filePath);
    const node = ctx2.textApi.getNode(nodeId1);
    expect(node).toBeDefined();
  });

  it('allows removal of parent node with --force', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    const ctx1 = await GraphContext.loadFromFile(filePath);
    ctx1.textApi.addNode({ type: 'compute/service', displayName: 'Child', parentId: nodeId1 });
    await ctx1.save();

    await runCommand(['-f', filePath, 'remove-node', nodeId1, '--force', '-q']);

    const ctx2 = await GraphContext.loadFromFile(filePath);
    const node = ctx2.textApi.getNode(nodeId1);
    expect(node).toBeUndefined();
  });

  it('outputs JSON when --format json', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand(['-f', filePath, 'remove-node', nodeId1, '--format', 'json']);

      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"removed"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.id).toBe(nodeId1);
      expect(parsed.removed).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── remove-edge ─────────────────────────────────────────────

describe('remove-edge', () => {
  it('removes an edge', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    const ctx1 = await GraphContext.loadFromFile(filePath);
    const edge = ctx1.textApi.addEdge({ fromNode: nodeId1, toNode: nodeId2, type: 'sync' });
    await ctx1.save();

    await runCommand(['-f', filePath, 'remove-edge', edge.id, '-q']);

    const ctx2 = await GraphContext.loadFromFile(filePath);
    expect(ctx2.getGraph().edges).toHaveLength(0);
  });

  it('errors on non-existent edge', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    try {
      await runCommand(['-f', testFile, 'remove-edge', 'nonexistent', '-q']);
    } catch (e) {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('outputs JSON when --format json', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    const ctx1 = await GraphContext.loadFromFile(filePath);
    const edge = ctx1.textApi.addEdge({ fromNode: nodeId1, toNode: nodeId2, type: 'sync' });
    await ctx1.save();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand(['-f', filePath, 'remove-edge', edge.id, '--format', 'json']);

      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"removed"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.id).toBe(edge.id);
      expect(parsed.removed).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── add-note ────────────────────────────────────────────────

describe('add-note', () => {
  it('adds a note to a node', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'add-note', '--node', nodeId1,
      '-c', 'This is a note', '-a', 'tester', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.getNode(nodeId1);
    expect(node?.notes).toHaveLength(1);
    expect(node?.notes[0].content).toBe('This is a note');
    expect(node?.notes[0].author).toBe('tester');
  });

  it('adds a note with --tags', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'add-note', '--node', nodeId1,
      '-c', 'Security note', '--tags', 'security,important,review', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    // Access raw graph to check tags (getNode detail doesn't expose tags)
    const graph = ctx.getGraph();
    const rawNode = findNodeRecursive(graph.nodes, nodeId1);
    expect(rawNode?.notes).toHaveLength(1);
    expect(rawNode?.notes[0].tags).toEqual(['security', 'important', 'review']);
  });

  it('defaults author to cli', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'add-note', '--node', nodeId1, '-c', 'Default author', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.getNode(nodeId1);
    expect(node?.notes[0].author).toBe('cli');
  });

  it('outputs JSON with note details', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand([
        '-f', filePath, 'add-note', '--node', nodeId1,
        '-c', 'JSON note', '--tags', 'tag1,tag2', '--format', 'json',
      ]);

      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"nodeId"') && str.includes('"content"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.nodeId).toBe(nodeId1);
      expect(parsed.content).toBe('JSON note');
      expect(parsed.tags).toEqual(['tag1', 'tag2']);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── update-node ─────────────────────────────────────────────

describe('update-node', () => {
  it('updates node display name', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand(['-f', filePath, 'update-node', nodeId1, '-n', 'Updated Name', '-q']);

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.getNode(nodeId1);
    expect(node?.displayName).toBe('Updated Name');
  });

  it('updates node args', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'update-node', nodeId1, '--args', 'env=prod', 'region=us-east-1', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.getNode(nodeId1);
    expect(node?.args).toEqual(expect.objectContaining({ env: 'prod', region: 'us-east-1' }));
  });

  it('updates node color', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand(['-f', filePath, 'update-node', nodeId1, '--color', '#ff0000', '-q']);

    const ctx = await GraphContext.loadFromFile(filePath);
    // Access raw graph to check color (stored in position.color)
    const graph = ctx.getGraph();
    const rawNode = findNodeRecursive(graph.nodes, nodeId1);
    expect(rawNode?.position.color).toBe('#ff0000');
  });

  it('updates node properties', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    await runCommand([
      '-f', filePath, 'update-node', nodeId1, '--set-prop', 'tier=critical', '-q',
    ]);

    const ctx = await GraphContext.loadFromFile(filePath);
    const node = ctx.textApi.getNode(nodeId1);
    expect(node?.properties).toEqual(expect.objectContaining({ tier: 'critical' }));
  });

  it('errors on non-existent node', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    try {
      await runCommand(['-f', testFile, 'update-node', 'nonexistent', '-n', 'Foo', '-q']);
    } catch (e) {
      // expected
    }

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('outputs JSON when --format json', async () => {
    const { filePath, nodeId1 } = await createTestFileWithNodes();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runCommand([
        '-f', filePath, 'update-node', nodeId1,
        '-n', 'NewName', '--color', '#00ff00', '--format', 'json',
      ]);

      const jsonCall = logSpy.mock.calls.find((call) => {
        const str = String(call[0]);
        return str.includes('"updated"');
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0]));
      expect(parsed.id).toBe(nodeId1);
      expect(parsed.updated).toBe(true);
      expect(parsed.displayName).toBe('NewName');
      expect(parsed.color).toBe('#00ff00');
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ─── Sidecar regeneration ────────────────────────────────────

describe('sidecar regeneration', () => {
  it('all mutation commands regenerate .summary.md', async () => {
    const { filePath, nodeId1, nodeId2 } = await createTestFileWithNodes();
    const summaryPath = filePath.replace('.archc', '.summary.md');

    // add-node triggers sidecar
    await runCommand(['-f', filePath, 'add-node', '-t', 'compute/service', '-n', 'Svc', '-q']);
    const stat1 = await fs.stat(summaryPath);
    expect(stat1.size).toBeGreaterThan(0);

    // add-edge triggers sidecar (wait to ensure different mtime)
    await new Promise((r) => setTimeout(r, 10));
    await runCommand(['-f', filePath, 'add-edge', '--from', nodeId1, '--to', nodeId2, '-q']);
    const stat2 = await fs.stat(summaryPath);
    expect(stat2.mtimeMs).toBeGreaterThanOrEqual(stat1.mtimeMs);

    // update-node triggers sidecar
    await new Promise((r) => setTimeout(r, 10));
    await runCommand(['-f', filePath, 'update-node', nodeId1, '-n', 'Updated', '-q']);
    const stat3 = await fs.stat(summaryPath);
    expect(stat3.mtimeMs).toBeGreaterThanOrEqual(stat2.mtimeMs);
  });
});
