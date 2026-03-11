/**
 * Regression test for Feature 3: Binary codec roundtrip preserves data integrity.
 */
import { describe, it, expect } from 'vitest';
import {
  encode,
  decode,
  isArchcFile,
  readFormatVersion,
  IntegrityError,
} from '@/core/storage/codec';
import type { IArchCanvasFile } from '@/proto/archcanvas';
import { FORMAT_VERSION } from '@/utils/constants';

describe('Binary codec roundtrip', () => {
  const testFile: IArchCanvasFile = {
    header: {
      formatVersion: FORMAT_VERSION,
      toolVersion: '0.1.0',
      createdAtMs: 1700000000000,
      updatedAtMs: 1700000000000,
    },
    architecture: {
      name: 'Test Architecture',
      description: 'A test architecture for roundtrip testing',
      owners: ['test-user'],
      nodes: [
        {
          id: 'node-1',
          type: 'service',
          displayName: 'API Service',
          position: { x: 100, y: 200, width: 200, height: 100, color: '#3b82f6' },
          children: [],
          codeRefs: [],
          notes: [],
        },
        {
          id: 'node-2',
          type: 'database',
          displayName: 'Main DB',
          position: { x: 400, y: 200, width: 200, height: 100, color: '#10b981' },
          children: [],
          codeRefs: [],
          notes: [],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          fromNode: 'node-1',
          toNode: 'node-2',
          type: 0, // SYNC
          label: 'queries',
          notes: [],
        },
      ],
    },
    canvasState: {
      viewportX: 0,
      viewportY: 0,
      viewportZoom: 1,
      selectedNodeIds: [],
      navigationPath: [],
    },
  };

  it('encodes to binary starting with magic bytes ARCHC\\0', async () => {
    const binary = await encode(testFile);
    expect(binary[0]).toBe(0x41); // A
    expect(binary[1]).toBe(0x52); // R
    expect(binary[2]).toBe(0x43); // C
    expect(binary[3]).toBe(0x48); // H
    expect(binary[4]).toBe(0x43); // C
    expect(binary[5]).toBe(0x00); // \0
  });

  it('writes format version uint16 after magic bytes', async () => {
    const binary = await encode(testFile);
    const version = (binary[6]! << 8) | binary[7]!;
    expect(version).toBe(FORMAT_VERSION);
  });

  it('isArchcFile detects valid binary', async () => {
    const binary = await encode(testFile);
    expect(isArchcFile(binary)).toBe(true);
  });

  it('readFormatVersion reads correct version', async () => {
    const binary = await encode(testFile);
    expect(readFormatVersion(binary)).toBe(FORMAT_VERSION);
  });

  it('roundtrip preserves architecture name', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.architecture?.name).toBe('Test Architecture');
  });

  it('roundtrip preserves architecture description', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.architecture?.description).toBe('A test architecture for roundtrip testing');
  });

  it('roundtrip preserves nodes array', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.architecture?.nodes).toHaveLength(2);
    expect(decoded.architecture?.nodes?.[0]?.id).toBe('node-1');
    expect(decoded.architecture?.nodes?.[0]?.displayName).toBe('API Service');
    expect(decoded.architecture?.nodes?.[1]?.id).toBe('node-2');
    expect(decoded.architecture?.nodes?.[1]?.displayName).toBe('Main DB');
  });

  it('roundtrip preserves edges array', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.architecture?.edges).toHaveLength(1);
    expect(decoded.architecture?.edges?.[0]?.fromNode).toBe('node-1');
    expect(decoded.architecture?.edges?.[0]?.toNode).toBe('node-2');
    expect(decoded.architecture?.edges?.[0]?.label).toBe('queries');
  });

  it('roundtrip preserves canvas state', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.canvasState?.viewportZoom).toBe(1);
    expect(decoded.canvasState?.viewportX).toBe(0);
    expect(decoded.canvasState?.viewportY).toBe(0);
  });

  it('decoded header contains valid SHA-256 checksum', async () => {
    const binary = await encode(testFile);
    const decoded = await decode(binary);
    expect(decoded.header?.checksumSha256).toBeInstanceOf(Uint8Array);
    expect(decoded.header?.checksumSha256).toHaveLength(32);
  });

  it('detects corruption when a byte is modified', async () => {
    const binary = await encode(testFile);
    const corrupted = new Uint8Array(binary);
    // Modify a byte in the payload section (after the 40-byte header)
    corrupted[42] = (corrupted[42]! + 1) % 256;

    await expect(decode(corrupted)).rejects.toThrow(IntegrityError);
  });
});
