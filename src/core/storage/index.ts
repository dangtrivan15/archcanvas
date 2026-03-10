/**
 * Storage barrel export.
 *
 * Binary .archc file codec (encode/decode), file I/O operations,
 * storage backend abstraction, and StorageManager.
 */

// Codec
export { CodecError, IntegrityError, encode, decode, isArchcFile, readFormatVersion } from './codec';
export type { DecodeOptions } from './codec';

// File I/O
export type { UndoHistoryData, AIStateData, ProtoToGraphResult, PickedFile } from './fileIO';
export {
  protoToGraph,
  protoToGraphFull,
  graphToProto,
  decodeArchcData,
  pickArchcFile,
  openArchcFile,
  saveArchcFile,
  saveArchcFileAs,
  deriveSummaryFileName,
  saveSummaryMarkdown,
} from './fileIO';

// Storage backend abstraction
export type {
  StorageBackend,
  StorageHandle,
  StorageCapabilities,
  OpenPickerOptions,
  SavePickerOptions,
} from './types';

// StorageManager
export { StorageManager } from './storageManager';
export type { OpenResult, SaveOptions, SaveAsResult } from './storageManager';

// Backends
export { InMemoryBackend } from './backends/inMemory';
