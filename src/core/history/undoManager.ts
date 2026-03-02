/**
 * Snapshot-based undo/redo manager.
 * Stores serialized Architecture snapshots for compact storage.
 * Max entries configurable (default 100). Branch behavior: new action after undo discards redo future.
 */

import type { ArchGraph } from '@/types/graph';
import { MAX_UNDO_ENTRIES } from '@/utils/constants';

export interface UndoEntry {
  description: string;
  timestampMs: number;
  snapshot: ArchGraph;
}

export class UndoManager {
  private entries: UndoEntry[] = [];
  private currentIndex = -1;
  private readonly maxEntries: number;

  constructor(maxEntries: number = MAX_UNDO_ENTRIES) {
    this.maxEntries = maxEntries;
    console.log(
      `[UndoManager] Initialized with max ${this.maxEntries} entries`,
    );
  }

  /**
   * Take a snapshot of the current graph state before making a change.
   * Discards any redo future (branch behavior).
   */
  snapshot(description: string, graph: ArchGraph): void {
    // Discard any entries after current index (branch behavior)
    if (this.currentIndex < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.currentIndex + 1);
    }

    // Deep clone the graph to create an independent snapshot
    const entry: UndoEntry = {
      description,
      timestampMs: Date.now(),
      snapshot: structuredClone(graph),
    };

    this.entries.push(entry);
    this.currentIndex = this.entries.length - 1;

    // Enforce max entries limit
    if (this.entries.length > this.maxEntries) {
      const overflow = this.entries.length - this.maxEntries;
      this.entries = this.entries.slice(overflow);
      this.currentIndex -= overflow;
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
    const entry = this.entries[this.currentIndex];
    return entry ? structuredClone(entry.snapshot) : undefined;
  }

  /**
   * Redo: returns the next graph state, or undefined if nothing to redo.
   */
  redo(): ArchGraph | undefined {
    if (!this.canRedo) {
      return undefined;
    }

    this.currentIndex++;
    const entry = this.entries[this.currentIndex];
    return entry ? structuredClone(entry.snapshot) : undefined;
  }

  /**
   * Whether undo is available.
   */
  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Whether redo is available.
   */
  get canRedo(): boolean {
    return this.currentIndex < this.entries.length - 1;
  }

  /**
   * Get the current number of entries in the history.
   */
  get historyLength(): number {
    return this.entries.length;
  }

  /**
   * Get the current index in the history.
   */
  get currentHistoryIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get all entry descriptions (for debugging/display).
   */
  getDescriptions(): string[] {
    return this.entries.map((e) => e.description);
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.entries = [];
    this.currentIndex = -1;
  }

  /**
   * Export the full undo history for serialization (e.g., saving to .archc file).
   * Returns a snapshot of entries, current index, and max entries.
   */
  exportHistory(): {
    entries: UndoEntry[];
    currentIndex: number;
    maxEntries: number;
  } {
    return {
      entries: this.entries.map((e) => ({
        description: e.description,
        timestampMs: e.timestampMs,
        snapshot: structuredClone(e.snapshot),
      })),
      currentIndex: this.currentIndex,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * Import undo history from deserialized data (e.g., loading from .archc file).
   * Replaces current history with the imported data.
   */
  importHistory(
    entries: UndoEntry[],
    currentIndex: number,
  ): void {
    this.entries = entries.map((e) => ({
      description: e.description,
      timestampMs: e.timestampMs,
      snapshot: structuredClone(e.snapshot),
    }));
    this.currentIndex = currentIndex;

    // Enforce max entries limit
    if (this.entries.length > this.maxEntries) {
      const overflow = this.entries.length - this.maxEntries;
      this.entries = this.entries.slice(overflow);
      this.currentIndex = Math.max(0, this.currentIndex - overflow);
    }

    console.log(
      `[UndoManager] Imported ${this.entries.length} entries, currentIndex=${this.currentIndex}`,
    );
  }
}
