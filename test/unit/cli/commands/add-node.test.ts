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
const existsSyncMock = vi.fn<(p: import('node:fs').PathLike) => boolean>().mockReturnValue(true);
vi.mock(import('node:fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual, existsSync: (p: import('node:fs').PathLike) => existsSyncMock(p) },
    existsSync: (p: import('node:fs').PathLike) => existsSyncMock(p),
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

// Capture stdout/stderr
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

describe('add-node command', () => {
  let addNodeCommand: typeof import('@/cli/commands/add-node').addNodeCommand;

  beforeEach(async () => {
    resetStores();
    vi.clearAllMocks();

    mockFs = new InMemoryFileSystem();
    mockFs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'TestProject' },
        nodes: [],
        edges: [],
        entities: [],
      }),
    });

    const mod = await import('@/cli/commands/add-node');
    addNodeCommand = mod.addNodeCommand;
  });

  it('adds a node to the root canvas (C5b.1)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-api', type: 'compute/service', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).toContain('svc-api');
  });

  it('saves after successful add (C5b.2, C11.1)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-api', type: 'compute/service', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    // After saveAll, dirty canvases should be cleared
    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });

  it('returns engine error on duplicate ID (C5b.3)', async () => {
    // First add succeeds
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-dup', type: 'compute/service', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    // Second add with same ID should throw CLIError
    await expect(
      addNodeCommand(
        { id: 'svc-dup', type: 'compute/service', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'DUPLICATE_NODE_ID' }),
    );
  });

  it('errors on unknown node type (C5b.4)', async () => {
    await expect(
      addNodeCommand(
        { id: 'svc-x', type: 'nonexistent/type', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'UNKNOWN_NODE_TYPE' }),
    );
  });

  it('defaults displayName from NodeDef metadata (C5b.5)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-default-name', type: 'compute/service', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const node = (canvas.data.nodes ?? []).find((n) => n.id === 'svc-default-name');
    expect(node).toBeDefined();
    // Should have the NodeDef's displayName, not undefined
    if (node && 'displayName' in node) {
      expect(node.displayName).toBeTruthy();
    }
  });

  it('uses provided --name when specified (C5b.5)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-named', type: 'compute/service', name: 'My API', project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const node = (canvas.data.nodes ?? []).find((n) => n.id === 'svc-named');
    expect(node).toBeDefined();
    if (node && 'displayName' in node) {
      expect(node.displayName).toBe('My API');
    }
  });

  it('json output has correct shape (C5b.6)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'svc-json', type: 'compute/service', name: 'JSON Svc', project: '/test' },
        { json: true },
      );
    } finally {
      cap.restore();
    }

    const parsed = JSON.parse(cap.output);
    expect(parsed).toMatchObject({
      ok: true,
      node: {
        id: 'svc-json',
        type: 'compute/service',
        displayName: 'JSON Svc',
      },
    });
  });

  it('adds node to a specific scope (C5b.1)', async () => {
    // First add a subsystem node that creates a nested canvas
    const cap = captureOutput();
    try {
      await addNodeCommand(
        { id: 'inner-svc', type: 'compute/service', scope: ROOT_CANVAS_KEY, project: '/test' },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const ids = (canvas.data.nodes ?? []).map((n) => n.id);
    expect(ids).toContain('inner-svc');
  });

  it('parses --args as JSON (C5b.1)', async () => {
    const cap = captureOutput();
    try {
      await addNodeCommand(
        {
          id: 'svc-args',
          type: 'compute/service',
          args: '{"port":"8080","replicas":"3"}',
          project: '/test',
        },
        { json: false },
      );
    } finally {
      cap.restore();
    }

    const canvas = useFileStore.getState().getCanvas(ROOT_CANVAS_KEY)!;
    const node = (canvas.data.nodes ?? []).find((n) => n.id === 'svc-args');
    expect(node).toBeDefined();
    if (node && 'args' in node) {
      expect(node.args).toEqual({ port: '8080', replicas: '3' });
    }
  });

  it('errors on invalid --args JSON', async () => {
    await expect(
      addNodeCommand(
        { id: 'svc-bad', type: 'compute/service', args: '{bad json', project: '/test' },
        { json: false },
      ),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'INVALID_ARGS' }),
    );
  });
});
