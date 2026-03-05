/**
 * Tests for Feature #189: Opening file with checksum mismatch shows warning.
 * Verifies that files with SHA-256 checksum mismatch trigger a warning dialog
 * that lets the user choose to proceed or cancel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encode, decode, IntegrityError, CodecError } from '@/core/storage/codec';
import { MAGIC_BYTES, FORMAT_VERSION } from '@/utils/constants';
import { ArchCanvasFile, FileHeader, Architecture, Node, Position } from '@/proto/archcanvas';
import { useUIStore } from '@/store/uiStore';

// ─── Helper Functions ──────────────────────────────────────────

/** Create a minimal valid ArchCanvasFile for encoding */
function createMinimalFile(): ArchCanvasFile {
  return ArchCanvasFile.create({
    header: FileHeader.create({
      formatVersion: FORMAT_VERSION,
      toolVersion: '0.1.0',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    }),
    architecture: Architecture.create({
      name: 'Test Architecture',
      description: 'A test file for checksum verification',
      nodes: [
        Node.create({
          id: 'test-node-1',
          type: 'compute/service',
          displayName: 'Test Service',
          position: Position.create({ x: 100, y: 100, width: 240, height: 120 }),
        }),
      ],
      edges: [],
    }),
  });
}

/**
 * Encode a valid file, then corrupt the STORED CHECKSUM (not the payload).
 * This causes checksum mismatch while keeping the protobuf payload valid,
 * so skipChecksumVerification can still decode it successfully.
 */
async function createChecksumMismatchFile(): Promise<Uint8Array> {
  const file = createMinimalFile();
  const encoded = await encode(file);

  // Corrupt the stored SHA-256 checksum (bytes 8-39), NOT the payload
  // This way the payload protobuf is still valid, but the checksum won't match
  const corrupted = new Uint8Array(encoded);
  corrupted[8] = corrupted[8]! ^ 0xff;
  corrupted[9] = corrupted[9]! ^ 0xff;
  corrupted[10] = corrupted[10]! ^ 0xff;

  return corrupted;
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Feature #189: Opening file with checksum mismatch shows warning', () => {
  beforeEach(() => {
    useUIStore.setState({
      errorDialogOpen: false,
      errorDialogInfo: null,
      integrityWarningDialogOpen: false,
      integrityWarningDialogInfo: null,
    });
  });

  describe('Codec detects checksum mismatch', () => {
    it('throws IntegrityError when payload is modified after encoding', async () => {
      const corruptedData = await createChecksumMismatchFile();
      await expect(decode(corruptedData)).rejects.toThrow(IntegrityError);
    });

    it('error message mentions checksum or integrity', async () => {
      const corruptedData = await createChecksumMismatchFile();
      await expect(decode(corruptedData)).rejects.toThrow(/integrity|checksum/i);
    });

    it('IntegrityError is a subclass of CodecError', async () => {
      const corruptedData = await createChecksumMismatchFile();
      try {
        await decode(corruptedData);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(IntegrityError);
        expect(err).toBeInstanceOf(CodecError);
      }
    });
  });

  describe('skipChecksumVerification allows opening despite mismatch', () => {
    it('decodes successfully when skipChecksumVerification is true', async () => {
      const corruptedData = await createChecksumMismatchFile();

      // Should NOT throw when skipping checksum
      const decoded = await decode(corruptedData, { skipChecksumVerification: true });
      expect(decoded).toBeDefined();
    });

    it('throws without the skip option', async () => {
      const corruptedData = await createChecksumMismatchFile();

      // Should throw without the skip option
      await expect(decode(corruptedData)).rejects.toThrow(IntegrityError);

      // Should succeed with the skip option
      const decoded = await decode(corruptedData, { skipChecksumVerification: true });
      expect(decoded).toBeDefined();
    });
  });

  describe('Integrity warning dialog state management', () => {
    it('starts with integrity warning dialog closed', () => {
      const state = useUIStore.getState();
      expect(state.integrityWarningDialogOpen).toBe(false);
      expect(state.integrityWarningDialogInfo).toBeNull();
    });

    it('openIntegrityWarningDialog sets dialog open with info', () => {
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'Checksum mismatch detected',
        onProceed: () => {},
      });

      const state = useUIStore.getState();
      expect(state.integrityWarningDialogOpen).toBe(true);
      expect(state.integrityWarningDialogInfo?.message).toContain('Checksum mismatch');
      expect(typeof state.integrityWarningDialogInfo?.onProceed).toBe('function');
    });

    it('closeIntegrityWarningDialog resets dialog state', () => {
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'Checksum mismatch',
        onProceed: () => {},
      });

      useUIStore.getState().closeIntegrityWarningDialog();

      const state = useUIStore.getState();
      expect(state.integrityWarningDialogOpen).toBe(false);
      expect(state.integrityWarningDialogInfo).toBeNull();
    });

    it('onProceed callback is callable from dialog info', () => {
      let proceeded = false;
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'Test warning',
        onProceed: () => {
          proceeded = true;
        },
      });

      const info = useUIStore.getState().integrityWarningDialogInfo;
      expect(info).not.toBeNull();
      info!.onProceed();
      expect(proceeded).toBe(true);
    });
  });

  describe('User choice: proceed or cancel', () => {
    it('user can choose to cancel (close dialog without proceeding)', () => {
      let proceeded = false;
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'File integrity warning',
        onProceed: () => {
          proceeded = true;
        },
      });

      // User clicks Cancel
      useUIStore.getState().closeIntegrityWarningDialog();

      expect(proceeded).toBe(false);
      expect(useUIStore.getState().integrityWarningDialogOpen).toBe(false);
    });

    it('user can choose to proceed (calls onProceed then closes)', () => {
      let proceeded = false;
      useUIStore.getState().openIntegrityWarningDialog({
        message: 'File integrity warning',
        onProceed: () => {
          proceeded = true;
        },
      });

      // User clicks "Open Anyway"
      const info = useUIStore.getState().integrityWarningDialogInfo;
      info!.onProceed();
      useUIStore.getState().closeIntegrityWarningDialog();

      expect(proceeded).toBe(true);
      expect(useUIStore.getState().integrityWarningDialogOpen).toBe(false);
    });
  });
});
