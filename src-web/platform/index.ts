export type { FileSystem } from './fileSystem';
export { InMemoryFileSystem } from './inMemoryFileSystem';
export { WebFileSystem } from './webFileSystem';
export type { FilePicker } from './filePicker';
export { createFilePicker } from './filePicker';
export type { FileSaver, FileSaveOptions } from './fileSaver';
export { createFileSaver } from './fileSaver';
// TauriFileSystem and NodeFileSystem are not statically exported because their
// platform-specific dependencies (node:fs, @tauri-apps/plugin-fs) must not
// enter the wrong bundle. Use createFileSystem() instead, which dynamically
// imports the correct implementation at runtime.

import type { FileSystem } from './fileSystem';

/**
 * Detect platform and return the appropriate FileSystem implementation.
 *
 * Detection order:
 * 1. Explicit FileSystemDirectoryHandle → WebFileSystem
 * 2. No `window` global (Node.js / CLI) → NodeFileSystem (dynamic import)
 * 3. Tauri runtime detected → TauriFileSystem (dynamic import)
 * 4. Otherwise → error (unknown environment)
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
