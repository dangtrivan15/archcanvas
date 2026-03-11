/**
 * InMemoryBackend — A StorageBackend that stores files in a Map.
 *
 * Designed for unit testing: no browser APIs, no filesystem, fully synchronous
 * storage with async interface conformance. Supports direct write (overwrite in
 * place) but not last-modified timestamps.
 *
 * Test helpers: seedFile(), getFile(), clear(), fileCount.
 */

import type {
  StorageBackend,
  StorageHandle,
  StorageCapabilities,
  OpenPickerOptions,
  SavePickerOptions,
} from '../types';

// ─── InMemoryBackend ─────────────────────────────────────────────

export class InMemoryBackend implements StorageBackend {
  readonly type = 'in-memory';

  readonly capabilities: StorageCapabilities = {
    supportsDirectWrite: true,
    supportsLastModified: false,
  };

  /** Internal storage: keyed by filename. */
  private files = new Map<string, Uint8Array>();

  /**
   * The filename that openFilePicker() will "select" next.
   * Set this before calling openFilePicker() in tests.
   * Resets to null after each pick.
   */
  nextPickFileName: string | null = null;

  /**
   * The filename that saveFilePicker() will "choose" next.
   * Set this before calling saveFilePicker() in tests.
   * Resets to null after each pick.
   */
  nextSaveFileName: string | null = null;

  // ── StorageBackend implementation ──────────────────────────────

  async read(handle: StorageHandle): Promise<Uint8Array> {
    const key = handle._internal as string;
    const data = this.files.get(key);
    if (!data) {
      throw new Error(`InMemoryBackend: file not found: "${key}"`);
    }
    // Return a copy so callers can't mutate internal state
    return new Uint8Array(data);
  }

  async write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    const key = handle._internal as string;
    // Store a copy so callers can't mutate internal state
    this.files.set(key, new Uint8Array(data));
    return handle;
  }

  async openFilePicker(_options?: OpenPickerOptions): Promise<StorageHandle | null> {
    const name = this.nextPickFileName;
    this.nextPickFileName = null;

    if (!name) return null;
    if (!this.files.has(name)) return null;

    return this.makeHandle(name);
  }

  async saveFilePicker(data: Uint8Array, _options?: SavePickerOptions): Promise<StorageHandle | null> {
    const name = this.nextSaveFileName;
    this.nextSaveFileName = null;

    if (!name) return null;

    // Store the data
    this.files.set(name, new Uint8Array(data));
    return this.makeHandle(name);
  }

  // ── Test Helpers ───────────────────────────────────────────────

  /**
   * Pre-populate a file in the in-memory store.
   * Useful for setting up test data before calling openArchitecture().
   */
  seedFile(name: string, data: Uint8Array): StorageHandle {
    this.files.set(name, new Uint8Array(data));
    return this.makeHandle(name);
  }

  /**
   * Retrieve a file's raw bytes (or undefined if not present).
   * Useful for verifying what was written after a save.
   */
  getFile(name: string): Uint8Array | undefined {
    const data = this.files.get(name);
    return data ? new Uint8Array(data) : undefined;
  }

  /** Remove all stored files. */
  clear(): void {
    this.files.clear();
    this.nextPickFileName = null;
    this.nextSaveFileName = null;
  }

  /** Number of stored files. */
  get fileCount(): number {
    return this.files.size;
  }

  // ── Internal ───────────────────────────────────────────────────

  private makeHandle(name: string): StorageHandle {
    return {
      backend: this.type,
      name,
      _internal: name,
    };
  }
}
