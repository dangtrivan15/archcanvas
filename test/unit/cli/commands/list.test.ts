import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { listCommand } from '@/cli/commands/list';
import { CLIError } from '@/cli/errors';
import type { Canvas } from '@/types/schema';

// Mock loadContext — stores are populated by setupStores(), no filesystem needed
vi.mock('@/cli/context', async () => {
  const actual = await vi.importActual('@/cli/context');
  return {
    ...actual,
    loadContext: vi.fn().mockResolvedValue({ fs: null, bridgeUrl: null }),
  };
});

enablePatches();

const seedData: Canvas = {
  project: { name: 'ListTest' },
  nodes: [
    { id: 'svc-api', type: 'compute/service', displayName: 'API Service' },
    { id: 'svc-db', type: 'data/database', displayName: 'Main DB' },
  ],
  edges: [
    { from: { node: 'svc-api' }, to: { node: 'svc-db' }, label: 'reads from', protocol: 'TCP' },
  ],
  entities: [
    { name: 'Order', description: 'An order entity' },
    { name: 'User', description: 'A user entity' },
  ],
};

function makeMainYaml(): string {
  return serializeCanvas(seedData);
}

async function setupStores(): Promise<void> {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });

  const fs = new InMemoryFileSystem();
  fs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

// Capture stdout writes
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

describe('listCommand', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // C5f.1: reads canvas data from fileStore.getCanvas
  it('lists all items in root scope', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'all' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.entities).toHaveLength(2);
    } finally {
      capture.restore();
    }
  });

  // C5f.2: filters by type flag
  it('filters to nodes only', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toBeUndefined();
      expect(result.entities).toBeUndefined();
    } finally {
      capture.restore();
    }
  });

  it('filters to edges only', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'edges' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.edges).toHaveLength(1);
      expect(result.nodes).toBeUndefined();
      expect(result.entities).toBeUndefined();
    } finally {
      capture.restore();
    }
  });

  it('filters to entities only', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'entities' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.entities).toHaveLength(2);
      expect(result.nodes).toBeUndefined();
      expect(result.edges).toBeUndefined();
    } finally {
      capture.restore();
    }
  });

  // C5f.3: human output is formatted
  it('produces human-readable output when json=false', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'all' }, { json: false });
      expect(capture.output).toBeTruthy();
      // Human output should NOT be parseable JSON
      expect(() => JSON.parse(capture.output)).toThrow();
    } finally {
      capture.restore();
    }
  });

  // C5f.4: JSON output contains only requested types
  it('json output includes only requested types', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'edges' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result).toHaveProperty('edges');
      expect(result).not.toHaveProperty('nodes');
      expect(result).not.toHaveProperty('entities');
    } finally {
      capture.restore();
    }
  });

  // C5f.5: errors on unknown scope
  it('throws CANVAS_NOT_FOUND for unknown scope', async () => {
    await expect(
      listCommand({ scope: 'nonexistent', type: 'all' }, { json: true }),
    ).rejects.toThrow(CLIError);

    try {
      await listCommand({ scope: 'nonexistent', type: 'all' }, { json: true });
    } catch (err) {
      expect((err as CLIError).code).toBe('CANVAS_NOT_FOUND');
    }
  });

  // C5f.1: explicit scope=root resolves to ROOT_CANVAS_KEY
  it('scope=root resolves to root canvas', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ scope: 'root', type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.nodes).toHaveLength(2);
    } finally {
      capture.restore();
    }
  });

  // C11.2: list does NOT save
  it('does not call saveAll (read-only)', async () => {
    const saveAllSpy = vi.spyOn(useFileStore.getState(), 'saveAll');
    const capture = captureStdout();
    try {
      await listCommand({ type: 'all' }, { json: true });
      expect(saveAllSpy).not.toHaveBeenCalled();
    } finally {
      capture.restore();
      saveAllSpy.mockRestore();
    }
  });

  // Node output shape
  it('node output includes id, type, displayName', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      const node = result.nodes[0];
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('displayName');
    } finally {
      capture.restore();
    }
  });

  // Edge output shape
  it('edge output includes from, to', async () => {
    const capture = captureStdout();
    try {
      await listCommand({ type: 'edges' }, { json: true });
      const result = JSON.parse(capture.output);
      const edge = result.edges[0];
      expect(edge.from).toBe('svc-api');
      expect(edge.to).toBe('svc-db');
    } finally {
      capture.restore();
    }
  });
});
