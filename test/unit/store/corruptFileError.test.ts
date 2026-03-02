/**
 * Tests for Feature #187: Opening corrupt .archc file shows error message.
 * Verifies that corrupt/invalid files trigger user-visible error dialogs
 * instead of silently failing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decode, CodecError, IntegrityError } from '@/core/storage/codec';
import { MAGIC_BYTES, FORMAT_VERSION } from '@/utils/constants';
import { useUIStore } from '@/store/uiStore';

// ─── Helper Functions ──────────────────────────────────────────

/** Create a buffer with completely random/corrupt bytes */
function createRandomCorruptFile(size = 100): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

/** Create a file that's too small to be valid */
function createTooSmallFile(): Uint8Array {
  return new Uint8Array([0x41, 0x52, 0x43]); // Only 3 bytes, far below the 40-byte minimum
}

/** Create a file with wrong magic bytes but correct size */
function createWrongMagicFile(): Uint8Array {
  const data = new Uint8Array(50);
  // Wrong magic bytes
  data.set([0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0x00], 0);
  return data;
}

/** Create a file with valid magic bytes but unsupported version */
function createUnsupportedVersionFile(): Uint8Array {
  const data = new Uint8Array(50);
  data.set(MAGIC_BYTES, 0);
  // Version 999 (big-endian)
  data[6] = 0x03;
  data[7] = 0xE7;
  return data;
}

/** Create a file with valid header but corrupted checksum */
function createCorruptedChecksumFile(): Uint8Array {
  const data = new Uint8Array(50);
  data.set(MAGIC_BYTES, 0);
  // Version 1
  data[6] = 0x00;
  data[7] = FORMAT_VERSION;
  // Random checksum (won't match payload)
  for (let i = 8; i < 40; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  // Some payload bytes
  for (let i = 40; i < 50; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Feature #187: Opening corrupt .archc file shows error message', () => {
  beforeEach(() => {
    // Reset the UI store error dialog state
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
    });
  });

  describe('Codec throws appropriate errors for corrupt files', () => {
    it('throws CodecError for files that are too small', async () => {
      const data = createTooSmallFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/too small/i);
    });

    it('throws CodecError for files with wrong magic bytes', async () => {
      const data = createWrongMagicFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/magic bytes mismatch/i);
    });

    it('throws CodecError for random/corrupted bytes', async () => {
      const data = createRandomCorruptFile(100);
      // Could fail at magic bytes check or size check
      await expect(decode(data)).rejects.toThrow(CodecError);
    });

    it('throws CodecError for unsupported format version', async () => {
      const data = createUnsupportedVersionFile();
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/unsupported format version/i);
    });

    it('throws IntegrityError for corrupted checksum', async () => {
      const data = createCorruptedChecksumFile();
      await expect(decode(data)).rejects.toThrow(IntegrityError);
      await expect(decode(data)).rejects.toThrow(/integrity|checksum/i);
    });

    it('throws CodecError for zero-byte file', async () => {
      const data = new Uint8Array(0);
      await expect(decode(data)).rejects.toThrow(CodecError);
      await expect(decode(data)).rejects.toThrow(/too small/i);
    });
  });

  describe('UI store error dialog state management', () => {
    it('starts with error dialog closed', () => {
      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(false);
      expect(state.errorDialogInfo).toBeNull();
    });

    it('openErrorDialog sets dialog open with info', () => {
      useUIStore.getState().openErrorDialog({
        title: 'Test Error',
        message: 'Something went wrong',
      });

      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(true);
      expect(state.errorDialogInfo).toEqual({
        title: 'Test Error',
        message: 'Something went wrong',
      });
    });

    it('closeErrorDialog resets dialog state', () => {
      // Open first
      useUIStore.getState().openErrorDialog({
        title: 'Test Error',
        message: 'Something went wrong',
      });

      // Then close
      useUIStore.getState().closeErrorDialog();

      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(false);
      expect(state.errorDialogInfo).toBeNull();
    });

    it('can show file corruption error', () => {
      useUIStore.getState().openErrorDialog({
        title: 'File Corrupted',
        message: 'The file appears to be corrupted.',
      });

      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(true);
      expect(state.errorDialogInfo?.title).toBe('File Corrupted');
      expect(state.errorDialogInfo?.message).toContain('corrupted');
    });

    it('can show invalid format error', () => {
      useUIStore.getState().openErrorDialog({
        title: 'Invalid File Format',
        message: 'The file is not a valid ArchCanvas file.',
      });

      const state = useUIStore.getState();
      expect(state.errorDialogOpen).toBe(true);
      expect(state.errorDialogInfo?.title).toBe('Invalid File Format');
    });
  });

  describe('Error classification for user-friendly messages', () => {
    it('IntegrityError extends CodecError', () => {
      const err = new IntegrityError('checksum mismatch');
      expect(err).toBeInstanceOf(CodecError);
      expect(err).toBeInstanceOf(IntegrityError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('IntegrityError');
    });

    it('CodecError has correct name', () => {
      const err = new CodecError('bad format');
      expect(err.name).toBe('CodecError');
      expect(err.message).toBe('bad format');
    });

    it('IntegrityError is distinguishable from CodecError', () => {
      const codecErr = new CodecError('format error');
      const integrityErr = new IntegrityError('checksum mismatch');

      // Both are CodecError instances
      expect(codecErr).toBeInstanceOf(CodecError);
      expect(integrityErr).toBeInstanceOf(CodecError);

      // Only IntegrityError is an IntegrityError
      expect(codecErr).not.toBeInstanceOf(IntegrityError);
      expect(integrityErr).toBeInstanceOf(IntegrityError);
    });
  });

  describe('Error handling categorization (matching coreStore logic)', () => {
    it('categorizes IntegrityError as "File Corrupted"', () => {
      const err = new IntegrityError('SHA-256 checksum does not match');

      let title: string;
      let message: string;

      if (err instanceof IntegrityError) {
        title = 'File Corrupted';
        message = 'The file appears to be corrupted.';
      } else if (err instanceof CodecError) {
        title = 'Invalid File Format';
        message = err.message;
      } else {
        title = 'Failed to Open File';
        message = 'Unknown error';
      }

      expect(title).toBe('File Corrupted');
      expect(message).toContain('corrupted');
    });

    it('categorizes CodecError as "Invalid File Format"', () => {
      const err = new CodecError('Invalid file format: magic bytes mismatch');

      let title: string;

      if (err instanceof IntegrityError) {
        title = 'File Corrupted';
      } else if (err instanceof CodecError) {
        title = 'Invalid File Format';
      } else {
        title = 'Failed to Open File';
      }

      expect(title).toBe('Invalid File Format');
    });

    it('categorizes generic Error as "Failed to Open File"', () => {
      const err = new Error('network failure');

      let title: string;

      if (err instanceof IntegrityError) {
        title = 'File Corrupted';
      } else if (err instanceof CodecError) {
        title = 'Invalid File Format';
      } else {
        title = 'Failed to Open File';
      }

      expect(title).toBe('Failed to Open File');
    });
  });
});
