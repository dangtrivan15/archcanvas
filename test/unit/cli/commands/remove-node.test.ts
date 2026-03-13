import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvasFile } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import type { CanvasFile } from '@/types/schema';

enablePatches();

// Mock createFileSystem to return our InMemoryFileSystem
let mockFs: InMemoryFileSystem;

vi.mock('@/platform/index', () => ({
  createFileSystem: vi.fn(async () => mockFs),
}));

// Mock node:fs existsSync for findProjectRoot
const existsSyncMock = vi.fn<(p: string) => boolean>().mockReturnValue(true);
vi.mock(import('node:fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual, existsSync: (p: string) => existsSyncMock(p) },
    existsSync: (p: string) => existsSyncMock(p),
  };
});

function yamlOf(data: Record<string, unknown>): string {
  return serializeCanvasFile(data as CanvasFile);
}

function resetStores(): void {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
    fs: null,
  });
  useRegistryStore.setState({
    registry: null,
    status: 'idle',
  });
}

function captureOutput() {
  const chunks: string[] = [];
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  return {
    get output() { return chunks.join(''); },
    restore() { process.stdout.write = origWrite; },
  };
}

describe('remove-node command', () => {
  let removeNodeCommand: typeof import('@/cli/commands/remove-node').removeNodeCommand;

  beforeEach(async () => {
    resetStores();
    vi.clearAllMocks();

    mockFs = new InMemoryFileSystem();
    mockFs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'TestProject' },
        nodes: [
          { id: 'node-a', type: 'compute/service', displayName: 'Node A' },
          { id: 'node-b', type: 'compute/service', displayName: 'Node B' },
        ],
        edges: [
          { from: { node: 'node-a' }, to: { node: 'node-b' } },
        ],
        entities: [],
      }),
    });

    const mod = await import('@/cli/commands/remove-node');
    removeNodeCommand = mod.removeNodeCommand;
  });

  it('removes a node by ID (C5d.1)', async () => {
    const cap = captureOutput();
    try {
      await removeNodeCommand(
        { id: 'node-a', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).not.toContain('node-a');
  });

  it('saves after successful remove (C5d.2, C11.1)', async () => {
    const cap = captureOutput();
    try {
      await removeNodeCommand(
        { id: 'node-a', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });

  it('returns error for missing node (C5d.3)', async () => {
    await expect(
      removeNodeCommand(
        { id: 'nonexistent', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NODE_NOT_FOUND' }),
    );
  });

  it('connected edges are also removed (C5d.4)', async () => {
    // Before removal, there's an edge from node-a to node-b
    const cap = captureOutput();
    try {
      await removeNodeCommand(
        { id: 'node-a', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    expect(canvas.data.edges ?? []).toHaveLength(0);
  });

  it('json output has correct shape', async () => {
    const cap = captureOutput();
    try {
      await removeNodeCommand(
        { id: 'node-b', project: '/test' },
        { json: true },
      );
    } finally {
      cap.restore();
    }

    const parsed = JSON.parse(cap.output);
    expect(parsed).toMatchObject({
      ok: true,
      removed: { id: 'node-b' },
    });
  });
});
