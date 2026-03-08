/**
 * Project module barrel exports.
 *
 * Provides folder scanning and file I/O for .archcanvas/-based
 * architecture projects.
 */

export { scanProjectFolder, readProjectFile, writeArchcToFolder, initArchcanvasDir } from './scanner';
export type { ScanResult } from './scanner';
export { FileLoaderService, LRUCache, FileNotFoundError, CircularReferenceError, CorruptedFileError } from './fileLoaderService';
export type { CachedFileEntry } from './fileLoaderService';
