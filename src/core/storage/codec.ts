/**
 * Binary codec for .archc files.
 * Handles encoding/decoding with magic bytes, format version, and SHA-256 checksum.
 *
 * File binary layout:
 *   [magic: 6B "ARCHC\0"] [version: 2B uint16 BE] [sha256: 32B] [protobuf: NB]
 *
 * The SHA-256 hash is computed over the protobuf payload and stored in the binary
 * file header (between version and payload). On decode, the hash is verified by
 * recomputing over the payload bytes. The checksum is also set on the decoded
 * FileHeader.checksum_sha256 for metadata access.
 */

import { sha256 } from 'js-sha256';
import { ArchCanvasFile, FileHeader } from '@/proto/archcanvas';
import type { IArchCanvasFile } from '@/proto/archcanvas';
import { MAGIC_BYTES, FORMAT_VERSION } from '@/utils/constants';

// ─── Error Types ────────────────────────────────────────────────

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodecError';
  }
}

export class IntegrityError extends CodecError {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

// ─── Constants ──────────────────────────────────────────────────

/** Size of SHA-256 hash in bytes */
const SHA256_SIZE = 32;

/** Total byte length of the binary file header (magic + version + sha256) */
const HEADER_SIZE = MAGIC_BYTES.length + 2 + SHA256_SIZE; // 6 + 2 + 32 = 40 bytes

// ─── SHA-256 Helper ─────────────────────────────────────────────

/**
 * Compute SHA-256 hash of the given data.
 * Uses js-sha256 which works in all contexts (HTTP, HTTPS, Node.js, Capacitor).
 * No dependency on crypto.subtle or secure contexts.
 *
 * Note: This function is synchronous (unlike the async Web Crypto API).
 * The parent encode/decode functions remain async for API stability and
 * to allow a future migration to crypto.subtle if needed.
 */
function computeSha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(sha256.arrayBuffer(data));
}

// ─── Encode ─────────────────────────────────────────────────────

/**
 * Encode an ArchCanvasFile to the .archc binary format.
 *
 * 1. Ensure header has timestamps and version
 * 2. Encode to protobuf bytes (checksum_sha256 left empty)
 * 3. Compute SHA-256 of the protobuf bytes
 * 4. Build final binary: [magic][version][sha256][protobuf]
 *
 * @param file - The ArchCanvasFile to encode
 * @returns The complete .archc binary data
 */
export async function encode(file: IArchCanvasFile): Promise<Uint8Array> {
  // Ensure header exists with timestamps
  const now = Date.now();
  const header = file.header ? FileHeader.create(file.header) : FileHeader.create();

  if (!header.formatVersion) {
    header.formatVersion = FORMAT_VERSION;
  }
  if (!header.createdAtMs || Number(header.createdAtMs) === 0) {
    header.createdAtMs = now;
  }
  header.updatedAtMs = now;

  // Clear checksum from protobuf (it will be stored in the binary header)
  header.checksumSha256 = new Uint8Array(0);

  // Encode to protobuf bytes
  const fileToEncode: IArchCanvasFile = { ...file, header };
  const payload = ArchCanvasFile.encode(ArchCanvasFile.create(fileToEncode)).finish();

  // Compute SHA-256 of the protobuf payload
  const checksum = await computeSha256(payload);

  // Build final binary: [magic 6B][version 2B][sha256 32B][protobuf NB]
  const version = header.formatVersion ?? FORMAT_VERSION;
  const result = new Uint8Array(HEADER_SIZE + payload.length);

  // Write magic bytes (offset 0)
  result.set(MAGIC_BYTES, 0);

  // Write format version as uint16 big-endian (offset 6)
  const versionOffset = MAGIC_BYTES.length;
  result[versionOffset] = (version >> 8) & 0xff;
  result[versionOffset + 1] = version & 0xff;

  // Write SHA-256 checksum (offset 8)
  const checksumOffset = versionOffset + 2;
  result.set(checksum, checksumOffset);

  // Write protobuf payload (offset 40)
  result.set(payload, HEADER_SIZE);

  return result;
}

// ─── Decode ─────────────────────────────────────────────────────

/** Options for decoding behavior */
export interface DecodeOptions {
  /** If true, skip checksum verification (for debugging/recovery) */
  skipChecksumVerification?: boolean;
}

/**
 * Decode a .archc binary file back to an ArchCanvasFile.
 *
 * 1. Verify magic bytes
 * 2. Read format version
 * 3. Read stored SHA-256 checksum from binary header
 * 4. Extract protobuf payload
 * 5. Verify SHA-256 of payload matches stored checksum
 * 6. Decode protobuf
 * 7. Set checksum on decoded header for metadata access
 *
 * @param data - The raw .archc binary data
 * @param options - Optional decode settings
 * @returns The decoded ArchCanvasFile
 * @throws {CodecError} If magic bytes or format are invalid
 * @throws {IntegrityError} If checksum verification fails
 */
export async function decode(data: Uint8Array, options?: DecodeOptions): Promise<ArchCanvasFile> {
  // Validate minimum size
  if (data.length < HEADER_SIZE) {
    throw new CodecError(
      `File too small: expected at least ${HEADER_SIZE} bytes, got ${data.length}`,
    );
  }

  // Step 1: Verify magic bytes
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (data[i] !== MAGIC_BYTES[i]) {
      throw new CodecError(
        `Invalid file format: magic bytes mismatch at position ${i}. ` +
          `Expected 0x${MAGIC_BYTES[i]!.toString(16)}, got 0x${data[i]!.toString(16)}`,
      );
    }
  }

  // Step 2: Read format version (uint16 big-endian)
  const versionOffset = MAGIC_BYTES.length;
  const version = (data[versionOffset]! << 8) | data[versionOffset + 1]!;
  if (version > FORMAT_VERSION) {
    throw new CodecError(
      `Unsupported format version: ${version}. This file was created with a newer version of ArchCanvas. ` +
        `Please update ArchCanvas to the latest version to open this file. (Current max supported version: ${FORMAT_VERSION})`,
    );
  }

  // Step 3: Read stored SHA-256 checksum from binary header
  const checksumOffset = versionOffset + 2;
  const storedChecksum = data.slice(checksumOffset, checksumOffset + SHA256_SIZE);

  // Step 4: Extract protobuf payload
  const payload = data.slice(HEADER_SIZE);

  if (payload.length === 0) {
    throw new CodecError('File contains no protobuf payload (empty after header)');
  }

  // Step 5: Verify checksum (hash the payload bytes and compare)
  if (!options?.skipChecksumVerification) {
    const computedChecksum = await computeSha256(payload);

    if (storedChecksum.length !== computedChecksum.length) {
      throw new IntegrityError(
        `Checksum size mismatch: stored ${storedChecksum.length} bytes, computed ${computedChecksum.length} bytes`,
      );
    }
    for (let i = 0; i < computedChecksum.length; i++) {
      if (storedChecksum[i] !== computedChecksum[i]) {
        throw new IntegrityError(
          'File integrity check failed: SHA-256 checksum does not match. ' +
            'The file may be corrupted or tampered with.',
        );
      }
    }
  }

  // Step 6: Decode protobuf payload
  let decoded: ArchCanvasFile;
  try {
    decoded = ArchCanvasFile.decode(payload);
  } catch (err) {
    throw new CodecError(
      `Failed to decode protobuf payload: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Step 6b: Verify decoded message has valid field types
  const verifyError = ArchCanvasFile.verify(decoded as unknown as Record<string, unknown>);
  if (verifyError) {
    throw new CodecError(`Malformed protobuf data: ${verifyError}`);
  }

  // Step 7: Set checksum on decoded header for metadata access
  if (decoded.header) {
    decoded.header.checksumSha256 = storedChecksum;
  }

  return decoded;
}

// ─── Utility Functions ──────────────────────────────────────────

/**
 * Check if a file has valid .archc magic bytes without fully decoding.
 */
export function isArchcFile(data: Uint8Array): boolean {
  if (data.length < MAGIC_BYTES.length) return false;
  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (data[i] !== MAGIC_BYTES[i]) return false;
  }
  return true;
}

/**
 * Read the format version from a .archc binary without decoding.
 */
export function readFormatVersion(data: Uint8Array): number {
  if (data.length < HEADER_SIZE) {
    throw new CodecError(`File too small to read version: ${data.length} bytes`);
  }
  const versionOffset = MAGIC_BYTES.length;
  return (data[versionOffset]! << 8) | data[versionOffset + 1]!;
}
