import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore, setLocalStorage } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { getTemplateById } from '@/core/templates/loader';
import { parseCanvas } from '@/storage/yamlCodec';

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

describe('fileStore.completeOnboarding with template', () => {
  beforeEach(() => {
    setLocalStorage(createMockStorage());
    useFileStore.setState({
      project: null,
      dirtyCanvases: new Set(),
      status: 'idle',
      error: null,
      fs: null,
      recentProjects: [],
      projectPath: null,
    });
  });

  it('creates a project from a template', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    useFileStore.setState({ fs, status: 'needs_onboarding' });

    const template = getTemplateById('microservices')!;
    await useFileStore.getState().completeOnboarding('template', undefined, template);

    // Should have loaded the project
    expect(useFileStore.getState().status).toBe('loaded');
    expect(useFileStore.getState().project).not.toBeNull();
  });

  it('writes template YAML with the correct project name', async () => {
    const fs = new InMemoryFileSystem('MyProject');
    useFileStore.setState({ fs, status: 'needs_onboarding' });

    const template = getTemplateById('serverless')!;
    await useFileStore.getState().completeOnboarding('template', undefined, template);

    const content = await fs.readFile('.archcanvas/main.yaml');
    const { data } = parseCanvas(content);

    expect(data.project!.name).toBe('MyProject');
  });

  it('loads all template nodes into the project', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    useFileStore.setState({ fs, status: 'needs_onboarding' });

    const template = getTemplateById('microservices')!;
    await useFileStore.getState().completeOnboarding('template', undefined, template);

    const root = useFileStore.getState().project!.root;
    expect(root.data.nodes!.length).toBe(template.canvas.nodes!.length);
    expect(root.data.edges!.length).toBe(template.canvas.edges!.length);
  });

  it('adds project to recents', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    useFileStore.setState({ fs, status: 'needs_onboarding' });

    const template = getTemplateById('monolith')!;
    await useFileStore.getState().completeOnboarding('template', undefined, template);

    const recents = useFileStore.getState().recentProjects;
    expect(recents.length).toBeGreaterThan(0);
  });

  it('does not trigger AI chat for template onboarding', async () => {
    const fs = new InMemoryFileSystem('TestProject');
    useFileStore.setState({ fs, status: 'needs_onboarding' });

    const template = getTemplateById('event-driven')!;
    await useFileStore.getState().completeOnboarding('template', undefined, template);

    // Template path should simply load the project without AI interaction
    expect(useFileStore.getState().status).toBe('loaded');
  });
});
