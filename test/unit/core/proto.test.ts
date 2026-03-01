/**
 * Tests for Protocol Buffer schema compilation and roundtrip encoding.
 * Verifies that the .proto schema compiles to usable TypeScript classes
 * and that encode/decode produces identical objects.
 */

import { describe, it, expect } from 'vitest';
import {
  ArchCanvasFile,
  Architecture,
  Node,
  Edge,
  FileHeader,
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
  StringList,
  EdgeType,
  NoteStatus,
  CodeRefRole,
} from '@/proto/archcanvas';

describe('Protocol Buffer schema compilation', () => {
  it('exports ArchCanvasFile class', () => {
    expect(ArchCanvasFile).toBeDefined();
    expect(typeof ArchCanvasFile.create).toBe('function');
    expect(typeof ArchCanvasFile.encode).toBe('function');
    expect(typeof ArchCanvasFile.decode).toBe('function');
  });

  it('exports Architecture class', () => {
    expect(Architecture).toBeDefined();
    expect(typeof Architecture.create).toBe('function');
    expect(typeof Architecture.encode).toBe('function');
    expect(typeof Architecture.decode).toBe('function');
  });

  it('exports Node class', () => {
    expect(Node).toBeDefined();
    expect(typeof Node.create).toBe('function');
    expect(typeof Node.encode).toBe('function');
    expect(typeof Node.decode).toBe('function');
  });

  it('exports Edge class', () => {
    expect(Edge).toBeDefined();
    expect(typeof Edge.create).toBe('function');
    expect(typeof Edge.encode).toBe('function');
    expect(typeof Edge.decode).toBe('function');
  });

  it('exports FileHeader class', () => {
    expect(FileHeader).toBeDefined();
    expect(typeof FileHeader.create).toBe('function');
  });

  it('exports Note class', () => {
    expect(Note).toBeDefined();
    expect(typeof Note.create).toBe('function');
  });

  it('exports CodeRef class', () => {
    expect(CodeRef).toBeDefined();
    expect(typeof CodeRef.create).toBe('function');
  });

  it('exports Position class', () => {
    expect(Position).toBeDefined();
    expect(typeof Position.create).toBe('function');
  });

  it('exports CanvasState class', () => {
    expect(CanvasState).toBeDefined();
    expect(typeof CanvasState.create).toBe('function');
  });

  it('exports PanelLayout class', () => {
    expect(PanelLayout).toBeDefined();
    expect(typeof PanelLayout.create).toBe('function');
  });

  it('exports AIState class', () => {
    expect(AIState).toBeDefined();
    expect(typeof AIState.create).toBe('function');
  });

  it('exports AIConversation class', () => {
    expect(AIConversation).toBeDefined();
    expect(typeof AIConversation.create).toBe('function');
  });

  it('exports AIMessage class', () => {
    expect(AIMessage).toBeDefined();
    expect(typeof AIMessage.create).toBe('function');
  });

  it('exports AISuggestion class', () => {
    expect(AISuggestion).toBeDefined();
    expect(typeof AISuggestion.create).toBe('function');
  });

  it('exports UndoHistory class', () => {
    expect(UndoHistory).toBeDefined();
    expect(typeof UndoHistory.create).toBe('function');
  });

  it('exports UndoEntry class', () => {
    expect(UndoEntry).toBeDefined();
    expect(typeof UndoEntry.create).toBe('function');
  });

  it('exports Value class', () => {
    expect(Value).toBeDefined();
    expect(typeof Value.create).toBe('function');
  });

  it('exports StringList class', () => {
    expect(StringList).toBeDefined();
    expect(typeof StringList.create).toBe('function');
  });

  it('exports EdgeType enum', () => {
    expect(EdgeType).toBeDefined();
    expect(EdgeType.SYNC).toBe(0);
    expect(EdgeType.ASYNC).toBe(1);
    expect(EdgeType.DATA_FLOW).toBe(2);
  });

  it('exports NoteStatus enum', () => {
    expect(NoteStatus).toBeDefined();
    expect(NoteStatus.NONE).toBe(0);
    expect(NoteStatus.PENDING).toBe(1);
    expect(NoteStatus.ACCEPTED).toBe(2);
    expect(NoteStatus.DISMISSED).toBe(3);
  });

  it('exports CodeRefRole enum', () => {
    expect(CodeRefRole).toBeDefined();
    expect(CodeRefRole.SOURCE).toBe(0);
    expect(CodeRefRole.API_SPEC).toBe(1);
    expect(CodeRefRole.SCHEMA).toBe(2);
    expect(CodeRefRole.DEPLOYMENT).toBe(3);
    expect(CodeRefRole.CONFIG).toBe(4);
    expect(CodeRefRole.TEST).toBe(5);
  });

  it('creates a sample ArchCanvasFile instance programmatically', () => {
    const file = ArchCanvasFile.create({
      header: FileHeader.create({
        formatVersion: 1,
        toolVersion: '0.1.0',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }),
      architecture: Architecture.create({
        name: 'Test Architecture',
        description: 'A test architecture for verification',
        owners: ['test-user'],
        nodes: [
          Node.create({
            id: 'node-1',
            type: 'compute/service',
            displayName: 'Order Service',
            args: {
              runtime: Value.create({ stringValue: 'node' }),
            },
            codeRefs: [
              CodeRef.create({
                path: 'src/services/order.ts',
                role: CodeRefRole.SOURCE,
              }),
            ],
            notes: [
              Note.create({
                id: 'note-1',
                author: 'test-user',
                timestampMs: Date.now(),
                content: 'Initial service setup',
                tags: ['setup'],
                status: NoteStatus.NONE,
              }),
            ],
            properties: {
              version: Value.create({ stringValue: '1.0.0' }),
            },
            position: Position.create({
              x: 100,
              y: 200,
              width: 240,
              height: 120,
              color: '#3b82f6',
            }),
            children: [],
          }),
        ],
        edges: [
          Edge.create({
            id: 'edge-1',
            fromNode: 'node-1',
            toNode: 'node-2',
            type: EdgeType.SYNC,
            label: 'REST API',
            properties: {},
            notes: [],
          }),
        ],
      }),
      canvasState: CanvasState.create({
        viewportX: 0,
        viewportY: 0,
        viewportZoom: 1.0,
        selectedNodeIds: [],
        navigationPath: [],
        panelLayout: PanelLayout.create({
          rightPanelOpen: false,
          rightPanelTab: 'properties',
          rightPanelWidth: 320,
        }),
      }),
      aiState: AIState.create({
        conversations: [],
      }),
      undoHistory: UndoHistory.create({
        entries: [],
        currentIndex: 0,
        maxEntries: 100,
      }),
    });

    expect(file).toBeDefined();
    expect(file.header?.formatVersion).toBe(1);
    expect(file.architecture?.name).toBe('Test Architecture');
    expect(file.architecture?.nodes).toHaveLength(1);
    expect(file.architecture?.nodes?.[0]?.displayName).toBe('Order Service');
    expect(file.architecture?.edges).toHaveLength(1);
    expect(file.canvasState?.viewportZoom).toBe(1.0);
    expect(file.undoHistory?.maxEntries).toBe(100);
  });

  it('encode and decode roundtrip produces identical object', () => {
    const original = ArchCanvasFile.create({
      header: FileHeader.create({
        formatVersion: 1,
        toolVersion: '0.1.0',
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000001000,
      }),
      architecture: Architecture.create({
        name: 'Roundtrip Test',
        description: 'Testing encode/decode roundtrip',
        owners: ['alice', 'bob'],
        nodes: [
          Node.create({
            id: 'svc-1',
            type: 'compute/service',
            displayName: 'Auth Service',
            args: {
              runtime: Value.create({ stringValue: 'go' }),
              replicas: Value.create({ numberValue: 3 }),
            },
            codeRefs: [
              CodeRef.create({ path: 'cmd/auth/main.go', role: CodeRefRole.SOURCE }),
              CodeRef.create({ path: 'api/auth.proto', role: CodeRefRole.API_SPEC }),
            ],
            notes: [
              Note.create({
                id: 'n1',
                author: 'alice',
                timestampMs: 1700000000000,
                content: 'Handles JWT token generation',
                tags: ['auth', 'security'],
                status: NoteStatus.NONE,
              }),
            ],
            properties: {
              team: Value.create({ stringValue: 'platform' }),
            },
            position: Position.create({ x: 50, y: 100, width: 240, height: 120 }),
            children: [
              Node.create({
                id: 'fn-1',
                type: 'compute/function',
                displayName: 'Token Validator',
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
            id: 'db-1',
            type: 'data/database',
            displayName: 'Users DB',
            args: {
              engine: Value.create({ stringValue: 'postgres' }),
            },
            codeRefs: [],
            notes: [],
            properties: {},
            position: Position.create({ x: 350, y: 100, width: 240, height: 120 }),
            children: [],
          }),
        ],
        edges: [
          Edge.create({
            id: 'e-1',
            fromNode: 'svc-1',
            toNode: 'db-1',
            fromPort: 'outbound',
            toPort: 'inbound',
            type: EdgeType.SYNC,
            label: 'SQL queries',
            properties: {
              protocol: Value.create({ stringValue: 'postgresql' }),
            },
            notes: [],
          }),
          Edge.create({
            id: 'e-2',
            fromNode: 'svc-1',
            toNode: 'db-1',
            type: EdgeType.ASYNC,
            label: 'Cache invalidation',
            properties: {},
            notes: [],
          }),
        ],
      }),
      canvasState: CanvasState.create({
        viewportX: 10.5,
        viewportY: 20.3,
        viewportZoom: 1.5,
        selectedNodeIds: ['svc-1'],
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
            scopedToNodeId: 'svc-1',
            messages: [
              AIMessage.create({
                id: 'msg-1',
                role: 'user',
                content: 'What security improvements should I consider?',
                timestampMs: 1700000002000,
                suggestions: [],
              }),
              AIMessage.create({
                id: 'msg-2',
                role: 'assistant',
                content: 'Consider adding rate limiting and IP-based blocking.',
                timestampMs: 1700000003000,
                suggestions: [
                  AISuggestion.create({
                    id: 'sug-1',
                    targetNodeId: 'svc-1',
                    suggestionType: 'improvement',
                    content: 'Add rate limiter middleware',
                    status: NoteStatus.PENDING,
                  }),
                ],
              }),
            ],
            createdAtMs: 1700000001000,
          }),
        ],
      }),
      undoHistory: UndoHistory.create({
        entries: [
          UndoEntry.create({
            description: 'Added Auth Service',
            timestampMs: 1700000000500,
            architectureSnapshot: new Uint8Array([1, 2, 3, 4]),
          }),
        ],
        currentIndex: 1,
        maxEntries: 100,
      }),
    });

    // Encode to binary
    const encoded = ArchCanvasFile.encode(original).finish();
    // protobufjs returns Buffer in Node env which is a Uint8Array subclass
    expect(ArrayBuffer.isView(encoded)).toBe(true);
    expect(encoded.length).toBeGreaterThan(0);

    // Decode back
    const decoded = ArchCanvasFile.decode(encoded);

    // Verify header
    expect(decoded.header?.formatVersion).toBe(original.header?.formatVersion);
    expect(decoded.header?.toolVersion).toBe(original.header?.toolVersion);

    // Verify architecture
    expect(decoded.architecture?.name).toBe('Roundtrip Test');
    expect(decoded.architecture?.description).toBe('Testing encode/decode roundtrip');
    expect(decoded.architecture?.owners).toEqual(['alice', 'bob']);

    // Verify nodes
    expect(decoded.architecture?.nodes).toHaveLength(2);
    const svc = decoded.architecture?.nodes?.[0];
    expect(svc?.id).toBe('svc-1');
    expect(svc?.displayName).toBe('Auth Service');
    expect(svc?.args?.runtime?.stringValue).toBe('go');
    expect(svc?.args?.replicas?.numberValue).toBe(3);
    expect(svc?.codeRefs).toHaveLength(2);
    expect(svc?.notes).toHaveLength(1);
    expect(svc?.notes?.[0]?.tags).toEqual(['auth', 'security']);
    expect(svc?.position?.x).toBe(50);
    expect(svc?.position?.color).toBe('');

    // Verify nested children
    expect(svc?.children).toHaveLength(1);
    expect(svc?.children?.[0]?.displayName).toBe('Token Validator');

    // Verify edges
    expect(decoded.architecture?.edges).toHaveLength(2);
    expect(decoded.architecture?.edges?.[0]?.type).toBe(EdgeType.SYNC);
    expect(decoded.architecture?.edges?.[1]?.type).toBe(EdgeType.ASYNC);

    // Verify canvas state
    expect(decoded.canvasState?.viewportZoom).toBeCloseTo(1.5);
    expect(decoded.canvasState?.selectedNodeIds).toEqual(['svc-1']);
    expect(decoded.canvasState?.panelLayout?.rightPanelOpen).toBe(true);

    // Verify AI state
    expect(decoded.aiState?.conversations).toHaveLength(1);
    expect(decoded.aiState?.conversations?.[0]?.messages).toHaveLength(2);
    expect(decoded.aiState?.conversations?.[0]?.messages?.[1]?.suggestions).toHaveLength(1);

    // Verify undo history
    expect(decoded.undoHistory?.entries).toHaveLength(1);
    expect(decoded.undoHistory?.currentIndex).toBe(1);
    expect(decoded.undoHistory?.maxEntries).toBe(100);

    // Verify binary snapshot preserved
    // protobufjs returns Buffer in Node env, so compare byte values
    const snapshot = decoded.undoHistory?.entries?.[0]?.architectureSnapshot;
    expect(snapshot).toBeDefined();
    expect(snapshot!.length).toBe(4);
    expect(Array.from(new Uint8Array(snapshot!))).toEqual([1, 2, 3, 4]);
  });
});
