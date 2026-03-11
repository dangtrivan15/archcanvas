/**
 * FileDownloadBackend — StorageBackend fallback for browsers without File System Access API.
 *
 * Uses <input type="file"> for opening and Blob download via <a> for saving.
 * Does NOT support save-in-place (every save triggers a download).
 * Does NOT report last-modified timestamps.
 *
 * This backend works in all modern browsers (Firefox, Safari, etc.).
 */

import type {
  StorageBackend,
  StorageHandle,
  StorageCapabilities,
  OpenPickerOptions,
  SavePickerOptions,
} from '../types';

// ─── FileDownloadBackend ──────────────────────────────────────────

export class FileDownloadBackend implements StorageBackend {
  readonly type = 'file-download';

  readonly capabilities: StorageCapabilities = {
    supportsDirectWrite: false,
    supportsLastModified: false,
  };

  // ── StorageBackend implementation ──────────────────────────────

  async read(handle: StorageHandle): Promise<Uint8Array> {
    const file = handle._internal as File;
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async write(handle: StorageHandle, data: Uint8Array): Promise<StorageHandle> {
    // No direct write support — trigger a download instead
    const fileName = handle.name || 'architecture.archc';
    this.downloadBlob(data, fileName);
    return handle;
  }

  async openFilePicker(_options?: OpenPickerOptions): Promise<StorageHandle | null> {
    return new Promise<StorageHandle | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.archc';

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        resolve(this.makeHandle(file));
      };

      // Handle cancel (no change event fires)
      input.addEventListener('cancel', () => resolve(null));

      input.click();
    });
  }

  async saveFilePicker(
    data: Uint8Array,
    options?: SavePickerOptions,
  ): Promise<StorageHandle | null> {
    const fileName = options?.suggestedName ?? 'architecture.archc';
    this.downloadBlob(data, fileName);

    // Create a synthetic File to serve as the handle
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const file = new File([blob], fileName, { type: 'application/octet-stream' });

    return this.makeHandle(file);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private makeHandle(file: File): StorageHandle {
    return {
      backend: this.type,
      name: file.name,
      _internal: file,
    };
  }

  /**
   * Download data as a file via a hidden <a> element.
   */
  private downloadBlob(data: Uint8Array, filename: string): void {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Delay cleanup so the browser has time to initiate the download
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }
}
