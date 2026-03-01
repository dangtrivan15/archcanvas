/**
 * Tests for the .archc binary codec.
 * Verifies magic bytes, format version, SHA-256 checksum, and roundtrip integrity.
 */

import { describe, it, expect } from 'vitest';
import {
  encode,
  decode,
  isArchcFile,
  readFormatVersion,
  CodecError,
  IntegrityError,
} from '@/core/storage/codec';
import {
  ArchCanvasFile,
  FileHeader,
  Architecture,
  Node,
  Edge,
  Note,
  CodeRef,
  Position,
  CanvasState,
  PanelLayout,
  AIState,
  AIConversation,
  AIMessage,
  AISuggestion,
  UndoHistory,
  UndoEntry,
  Value,
  EdgeType,
  NoteStatus,
  CodeRefRole,
} from '@/proto/archcanvas';
import { FORMAT_VERSION } from '@/utils/constants';

// ─── Test Data Factory ──────────────────────────────────────────

function createTestFile(): ArchCanvasFile {
  return ArchCanvasFile.create({
    header: FileHeader.create({
      formatVersion: FORMAT_VERSION,
      toolVersion: '0.1.0',
      createdAtMs: 1700000000000,
      updatedAtMs: 1700000001000,
    }),
    architecture: Architecture.create({
      name: 'E-Commerce Platform',
      description: 'A microservices architecture for an e-commerce system',
      owners: ['alice', 'bob'],
      nodes: [
        Node.create({
          id: 'svc-order',
          type: 'compute/service',
          displayName: 'Order Service',
          args: {
            runtime: Value.create({ stringValue: 'node' }),
            replicas: Value.create({ numberValue: 3 }),
          },
          codeRefs: [
            CodeRef.create({ path: 'src/services/order.ts', role: CodeRefRole.SOURCE }),
            CodeRef.create({ path: 'api/order.proto', role: CodeRefRole.API_SPEC }),
          ],
          notes: [
            Note.create({
              id: 'note-1',
              author: 'alice',
              timestampMs: 1700000000000,
              content: 'Handles order lifecycle management',
              tags: ['core', 'orders'],
              status: NoteStatus.NONE,
            }),
          ],
          properties: {
            team: Value.create({ stringValue: 'platform' }),
            version: Value.create({ stringValue: '2.1.0' }),
          },
          position: Position.create({ x: 100, y: 200, width: 240, height: 120, color: '#3b82f6' }),
          children: [
            Node.create({
              id: 'fn-validate',
              type: 'compute/function',
              displayName: 'Order Validator',
              args: {},
              codeRefs: [],
              notes: [],
              properties: {},
              position: Position.create({ x: 10, y: 10, width: 200, height: 80 }),
              children: [],
            }),
          ],
        }),
        Node.create({
          id: 'db-orders',
          type: 'data/database',
          displayName: 'Orders DB',
          args: {
            engine: Value.create({ stringValue: 'postgres' }),
            version: Value.create({ stringValue: '15' }),
          },
          codeRefs: [
            CodeRef.create({ path: 'migrations/', role: CodeRefRole.SCHEMA }),
          ],
          notes: [],
          properties: {},
          position: Position.create({ x: 400, y: 200, width: 240, height: 120 }),
          children: [],
        }),
        Node.create({
          id: 'queue-events',
          type: 'messaging/message-queue',
          displayName: 'Event Bus',
          args: {},
          codeRefs: [],
          notes: [],
          properties: {},
          position: Position.create({ x: 250, y: 400, width: 240, height: 120 }),
          children: [],
        }),
      ],
      edges: [
        Edge.create({
          id: 'e-1',
          fromNode: 'svc-order',
          toNode: 'db-orders',
          fromPort: 'outbound',
          toPort: 'inbound',
          type: EdgeType.SYNC,
          label: 'SQL queries',
          properties: { protocol: Value.create({ stringValue: 'postgresql' }) },
          notes: [],
        }),
        Edge.create({
          id: 'e-2',
          fromNode: 'svc-order',
          toNode: 'queue-events',
          type: EdgeType.ASYNC,
          label: 'Order events',
          properties: {},
          notes: [
            Note.create({
              id: 'note-e2',
              author: 'bob',
              timestampMs: 1700000002000,
              content: 'Publishes OrderCreated, OrderCompleted events',
              tags: ['events'],
              status: NoteStatus.NONE,
            }),
          ],
        }),
        Edge.create({
          id: 'e-3',
          fromNode: 'db-orders',
          toNode: 'queue-events',
          type: EdgeType.DATA_FLOW,
          label: 'CDC stream',
          properties: {},
          notes: [],
        }),
      ],
    }),
    canvasState: CanvasState.create({
      viewportX: 150.5,
      viewportY: 250.3,
      viewportZoom: 1.5,
      selectedNodeIds: ['svc-order'],
      navigationPath: [],
      panelLayout: PanelLayout.create({
        rightPanelOpen: true,
        rightPanelTab: 'notes',
        rightPanelWidth: 400,
      }),
    }),
    aiState: AIState.create({
      conversations: [
        AIConversation.create({
          id: 'conv-1',
          scopedToNodeId: 'svc-order',
          messages: [
            AIMessage.create({
              id: 'msg-1',
              role: 'user',
              content: 'What improvements can be made?',
              timestampMs: 1700000005000,
              suggestions: [],
            }),
            AIMessage.create({
              id: 'msg-2',
              role: 'assistant',
              content: 'Consider adding circuit breakers and retry logic.',
              timestampMs: 1700000006000,
              suggestions: [
                AISuggestion.create({
                  id: 'sug-1',
                  targetNodeId: 'svc-order',
                  suggestionType: 'improvement',
                  content: 'Add circuit breaker pattern',
                  status: NoteStatus.PENDING,
                }),
              ],
            }),
          ],
          createdAtMs: 1700000004000,
        }),
      ],
    }),
    undoHistory: UndoHistory.create({
      entries: [
        UndoEntry.create({
          description: 'Added Order Service',
          timestampMs: 1700000000500,
          architectureSnapshot: new Uint8Array([10, 20, 30, 40, 50]),
        }),
      ],
      currentIndex: 1,
      maxEntries: 100,
    }),
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Binary codec (.archc)', () => {
  describe('encode', () => {
    it('produces a Uint8Array with correct magic bytes', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // Check magic bytes "ARCHC\0"
      expect(binary[0]).toBe(0x41); // 'A'
      expect(binary[1]).toBe(0x52); // 'R'
      expect(binary[2]).toBe(0x43); // 'C'
      expect(binary[3]).toBe(0x48); // 'H'
      expect(binary[4]).toBe(0x43); // 'C'
      expect(binary[5]).toBe(0x00); // '\0'
    });

    it('writes format version as uint16 big-endian after magic bytes', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // Format version follows magic bytes at offset 6-7
      const version = (binary[6]! << 8) | binary[7]!;
      expect(version).toBe(FORMAT_VERSION);
    });

    it('produces binary data larger than just the header', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // 6 (magic) + 2 (version) + 32 (sha256) + protobuf payload = 40 + payload
      expect(binary.length).toBeGreaterThan(40);
    });

    it('sets updatedAtMs timestamp on encode', async () => {
      const file = createTestFile();
      const before = Date.now();
      const binary = await encode(file);
      const after = Date.now();

      const decoded = await decode(binary);
      const updatedAt = Number(decoded.header?.updatedAtMs);
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('decode', () => {
    it('rejects files that are too small', async () => {
      const tiny = new Uint8Array([0x41, 0x52]);
      await expect(decode(tiny)).rejects.toThrow(CodecError);
      await expect(decode(tiny)).rejects.toThrow('File too small');
    });

    it('rejects files with wrong magic bytes', async () => {
      const bad = new Uint8Array(50); // large enough to pass size check
      bad[0] = 0xFF; // wrong magic byte
      await expect(decode(bad)).rejects.toThrow(CodecError);
      await expect(decode(bad)).rejects.toThrow('magic bytes mismatch');
    });

    it('rejects files with unsupported future version', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // Modify version to 999 (offset 6-7)
      binary[6] = 0x03;
      binary[7] = 0xE7;

      await expect(decode(binary)).rejects.toThrow(CodecError);
      await expect(decode(binary)).rejects.toThrow('Unsupported format version');
    });
  });

  describe('roundtrip', () => {
    it('preserves architecture name', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.architecture?.name).toBe('E-Commerce Platform');
    });

    it('preserves architecture description and owners', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.architecture?.description).toBe(
        'A microservices architecture for an e-commerce system'
      );
      expect(decoded.architecture?.owners).toEqual(['alice', 'bob']);
    });

    it('preserves nodes array with all fields', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.architecture?.nodes).toHaveLength(3);

      const orderSvc = decoded.architecture?.nodes?.[0];
      expect(orderSvc?.id).toBe('svc-order');
      expect(orderSvc?.type).toBe('compute/service');
      expect(orderSvc?.displayName).toBe('Order Service');
      expect(orderSvc?.args?.runtime?.stringValue).toBe('node');
      expect(orderSvc?.args?.replicas?.numberValue).toBe(3);
      expect(orderSvc?.codeRefs).toHaveLength(2);
      expect(orderSvc?.notes).toHaveLength(1);
      expect(orderSvc?.notes?.[0]?.content).toBe('Handles order lifecycle management');
      expect(orderSvc?.position?.x).toBe(100);
      expect(orderSvc?.position?.y).toBe(200);
      expect(orderSvc?.position?.color).toBe('#3b82f6');

      // Verify nested children
      expect(orderSvc?.children).toHaveLength(1);
      expect(orderSvc?.children?.[0]?.displayName).toBe('Order Validator');
    });

    it('preserves edges array with all types', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.architecture?.edges).toHaveLength(3);

      const syncEdge = decoded.architecture?.edges?.[0];
      expect(syncEdge?.type).toBe(EdgeType.SYNC);
      expect(syncEdge?.label).toBe('SQL queries');
      expect(syncEdge?.fromPort).toBe('outbound');

      const asyncEdge = decoded.architecture?.edges?.[1];
      expect(asyncEdge?.type).toBe(EdgeType.ASYNC);
      expect(asyncEdge?.notes).toHaveLength(1);

      const dataFlowEdge = decoded.architecture?.edges?.[2];
      expect(dataFlowEdge?.type).toBe(EdgeType.DATA_FLOW);
    });

    it('preserves canvas state', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.canvasState?.viewportX).toBeCloseTo(150.5);
      expect(decoded.canvasState?.viewportY).toBeCloseTo(250.3);
      expect(decoded.canvasState?.viewportZoom).toBeCloseTo(1.5);
      expect(decoded.canvasState?.selectedNodeIds).toEqual(['svc-order']);
      expect(decoded.canvasState?.panelLayout?.rightPanelOpen).toBe(true);
      expect(decoded.canvasState?.panelLayout?.rightPanelTab).toBe('notes');
      expect(decoded.canvasState?.panelLayout?.rightPanelWidth).toBe(400);
    });

    it('preserves AI state with conversations and suggestions', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.aiState?.conversations).toHaveLength(1);
      const conv = decoded.aiState?.conversations?.[0];
      expect(conv?.id).toBe('conv-1');
      expect(conv?.scopedToNodeId).toBe('svc-order');
      expect(conv?.messages).toHaveLength(2);
      expect(conv?.messages?.[1]?.suggestions).toHaveLength(1);
      expect(conv?.messages?.[1]?.suggestions?.[0]?.content).toBe(
        'Add circuit breaker pattern'
      );
    });

    it('preserves undo history with binary snapshots', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.undoHistory?.entries).toHaveLength(1);
      expect(decoded.undoHistory?.currentIndex).toBe(1);
      expect(decoded.undoHistory?.maxEntries).toBe(100);

      const snapshot = decoded.undoHistory?.entries?.[0]?.architectureSnapshot;
      expect(snapshot).toBeDefined();
      expect(Array.from(new Uint8Array(snapshot!))).toEqual([10, 20, 30, 40, 50]);
    });

    it('preserves header fields', async () => {
      const original = createTestFile();
      const binary = await encode(original);
      const decoded = await decode(binary);

      expect(decoded.header?.formatVersion).toBe(FORMAT_VERSION);
      expect(decoded.header?.toolVersion).toBe('0.1.0');
    });

    it('handles empty architecture', async () => {
      const minimal = ArchCanvasFile.create({
        header: FileHeader.create({ formatVersion: FORMAT_VERSION }),
        architecture: Architecture.create({ name: 'Empty', description: '', owners: [], nodes: [], edges: [] }),
        canvasState: CanvasState.create({}),
        aiState: AIState.create({ conversations: [] }),
        undoHistory: UndoHistory.create({ entries: [], currentIndex: 0, maxEntries: 100 }),
      });

      const binary = await encode(minimal);
      const decoded = await decode(binary);

      expect(decoded.architecture?.name).toBe('Empty');
      expect(decoded.architecture?.nodes).toHaveLength(0);
      expect(decoded.architecture?.edges).toHaveLength(0);
    });
  });

  describe('SHA-256 checksum', () => {
    it('stores a 32-byte checksum in the header', async () => {
      const file = createTestFile();
      const binary = await encode(file);
      const decoded = await decode(binary);

      const checksum = decoded.header?.checksumSha256;
      expect(checksum).toBeDefined();
      expect(new Uint8Array(checksum!).length).toBe(32);
    });

    it('detects corruption when a payload byte is modified', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // Modify a byte in the protobuf payload area (after 40-byte header)
      const payloadOffset = 40 + 50; // well into the protobuf payload
      if (payloadOffset < binary.length) {
        binary[payloadOffset] = (binary[payloadOffset]! + 1) % 256;
      }

      await expect(decode(binary)).rejects.toThrow(IntegrityError);
    });

    it('can skip checksum verification with option', async () => {
      const file = createTestFile();
      const binary = await encode(file);

      // Modify a byte in the protobuf payload area
      const payloadOffset = 40 + 50;
      if (payloadOffset < binary.length) {
        binary[payloadOffset] = (binary[payloadOffset]! + 1) % 256;
      }

      // Should NOT throw with skipChecksumVerification
      // (may fail protobuf decode or produce different data, but won't throw IntegrityError)
      try {
        const decoded = await decode(binary, { skipChecksumVerification: true });
        // If decode succeeds, it should not throw IntegrityError
        expect(decoded).toBeDefined();
      } catch (err) {
        // If it throws, it should be CodecError (protobuf decode), not IntegrityError
        expect(err).not.toBeInstanceOf(IntegrityError);
      }
    });
  });

  describe('utility functions', () => {
    it('isArchcFile returns true for valid files', async () => {
      const file = createTestFile();
      const binary = await encode(file);
      expect(isArchcFile(binary)).toBe(true);
    });

    it('isArchcFile returns false for invalid data', () => {
      expect(isArchcFile(new Uint8Array([1, 2, 3]))).toBe(false);
      expect(isArchcFile(new Uint8Array([]))).toBe(false);
      expect(isArchcFile(new Uint8Array([0x41, 0x52, 0x43, 0x00]))).toBe(false);
    });

    it('readFormatVersion returns correct version', async () => {
      const file = createTestFile();
      const binary = await encode(file);
      expect(readFormatVersion(binary)).toBe(FORMAT_VERSION);
    });

    it('readFormatVersion throws for tiny files', () => {
      expect(() => readFormatVersion(new Uint8Array([1, 2]))).toThrow(CodecError);
    });
  });
});
