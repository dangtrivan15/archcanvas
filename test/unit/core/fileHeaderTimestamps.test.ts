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
});
