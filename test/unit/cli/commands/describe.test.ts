import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { describeCommand } from '@/cli/commands/describe';
import { CLIError } from '@/cli/errors';
import type { Canvas } from '@/types/schema';

vi.mock('@/cli/context', async () => {
  const actual = await vi.importActual('@/cli/context');
  return {
    ...actual,
    loadContext: vi.fn().mockResolvedValue({ fs: null, bridgeUrl: null }),
  };
});

enablePatches();

const seedData: Canvas = {
  project: { name: 'DescribeTest' },
  nodes: [
    {
      id: 'svc-api',
      type: 'compute/service',
      displayName: 'API Service',
      args: { language: 'TypeScript', framework: 'Express' },
      notes: [{ author: 'dev', content: 'Main API' }],
      codeRefs: ['src/api/index.ts'],
    },
    { id: 'svc-db', type: 'data/database', displayName: 'Main DB' },
    { id: 'child-scope', ref: 'child-canvas.yaml' },
  ],
  edges: [
    { from: { node: 'svc-api' }, to: { node: 'svc-db' }, label: 'reads from', protocol: 'TCP' },
  ],
  entities: [
    { name: 'Order', description: 'An order entity' },
  ],
};

const childCanvasData: Canvas = {
  id: 'child-canvas',
  type: 'compute/service',
  displayName: 'Child Service',
  nodes: [
    { id: 'inner-node', type: 'compute/function', displayName: 'Inner Function' },
  ],
  edges: [],
  entities: [],
};

function makeMainYaml(): string {
  return serializeCanvas(seedData);
}

function makeChildYaml(): string {
  return serializeCanvas(childCanvasData);
}

async function setupStores(): Promise<void> {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });

  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': makeMainYaml(),
    '.archcanvas/child-canvas.yaml': makeChildYaml(),
  });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

function captureStdout(): { output: string; restore: () => void } {
  let output = '';
  const original = process.stdout.write.bind(process.stdout);
  const mockWrite = vi.fn((chunk: string | Uint8Array) => {
    output += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    return true;
  });
  process.stdout.write = mockWrite as unknown as typeof process.stdout.write;
  return {
    get output() { return output; },
    restore: () => { process.stdout.write = original; },
  };
}

describe('describeCommand', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // C5g.1: describes single node with full details
  it('describes a node by ID with type, displayName, args, edges, notes, codeRefs', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'svc-api' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.node.id).toBe('svc-api');
      expect(result.node.type).toBe('compute/service');
      expect(result.node.displayName).toBe('API Service');
      expect(result.node.args).toEqual({ language: 'TypeScript', framework: 'Express' });
      expect(result.node.notes).toHaveLength(1);
      expect(result.node.codeRefs).toEqual(['src/api/index.ts']);
      expect(result.node.connectedEdges).toHaveLength(1);
    } finally {
      capture.restore();
    }
  });

  // C5g.1: ports resolved from NodeDef registry
  it('includes ports from the NodeDef registry', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'svc-api' }, { json: true });
      const result = JSON.parse(capture.output);
      // compute/service has ports defined in the builtin registry
      expect(result.node.ports).toBeDefined();
      expect(Array.isArray(result.node.ports)).toBe(true);
    } finally {
      capture.restore();
    }
  });

  // C5g.1: connected edges are filtered from canvas edges
  it('only includes edges connected to the specified node', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'svc-db' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.node.connectedEdges).toHaveLength(1);
      expect(result.node.connectedEdges[0].to).toBe('svc-db');
    } finally {
      capture.restore();
    }
  });

  // C5g.2: describes full architecture when no ID
  it('describes full architecture (project name, counts per scope)', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({}, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.project).toBe('DescribeTest');
      expect(result.scopes).toBeDefined();
      expect(Array.isArray(result.scopes)).toBe(true);

      // Find root scope
      const root = result.scopes.find((s: Record<string, unknown>) => s.canvasId === ROOT_CANVAS_KEY);
      expect(root).toBeDefined();
      expect(root.nodeCount).toBe(3);
      expect(root.edgeCount).toBe(1);
      expect(root.entityCount).toBe(1);
    } finally {
      capture.restore();
    }
  });

  // C5g.3: for ref nodes with children, includes child canvas counts
  it('includes child canvas data for ref nodes', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({}, { json: true });
      const result = JSON.parse(capture.output);

      // The child-scope canvas should be present (keyed by node.id)
      const child = result.scopes.find((s: Record<string, unknown>) => s.canvasId === 'child-scope');
      expect(child).toBeDefined();
      expect(child.nodeCount).toBe(1);
    } finally {
      capture.restore();
    }
  });

  // C5g.4: JSON output is proper shape
  it('json output has ok: true and node or scopes data', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'svc-api' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result).toHaveProperty('node');
    } finally {
      capture.restore();
    }
  });

  // Error case: unknown node ID
  it('throws NODE_NOT_FOUND for unknown node ID', async () => {
    await expect(describeCommand({ id: 'nonexistent' }, { json: true })).rejects.toThrow(CLIError);

    try {
      await describeCommand({ id: 'nonexistent' }, { json: true });
    } catch (err) {
      expect((err as CLIError).code).toBe('NODE_NOT_FOUND');
    }
  });

  // Error case: unknown scope
  it('throws CANVAS_NOT_FOUND for unknown scope', async () => {
    await expect(describeCommand({ id: 'svc-api', scope: 'nonexistent' }, { json: true })).rejects.toThrow(CLIError);

    try {
      await describeCommand({ id: 'svc-api', scope: 'nonexistent' }, { json: true });
    } catch (err) {
      expect((err as CLIError).code).toBe('CANVAS_NOT_FOUND');
    }
  });

  // C11.2: describe does NOT save
  it('does not call saveAll (read-only)', async () => {
    const saveAllSpy = vi.spyOn(useFileStore.getState(), 'saveAll');
    const capture = captureStdout();
    try {
      await describeCommand({}, { json: true });
      expect(saveAllSpy).not.toHaveBeenCalled();
    } finally {
      capture.restore();
      saveAllSpy.mockRestore();
    }
  });

  // Human output for describe node
  it('produces human-readable output when json=false for node', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'svc-api' }, { json: false });
      expect(capture.output).toBeTruthy();
      expect(() => JSON.parse(capture.output)).toThrow();
    } finally {
      capture.restore();
    }
  });

  // Describe a ref node
  it('describes a ref node with ref field', async () => {
    const capture = captureStdout();
    try {
      await describeCommand({ id: 'child-scope' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.node.id).toBe('child-scope');
      expect(result.node.ref).toBe('child-canvas.yaml');
    } finally {
      capture.restore();
    }
  });
});
