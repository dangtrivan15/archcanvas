import type { FileSystem } from './fileSystem';

/**
 * Abstraction for directory picker dialogs.
 * Returns a FileSystem bound to the chosen directory, or null if the user cancelled.
 */
export interface FilePicker {
  pickDirectory(): Promise<FileSystem | null>;
}

/**
 * Web implementation — uses the File System Access API's showDirectoryPicker().
 */
class WebFilePicker implements FilePicker {
  async pickDirectory(): Promise<FileSystem | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      const { WebFileSystem } = await import('./webFileSystem');
      return new WebFileSystem(handle);
    } catch {
      // User cancelled (AbortError) or API not supported
      return null;
    }
  }
}

/**
 * Tauri implementation — uses Tauri dialog API.
 * Placeholder until @tauri-apps/plugin-dialog is wired up.
 *
 * The dynamic import uses a variable to prevent Vite from statically
 * analyzing and failing on the missing Tauri package during dev/test builds.
 */
class TauriFilePicker implements FilePicker {
  async pickDirectory(): Promise<FileSystem | null> {
    try {
      // Indirection prevents Vite's import analysis from resolving at build time
      const dialogModule = '@tauri-apps/plugin-dialog';
      const { open } = await import(/* @vite-ignore */ dialogModule);
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== 'string') return null;
      const { TauriFileSystem } = await import('./tauriFileSystem');
      return new TauriFileSystem(selected);
    } catch {
      return null;
    }
  }
}

/**
 * Detect environment and return the appropriate FilePicker implementation.
 * Accepts an override for testability (dependency injection).
 */
export function createFilePicker(override?: FilePicker): FilePicker {
  if (override) return override;

  if (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  ) {
    return new TauriFilePicker();
  }

  return new WebFilePicker();
}
