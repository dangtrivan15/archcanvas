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

describe('add-edge command', () => {
  let addEdgeCommand: typeof import('@/cli/commands/add-edge').addEdgeCommand;

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
        edges: [],
        entities: [],
      }),
    });

    const mod = await import('@/cli/commands/add-edge');
    addEdgeCommand = mod.addEdgeCommand;
  });

  it('adds an edge with EdgeEndpoint objects (C5c.1)', async () => {
    const cap = captureOutput();
    try {
      await addEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edges = canvas.data.edges ?? [];
    expect(edges).toHaveLength(1);
    expect(edges[0].from.node).toBe('node-a');
    expect(edges[0].to.node).toBe('node-b');
  });

  it('saves after successful add (C5c.2, C11.1)', async () => {
    const cap = captureOutput();
    try {
      await addEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });

  it('returns error for missing endpoint (C5c.3)', async () => {
    await expect(
      addEdgeCommand(
        { from: 'node-a', to: 'nonexistent', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'EDGE_ENDPOINT_NOT_FOUND' }),
    );
  });

  it('json output has correct shape (C5c.4)', async () => {
    const cap = captureOutput();
    try {
      await addEdgeCommand(
        { from: 'node-a', to: 'node-b', protocol: 'REST', label: 'API call', project: '/test' },
        { json: true },
      );
    } finally {
      cap.restore();
    }

    const parsed = JSON.parse(cap.output);
    expect(parsed).toMatchObject({
      ok: true,
      edge: {
        from: 'node-a',
        to: 'node-b',
        protocol: 'REST',
        label: 'API call',
      },
    });
  });

  it('adds edge with optional ports and protocol', async () => {
    const cap = captureOutput();
    try {
      await addEdgeCommand(
        {
          from: 'node-a',
          to: 'node-b',
          fromPort: 'out',
          toPort: 'in',
          protocol: 'gRPC',
          label: 'RPC call',
          project: '/test',
        },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const edge = (canvas.data.edges ?? [])[0];
    expect(edge.from.port).toBe('out');
    expect(edge.to.port).toBe('in');
    expect(edge.protocol).toBe('gRPC');
    expect(edge.label).toBe('RPC call');
  });

  it('returns error for duplicate edge', async () => {
    const cap = captureOutput();
    try {
      await addEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    await expect(
      addEdgeCommand(
        { from: 'node-a', to: 'node-b', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'DUPLICATE_EDGE' }),
    );
  });
});
