import { create } from 'zustand';
import { applyPatches, enablePatches, type Patch } from 'immer';
import { useFileStore } from './fileStore';

enablePatches();

const MAX_DEPTH = 50;

interface HistoryEntry {
  canvasId: string;
  patches: Patch[];
  inversePatches: Patch[];
}

// Module-level batch buffer — not reactive state, purely internal coordination
let batchBuffer: HistoryEntry[] | null = null;

// ---------------------------------------------------------------------------
// Per-canvas version counters for dirty-state tracking
// ---------------------------------------------------------------------------
// Each edit increments the version, undo decrements, redo increments.
// When the version matches the save-point version, the canvas is clean.
const canvasVersions = new Map<string, number>();
const savePointVersions = new Map<string, number>();

function getVersion(canvasId: string): number {
  return canvasVersions.get(canvasId) ?? 0;
}

function checkSavePoint(canvasId: string): void {
  if (getVersion(canvasId) === (savePointVersions.get(canvasId) ?? 0)) {
    useFileStore.getState().markClean(canvasId);
  }
}

interface HistoryStoreState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  pushPatches(canvasId: string, patches: Patch[], inversePatches: Patch[]): void;
  beginBatch(): void;
  commitBatch(): void;
  undo(): void;
  redo(): void;
  clear(): void;
  /** Record that the canvas was just saved — current version becomes the save point. */
  markSavePoint(canvasId: string): void;
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  pushPatches(canvasId, patches, inversePatches) {
    // If batching, accumulate instead of pushing to the stack
    if (batchBuffer !== null) {
      batchBuffer.push({ canvasId, patches, inversePatches });
      return;
    }

    const { undoStack } = get();
    const entry: HistoryEntry = { canvasId, patches, inversePatches };
    const next = [...undoStack, entry];

    // Enforce max depth: drop oldest entry from the front
    if (next.length > MAX_DEPTH) {
      next.shift();
    }

    // Increment per-canvas version counter
    canvasVersions.set(canvasId, getVersion(canvasId) + 1);

    set({
      undoStack: next,
      redoStack: [],
      canUndo: next.length > 0,
      canRedo: false,
    });
  },

  beginBatch() {
    batchBuffer = [];
  },

  commitBatch() {
    const buf = batchBuffer;
    batchBuffer = null;

    if (!buf || buf.length === 0) return;

    // Single entry → push directly, no merging needed
    if (buf.length === 1) {
      get().pushPatches(buf[0].canvasId, buf[0].patches, buf[0].inversePatches);
      return;
    }

    // Merge: forward patches in order, inverse patches in reverse order
    const canvasId = buf[0].canvasId;
    const mergedPatches = buf.flatMap((e) => e.patches);
    const mergedInverse = buf.slice().reverse().flatMap((e) => e.inversePatches);

    get().pushPatches(canvasId, mergedPatches, mergedInverse);
  },

  undo() {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];
    const canvas = useFileStore.getState().getCanvas(entry.canvasId);
    if (!canvas) return;

    // applyPatches returns a NEW object — does NOT mutate in place
    const patched = applyPatches(canvas.data, entry.inversePatches);
    useFileStore.getState().updateCanvasData(entry.canvasId, patched);

    // Decrement per-canvas version and check if we're back at save point
    canvasVersions.set(entry.canvasId, getVersion(entry.canvasId) - 1);
    checkSavePoint(entry.canvasId);

    const nextUndo = undoStack.slice(0, -1);
    const nextRedo = [...redoStack, entry];

    set({
      undoStack: nextUndo,
      redoStack: nextRedo,
      canUndo: nextUndo.length > 0,
      canRedo: nextRedo.length > 0,
    });
  },

  redo() {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    const canvas = useFileStore.getState().getCanvas(entry.canvasId);
    if (!canvas) return;

    // Apply forward patches
    const patched = applyPatches(canvas.data, entry.patches);
    useFileStore.getState().updateCanvasData(entry.canvasId, patched);

    // Increment per-canvas version and check if we're back at save point
    canvasVersions.set(entry.canvasId, getVersion(entry.canvasId) + 1);
    checkSavePoint(entry.canvasId);

    const nextRedo = redoStack.slice(0, -1);
    const nextUndo = [...undoStack, entry];

    set({
      undoStack: nextUndo,
      redoStack: nextRedo,
      canUndo: nextUndo.length > 0,
      canRedo: nextRedo.length > 0,
    });
  },

  clear() {
    canvasVersions.clear();
    savePointVersions.clear();
    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },

  markSavePoint(canvasId) {
    savePointVersions.set(canvasId, getVersion(canvasId));
  },
}));
