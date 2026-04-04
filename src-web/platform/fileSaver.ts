/**
 * Abstraction for file save dialogs.
 * Mirrors the FilePicker pattern — detects environment and provides
 * the appropriate implementation (Web File System Access API / `<a>` fallback / Tauri).
 */

export interface FileSaveOptions {
  /** Suggested file name (e.g. "architecture.png") */
  defaultName: string;
  /** MIME type of the data being saved */
  mimeType: string;
  /** File extension filters for save dialogs */
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FileSaver {
  /** Save a Blob to a user-chosen location. Returns true if saved, false if cancelled. */
  saveBlob(blob: Blob, options: FileSaveOptions): Promise<boolean>;
  /** Save a UTF-8 string to a user-chosen location. Returns true if saved, false if cancelled. */
  saveText(text: string, options: FileSaveOptions): Promise<boolean>;
}

/**
 * Web implementation — uses the File System Access API's showSaveFilePicker(),
 * with an `<a download>` fallback for browsers that don't support it (e.g. Firefox).
 */
class WebFileSaver implements FileSaver {
  async saveBlob(blob: Blob, options: FileSaveOptions): Promise<boolean> {
    // Try File System Access API first
    if ('showSaveFilePicker' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: options.defaultName,
          types: options.filters?.map((f) => ({
            description: f.name,
            accept: { [options.mimeType]: f.extensions.map((e) => `.${e}`) },
          })),
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch {
        // User cancelled (AbortError) or API error
        return false;
      }
    }

    // Fallback: <a download> trick
    return this.downloadViaAnchor(blob, options.defaultName);
  }

  async saveText(text: string, options: FileSaveOptions): Promise<boolean> {
    const blob = new Blob([text], { type: options.mimeType });
    return this.saveBlob(blob, options);
  }

  private downloadViaAnchor(blob: Blob, filename: string): boolean {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return true;
  }
}

/**
 * Tauri implementation — uses Tauri dialog + fs APIs.
 */
class TauriFileSaver implements FileSaver {
  async saveBlob(blob: Blob, options: FileSaveOptions): Promise<boolean> {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: options.defaultName,
        filters: options.filters,
      });
      if (!path) return false;

      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const buffer = new Uint8Array(await blob.arrayBuffer());
      await writeFile(path, buffer);
      return true;
    } catch (err) {
      console.error('[TauriFileSaver] Save failed:', err);
      return false;
    }
  }

  async saveText(text: string, options: FileSaveOptions): Promise<boolean> {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: options.defaultName,
        filters: options.filters,
      });
      if (!path) return false;

      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, text);
      return true;
    } catch (err) {
      console.error('[TauriFileSaver] Save failed:', err);
      return false;
    }
  }
}

/**
 * Detect environment and return the appropriate FileSaver implementation.
 * Accepts an override for testability (dependency injection).
 */
export function createFileSaver(override?: FileSaver): FileSaver {
  if (override) return override;

  if (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  ) {
    return new TauriFileSaver();
  }

  return new WebFileSaver();
}
