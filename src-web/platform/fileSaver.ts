/**
 * Abstraction for file-save dialogs.
 * Mirrors FilePicker — environment-specific implementations for Tauri (native
 * save dialog) and Web (download via <a> link).
 */

export interface SaveFileOptions {
  /** Suggested file name (e.g. "diagram.png"). */
  defaultName: string;
  /** MIME type of the data being saved (e.g. "image/png"). */
  mimeType: string;
  /** File-type filters for native dialogs (e.g. [{ name: 'PNG', extensions: ['png'] }]). */
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FileSaver {
  /**
   * Save binary or text data to a user-chosen location.
   * Returns true if saved, false if the user cancelled.
   */
  saveFile(data: Blob | string, options: SaveFileOptions): Promise<boolean>;
}

/**
 * Web implementation — triggers a download via a hidden <a> element.
 * Always returns true because there's no cancel detection for downloads.
 */
class WebFileSaver implements FileSaver {
  async saveFile(data: Blob | string, options: SaveFileOptions): Promise<boolean> {
    const blob = typeof data === 'string'
      ? new Blob([data], { type: options.mimeType })
      : data;

    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = options.defaultName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      // Revoke after a small delay to ensure download initiates
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  }
}

/**
 * Tauri implementation — uses Tauri save-dialog + plugin-fs.
 */
class TauriFileSaver implements FileSaver {
  async saveFile(data: Blob | string, options: SaveFileOptions): Promise<boolean> {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: options.defaultName,
        filters: options.filters,
      });
      if (!filePath) return false; // user cancelled

      const { writeFile, writeTextFile } = await import('@tauri-apps/plugin-fs');

      if (typeof data === 'string') {
        await writeTextFile(filePath, data);
      } else {
        const buffer = new Uint8Array(await data.arrayBuffer());
        await writeFile(filePath, buffer);
      }
      return true;
    } catch (err) {
      console.error('[TauriFileSaver] Save failed:', err);
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Dependency injection for testing
// ---------------------------------------------------------------------------

let _override: FileSaver | null = null;

/**
 * Override the FileSaver implementation (for testing).
 * Pass null to restore auto-detection.
 */
export function setFileSaver(saver: FileSaver | null): void {
  _override = saver;
}

/**
 * Detect environment and return the appropriate FileSaver implementation.
 */
export function createFileSaver(): FileSaver {
  if (_override) return _override;

  if (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  ) {
    return new TauriFileSaver();
  }

  return new WebFileSaver();
}
