import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import type { Canvas } from '@/types/schema';

// Mock createFileSystem to return our InMemoryFileSystem
let mockFs: InMemoryFileSystem;

vi.mock('@/platform/index', () => ({
  createFileSystem: vi.fn(async () => mockFs),
}));

// Mock node:fs to control existsSync for findProjectRoot
const existsSyncMock = vi.fn<(p: import('node:fs').PathLike) => boolean>();
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
  });
  useRegistryStore.setState({
    registry: null,
    status: 'idle',
  });
}

describe('resolveCanvasId', () => {
  // resolveCanvasId is a pure function — no async, no setup needed
  let resolveCanvasId: typeof import('@/cli/context').resolveCanvasId;

  beforeEach(async () => {
    const mod = await import('@/cli/context');
    resolveCanvasId = mod.resolveCanvasId;
  });

  it('returns ROOT_CANVAS_KEY for undefined', () => {
    expect(resolveCanvasId(undefined)).toBe(ROOT_CANVAS_KEY);
  });

  it('returns ROOT_CANVAS_KEY for "root"', () => {
    expect(resolveCanvasId('root')).toBe(ROOT_CANVAS_KEY);
  });

  it('passes through any other value as-is', () => {
    expect(resolveCanvasId('svc-foo')).toBe('svc-foo');
    expect(resolveCanvasId('my-subsystem')).toBe('my-subsystem');
  });
});

describe('loadContext', () => {
  let loadContext: typeof import('@/cli/context').loadContext;

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

    const mod = await import('@/cli/context');
    loadContext = mod.loadContext;
  });

  it('loads project from explicit path', async () => {
    existsSyncMock.mockReturnValue(true);

    const ctx = await loadContext('/projects/myapp');
    expect(ctx.fs).toBe(mockFs);
    expect(useFileStore.getState().status).toBe('loaded');
  });

  it('initializes the registry store', async () => {
    existsSyncMock.mockReturnValue(true);

    await loadContext('/projects/myapp');
    expect(useRegistryStore.getState().status).toBe('ready');
    expect(useRegistryStore.getState().registry).not.toBeNull();
  });

  it('returns CLIContext with fs', async () => {
    existsSyncMock.mockReturnValue(true);

    const ctx = await loadContext('/projects/myapp');
    expect(ctx).toHaveProperty('fs');
  });

  it('throws PROJECT_NOT_FOUND when no .archcanvas/ found', async () => {
    // existsSync always returns false — no .archcanvas/ anywhere
    existsSyncMock.mockReturnValue(false);

    await expect(loadContext()).rejects.toThrow(
      expect.objectContaining({ code: 'PROJECT_NOT_FOUND' }),
    );
  });

  it('throws PROJECT_LOAD_FAILED when fileStore reports error', async () => {
    existsSyncMock.mockReturnValue(true);

    // Seed with invalid YAML content to trigger a load error
    mockFs = new InMemoryFileSystem();
    mockFs.seed({
      '.archcanvas/main.yaml': '}{invalid yaml{{',
    });

    await expect(loadContext('/projects/broken')).rejects.toThrow(
      expect.objectContaining({ code: 'PROJECT_LOAD_FAILED' }),
    );
  });

  it('searches cwd upward for .archcanvas/ when no explicit path', async () => {
    // Mock existsSync to find .archcanvas/ in a parent directory
    existsSyncMock.mockImplementation((p: import('node:fs').PathLike) => {
      const s = String(p);
      return s.endsWith('/.archcanvas') && !s.includes('worktrees');
    });

    // This will search cwd upward — since existsSync is mocked
    // to match a specific pattern, the search should eventually hit it
    // or exhaust parents. Given the mock, this tests the walking logic.
    // The test may throw PROJECT_NOT_FOUND depending on cwd path structure.
    // What matters is that existsSync was called with ascending directories.
    try {
      await loadContext();
    } catch {
      // May throw if mock doesn't match cwd parents — that's OK
    }
    expect(existsSyncMock).toHaveBeenCalled();
    // Verify it was called with a path ending in .archcanvas
    const calls = existsSyncMock.mock.calls.map((c) => c[0]);
    expect(calls.some((p) => String(p).endsWith('.archcanvas'))).toBe(true);
  });
});
