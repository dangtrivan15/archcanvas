/**
 * NodeFileSystemAdapter — File operations for Node.js CLI/server environments.
 *
 * Implements the FileSystemAdapter interface using the Node.js `fs` module
 * for reading/writing .archc binary files from disk. This adapter is the
 * foundation for all CLI and MCP server features.
 *
 * Unlike the WebFileSystemAdapter (browser) and NativeFileSystemAdapter (iOS),
 * this adapter operates on file paths directly — there are no file pickers
 * or share sheets in a CLI context.
 *
 * Usage:
 *   const adapter = new NodeFileSystemAdapter('/path/to/file.archc');
 *   const result = await adapter.pickFile(); // reads from constructor path
 *   await adapter.saveFile(data, '/path/to/file.archc'); // handle = file path
 *
 * The `handle` in this adapter is always a string file path.
 */

import type {
  FileSystemAdapter,
  PickFileResult,
  SaveFileResult,
  SaveFileAsResult,
} from './fileSystemAdapter';

// ─── Error Types ──────────────────────────────────────────────

/**
 * Error thrown when a file operation fails in the Node.js adapter.
 */
export class NodeFileSystemError extends Error {
  /** The original system error code (e.g. 'ENOENT', 'EACCES') */
  readonly code?: string;
  /** The file path that caused the error */
  readonly filePath?: string;

  constructor(message: string, code?: string, filePath?: string) {
    super(message);
    this.name = 'NodeFileSystemError';
    this.code = code;
    this.filePath = filePath;
  }
}

// ─── Adapter ──────────────────────────────────────────────────

export class NodeFileSystemAdapter implements FileSystemAdapter {
  private readonly filePath?: string;

  /**
   * Create a Node.js file system adapter.
   *
   * @param filePath - Optional default file path for pickFile().
   *   If not provided, pickFile() returns null (no file to open).
   *   This is typically the .archc file path passed via CLI argument.
   */
  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  // ─── Pick File (Open) ───────────────────────────────────────

  /**
   * Read a file from the filesystem.
   *
   * In CLI context, there is no file picker dialog. Instead, this reads
   * from the file path provided in the constructor.
   * Returns null if no path was provided.
   *
   * @returns The file contents as a PickFileResult, or null
   */
  async pickFile(): Promise<PickFileResult | null> {
    if (!this.filePath) return null;
    return this.readFile(this.filePath);
  }

  /**
   * Read a specific file by path.
   *
   * This is the primary way to load .archc files in CLI/server contexts.
   * Provides richer error handling than the generic pickFile() interface.
   *
   * @param filePath - Absolute or relative path to the file
   * @returns The file contents as a PickFileResult
   * @throws {NodeFileSystemError} If the file cannot be read
   */
  async readFile(filePath: string): Promise<PickFileResult> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const resolvedPath = path.resolve(filePath);

    try {
      const buffer = await fs.readFile(resolvedPath);
      const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const name = path.basename(resolvedPath);

      return {
        data,
        name,
        handle: resolvedPath,
      };
    } catch (err) {
      throw this.wrapError(err, resolvedPath);
    }
  }

  // ─── Save File (Save in-place) ─────────────────────────────

  /**
   * Write binary data to an existing file location.
   *
   * The `handle` parameter is a string file path. If no handle is provided,
   * falls back to the constructor path. Throws if neither is available.
   *
   * @param data - Raw binary data to write
   * @param handle - File path string (from a previous pickFile or saveFileAs)
   * @returns The save result with the file path as handle
   * @throws {NodeFileSystemError} If the file cannot be written
   */
  async saveFile(data: Uint8Array, handle?: unknown): Promise<SaveFileResult> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const filePath = (handle as string | undefined) ?? this.filePath;
    if (!filePath) {
      throw new NodeFileSystemError(
        'No file path specified for save. Provide a handle or construct the adapter with a path.',
      );
    }

    const resolvedPath = path.resolve(filePath);

    try {
      // Ensure parent directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(resolvedPath, data);
      return { handle: resolvedPath };
    } catch (err) {
      throw this.wrapError(err, resolvedPath);
    }
  }

  // ─── Save File As ──────────────────────────────────────────

  /**
   * Write binary data to a new file path.
   *
   * In CLI context, there is no "Save As" dialog. The `suggestedName`
   * is used as the file path. If it's just a filename (no directory),
   * the file is written to the current working directory.
   *
   * @param data - Raw binary data to write
   * @param suggestedName - File path or filename for the new file
   * @returns The save result with file path and name
   * @throws {NodeFileSystemError} If the file cannot be written
   */
  async saveFileAs(data: Uint8Array, suggestedName: string): Promise<SaveFileAsResult | null> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const resolvedPath = path.resolve(suggestedName);

    try {
      // Ensure parent directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(resolvedPath, data);

      return {
        handle: resolvedPath,
        fileName: path.basename(resolvedPath),
      };
    } catch (err) {
      throw this.wrapError(err, resolvedPath);
    }
  }

  // ─── Share File ────────────────────────────────────────────

  /**
   * Write a file to disk (no share sheet in CLI context).
   *
   * In the browser, shareFile opens a share sheet or downloads.
   * In CLI context, it simply writes the file to disk at the given filename.
   *
   * @param data - File content (binary or text)
   * @param filename - Output filename or path
   * @param _mimeType - MIME type (unused in Node.js context)
   */
  async shareFile(data: Uint8Array | string, filename: string, _mimeType: string): Promise<void> {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');

    const resolvedPath = path.resolve(filename);

    try {
      // Ensure parent directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });

      if (typeof data === 'string') {
        await fs.writeFile(resolvedPath, data, 'utf-8');
      } else {
        await fs.writeFile(resolvedPath, data);
      }
    } catch (err) {
      throw this.wrapError(err, resolvedPath);
    }
  }

  // ─── Convenience Methods ──────────────────────────────────

  /**
   * Check if a file exists at the given path.
   *
   * @param filePath - Path to check
   * @returns true if the file exists and is readable
   */
  async fileExists(filePath: string): Promise<boolean> {
    const { promises: fs, constants } = await import('node:fs');
    const path = await import('node:path');

    try {
      await fs.access(path.resolve(filePath), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────

  /**
   * Wrap a Node.js filesystem error into a NodeFileSystemError with
   * a user-friendly message.
   */
  private wrapError(err: unknown, filePath: string): NodeFileSystemError {
    if (err instanceof NodeFileSystemError) return err;

    const code = (err as NodeJS.ErrnoException)?.code;

    switch (code) {
      case 'ENOENT':
        return new NodeFileSystemError(`File not found: ${filePath}`, code, filePath);
      case 'EACCES':
      case 'EPERM':
        return new NodeFileSystemError(`Permission denied: ${filePath}`, code, filePath);
      case 'EISDIR':
        return new NodeFileSystemError(
          `Path is a directory, expected a file: ${filePath}`,
          code,
          filePath,
        );
      case 'ENOSPC':
        return new NodeFileSystemError(
          `No space left on device while writing: ${filePath}`,
          code,
          filePath,
        );
      default:
        return new NodeFileSystemError(
          `File operation failed: ${err instanceof Error ? err.message : String(err)}`,
          code,
          filePath,
        );
    }
  }
}
