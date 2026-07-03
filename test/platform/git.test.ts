import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeFileSystem } from '../../src-web/platform/nodeFileSystem';
import { createGitProvider } from '../../src-web/platform/git';

let repoDir: string;

beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'archcanvas-git-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repoDir });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  mkdirSync(join(repoDir, '.archcanvas'), { recursive: true });
  writeFileSync(join(repoDir, '.archcanvas', 'main.yaml'), 'nodes: []\nedges: []\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'initial');
  // Modify the working tree AFTER commit so HEAD differs from disk
  writeFileSync(join(repoDir, '.archcanvas', 'main.yaml'), 'nodes: [changed]\n');
});

afterAll(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe('IsomorphicGitProvider', () => {
  it('reports a directory containing .git as a repository', async () => {
    const provider = createGitProvider(new NodeFileSystem(repoDir));
    expect(await provider.isRepository()).toBe(true);
  });

  it('reports a non-repo directory as not a repository', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'archcanvas-norepo-'));
    const provider = createGitProvider(new NodeFileSystem(bare));
    expect(await provider.isRepository()).toBe(false);
    rmSync(bare, { recursive: true, force: true });
  });

  it('reads a committed file at HEAD (not the working-tree version)', async () => {
    const provider = createGitProvider(new NodeFileSystem(repoDir));
    const content = await provider.readFileAtRef('HEAD', '.archcanvas/main.yaml');
    expect(content).toBe('nodes: []\nedges: []\n');
  });

  it('returns null for a path absent in the ref', async () => {
    const provider = createGitProvider(new NodeFileSystem(repoDir));
    const content = await provider.readFileAtRef('HEAD', '.archcanvas/missing.yaml');
    expect(content).toBeNull();
  });

  // Regression guard: an unresolvable ref must PROPAGATE, not collapse to null.
  // resolveRef and readBlob both throw NotFoundError, so if resolveRef were ever
  // moved back inside readFileAtRef's readBlob try/catch, a bad ref would be
  // swallowed into `null` and this test would fail (promise resolves instead of
  // rejecting). Keeping resolveRef outside that catch is what makes this pass.
  it('propagates an error for an unresolvable ref', async () => {
    const provider = createGitProvider(new NodeFileSystem(repoDir));
    await expect(
      provider.readFileAtRef('refs/heads/does-not-exist', '.archcanvas/main.yaml'),
    ).rejects.toThrow();
  });
});

// The main fixture above is a single fresh commit, so all objects are LOOSE.
// This block packs objects (git repack) so reads exercise the packfile path
// (readObjectPacked / loadPackIndex) and the shared cache across calls.
describe('IsomorphicGitProvider (packed repo)', () => {
  let packedRepoDir: string;

  beforeAll(() => {
    packedRepoDir = mkdtempSync(join(tmpdir(), 'archcanvas-git-packed-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: packedRepoDir });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    mkdirSync(join(packedRepoDir, '.archcanvas'), { recursive: true });
    writeFileSync(join(packedRepoDir, '.archcanvas', 'main.yaml'), 'nodes: []\nedges: []\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'initial');
    // Pack loose objects into a .pack/.idx so reads hit the packfile path.
    git('repack', '-ad');
  });

  afterAll(() => {
    rmSync(packedRepoDir, { recursive: true, force: true });
  });

  it('reads a committed file from packed objects', async () => {
    const provider = createGitProvider(new NodeFileSystem(packedRepoDir));
    // Two sequential reads: proves packfile reads work and exercises the
    // shared cache carried across calls on the same provider instance.
    const first = await provider.readFileAtRef('HEAD', '.archcanvas/main.yaml');
    const second = await provider.readFileAtRef('HEAD', '.archcanvas/main.yaml');
    expect(first).toBe('nodes: []\nedges: []\n');
    expect(second).toBe('nodes: []\nedges: []\n');
  });
});
