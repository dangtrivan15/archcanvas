export type { FileSystem } from './fileSystem';
export { InMemoryFileSystem } from './inMemoryFileSystem';
export { WebFileSystem } from './webFileSystem';
export type { FilePicker } from './filePicker';
export { createFilePicker } from './filePicker';
// TauriFileSystem is not statically exported because @tauri-apps/plugin-fs
// is only available inside a Tauri build. Use createFileSystem() instead,
// which dynamically imports the Tauri implementation when needed.

import type { FileSystem } from './fileSystem';

/**
 * Detect platform and return the appropriate FileSystem implementation.
 * - Tauri: uses @tauri-apps/plugin-fs with the given root path
 * - Web: uses File System Access API with the given directory handle
 */
export async function createFileSystem(
  root: FileSystemDirectoryHandle | string,
): Promise<FileSystem> {
  if (typeof root === 'string') {
    // Tauri — root is a filesystem path
    const { TauriFileSystem } = await import('./tauriFileSystem');
    return new TauriFileSystem(root);
  }
  // Web — root is a FileSystemDirectoryHandle
  const { WebFileSystem } = await import('./webFileSystem');
  return new WebFileSystem(root);
}
