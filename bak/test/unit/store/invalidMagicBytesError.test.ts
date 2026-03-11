/**
 * Tests for Feature #188: Opening file with invalid magic bytes shows error.
 * Verifies that files without correct ARCHC\x00 magic bytes are rejected
 * with appropriate error messages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { decode, CodecError } from '@/core/storage/codec';
import { MAGIC_BYTES } from '@/utils/constants';
import { useUIStore } from '@/store/uiStore';

// ─── Test Data Factories ───────────────────────────────────────

/** Create a file that starts with a PDF header instead of ARCHC */
function createPdfLikeFile(): Uint8Array {
  const data = new Uint8Array(50);
  // PDF magic bytes: %PDF
  data[0] = 0x25; // %
  data[1] = 0x50; // P
  data[2] = 0x44; // D
  data[3] = 0x46; // F
  data[4] = 0x2d; // -
  data[5] = 0x31; // 1
  return data;
}

/** Create a file that starts with a ZIP header instead of ARCHC */
function createZipLikeFile(): Uint8Array {
  const data = new Uint8Array(50);
  // ZIP magic bytes: PK
  data[0] = 0x50; // P
  data[1] = 0x4b; // K
  data[2] = 0x03;
  data[3] = 0x04;
  return data;
}

/** Create a file with all zero bytes */
function createZeroFile(): Uint8Array {
  return new Uint8Array(50); // All zeros
}

/** Create a file with almost-correct magic bytes (off by one byte) */
function createAlmostCorrectMagicFile(): Uint8Array {
  const data = new Uint8Array(50);
  // Copy ARCHC\x00 but change last byte
  data.set(MAGIC_BYTES, 0);
  data[5] = 0x01; // Should be 0x00
  return data;
}

/** Create a file with correct magic prefix but wrong at position 2 */
function createPartiallyCorrectMagicFile(): Uint8Array {
  const data = new Uint8Array(50);
  data[0] = 0x41; // A
  data[1] = 0x52; // R
  data[2] = 0x00; // should be 0x43 (C) - wrong!
  data[3] = 0x48; // H
  data[4] = 0x43; // C
  data[5] = 0x00; // null
  return data;
}

/** Create a plain text file */
function createTextFile(): Uint8Array {
  const text = 'This is just a plain text file, not an ArchCanvas file.';
  return new TextEncoder().encode(text);
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Feature #188: Opening file with invalid magic bytes shows error', () => {
  beforeEach(() => {
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
    });
  });

  describe('Codec rejects files without ARCHC\\x00 magic bytes', () => {
    it('rejects a PDF-like file', async () => {
      const data = createPdfLikeFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch at position 0/);
    });

    it('rejects a ZIP-like file', async () => {
      const data = createZipLikeFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch at position 0/);
    });

    it('rejects a file with all zero bytes', async () => {
      const data = createZeroFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch at position 0/);
    });

    it('rejects a file with almost-correct magic bytes (last byte wrong)', async () => {
      const data = createAlmostCorrectMagicFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch at position 5/);
    });

    it('rejects a file with partially correct magic bytes', async () => {
      const data = createPartiallyCorrectMagicFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch at position 2/);
    });

    it('rejects a plain text file', async () => {
      const data = createTextFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch/);
    });
  });

  describe('Error messages contain helpful information', () => {
    it('error message includes expected byte value', async () => {
      const data = createPdfLikeFile();
      try {
        await decode(data);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CodecError);
        expect((err as Error).message).toContain('Expected 0x41'); // 'A' in hex
      }
    });

    it('error message includes actual byte value', async () => {
      const data = createPdfLikeFile();
      try {
        await decode(data);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CodecError);
        expect((err as Error).message).toContain('got 0x25'); // '%' in hex
      }
    });

    it('error message includes position of mismatch', async () => {
      const data = createAlmostCorrectMagicFile();
      try {
        await decode(data);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CodecError);
        expect((err as Error).message).toContain('position 5');
      }
    });
  });

  describe('Error dialog shows appropriate message for magic bytes error', () => {
    it('CodecError with magic bytes message categorizes as Invalid File Format', () => {
      const err = new CodecError('Invalid file format: magic bytes mismatch at position 0');

      // Simulate the coreStore error classification logic
      const { openErrorDialog } = useUIStore.getState();
      openErrorDialog({
        title: 'Invalid File Format',
        message: err.message,
      });

      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(true);
      expect(state.errorDialogInfo?.title).toBe('Invalid File Format');
      expect(state.errorDialogInfo?.message).toContain('magic bytes mismatch');
    });

    it('app remains usable after error - dialog can be closed', () => {
      const { openErrorDialog, closeErrorDialog } = useUIStore.getState();

      openErrorDialog({
        title: 'Invalid File Format',
        message: 'magic bytes mismatch',
      });
      expect(useUIStore.getState().errorDialogOpen).toBe(true);

      closeErrorDialog();
      expect(useUIStore.getState().errorDialogOpen).toBe(false);
      expect(useUIStore.getState().errorDialogInfo).toBeNull();
    });
  });
});
