/**
 * Storage backend abstraction types.
 *
 * Defines a pluggable interface for reading/writing .archc binary data.
 * Backends handle raw I/O (file pickers, byte read/write) while the
 * StorageManager composes backends with the codec and proto conversion layers.
 *
 * This is a higher-level abstraction than FileSystemAdapter: backends own
 * the full open/save lifecycle including file pickers, whereas the adapter
 * is a thin platform shim for individual I/O operations.
 */

// ─── Storage Handle ──────────────────────────────────────────────

/**
 * Opaque reference to a storage location (file, blob, in-memory slot, etc.).
 * Each backend defines what `_internal` contains.
 */
export interface StorageHandle {
  /** Which backend produced this handle (matches StorageBackend.type). */
  readonly backend: string;
  /** Human-readable name (e.g. filename). */
  readonly name: string;
  /** Backend-specific data (FileSystemFileHandle, path string, key, etc.). */
  readonly _internal: unknown;
}

// ─── Picker Options ──────────────────────────────────────────────

/** Options for the "open file" picker. */
export interface OpenPickerOptions {
  /** Accepted file extensions, e.g. ['.archc']. */
  accept?: string[];
}

/** Options for the "save as" picker. */
export interface SavePickerOptions {
  /** Suggested filename for the save dialog. */
  suggestedName?: string;
}

// ─── Capabilities ────────────────────────────────────────────────

/** Declares what a backend can do, so the manager can adapt its behavior. */
export interface StorageCapabilities {
  /** Whether write() can overwrite a handle in-place (vs. always requiring a picker). */
  supportsDirectWrite: boolean;
  /** Whether the backend can report a file's last-modified timestamp. */
  supportsLastModified: boolean;
}

// ─── Backend Interface ───────────────────────────────────────────

/**
 * Pluggable storage backend for reading/writing raw binary data.
 *
 * Implementations:
 * - InMemoryBackend (testing)
 * - FileSystemBackend (web File System Access API) — future T2/T3
 * - NativeBackend (Capacitor filesystem) — future
 */
export interface StorageBackend {
  /** Unique identifier for this backend type (e.g. 'in-memory', 'file-system'). */
  readonly type: string;

  /** What this backend supports. */
  readonly capabilities: StorageCapabilities;

  /**
   * Read raw bytes from a storage location.
   * @throws if the handle is invalid or the data cannot be read.
   */
  read(handle: StorageHandle): Promise<Uint8Array>;

  /**
   * Write raw bytes to a storage location.
   * Returns the (possibly updated) handle for future reads/writes.
   * @throws if write is not supported or fails.
   */
  write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle>;

  /**
   * Show an "open file" picker and return a handle to the selected file.
   * Returns null if the user cancels.
   */
  openFilePicker(options?: OpenPickerOptions): Promise<StorageHandle | null>;

  /**
   * Show a "save as" picker, write the data, and return the new handle.
   * Returns null if the user cancels.
   */
  saveFilePicker(data: Uint8Array, options?: SavePickerOptions): Promise<StorageHandle | null>;
}
