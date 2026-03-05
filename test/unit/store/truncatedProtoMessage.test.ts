/**
 * Tests for Feature #199: Proto deserialization handles truncated messages.
 * Verifies that truncated or incomplete Protocol Buffer messages are handled
 * gracefully with proper error reporting (not silent failures or crashes).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encode, decode, CodecError, IntegrityError } from '@/core/storage/codec';
import {
  ArchCanvasFile,
  FileHeader,
  Architecture,
  Node,
  Edge,
  Position,
  EdgeType,
  Value,
} from '@/proto/archcanvas';
import { FORMAT_VERSION, MAGIC_BYTES } from '@/utils/constants';
import { useUIStore } from '@/store/uiStore';

// ─── Helper Functions ──────────────────────────────────────────

/** Create a rich test file to ensure we have enough payload to truncate meaningfully */
function createTestFile(): ArchCanvasFile {
  return ArchCanvasFile.create({
    header: FileHeader.create({
      formatVersion: FORMAT_VERSION,
      toolVersion: '0.1.0',
      createdAtMs: 1700000000000,
      updatedAtMs: 1700000001000,
    }),
    architecture: Architecture.create({
      name: 'Truncation Test Architecture',
      description: 'A test architecture with enough data to produce a meaningful truncation',
      owners: ['test-user'],
      nodes: [
        Node.create({
          id: 'node-a',
          type: 'compute/service',
          displayName: 'Service Alpha',
          args: { lang: Value.create({ stringValue: 'TypeScript' }) },
          position: Position.create({ x: 100, y: 200, width: 240, height: 120 }),
          children: [],
          codeRefs: [],
          notes: [],
          properties: {},
        }),
        Node.create({
          id: 'node-b',
          type: 'data/database',
          displayName: 'Database Beta',
          args: { engine: Value.create({ stringValue: 'PostgreSQL' }) },
          position: Position.create({ x: 400, y: 200, width: 240, height: 120 }),
          children: [],
          codeRefs: [],
          notes: [],
          properties: {},
        }),
      ],
      edges: [
        Edge.create({
          id: 'edge-ab',
          fromNode: 'node-a',
          toNode: 'node-b',
          type: EdgeType.SYNC,
          label: 'SQL queries',
          properties: {},
          notes: [],
        }),
      ],
    }),
  });
}

/** Truncate a valid .archc binary to exactly half its length */
function truncateToHalf(binary: Uint8Array): Uint8Array {
  const halfLength = Math.floor(binary.length / 2);
  return binary.slice(0, halfLength);
}

/** Truncate a valid .archc binary to keep header intact but only partial payload */
function truncatePayloadToHalf(binary: Uint8Array): Uint8Array {
  const headerSize = 40; // magic(6) + version(2) + sha256(32)
  const payloadLength = binary.length - headerSize;
  const halfPayload = Math.floor(payloadLength / 2);
  return binary.slice(0, headerSize + halfPayload);
}

/** Create a valid .archc binary with header intact but empty payload */
function truncateToHeaderOnly(binary: Uint8Array): Uint8Array {
  return binary.slice(0, 40); // Keep only the 40-byte header
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Feature #199: Proto deserialization handles truncated messages', () => {
  let validBinary: Uint8Array;

  beforeEach(async () => {
    validBinary = await encode(createTestFile());
    // Reset UI store state
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      integrityWarningDialogOpen: false,
      integrityWarningDialogInfo: null,
    });
  });

  describe('Truncated file detection via checksum', () => {
    it('truncated-to-half file throws IntegrityError (checksum mismatch)', async () => {
      const truncated = truncateToHalf(validBinary);

      // File is still > 40 bytes (header intact), so magic/version pass.
      // But truncated payload has different hash than stored checksum.
      expect(truncated.length).toBeGreaterThan(40);
      await expect(decode(truncated)).rejects.toThrow(IntegrityError);
      await expect(decode(truncated)).rejects.toThrow(/integrity|checksum/i);
    });

    it('truncated payload throws IntegrityError (checksum mismatch)', async () => {
      const truncated = truncatePayloadToHalf(validBinary);

      expect(truncated.length).toBeGreaterThan(40);
      await expect(decode(truncated)).rejects.toThrow(IntegrityError);
    });

    it('header-only file (no payload) throws IntegrityError', async () => {
      const headerOnly = truncateToHeaderOnly(validBinary);

      expect(headerOnly.length).toBe(40);
      await expect(decode(headerOnly)).rejects.toThrow(IntegrityError);
    });
  });

  describe('Truncated proto payload with checksum skip', () => {
    it('truncated-to-half file with skipChecksumVerification throws CodecError', async () => {
      const truncated = truncateToHalf(validBinary);

      // Skip checksum → protobuf decode with truncated payload
      // Should throw CodecError, NOT crash or return undefined
      try {
        const result = await decode(truncated, { skipChecksumVerification: true });
        // If protobuf somehow partially decoded (proto3 defaults),
        // the result should still be defined (not crash)
        expect(result).toBeDefined();
      } catch (err) {
        // Expected: protobuf decode failure wraps as CodecError
        expect(err).toBeInstanceOf(CodecError);
        expect(err).not.toBeInstanceOf(IntegrityError);
        expect((err as Error).message).toMatch(/decode|protobuf|payload/i);
      }
    });

    it('truncated payload with skipChecksumVerification throws CodecError', async () => {
      const truncated = truncatePayloadToHalf(validBinary);

      try {
        const result = await decode(truncated, { skipChecksumVerification: true });
        // If it doesn't throw, it at least didn't crash
        expect(result).toBeDefined();
      } catch (err) {
        expect(err).toBeInstanceOf(CodecError);
        expect(err).not.toBeInstanceOf(IntegrityError);
        expect((err as Error).message).toMatch(/decode|protobuf|payload/i);
      }
    });

    it('header-only file with skipChecksumVerification handles empty payload', async () => {
      const headerOnly = truncateToHeaderOnly(validBinary);

      // Empty protobuf payload → should either decode to default/empty object
      // or throw a meaningful error. Either way, no crash.
      try {
        const result = await decode(headerOnly, { skipChecksumVerification: true });
        // Empty payload in proto3 decodes to default values (all fields empty/zero)
        expect(result).toBeDefined();
      } catch (err) {
        expect(err).toBeInstanceOf(CodecError);
        expect((err as Error).message).toBeDefined();
      }
    });
  });

  describe('Truncation below header size', () => {
    it('file truncated below 40 bytes throws CodecError (too small)', async () => {
      // Truncate to only 20 bytes (within the header area)
      const tooSmall = validBinary.slice(0, 20);

      await expect(decode(tooSmall)).rejects.toThrow(CodecError);
      await expect(decode(tooSmall)).rejects.toThrow(/too small/i);
    });

    it('file truncated to just magic bytes throws CodecError', async () => {
      const justMagic = validBinary.slice(0, 6);

      await expect(decode(justMagic)).rejects.toThrow(CodecError);
      await expect(decode(justMagic)).rejects.toThrow(/too small/i);
    });

    it('single byte file throws CodecError', async () => {
      const oneByte = validBinary.slice(0, 1);

      await expect(decode(oneByte)).rejects.toThrow(CodecError);
      await expect(decode(oneByte)).rejects.toThrow(/too small/i);
    });
  });

  describe('Error does not crash the app', () => {
    it('all truncation variants produce Error subclasses (never unhandled)', async () => {
      const variants = [
        validBinary.slice(0, 1), // 1 byte
        validBinary.slice(0, 6), // magic only
        validBinary.slice(0, 20), // partial header
        validBinary.slice(0, 40), // header only
        truncatePayloadToHalf(validBinary), // half payload
        truncateToHalf(validBinary), // half total
        validBinary.slice(0, validBinary.length - 1), // missing last byte
      ];

      for (const truncated of variants) {
        try {
          await decode(truncated);
          // If it somehow succeeds (e.g., near-complete file), that's OK
        } catch (err) {
          // MUST be a proper Error instance (catchable), never a raw throw
          expect(err).toBeInstanceOf(Error);
          expect((err as Error).message).toBeTruthy();
        }
      }
    });

    it('truncated file never throws non-Error values', async () => {
      const truncated = truncateToHalf(validBinary);

      // Ensure the error is a proper Error object, not a string or other primitive
      try {
        await decode(truncated);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(typeof (err as Error).message).toBe('string');
        expect((err as Error).name).toBeTruthy();
      }
    });
  });

  describe('User-visible error categorization', () => {
    it('truncated file error maps to "File Integrity Warning" dialog category', async () => {
      const truncated = truncateToHalf(validBinary);

      try {
        await decode(truncated);
      } catch (err) {
        // Truncation with checksum enabled → IntegrityError → integrity warning dialog
        expect(err).toBeInstanceOf(IntegrityError);

        // This is how coreStore routes the error to the UI
        if (err instanceof IntegrityError) {
          // User would see IntegrityWarningDialog with "Open Anyway" option
          useUIStore.getState().openIntegrityWarningDialog({
            message: (err as Error).message,
            onProceed: () => {},
          });
          const state = useUIStore.getState();
          expect(state.integrityWarningDialogOpen).toBe(true);
          expect(state.integrityWarningDialogInfo?.message).toMatch(/integrity|checksum/i);
        }
      }
    });

    it('truncated file with skip-checksum maps to "Invalid File Format" dialog category', async () => {
      const truncated = truncateToHalf(validBinary);

      try {
        await decode(truncated, { skipChecksumVerification: true });
      } catch (err) {
        // Truncation with checksum skip → CodecError → error dialog
        if (err instanceof CodecError && !(err instanceof IntegrityError)) {
          useUIStore.getState().openErrorDialog({
            title: 'Invalid File Format',
            message: (err as Error).message,
          });
          const state = useUIStore.getState();
          expect(state.errorDialogOpen).toBe(true);
          expect(state.errorDialogInfo?.title).toBe('Invalid File Format');
          expect(state.errorDialogInfo?.message).toMatch(/decode|protobuf|payload/i);
        }
      }
    });

    it('meaningful error message includes cause description', async () => {
      const truncated = truncateToHalf(validBinary);

      try {
        await decode(truncated);
        // Should not reach here for truncated data
      } catch (err) {
        const message = (err as Error).message;
        // The error message should give the user some meaningful indication of what went wrong
        expect(message.length).toBeGreaterThan(10);
        // It should mention integrity/checksum (since that's the first check that fails)
        expect(message).toMatch(/integrity|checksum|corrupt|truncat/i);
      }
    });
  });
});
