import type { Patch } from 'immer';
import type { Canvas } from '@/types';

// --- Error Codes (hard — block the operation) ---

export type EngineError =
  | { code: 'DUPLICATE_NODE_ID'; nodeId: string }
  | { code: 'NODE_NOT_FOUND'; nodeId: string }
  | { code: 'EDGE_ENDPOINT_NOT_FOUND'; endpoint: string; side: 'from' | 'to' }
  | { code: 'DUPLICATE_EDGE'; from: string; to: string }
  | { code: 'SELF_LOOP'; nodeId: string }
  | { code: 'EDGE_NOT_FOUND'; from: string; to: string }
  | { code: 'ENTITY_NOT_FOUND'; name: string }
  | { code: 'DUPLICATE_ENTITY'; name: string }
  | {
      code: 'ENTITY_IN_USE';
      name: string;
      referencedBy: Array<{ from: string; to: string }>;
    }
  | { code: 'INVALID_REF_NODE_UPDATE' }
  | { code: 'CANVAS_NOT_FOUND'; canvasId: string }
  | { code: 'INVALID_CROSS_SCOPE_REF'; message: string }
  | { code: 'CROSS_SCOPE_REF_NOT_FOUND'; message: string };

// --- Warning Codes (soft — operation succeeds) ---

export type EngineWarning =
  | { code: 'UNKNOWN_NODE_TYPE'; type: string }
  | { code: 'INVALID_ARG'; nodeId: string; arg: string; reason: string }
  | { code: 'UNKNOWN_PORT'; nodeId: string; port: string }
  | {
      code: 'INVALID_PORT_DIRECTION';
      nodeId: string;
      port: string;
      expected: 'inbound' | 'outbound';
    }
  | { code: 'ENTITY_UNREFERENCED'; name: string };

// --- Result Type ---

export type EngineResult =
  | {
      ok: true;
      data: Canvas;
      patches: Patch[];
      inversePatches: Patch[];
      warnings: EngineWarning[];
    }
  | { ok: false; error: EngineError };

// --- Search Result ---

export type SearchResult =
  | {
      type: 'node';
      canvasId: string;
      nodeId: string;
      displayName: string;
      matchContext: string;
      score: number;
    }
  | {
      type: 'edge';
      canvasId: string;
      from: string;
      to: string;
      displayName: string;
      matchContext: string;
      score: number;
    }
  | {
      type: 'entity';
      canvasId: string;
      name: string;
      displayName: string;
      matchContext: string;
      score: number;
    };
