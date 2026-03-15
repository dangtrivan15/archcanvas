import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { importCommand } from '@/cli/commands/import';
import { CLIError } from '@/cli/errors';
import type { Canvas } from '@/types/schema';

// Mock node:fs/promises readFile
const mockReadFile = vi.fn<(path: string, encoding: string) => Promise<string>>();
vi.mock(import('node:fs/promises'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual,
      readFile: (path: string, encoding: string) => mockReadFile(path, encoding),
    },
    readFile: (path: string, encoding: string) => mockReadFile(path, encoding),
  };
});

// Import tests need a real fs for saveAll — use a shared ref the mock can access
let inMemFs: InMemoryFileSystem;

vi.mock('@/cli/context', async () => {
  const actual = await vi.importActual('@/cli/context');
  return {
    ...actual,
    loadContext: vi.fn().mockImplementation(() =>
      Promise.resolve({ fs: inMemFs, bridgeUrl: null }),
    ),
  };
});

enablePatches();

const seedData: Canvas = {
  project: { name: 'ImportTest' },
  nodes: [],
  edges: [],
  entities: [],
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

  inMemFs = new InMemoryFileSystem();
  inMemFs.seed({ '.archcanvas/main.yaml': makeMainYaml() });

  await useFileStore.getState().openProject(inMemFs);
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

const validImportYaml = `
nodes:
  - id: imported-svc
    type: compute/service
    displayName: Imported Service
  - id: imported-db
    type: data/database
    displayName: Imported DB
edges:
  - from:
      node: imported-svc
    to:
      node: imported-db
    label: connects to
entities:
  - name: ImportedEntity
    description: An imported entity
`;

describe('importCommand', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setupStores();
  });

  // C5i.1, C5i.2: imports nodes, edges, entities from YAML
  it('imports nodes, edges, and entities from YAML file', async () => {
    mockReadFile.mockResolvedValue(validImportYaml);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/import.yaml' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.added.nodes).toBe(2);
      expect(result.added.edges).toBe(1);
      expect(result.added.entities).toBe(1);
      expect(result.errors).toHaveLength(0);
    } finally {
      capture.restore();
    }

    // Verify nodes were actually added to the store
    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY);
    const nodes = canvas?.data.nodes ?? [];
    expect(nodes.some((n) => n.id === 'imported-svc')).toBe(true);
    expect(nodes.some((n) => n.id === 'imported-db')).toBe(true);
  });

  // C5i.3: collects errors per item, doesn't stop
  it('collects errors per item and does not stop on first error', async () => {
    const yamlWithDupes = `
nodes:
  - id: dup-node
    type: compute/service
    displayName: First
  - id: dup-node
    type: compute/service
    displayName: Duplicate
  - id: good-node
    type: data/database
    displayName: Good One
`;
    mockReadFile.mockResolvedValue(yamlWithDupes);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/dupes.yaml' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      // First node succeeds, second is duplicate, third succeeds
      expect(result.added.nodes).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('node');
      expect(result.errors[0].error).toContain('DUPLICATE_NODE_ID');
    } finally {
      capture.restore();
    }
  });

  // C5i.4, C11.1: saves once at end
  it('calls saveAll once at the end', async () => {
    mockReadFile.mockResolvedValue(validImportYaml);

    const saveAllSpy = vi.spyOn(useFileStore.getState(), 'saveAll');
    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/import.yaml' }, { json: true });
      expect(saveAllSpy).toHaveBeenCalledTimes(1);
      expect(saveAllSpy).toHaveBeenCalledWith(inMemFs);
    } finally {
      capture.restore();
      saveAllSpy.mockRestore();
    }
  });

  // C5i.5: human output has added/failed summary
  it('produces human-readable summary', async () => {
    mockReadFile.mockResolvedValue(validImportYaml);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/import.yaml' }, { json: false });
      expect(capture.output).toBeTruthy();
      expect(() => JSON.parse(capture.output)).toThrow();
    } finally {
      capture.restore();
    }
  });

  // C5i.6: JSON output shape
  it('json output has { added: { nodes, edges, entities }, errors: [...] }', async () => {
    mockReadFile.mockResolvedValue(validImportYaml);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/import.yaml' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.added).toHaveProperty('nodes');
      expect(result.added).toHaveProperty('edges');
      expect(result.added).toHaveProperty('entities');
      expect(Array.isArray(result.errors)).toBe(true);
    } finally {
      capture.restore();
    }
  });

  // Error: file not found
  it('throws CLIError for unreadable file', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

    await expect(
      importCommand({ file: '/tmp/missing.yaml' }, { json: true }),
    ).rejects.toThrow(CLIError);

    try {
      await importCommand({ file: '/tmp/missing.yaml' }, { json: true });
    } catch (err) {
      expect((err as CLIError).code).toBe('INVALID_ARGS');
    }
  });

  // Error: invalid YAML
  it('throws CLIError for invalid YAML', async () => {
    mockReadFile.mockResolvedValue('}{not valid yaml{{');

    await expect(
      importCommand({ file: '/tmp/bad.yaml' }, { json: true }),
    ).rejects.toThrow(CLIError);
  });

  // Error: unknown scope
  it('throws CANVAS_NOT_FOUND for unknown scope', async () => {
    mockReadFile.mockResolvedValue(validImportYaml);

    await expect(
      importCommand({ file: '/tmp/import.yaml', scope: 'nonexistent' }, { json: true }),
    ).rejects.toThrow(CLIError);

    try {
      await importCommand({ file: '/tmp/import.yaml', scope: 'nonexistent' }, { json: true });
    } catch (err) {
      expect((err as CLIError).code).toBe('CANVAS_NOT_FOUND');
    }
  });

  // Import with only nodes (no edges/entities)
  it('handles YAML with only nodes', async () => {
    const nodesOnly = `
nodes:
  - id: solo-node
    type: compute/function
    displayName: Solo Function
`;
    mockReadFile.mockResolvedValue(nodesOnly);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/nodes-only.yaml' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.added.nodes).toBe(1);
      expect(result.added.edges).toBe(0);
      expect(result.added.entities).toBe(0);
    } finally {
      capture.restore();
    }
  });

  // Import with edge errors (missing endpoints)
  it('collects edge errors for missing endpoints', async () => {
    const badEdges = `
edges:
  - from:
      node: nonexistent-from
    to:
      node: nonexistent-to
    label: broken edge
`;
    mockReadFile.mockResolvedValue(badEdges);

    const capture = captureStdout();
    try {
      await importCommand({ file: '/tmp/bad-edges.yaml' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.added.edges).toBe(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].type).toBe('edge');
    } finally {
      capture.restore();
    }
  });
});
