import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFileStore, setFilePicker, setLocalStorage } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import type { FilePicker } from '@/platform/filePicker';
import { serializeCanvas } from '@/storage/yamlCodec';
import { getLastActiveProject, clearLastActiveProject } from '@/core/lastActiveProject';

function yamlOf(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvas(data as any);
}

/** Create an InMemoryFileSystem seeded with a minimal valid project */
function createSeededFs(name = 'Test'): InMemoryFileSystem {
  const fs = new InMemoryFileSystem(name);
  fs.seed({
    '.archcanvas/main.yaml': yamlOf({
      project: { name },
      nodes: [{ id: 'svc-api', type: 'compute/service' }],
    }),
  });
  return fs;
}

/** Simple in-memory localStorage mock */
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

/** Create a mock FilePicker that returns a given FileSystem */
function createMockPicker(fs: InMemoryFileSystem | null): FilePicker {
  return {
    pickDirectory: vi.fn().mockResolvedValue(fs),
  };
}

describe('fileStore.open()', () => {
  beforeEach(() => {
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
      fs: null,
      recentProjects: [],
    });
    setFilePicker(null);
    setLocalStorage(null);
  });

  afterEach(() => {
    setFilePicker(null);
    setLocalStorage(null);
  });

  it('does nothing when user cancels the picker', async () => {
    setFilePicker(createMockPicker(null));

    await useFileStore.getState().open();

    expect(useFileStore.getState().fs).toBeNull();
    expect(useFileStore.getState().status).toBe('idle');
    expect(useFileStore.getState().project).toBeNull();
  });

  it('routes to needs_onboarding when .archcanvas/ does not exist (no scaffolding)', async () => {
    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().open();

    // Should NOT scaffold — that's now completeOnboarding's job
    const exists = await emptyFs.exists('.archcanvas/main.yaml');
    expect(exists).toBe(false);

    // Should route to needs_onboarding so the wizard can handle setup
    expect(useFileStore.getState().status).toBe('needs_onboarding');
    expect(useFileStore.getState().fs).toBe(emptyFs);
  });

  it('opens existing project when .archcanvas/main.yaml already exists', async () => {
    const mockStorage = createMockStorage();
    setLocalStorage(mockStorage);

    const existingFs = createSeededFs('Existing Project');
    setFilePicker(createMockPicker(existingFs));

    await useFileStore.getState().open();

    // Should have loaded the existing project (not overwritten it)
    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().fs).toBe(existingFs);
    expect(useFileStore.getState().project?.root.data.project?.name).toBe('Existing Project');

    // Recents should be updated after a successful load
    expect(useFileStore.getState().recentProjects.length).toBe(1);
    expect(useFileStore.getState().recentProjects[0].name).toBe('Existing Project');
  });

  it('does not overwrite existing .archcanvas/main.yaml', async () => {
    const existingFs = createSeededFs('Existing Project');
    const originalContent = await existingFs.readFile('.archcanvas/main.yaml');
    setFilePicker(createMockPicker(existingFs));

    await useFileStore.getState().open();

    // File content should be unchanged
    const currentContent = await existingFs.readFile('.archcanvas/main.yaml');
    expect(currentContent).toBe(originalContent);
  });

  it('does not update recents on needs_onboarding (recents set during completeOnboarding)', async () => {
    const mockStorage = createMockStorage();
    setLocalStorage(mockStorage);

    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().open();

    // Recents should NOT be updated yet — that happens in completeOnboarding
    expect(useFileStore.getState().recentProjects.length).toBe(0);
  });

  it('sets fs after picking a directory (even for needs_onboarding)', async () => {
    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().open();

    expect(useFileStore.getState().fs).toBe(emptyFs);
  });

  it('dirty canvases remain unchanged on needs_onboarding (no project loaded)', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['old-canvas']) });

    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().open();

    // needs_onboarding doesn't clear dirty canvases (no project load happened)
    expect(useFileStore.getState().status).toBe('needs_onboarding');
  });

  it('clears dirty canvases when opening existing project', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['old-canvas']) });

    const existingFs = createSeededFs('Existing');
    setFilePicker(createMockPicker(existingFs));

    await useFileStore.getState().open();

    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// lastActiveProject persistence via loadProject
// ---------------------------------------------------------------------------

describe('lastActiveProject persistence', () => {
  beforeEach(() => {
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
      fs: null,
      recentProjects: [],
      projectPath: null,
    });
    setFilePicker(null);
    setLocalStorage(null);
    clearLastActiveProject();
  });

  afterEach(() => {
    setFilePicker(null);
    setLocalStorage(null);
    clearLastActiveProject();
  });

  it('persists project path to localStorage after successful openProject', async () => {
    const existingFs = createSeededFs('MyProject');
    // InMemoryFileSystem.getPath() returns null, so manually set projectPath
    useFileStore.setState({ projectPath: '/home/user/my-project' });

    await useFileStore.getState().openProject(existingFs);

    expect(useFileStore.getState().status).toBe('loaded');
    expect(getLastActiveProject()).toBe('/home/user/my-project');
  });

  it('does not persist when openProject leads to needs_onboarding', async () => {
    const emptyFs = new InMemoryFileSystem('Empty');
    useFileStore.setState({ projectPath: '/home/user/empty' });

    await useFileStore.getState().openProject(emptyFs);

    expect(useFileStore.getState().status).toBe('needs_onboarding');
    expect(getLastActiveProject()).toBeNull();
  });

  it('does not persist when projectPath is null', async () => {
    const existingFs = createSeededFs('NoPath');
    // projectPath stays null (InMemoryFileSystem.getPath() returns null)

    await useFileStore.getState().openProject(existingFs);

    expect(useFileStore.getState().status).toBe('loaded');
    expect(getLastActiveProject()).toBeNull();
  });

  it('persists updated path when opening a different project', async () => {
    const fs1 = createSeededFs('First');
    useFileStore.setState({ projectPath: '/first' });
    await useFileStore.getState().openProject(fs1);
    expect(getLastActiveProject()).toBe('/first');

    // Reset and open a different project
    useFileStore.setState({ project: null, fs: null, status: 'idle', projectPath: '/second' });
    const fs2 = createSeededFs('Second');
    await useFileStore.getState().openProject(fs2);
    expect(getLastActiveProject()).toBe('/second');
  });
});
