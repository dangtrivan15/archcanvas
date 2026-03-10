/**
 * FileSystemAccessBackend — StorageBackend for Chrome's File System Access API.
 *
 * Uses window.showOpenFilePicker / window.showSaveFilePicker for file dialogs,
 * and FileSystemFileHandle.createWritable() for direct write-in-place.
 *
 * Only works in browsers that support the File System Access API (Chrome/Edge).
 * For other browsers, use FileDownloadBackend as a fallback.
 */

import type {
  StorageBackend,
  StorageHandle,
  StorageCapabilities,
  OpenPickerOptions,
  SavePickerOptions,
} from '../types';

// ─── FileSystemAccessBackend ──────────────────────────────────────

export class FileSystemAccessBackend implements StorageBackend {
  readonly type = 'file-system-access';

  readonly capabilities: StorageCapabilities = {
    supportsDirectWrite: true,
    supportsLastModified: true,
  };

  // ── StorageBackend implementation ──────────────────────────────

  async read(handle: StorageHandle): Promise<Uint8Array> {
    const fsHandle = handle._internal as FileSystemFileHandle;
    const file = await fsHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    const fsHandle = handle._internal as FileSystemFileHandle;
    const writable = await fsHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return handle;
  }

  async openFilePicker(options?: OpenPickerOptions): Promise<StorageHandle | null> {
    try {
      const acceptTypes = this.buildAcceptTypes(options?.accept);
      const handles = await window.showOpenFilePicker({
        types: acceptTypes,
        excludeAcceptAllOption: false,
        multiple: false,
      });
      const fsHandle = handles[0];
      if (!fsHandle) return null;

      return this.makeHandle(fsHandle);
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  async saveFilePicker(
    data: Uint8Array,
    options?: SavePickerOptions,
  ): Promise<StorageHandle | null> {
    try {
      const fsHandle = await window.showSaveFilePicker({
        suggestedName: options?.suggestedName ?? 'architecture.archc',
        types: [
          {
            description: 'ArchCanvas Files',
            accept: { 'application/x-archcanvas': ['.archc'] },
          },
        ],
        excludeAcceptAllOption: false,
      });

      const writable = await fsHandle.createWritable();
      await writable.write(data);
      await writable.close();

      return this.makeHandle(fsHandle);
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private makeHandle(fsHandle: FileSystemFileHandle): StorageHandle {
    return {
      backend: this.type,
      name: fsHandle.name,
      _internal: fsHandle,
    };
  }

  /**
   * Build the accept types array for the file picker from extension strings.
   * Falls back to .archc if no extensions are provided.
   */
  private buildAcceptTypes(
    accept?: string[],
  ): Array<{ description: string; accept: Record<string, string[]> }> {
    if (!accept || accept.length === 0) {
      return [
        {
          description: 'ArchCanvas Files',
          accept: { 'application/x-archcanvas': ['.archc'] },
        },
      ];
    }

    return [
      {
        description: 'ArchCanvas Files',
        accept: { 'application/x-archcanvas': accept },
      },
    ];
  }
}
