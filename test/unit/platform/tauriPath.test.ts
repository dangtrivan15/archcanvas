import { describe, it, expect } from 'vitest';
import { resolveTauriPath } from '@/platform/tauriPath';

describe('resolveTauriPath', () => {
  const root = '/Users/dev/GitProjects/myproject';

  it('joins a relative path onto the root', () => {
    expect(resolveTauriPath(root, '.archcanvas/main.yaml')).toBe(
      '/Users/dev/GitProjects/myproject/.archcanvas/main.yaml',
    );
  });

  it('strips a leading slash from an otherwise-relative path', () => {
    expect(resolveTauriPath(root, '/foo/bar.yaml')).toBe(
      '/Users/dev/GitProjects/myproject/foo/bar.yaml',
    );
  });

  it('normalizes a trailing slash on the root', () => {
    expect(resolveTauriPath(root + '/', '.archcanvas/x.yaml')).toBe(
      '/Users/dev/GitProjects/myproject/.archcanvas/x.yaml',
    );
  });

  // Regression: an already-absolute path rooted at the FS root must be honored
  // as-is, not re-prepended onto the root (which produced a nested
  // `<root>/Users/.../<project>/.archcanvas/...` tree — the reported bug).
  it('honors an absolute path already rooted at the FS root (no double-nesting)', () => {
    const absolute = `${root}/.archcanvas/registry.lock.yaml`;
    expect(resolveTauriPath(root, absolute)).toBe(absolute);
  });

  it('honors a path exactly equal to the root', () => {
    expect(resolveTauriPath(root, root)).toBe(root);
  });

  it('does NOT treat an unrelated absolute-looking path as rooted', () => {
    // A path that merely shares a prefix string but is not a child of root
    // (e.g. a sibling project) should still be joined relative, not escape.
    expect(resolveTauriPath(root, `${root}-other/file.yaml`)).toBe(
      `${root}/Users/dev/GitProjects/myproject-other/file.yaml`,
    );
  });
});
