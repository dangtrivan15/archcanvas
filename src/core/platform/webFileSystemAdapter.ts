/**
 * WebFileSystemAdapter — File operations for web browsers.
 *
 * Uses the File System Access API (Chrome/Edge) for save-in-place,
 * with graceful fallbacks for other browsers:
 * - Open: showOpenFilePicker → hidden <input type="file">
 * - Save: FileSystemFileHandle.createWritable → Blob download
 * - Save As: showSaveFilePicker → Blob download
 * - Share: navigator.share (Web Share API) → Blob download
 *
 * This adapter extracts the raw file I/O logic that was previously
 * inlined in fileIO.ts, making it swappable with NativeFileSystemAdapter.
 */

import type {
  FileSystemAdapter,
  PickFileResult,
  SaveFileResult,
  SaveFileAsResult,
} from './fileSystemAdapter';

export class WebFileSystemAdapter implements FileSystemAdapter {
  // ─── Pick File (Open) ───────────────────────────────────────

  async pickFile(): Promise<PickFileResult | null> {
    // Try File System Access API first (Chrome/Edge)
    if (this.hasFileSystemAccess()) {
      return this.pickFileViaFSA();
    }
    // Fallback: hidden <input type="file">
    return this.pickFileViaInput();
  }

  // ─── Save File (Save in-place) ─────────────────────────────

  async saveFile(data: Uint8Array, handle?: unknown): Promise<SaveFileResult> {
    const fileHandle = handle as FileSystemFileHandle | undefined;

    if (fileHandle && this.hasFileSystemAccess()) {
      // Write directly to the existing file handle
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return { handle: fileHandle };
    }

    // No handle or no File System Access API — trigger a download
    this.downloadBlob(data, 'architecture.archc', 'application/octet-stream');
    return {};
  }

  // ─── Save File As ──────────────────────────────────────────

  async saveFileAs(data: Uint8Array, suggestedName: string): Promise<SaveFileAsResult | null> {
    if (this.hasFileSystemAccess()) {
      return this.saveFileAsViaFSA(data, suggestedName);
    }
    // Fallback: Blob download
    this.downloadBlob(data, suggestedName, 'application/octet-stream');
    return { fileName: suggestedName };
  }

  // ─── Share File ────────────────────────────────────────────

  async shareFile(data: Uint8Array | string, filename: string, mimeType: string): Promise<void> {
    const blob = data instanceof Uint8Array
      ? new Blob([data], { type: mimeType })
      : new Blob([data], { type: mimeType });

    // Try Web Share API if available
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: mimeType });
      const shareData = { files: [file] };
      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          // User cancelled or share failed — fall through to download
          if (err instanceof DOMException && err.name === 'AbortError') {
            return; // User cancelled — don't download
          }
        }
      }
    }

    // Fallback: Blob download
    this.downloadBlob(blob, filename, mimeType);
  }

  // ─── Internal Helpers ──────────────────────────────────────

  /** Check if the File System Access API is available. */
  private hasFileSystemAccess(): boolean {
    return 'showOpenFilePicker' in window;
  }

  /** Pick a file using the File System Access API. */
  private async pickFileViaFSA(): Promise<PickFileResult | null> {
    try {
      const handles = await window.showOpenFilePicker({
        types: [
          {
            description: 'ArchCanvas Files',
            accept: { 'application/octet-stream': ['.archc'] },
          },
        ],
        multiple: false,
      });
      const handle = handles[0];
      if (!handle) return null;

      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      return {
        data: new Uint8Array(buffer),
        name: file.name,
        handle,
      };
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /** Pick a file using a hidden <input type="file"> element. */
  private pickFileViaInput(): Promise<PickFileResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.archc';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const buffer = await file.arrayBuffer();
        resolve({
          data: new Uint8Array(buffer),
          name: file.name,
        });
      };

      // Handle cancel (no change event fires)
      input.addEventListener('cancel', () => resolve(null));

      input.click();
    });
  }

  /** Save As using the File System Access API. */
  private async saveFileAsViaFSA(
    data: Uint8Array,
    suggestedName: string,
  ): Promise<SaveFileAsResult | null> {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'ArchCanvas Files',
            accept: { 'application/octet-stream': ['.archc'] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();

      return {
        handle,
        fileName: handle.name,
      };
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /** Download data as a file via a hidden <a> element. */
  private downloadBlob(
    data: Uint8Array | Blob | string,
    filename: string,
    mimeType: string,
  ): void {
    const blob = data instanceof Blob
      ? data
      : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
