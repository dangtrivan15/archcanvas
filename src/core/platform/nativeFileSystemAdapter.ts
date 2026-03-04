/**
 * NativeFileSystemAdapter — File operations for Capacitor iOS.
 *
 * Stub implementation that will be completed when the Capacitor
 * Filesystem plugin (@capacitor/filesystem) is integrated.
 *
 * On iOS, file operations use:
 * - Filesystem.readFile / Filesystem.writeFile for local storage
 * - Share plugin for sharing files via the native share sheet
 * - UIDocumentPickerViewController for file picking
 *
 * For now, all methods throw a descriptive error indicating that
 * the native implementation is pending. This ensures the factory
 * function works correctly and that accidental use surfaces clearly.
 */

import type {
  FileSystemAdapter,
  PickFileResult,
  SaveFileResult,
  SaveFileAsResult,
} from './fileSystemAdapter';

export class NativeFileSystemAdapter implements FileSystemAdapter {
  async pickFile(): Promise<PickFileResult | null> {
    throw new Error(
      'NativeFileSystemAdapter.pickFile() is not yet implemented. ' +
      'Install @capacitor/filesystem and implement iOS file picking.',
    );
  }

  async saveFile(_data: Uint8Array, _handle?: unknown): Promise<SaveFileResult> {
    throw new Error(
      'NativeFileSystemAdapter.saveFile() is not yet implemented. ' +
      'Install @capacitor/filesystem and implement iOS file saving.',
    );
  }

  async saveFileAs(_data: Uint8Array, _suggestedName: string): Promise<SaveFileAsResult | null> {
    throw new Error(
      'NativeFileSystemAdapter.saveFileAs() is not yet implemented. ' +
      'Install @capacitor/filesystem and implement iOS Save As.',
    );
  }

  async shareFile(
    _data: Uint8Array | string,
    _filename: string,
    _mimeType: string,
  ): Promise<void> {
    throw new Error(
      'NativeFileSystemAdapter.shareFile() is not yet implemented. ' +
      'Install @capacitor/share and implement iOS native sharing.',
    );
  }
}
