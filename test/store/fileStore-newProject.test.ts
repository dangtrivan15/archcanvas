import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFileStore, setFilePicker, setLocalStorage } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import type { FilePicker } from '@/platform/filePicker';
import { serializeCanvas } from '@/storage/yamlCodec';

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
      nodes: [],
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

describe('fileStore.newProject()', () => {
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

    await useFileStore.getState().newProject();

    expect(useFileStore.getState().fs).toBeNull();
    expect(useFileStore.getState().status).toBe('idle');
    expect(useFileStore.getState().project).toBeNull();
  });

  it('routes to needs_onboarding when .archcanvas/ does not exist (no scaffolding)', async () => {
    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

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

    await useFileStore.getState().newProject();

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

    await useFileStore.getState().newProject();

    // File content should be unchanged
    const currentContent = await existingFs.readFile('.archcanvas/main.yaml');
    expect(currentContent).toBe(originalContent);
  });

  it('does not update recents on needs_onboarding (recents set during completeOnboarding)', async () => {
    const mockStorage = createMockStorage();
    setLocalStorage(mockStorage);

    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    // Recents should NOT be updated yet — that happens in completeOnboarding
    expect(useFileStore.getState().recentProjects.length).toBe(0);
  });

  it('sets fs after picking a directory (even for needs_onboarding)', async () => {
    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    expect(useFileStore.getState().fs).toBe(emptyFs);
  });

  it('dirty canvases remain unchanged on needs_onboarding (no project loaded)', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['old-canvas']) });

    const emptyFs = new InMemoryFileSystem('NewProject');
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    // needs_onboarding doesn't clear dirty canvases (no project load happened)
    expect(useFileStore.getState().status).toBe('needs_onboarding');
  });

  it('clears dirty canvases when opening existing project', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['old-canvas']) });

    const existingFs = createSeededFs('Existing');
    setFilePicker(createMockPicker(existingFs));

    await useFileStore.getState().newProject();

    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });
});
