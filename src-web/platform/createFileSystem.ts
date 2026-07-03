import type { FileSystem } from './fileSystem';

/**
 * Detect platform and return the appropriate FileSystem implementation.
 *
 * Detection order:
 * 1. Explicit FileSystemDirectoryHandle → WebFileSystem
 * 2. No `window` global (Node.js / CLI) → NodeFileSystem (dynamic import)
 * 3. Tauri runtime detected → TauriFileSystem (dynamic import)
 * 4. Otherwise → error (unknown environment)
 *
 * Deliberately its own module, NOT re-exported from './index' — see the
 * comment there. This function's `await import('./nodeFileSystem')` branch
 * touches node:fs/node:path; if it were reachable from the barrel that other
 * modules import for unrelated symbols (e.g. createGitProvider), Rollup
 * bundles nodeFileSystem.ts into the production client build and fails,
 * even though this function is never called from browser code.
 */
export async function createFileSystem(
  root: FileSystemDirectoryHandle | string,
): Promise<FileSystem> {
  // Branch 1: Web — caller passed a FileSystemDirectoryHandle
  if (typeof root === 'object' && root !== null && 'getFileHandle' in root) {
    const { WebFileSystem } = await import('./webFileSystem');
    return new WebFileSystem(root as FileSystemDirectoryHandle);
  }

  if (typeof root !== 'string') {
    throw new Error(
      `createFileSystem: expected a string path or FileSystemDirectoryHandle, got ${typeof root}`,
    );
  }

  // Branch 2: Node.js / CLI — no window global
  if (typeof window === 'undefined') {
    const { NodeFileSystem } = await import('./nodeFileSystem');
    return new NodeFileSystem(root);
  }

  // Branch 3: Tauri runtime
  if (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  ) {
    const { TauriFileSystem } = await import('./tauriFileSystem');
    return new TauriFileSystem(root);
  }

  // Branch 4: Unknown environment
  throw new Error(
    'createFileSystem: unable to detect platform. ' +
      'Expected Node.js (no window), Tauri (window.__TAURI_INTERNALS__), ' +
      'or Web (FileSystemDirectoryHandle).',
  );
}
