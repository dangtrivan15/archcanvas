import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useGraphStore } from '@/store/graphStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import type { Canvas } from '@/types/schema';

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
  return serializeCanvas(data as Canvas);
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

describe('remove-edge command', () => {
  let removeEdgeCommand: typeof import('@/cli/commands/remove-edge').removeEdgeCommand;

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

    const mod = await import('@/cli/commands/remove-edge');
    removeEdgeCommand = mod.removeEdgeCommand;
  });

  it('removes an edge by from/to (C5e.1)', async () => {
    const cap = captureOutput();
    try {
      await removeEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    expect(canvas.data.edges ?? []).toHaveLength(0);
  });

  it('saves after successful remove (C5e.2, C11.1)', async () => {
    const cap = captureOutput();
    try {
      await removeEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });

  it('returns error for missing edge (C5e.3)', async () => {
    await expect(
      removeEdgeCommand(
        { from: 'node-a', to: 'nonexistent', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'EDGE_NOT_FOUND' }),
    );
  });

  it('json output has correct shape (C5e.4)', async () => {
    const cap = captureOutput();
    try {
      await removeEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: true },
      );
    } finally {
      cap.restore();
    }

    const parsed = JSON.parse(cap.output);
    expect(parsed).toMatchObject({
      ok: true,
      removed: { from: 'node-a', to: 'node-b' },
    });
  });

  it('returns error when nodes exist but no edge between them', async () => {
    // Remove the existing edge first
    const cap = captureOutput();
    try {
      await removeEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    // Now try to remove again — should fail
    await expect(
      removeEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'EDGE_NOT_FOUND' }),
    );
  });
});
