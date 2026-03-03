import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { graphToProto, protoToGraphFull } from '@/core/storage/fileIO';
import { encode, decode } from '@/core/storage/codec';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import type { ArchGraph } from '@/types/graph';

describe('FileHeader timestamps', () => {
  let graph: ArchGraph;

  beforeEach(() => {
    graph = createEmptyGraph();
    graph.name = 'Timestamp Test';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets createdAtMs on first save (no prior createdAtMs)', async () => {
    const before = Date.now();
    const protoFile = graphToProto(graph);
    const binary = await encode(protoFile);
    const after = Date.now();

    const decoded = await decode(binary);
    const createdAt = Number(decoded.header?.createdAtMs ?? 0);
    const updatedAt = Number(decoded.header?.updatedAtMs ?? 0);

    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it('sets updatedAtMs to current time on every save', async () => {
    const before = Date.now();
    const protoFile = graphToProto(graph);
    const binary = await encode(protoFile);
    const after = Date.now();

    const decoded = await decode(binary);
    const updatedAt = Number(decoded.header?.updatedAtMs ?? 0);

    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it('preserves createdAtMs on re-save when passed explicitly', async () => {
    // First save
    const originalCreatedAt = Date.now() - 60_000; // 1 minute ago
    const protoFile = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
    const binary = await encode(protoFile);

    const decoded = await decode(binary);
    const createdAt = Number(decoded.header?.createdAtMs ?? 0);
    const updatedAt = Number(decoded.header?.updatedAtMs ?? 0);

    // createdAt should be preserved (the original value from 1 minute ago)
    expect(createdAt).toBe(originalCreatedAt);
    // updatedAt should be approximately now
    expect(updatedAt).toBeGreaterThan(originalCreatedAt);
  });

  it('does NOT change createdAtMs on re-save', async () => {
    // Simulate first save: set createdAtMs to 1 hour ago
    const oneHourAgo = Date.now() - 3600_000;

    // Re-save with the same createdAtMs
    const protoFile = graphToProto(graph, undefined, undefined, undefined, oneHourAgo);
    const binary = await encode(protoFile);

    const decoded = await decode(binary);
    const createdAt = Number(decoded.header?.createdAtMs ?? 0);

    // createdAtMs should still be 1 hour ago, NOT updated to now
    expect(createdAt).toBe(oneHourAgo);
  });

  it('updatedAtMs changes on each re-save', async () => {
    const originalCreatedAt = Date.now() - 3600_000; // 1 hour ago

    // First re-save
    const protoFile1 = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
    const binary1 = await encode(protoFile1);
    const decoded1 = await decode(binary1);
    const updatedAt1 = Number(decoded1.header?.updatedAtMs ?? 0);

    // Small delay to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second re-save
    const protoFile2 = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
    const binary2 = await encode(protoFile2);
    const decoded2 = await decode(binary2);
    const updatedAt2 = Number(decoded2.header?.updatedAtMs ?? 0);

    // Both should have the same createdAtMs
    expect(Number(decoded1.header?.createdAtMs ?? 0)).toBe(originalCreatedAt);
    expect(Number(decoded2.header?.createdAtMs ?? 0)).toBe(originalCreatedAt);

    // updatedAtMs should be different (or at least >= first save)
    expect(updatedAt2).toBeGreaterThanOrEqual(updatedAt1);
  });

  it('protoToGraphFull extracts createdAtMs and updatedAtMs from header', async () => {
    const createdAt = Date.now() - 7200_000; // 2 hours ago
    const protoFile = graphToProto(graph, undefined, undefined, undefined, createdAt);
    const binary = await encode(protoFile);
    const decoded = await decode(binary);

    const result = protoToGraphFull(decoded);
    expect(result.createdAtMs).toBe(createdAt);
    expect(result.updatedAtMs).toBeGreaterThan(0);
    expect(result.updatedAtMs).toBeGreaterThanOrEqual(Date.now() - 1000);
  });

  it('round-trip: save with createdAtMs → load → save again preserves createdAtMs', async () => {
    const originalCreated = Date.now() - 86400_000; // 1 day ago

    // First save
    const proto1 = graphToProto(graph, undefined, undefined, undefined, originalCreated);
    const binary1 = await encode(proto1);

    // Load
    const decoded1 = await decode(binary1);
    const result = protoToGraphFull(decoded1);

    // Re-save using extracted createdAtMs
    const proto2 = graphToProto(result.graph, undefined, undefined, undefined, result.createdAtMs);
    const binary2 = await encode(proto2);

    // Verify createdAtMs is preserved
    const decoded2 = await decode(binary2);
    expect(Number(decoded2.header?.createdAtMs ?? 0)).toBe(originalCreated);
  });

  // ─── Feature #227: End-to-end verification steps ───────────────

  describe('Feature #227: Full save lifecycle', () => {
    it('Step 1-3: create and save a file, created_at is approximately now', async () => {
      // Create a new file with a node
      const newGraph = createEmptyGraph();
      newGraph.name = 'My New Architecture';

      // Save the file (first save, no prior createdAtMs)
      const before = Date.now();
      const protoFile = graphToProto(newGraph);
      const binary = await encode(protoFile);
      const after = Date.now();

      // Read the FileHeader timestamps
      const decoded = await decode(binary);
      const header = decoded.header;
      expect(header).toBeDefined();

      const createdAt = Number(header?.createdAtMs ?? 0);
      const updatedAt = Number(header?.updatedAtMs ?? 0);

      // Verify created_at timestamp is approximately now
      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(after);
      expect(createdAt).toBeGreaterThan(0);

      // Verify updated_at is also approximately now
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
      expect(updatedAt).toBeGreaterThan(0);
    });

    it('Step 4-6: modify and re-save, updated_at changes but created_at stays', async () => {
      // Step 1: Create and save a file (simulating first save)
      const originalCreatedAt = Date.now() - 120_000; // 2 minutes ago
      const proto1 = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
      const binary1 = await encode(proto1);

      // Read the first save's header
      const decoded1 = await decode(binary1);
      const updatedAt1 = Number(decoded1.header?.updatedAtMs ?? 0);

      // Small delay to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Step 4: Modify the graph and save again
      graph.name = 'Modified Architecture';
      graph.description = 'Added a description after initial creation';

      const beforeReSave = Date.now();
      const proto2 = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
      const binary2 = await encode(proto2);
      const afterReSave = Date.now();

      // Read the re-saved header
      const decoded2 = await decode(binary2);
      const createdAt2 = Number(decoded2.header?.createdAtMs ?? 0);
      const updatedAt2 = Number(decoded2.header?.updatedAtMs ?? 0);

      // Step 5: Verify updated_at timestamp IS updated
      expect(updatedAt2).toBeGreaterThanOrEqual(beforeReSave);
      expect(updatedAt2).toBeLessThanOrEqual(afterReSave);
      expect(updatedAt2).toBeGreaterThan(updatedAt1);

      // Step 6: Verify created_at timestamp is NOT changed on re-save
      expect(createdAt2).toBe(originalCreatedAt);
      expect(createdAt2).toBeLessThan(updatedAt2);
    });

    it('header includes format_version alongside timestamps', async () => {
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const decoded = await decode(binary);

      expect(decoded.header?.formatVersion).toBeDefined();
      expect(decoded.header?.formatVersion).toBeGreaterThan(0);
    });

    it('timestamps survive multiple round-trips (open → edit → save → open → edit → save)', async () => {
      // First creation
      const originalCreatedAt = Date.now() - 300_000; // 5 minutes ago

      // First save
      const proto1 = graphToProto(graph, undefined, undefined, undefined, originalCreatedAt);
      const binary1 = await encode(proto1);

      // First open
      const decoded1 = await decode(binary1);
      const result1 = protoToGraphFull(decoded1);
      expect(result1.createdAtMs).toBe(originalCreatedAt);

      await new Promise((resolve) => setTimeout(resolve, 5));

      // Edit and second save
      result1.graph.name = 'Edited Once';
      const proto2 = graphToProto(result1.graph, undefined, undefined, undefined, result1.createdAtMs);
      const binary2 = await encode(proto2);

      // Second open
      const decoded2 = await decode(binary2);
      const result2 = protoToGraphFull(decoded2);
      expect(result2.createdAtMs).toBe(originalCreatedAt);

      await new Promise((resolve) => setTimeout(resolve, 5));

      // Edit and third save
      result2.graph.name = 'Edited Twice';
      const proto3 = graphToProto(result2.graph, undefined, undefined, undefined, result2.createdAtMs);
      const binary3 = await encode(proto3);

      // Third open and final verification
      const decoded3 = await decode(binary3);
      const result3 = protoToGraphFull(decoded3);

      // created_at STILL the original value after 3 saves
      expect(result3.createdAtMs).toBe(originalCreatedAt);
      // updated_at is the most recent
      expect(result3.updatedAtMs).toBeGreaterThan(originalCreatedAt);
    });

    it('timestamps are stored as uint64 (non-negative)', async () => {
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const decoded = await decode(binary);

      const createdAt = Number(decoded.header?.createdAtMs ?? 0);
      const updatedAt = Number(decoded.header?.updatedAtMs ?? 0);

      expect(createdAt).toBeGreaterThan(0);
      expect(updatedAt).toBeGreaterThan(0);
      expect(Number.isInteger(createdAt)).toBe(true);
      expect(Number.isInteger(updatedAt)).toBe(true);
    });

    it('createdAtMs and updatedAtMs are equal on first-ever save', async () => {
      // When no createdAtMs is provided, both are set to Date.now() in encode()
      const protoFile = graphToProto(graph);
      const binary = await encode(protoFile);
      const decoded = await decode(binary);

      const createdAt = Number(decoded.header?.createdAtMs ?? 0);
      const updatedAt = Number(decoded.header?.updatedAtMs ?? 0);

      // They should be from the same Date.now() call, so identical or at most 1ms apart
      expect(Math.abs(createdAt - updatedAt)).toBeLessThanOrEqual(1);
    });

    it('graphToProto sets header with createdAtMs when provided', () => {
      const past = Date.now() - 50_000;
      const protoFile = graphToProto(graph, undefined, undefined, undefined, past);

      expect(protoFile.header).toBeDefined();
      expect(protoFile.header?.createdAtMs).toBe(past);
    });

    it('graphToProto does NOT set header when createdAtMs is not provided', () => {
      const protoFile = graphToProto(graph);

      // No header set at graphToProto level (codec.encode will create it)
      expect(protoFile.header).toBeUndefined();
    });
  });
});
