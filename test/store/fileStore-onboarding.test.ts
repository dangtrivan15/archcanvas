import { describe, it, expect, beforeEach } from 'vitest';
import { useFileStore, setLocalStorage } from '@/store/fileStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';

/** Simple in-memory localStorage mock (recents persistence writes here). */
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

function resetStore() {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
    fs: null,
    recentProjects: [],
    projectPath: null,
  });
}

describe('onboarding: .archcanvas is created only after a choice (invariant)', () => {
  beforeEach(() => {
    setLocalStorage(createMockStorage());
    resetStore();
  });

  it('opening an empty folder shows the wizard WITHOUT creating .archcanvas', async () => {
    const fs = new InMemoryFileSystem('EmptyProject');

    await useFileStore.getState().openProject(fs);

    // The wizard route is driven by this status.
    expect(useFileStore.getState().status).toBe('needs_onboarding');
    // Guardrail: nothing must be written to disk before a choice is made.
    expect(await fs.exists('.archcanvas')).toBe(false);
  });

  it('cancelling onboarding returns to the gate and leaves no .archcanvas', async () => {
    const fs = new InMemoryFileSystem('EmptyProject');
    await useFileStore.getState().openProject(fs);
    expect(useFileStore.getState().status).toBe('needs_onboarding');

    useFileStore.getState().cancelOnboarding();

    // App renders <ProjectGate/> whenever fs === null.
    expect(useFileStore.getState().fs).toBeNull();
    expect(useFileStore.getState().status).toBe('idle');
    expect(useFileStore.getState().projectPath).toBeNull();
    expect(useFileStore.getState().project).toBeNull();
    // Still no folder — the misclicked project was never materialized.
    expect(await fs.exists('.archcanvas')).toBe(false);
  });

  it('cancelling preserves recentProjects so the gate still shows history', () => {
    useFileStore.setState({
      recentProjects: [{ name: 'Prev', path: '/prev', lastOpened: '2026-01-01T00:00:00.000Z' }],
    });

    useFileStore.getState().cancelOnboarding();

    expect(useFileStore.getState().recentProjects).toHaveLength(1);
  });

  it('positive control: choosing Blank Canvas DOES create .archcanvas', async () => {
    const fs = new InMemoryFileSystem('EmptyProject');
    await useFileStore.getState().openProject(fs);
    expect(await fs.exists('.archcanvas')).toBe(false);

    await useFileStore.getState().completeOnboarding('blank');

    // Creation is bound to the choice — folder exists once, and only once,
    // an onboarding option is selected.
    expect(useFileStore.getState().status).toBe('loaded');
    expect(await fs.exists('.archcanvas')).toBe(true);
    expect(await fs.exists('.archcanvas/main.yaml')).toBe(true);
  });
});
