/**
 * FileSystemAdapter — Platform-agnostic interface for file operations.
 *
 * Abstracts over the File System Access API (web/Chrome) and the
 * Capacitor Filesystem plugin (iOS native). All file I/O operations
 * in the app should go through this interface so the same coreStore
 * code works on both web and native platforms.
 *
 * Use getFileSystemAdapter() to obtain the correct implementation
 * for the current runtime platform.
 */

import { isNative } from './platformBridge';

// ─── Types ──────────────────────────────────────────────────────

/** Result of picking (opening) a file from the user. */
export interface PickFileResult {
  /** Raw binary content of the file. */
  data: Uint8Array;
  /** Display name of the file (e.g. "my-project.archc"). */
  name: string;
  /**
   * Opaque handle for save-in-place.
   * On web this is a FileSystemFileHandle; on native it may be a path string.
   */
  handle?: unknown;
}

/** Result of saving a file. */
export interface SaveFileResult {
  /**
   * Updated handle after save (same as input on web, may differ on native).
   */
  handle?: unknown;
}

/** Result of "Save As" — save to a new location chosen by the user. */
export interface SaveFileAsResult {
  /** Handle for future save-in-place calls. */
  handle?: unknown;
  /** The filename the user chose or was assigned. */
  fileName: string;
}

// ─── Interface ──────────────────────────────────────────────────

/**
 * Platform-agnostic file system adapter.
 *
 * Each method maps to a user-facing file operation:
 * - pickFile: "Open" dialog
 * - saveFile: "Save" (write to existing location)
 * - saveFileAs: "Save As" (choose new location)
 * - shareFile: Native share sheet / download fallback
 */
export interface FileSystemAdapter {
  /**
   * Show a file picker and return the selected file's raw bytes.
   * Returns null if the user cancels.
   */
  pickFile(): Promise<PickFileResult | null>;

  /**
   * Write binary data to an existing file location (save-in-place).
   * @param data - Raw binary data to write
   * @param handle - Opaque handle from a previous pickFile or saveFileAs
   */
  saveFile(data: Uint8Array, handle?: unknown): Promise<SaveFileResult>;

  /**
   * Show a "Save As" dialog and write binary data to the chosen location.
   * Returns null if the user cancels.
   * @param data - Raw binary data to write
   * @param suggestedName - Suggested filename (e.g. "my-project.archc")
   */
  saveFileAs(data: Uint8Array, suggestedName: string): Promise<SaveFileAsResult | null>;

  /**
   * Share or export a file (native share sheet on iOS, blob download on web).
   * @param data - File content (binary or text)
   * @param filename - Display filename for the shared file
   * @param mimeType - MIME type (e.g. "application/octet-stream", "text/markdown")
   */
  shareFile(data: Uint8Array | string, filename: string, mimeType: string): Promise<void>;
}

// ─── Factory ────────────────────────────────────────────────────

let _adapter: FileSystemAdapter | null = null;

/**
 * Returns the FileSystemAdapter for the current platform.
 *
 * - Web browser → WebFileSystemAdapter (File System Access API + Blob fallback)
 * - Capacitor iOS → NativeFileSystemAdapter (@capacitor/filesystem)
 *
 * The adapter is lazily created and cached for the lifetime of the app.
 */
export async function getFileSystemAdapter(): Promise<FileSystemAdapter> {
  if (_adapter) return _adapter;

  if (isNative()) {
    const { NativeFileSystemAdapter } = await import('./nativeFileSystemAdapter');
    _adapter = new NativeFileSystemAdapter();
  } else {
    const { WebFileSystemAdapter } = await import('./webFileSystemAdapter');
    _adapter = new WebFileSystemAdapter();
  }

  return _adapter;
}

/**
 * Reset the cached adapter (useful for testing).
 * @internal
 */
export function _resetFileSystemAdapter(): void {
  _adapter = null;
}
