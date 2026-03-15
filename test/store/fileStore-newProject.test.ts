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
  const fs = new InMemoryFileSystem();
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

  it('scaffolds new project when .archcanvas/main.yaml does not exist', async () => {
    const emptyFs = new InMemoryFileSystem();
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    // Should have created the scaffold file
    const exists = await emptyFs.exists('.archcanvas/main.yaml');
    expect(exists).toBe(true);

    // Should have loaded the project successfully
    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().fs).toBe(emptyFs);
    expect(useFileStore.getState().project?.root.data.project?.name).toBe('New Project');
  });

  it('scaffold template contains expected YAML fields', async () => {
    const emptyFs = new InMemoryFileSystem();
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    const content = await emptyFs.readFile('.archcanvas/main.yaml');
    expect(content).toContain('project:');
    expect(content).toContain('name: "New Project"');
    expect(content).toContain('nodes: []');
    expect(content).toContain('edges: []');
    expect(content).toContain('entities: []');
  });

  it('opens existing project when .archcanvas/main.yaml already exists', async () => {
    const existingFs = createSeededFs('Existing Project');
    setFilePicker(createMockPicker(existingFs));

    await useFileStore.getState().newProject();

    // Should have loaded the existing project (not overwritten it)
    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().fs).toBe(existingFs);
    expect(useFileStore.getState().project?.root.data.project?.name).toBe('Existing Project');
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

  it('updates recentProjects after successful new project', async () => {
    const mockStorage = createMockStorage();
    setLocalStorage(mockStorage);

    const emptyFs = new InMemoryFileSystem();
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    const recents = useFileStore.getState().recentProjects;
    expect(recents.length).toBe(1);
    expect(recents[0].name).toBe('New Project');
    expect(recents[0].lastOpened).toBeTruthy();
  });

  it('sets fs after successful new project', async () => {
    const emptyFs = new InMemoryFileSystem();
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    expect(useFileStore.getState().fs).toBe(emptyFs);
  });

  it('clears dirty canvases on new project', async () => {
    useFileStore.setState({ dirtyCanvases: new Set(['old-canvas']) });

    const emptyFs = new InMemoryFileSystem();
    setFilePicker(createMockPicker(emptyFs));

    await useFileStore.getState().newProject();

    expect(useFileStore.getState().dirtyCanvases.size).toBe(0);
  });
});
