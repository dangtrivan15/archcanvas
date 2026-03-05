/**
 * Tests for file format version validation on open - Feature #205.
 *
 * Verifies that:
 * - Files with future/unknown format versions are rejected
 * - Error message mentions the unsupported version number
 * - Error message suggests updating the application
 * - Files with the current format version are accepted
 * - Files with version 0 (less than current) are accepted
 * - App remains in a usable state after rejection
 */
import { describe, it, expect } from 'vitest';
import { decode, CodecError, readFormatVersion } from '@/core/storage/codec';
import { MAGIC_BYTES, FORMAT_VERSION } from '@/utils/constants';

/** Build a minimal .archc binary with a specific format version */
function buildWithVersion(version: number): Uint8Array {
  // Minimal file: magic(6) + version(2) + sha256(32) + empty protobuf
  // We need at least the header (40 bytes) to pass size validation
  const headerSize = MAGIC_BYTES.length + 2 + 32; // 40
  const data = new Uint8Array(headerSize + 2); // +2 for minimal protobuf (empty message)

  // Write magic bytes
  data.set(MAGIC_BYTES, 0);

  // Write version as uint16 big-endian
  const versionOffset = MAGIC_BYTES.length;
  data[versionOffset] = (version >> 8) & 0xff;
  data[versionOffset + 1] = version & 0xff;

  // SHA-256 and payload are zero-filled (will fail checksum, but we test version first)

  return data;
}

describe('File format version validation - Feature #205', () => {
  it('rejects files with format version 9999', async () => {
    const data = buildWithVersion(9999);
    await expect(decode(data)).rejects.toThrow(CodecError);
  });

  it('error message includes the unsupported version number', async () => {
    const data = buildWithVersion(9999);
    await expect(decode(data)).rejects.toThrow('9999');
  });

  it('error message mentions "update" to suggest upgrading', async () => {
    const data = buildWithVersion(9999);
    await expect(decode(data)).rejects.toThrow(/update/i);
  });

  it('error message mentions "newer version" of ArchCanvas', async () => {
    const data = buildWithVersion(9999);
    await expect(decode(data)).rejects.toThrow(/newer version/i);
  });

  it('error message includes the current max supported version', async () => {
    const data = buildWithVersion(9999);
    await expect(decode(data)).rejects.toThrow(String(FORMAT_VERSION));
  });

  it('rejects files with version FORMAT_VERSION + 1', async () => {
    const data = buildWithVersion(FORMAT_VERSION + 1);
    await expect(decode(data)).rejects.toThrow(CodecError);
    await expect(decode(data)).rejects.toThrow(/update/i);
  });

  it('rejects files with version 65535 (max uint16)', async () => {
    const data = buildWithVersion(65535);
    await expect(decode(data)).rejects.toThrow(CodecError);
    await expect(decode(data)).rejects.toThrow('65535');
  });

  it('rejects files with version 256', async () => {
    const data = buildWithVersion(256);
    await expect(decode(data)).rejects.toThrow(CodecError);
  });

  it('does NOT reject files with the current format version (checksum error expected instead)', async () => {
    // A file with the correct format version should pass the version check
    // but will fail on checksum verification (since we have dummy zeros)
    const data = buildWithVersion(FORMAT_VERSION);
    try {
      await decode(data);
      // If it somehow succeeds, that's fine too
    } catch (err) {
      // Should fail for checksum or protobuf reasons, NOT for version reasons
      expect((err as Error).message).not.toMatch(/Unsupported format version/);
    }
  });

  it('does NOT reject files with version 0', async () => {
    const data = buildWithVersion(0);
    try {
      await decode(data);
    } catch (err) {
      // Should fail for checksum/protobuf reasons, NOT for version
      expect((err as Error).message).not.toMatch(/Unsupported format version/);
    }
  });

  it('readFormatVersion correctly reads future version from binary', () => {
    const data = buildWithVersion(9999);
    expect(readFormatVersion(data)).toBe(9999);
  });

  it('readFormatVersion correctly reads current version', () => {
    const data = buildWithVersion(FORMAT_VERSION);
    expect(readFormatVersion(data)).toBe(FORMAT_VERSION);
  });

  it('the thrown error is an instance of CodecError', async () => {
    const data = buildWithVersion(9999);
    try {
      await decode(data);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CodecError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('version check happens before checksum verification', async () => {
    // Even with skipChecksumVerification, future version should still be rejected
    const data = buildWithVersion(9999);
    await expect(decode(data, { skipChecksumVerification: true })).rejects.toThrow(
      /Unsupported format version/,
    );
  });
});
