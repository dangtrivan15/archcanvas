import { describe, it, expect } from 'vitest';
import { readGitBaseline } from '../../../src-web/core/diff/gitBaseline';
import { InMemoryFileSystem } from '../../../src-web/platform/inMemoryFileSystem';
import type { GitProvider } from '../../../src-web/platform/git';

function fakeGit(files: Record<string, string>): GitProvider {
  return {
    isRepository: async () => true,
    readFileAtRef: async (_ref, filepath) =>
      filepath in files ? files[filepath] : null,
  };
}

describe('readGitBaseline', () => {
  it('reads and parses canvas YAML from the provider', async () => {
    const fs = new InMemoryFileSystem('t');
    fs.seed({ '.archcanvas/main.yaml': 'nodes: []\nedges: []\n' });
    const git = fakeGit({ '.archcanvas/main.yaml': 'nodes: []\nedges: []\n' });

    const result = await readGitBaseline('HEAD', git, fs);
    expect(result.canvases.has('__root__')).toBe(true);
    expect(result.ref).toBe('HEAD');
  });

  it('skips files absent in the ref', async () => {
    const fs = new InMemoryFileSystem('t');
    fs.seed({ '.archcanvas/main.yaml': 'nodes: []\n' });
    const git = fakeGit({}); // returns null for everything

    const result = await readGitBaseline('HEAD', git, fs);
    expect(result.canvases.size).toBe(0);
  });
});
