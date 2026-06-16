/**
 * Resolve a path against a Tauri project root.
 *
 * The {@link FileSystem} contract is "paths are relative to the FS root", so
 * callers normally pass `.archcanvas/main.yaml` and the platform layer joins it
 * onto the root. To stay robust against callers that hand us a path already
 * rooted at this FS (matching {@link NodeFileSystem}, whose `path.resolve`
 * honors absolute inputs), an absolute path that points inside the root is
 * returned as-is instead of being re-prepended — which would otherwise produce
 * a nested `<root>/<root>/…` tree.
 *
 * Pure and free of `@tauri-apps/*` imports so it can be unit-tested directly.
 */
export function resolveTauriPath(rootPath: string, path: string): string {
  const root = rootPath.replace(/\/+$/, '');
  // Already rooted at this FS — honor it verbatim (no double-nesting).
  if (path === root || path.startsWith(root + '/')) {
    return path;
  }
  const rel = path.replace(/^\/+/, '');
  return `${root}/${rel}`;
}
