/**
 * Patch-based undo/redo manager using Immer for structural diffing.
 *
 * Instead of storing full ArchGraph snapshots for every entry, stores:
 * - Periodic full checkpoints (every `checkpointInterval` entries)
 * - Immer patches between checkpoints
 *
 * This achieves ~20x memory reduction while maintaining the same public API.
 * Reconstruction walks forward from the nearest checkpoint applying patches.
 *
 * Max entries configurable (default 100). Branch behavior: new action after
 * undo discards redo future.
 */

import { enablePatches, produceWithPatches, applyPatches, type Patch } from 'immer';
import type { ArchGraph } from '@/types/graph';
import { MAX_UNDO_ENTRIES } from '@/utils/constants';

// Enable Immer's patch tracking (idempotent, safe to call multiple times)
enablePatches();

/** Public undo entry type — unchanged for backward compatibility with fileIO.ts */
export interface UndoEntry {
  description: string;
  timestampMs: number;
  snapshot: ArchGraph;
}

// ─── Internal Types (not exported) ───────────────────────────────

interface CheckpointEntry {
  kind: 'checkpoint';
  description: string;
  timestampMs: number;
  snapshot: ArchGraph;
}

interface PatchEntry {
  kind: 'patch';
  description: string;
  timestampMs: number;
  patches: Patch[];
}

type InternalEntry = CheckpointEntry | PatchEntry;

// ─── Patch Computation ───────────────────────────────────────────

/**
 * Compute Immer forward patches from prevGraph to nextGraph.
 * Uses produceWithPatches to structurally diff the two graphs.
 * Clones nextGraph to ensure patch values own their data
 * (Immer stores references, not copies, in patch values).
 */
function computeForwardPatches(prevGraph: ArchGraph, nextGraph: ArchGraph): Patch[] {
  const safeNext = structuredClone(nextGraph);
  const [, patches] = produceWithPatches(prevGraph, (draft) => {
    draft.name = safeNext.name;
    draft.description = safeNext.description;
    draft.owners = safeNext.owners;
    draft.nodes = safeNext.nodes;
    draft.edges = safeNext.edges;
    draft.annotations = safeNext.annotations;
  });
  return patches;
}

// ─── UndoManager ─────────────────────────────────────────────────

export class UndoManager {
  private internalEntries: InternalEntry[] = [];
  private currentIndex = -1;
  private readonly maxEntries: number;
  private readonly checkpointInterval: number;

  constructor(maxEntries: number = MAX_UNDO_ENTRIES, checkpointInterval: number = 10) {
    this.maxEntries = maxEntries;
    this.checkpointInterval = checkpointInterval;
    console.log(`[UndoManager] Initialized with max ${this.maxEntries} entries`);
  }

  /**
   * Take a snapshot of the current graph state.
   * Internally stores either a checkpoint (full graph) or patches (diff from previous).
   * Discards any redo future (branch behavior).
   */
  snapshot(description: string, graph: ArchGraph): void {
    // Discard any entries after current index (branch behavior)
    if (this.currentIndex < this.internalEntries.length - 1) {
      this.internalEntries = this.internalEntries.slice(0, this.currentIndex + 1);
    }

    const newIndex = this.internalEntries.length;
    const shouldCheckpoint =
      newIndex === 0 || newIndex % this.checkpointInterval === 0;

    if (shouldCheckpoint) {
      this.internalEntries.push({
        kind: 'checkpoint',
        description,
        timestampMs: Date.now(),
        snapshot: structuredClone(graph),
      });
    } else {
      // Compute patches from the current tip state to the new graph
      const prevGraph = this.reconstructAt(this.currentIndex);
      const patches = computeForwardPatches(prevGraph, graph);
      this.internalEntries.push({
        kind: 'patch',
        description,
        timestampMs: Date.now(),
        patches,
      });
    }

    this.currentIndex = this.internalEntries.length - 1;

    // Enforce max entries limit
    if (this.internalEntries.length > this.maxEntries) {
      this.trimOldEntries();
    }
  }

  /**
   * Undo: returns the previous graph state, or undefined if nothing to undo.
   */
  undo(): ArchGraph | undefined {
    if (!this.canUndo) {
      return undefined;
    }
    this.currentIndex--;
    return structuredClone(this.reconstructAt(this.currentIndex));
  }

  /**
   * Redo: returns the next graph state, or undefined if nothing to redo.
   */
  redo(): ArchGraph | undefined {
    if (!this.canRedo) {
      return undefined;
    }
    this.currentIndex++;
    return structuredClone(this.reconstructAt(this.currentIndex));
  }

  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  get canRedo(): boolean {
    return this.currentIndex < this.internalEntries.length - 1;
  }

  get historyLength(): number {
    return this.internalEntries.length;
  }

  get currentHistoryIndex(): number {
    return this.currentIndex;
  }

  getDescriptions(): string[] {
    return this.internalEntries.map((e) => e.description);
  }

  clear(): void {
    this.internalEntries = [];
    this.currentIndex = -1;
  }

  /**
   * Export the full undo history for serialization.
   * Reconstructs full ArchGraph snapshots from patches for backward compatibility.
   */
  exportHistory(): {
    entries: UndoEntry[];
    currentIndex: number;
    maxEntries: number;
  } {
    const entries: UndoEntry[] = [];
    for (let i = 0; i < this.internalEntries.length; i++) {
      const e = this.internalEntries[i]!;
      entries.push({
        description: e.description,
        timestampMs: e.timestampMs,
        snapshot: structuredClone(this.reconstructAt(i)),
      });
    }
    return {
      entries,
      currentIndex: this.currentIndex,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * Import undo history from deserialized data.
   * Converts full snapshots to internal patch-based format.
   */
  importHistory(entries: UndoEntry[], currentIndex: number): void {
    this.internalEntries = [];
    this.currentIndex = -1;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const shouldCheckpoint =
        i === 0 || i % this.checkpointInterval === 0;

      if (shouldCheckpoint) {
        this.internalEntries.push({
          kind: 'checkpoint',
          description: entry.description,
          timestampMs: entry.timestampMs,
          snapshot: structuredClone(entry.snapshot),
        });
      } else {
        const prevSnapshot = entries[i - 1]!.snapshot;
        const patches = computeForwardPatches(prevSnapshot, entry.snapshot);
        this.internalEntries.push({
          kind: 'patch',
          description: entry.description,
          timestampMs: entry.timestampMs,
          patches,
        });
      }
    }

    this.currentIndex = currentIndex;

    // Enforce max entries limit
    if (this.internalEntries.length > this.maxEntries) {
      const overflow = this.internalEntries.length - this.maxEntries;
      // Reconstruct state at the new first position before trimming
      const newFirstState = this.reconstructAt(overflow);
      this.internalEntries = this.internalEntries.slice(overflow);
      this.currentIndex = Math.max(0, this.currentIndex - overflow);
      // Ensure new first entry is a checkpoint
      this.promoteToCheckpoint(0, newFirstState);
    }

    console.log(
      `[UndoManager] Imported ${this.internalEntries.length} entries, currentIndex=${this.currentIndex}`,
    );
  }

  // ─── Private Methods ────────────────────────────────────────────

  /**
   * Reconstruct the full ArchGraph at a given index by walking forward
   * from the nearest checkpoint and applying patches.
   */
  private reconstructAt(index: number): ArchGraph {
    // Find the nearest checkpoint at or before the target index
    let checkpointIdx = index;
    while (checkpointIdx >= 0 && this.internalEntries[checkpointIdx]!.kind !== 'checkpoint') {
      checkpointIdx--;
    }

    if (checkpointIdx < 0) {
      throw new Error(`[UndoManager] No checkpoint found at or before index ${index}`);
    }

    const checkpoint = this.internalEntries[checkpointIdx] as CheckpointEntry;
    let state = structuredClone(checkpoint.snapshot);

    // Apply forward patches from checkpoint+1 to target index
    for (let i = checkpointIdx + 1; i <= index; i++) {
      const entry = this.internalEntries[i]!;
      if (entry.kind === 'patch') {
        state = applyPatches(state, entry.patches);
      } else {
        // Hit another checkpoint — use it directly (faster)
        state = structuredClone((entry as CheckpointEntry).snapshot);
      }
    }

    return state;
  }

  /**
   * Trim oldest entries when exceeding maxEntries.
   * Ensures the new first entry is always a checkpoint.
   */
  private trimOldEntries(): void {
    const overflow = this.internalEntries.length - this.maxEntries;
    // Reconstruct state at the new first position before slicing
    const newFirstState = this.reconstructAt(overflow);
    this.internalEntries = this.internalEntries.slice(overflow);
    this.currentIndex -= overflow;
    // Ensure new first entry is a checkpoint
    this.promoteToCheckpoint(0, newFirstState);
  }

  /**
   * Promote an entry to a checkpoint at the given index.
   */
  private promoteToCheckpoint(index: number, snapshot: ArchGraph): void {
    const entry = this.internalEntries[index]!;
    if (entry.kind !== 'checkpoint') {
      this.internalEntries[index] = {
        kind: 'checkpoint',
        description: entry.description,
        timestampMs: entry.timestampMs,
        snapshot,
      };
    }
  }
}
