/**
 * Storage barrel export.
 *
 * Binary .archc file codec (encode/decode) and file I/O operations.
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
