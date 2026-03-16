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
 * The @tauri-apps/plugin-dialog package is bundled into the frontend
 * and communicates with the Rust backend via __TAURI_INTERNALS__ IPC.
 */
class TauriFilePicker implements FilePicker {
  async pickDirectory(): Promise<FileSystem | null> {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, recursive: true });
      if (!selected || typeof selected !== 'string') return null;
      const { TauriFileSystem } = await import('./tauriFileSystem');
      return new TauriFileSystem(selected);
    } catch (err) {
      console.error('[TauriFilePicker] Dialog failed:', err);
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
