/**
 * StorageManager — Orchestrates backend I/O, binary codec, and proto conversion.
 *
 * Composes three layers:
 *   1. StorageBackend  — raw byte read/write + file pickers
 *   2. codec           — .archc binary envelope (magic bytes, version, SHA-256, protobuf)
 *   3. fileIO          — protobuf ↔ ArchGraph conversion
 *
 * This is the single entry point for "open architecture" / "save architecture" workflows.
 * It replaces the scattered encode/decode calls currently spread across fileStore and projectStore.
 */

import type { ArchGraph, SavedCanvasState } from '@/types/graph';
import type {
  StorageBackend,
  StorageHandle,
  StorageCapabilities,
  OpenPickerOptions,
} from './types';
import { encode, decode } from './codec';
import type { DecodeOptions } from './codec';
import { protoToGraphFull, graphToProto } from './fileIO';
import type { ProtoToGraphResult, AIStateData, UndoHistoryData } from './fileIO';

// ─── Result Types ────────────────────────────────────────────────

/** Result of opening an architecture file. */
export interface OpenResult {
  /** The decoded architecture graph and associated state. */
  result: ProtoToGraphResult;
  /** Handle for subsequent save-in-place calls. */
  handle: StorageHandle;
}

/** Options for saving an architecture. */
export interface SaveOptions {
  canvasState?: SavedCanvasState;
  undoHistory?: UndoHistoryData;
  aiState?: AIStateData;
  createdAtMs?: number;
}

/** Result of a "Save As" operation. */
export interface SaveAsResult {
  /** Handle for subsequent save-in-place calls. */
  handle: StorageHandle;
}

// ─── StorageManager ──────────────────────────────────────────────

export class StorageManager {
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  /** The backend type identifier (e.g. 'in-memory', 'file-system'). */
  get backendType(): string {
    return this.backend.type;
  }

  /** Capabilities of the underlying backend. */
  get capabilities(): StorageCapabilities {
    return this.backend.capabilities;
  }

  /**
   * Open: pick file -> read bytes -> decode binary -> convert proto -> return graph.
   *
   * @param options - Optional picker options (accepted file types, etc.)
   * @param decodeOptions - Optional decode settings (e.g. skip checksum verification)
   * @returns The decoded architecture and handle, or null if user cancelled the picker.
   */
  async openArchitecture(
    options?: OpenPickerOptions,
    decodeOptions?: DecodeOptions,
  ): Promise<OpenResult | null> {
    // Step 1: Pick a file via the backend
    const handle = await this.backend.openFilePicker(options);
    if (!handle) return null;

    // Step 2: Read raw bytes
    const data = await this.backend.read(handle);

    // Step 3: Decode .archc binary envelope
    const decoded = await decode(data, decodeOptions);

    // Step 4: Convert protobuf to internal graph types
    const result = protoToGraphFull(decoded);

    return { result, handle };
  }

  /**
   * Save: convert graph -> encode binary -> write bytes to existing handle.
   *
   * @param graph - The architecture graph to save
   * @param handle - The storage handle to write to (from a previous open or save-as)
   * @param options - Optional canvas state, undo history, AI state, timestamps
   * @returns The (possibly updated) storage handle
   */
  async saveArchitecture(
    graph: ArchGraph,
    handle: StorageHandle,
    options?: SaveOptions,
  ): Promise<StorageHandle> {
    // Step 1: Convert graph to protobuf structure
    const protoFile = graphToProto(
      graph,
      options?.canvasState,
      options?.undoHistory,
      options?.aiState,
      options?.createdAtMs,
    );

    // Step 2: Encode to .archc binary format
    const data = await encode(protoFile);

    // Step 3: Write bytes via the backend
    return this.backend.write(handle, data);
  }

  /**
   * Save As: convert -> encode -> pick location -> write.
   *
   * @param graph - The architecture graph to save
   * @param suggestedName - Suggested filename for the picker
   * @param options - Optional canvas state, undo history, AI state, timestamps
   * @returns The new handle, or null if user cancelled the picker
   */
  async saveArchitectureAs(
    graph: ArchGraph,
    suggestedName: string,
    options?: SaveOptions,
  ): Promise<SaveAsResult | null> {
    // Step 1: Convert graph to protobuf structure
    const protoFile = graphToProto(
      graph,
      options?.canvasState,
      options?.undoHistory,
      options?.aiState,
      options?.createdAtMs,
    );

    // Step 2: Encode to .archc binary format
    const data = await encode(protoFile);

    // Step 3: Pick a save location and write
    const handle = await this.backend.saveFilePicker(data, {
      suggestedName,
    });
    if (!handle) return null;

    return { handle };
  }
}
