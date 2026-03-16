import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { searchCommand } from '@/cli/commands/search';
import type { Canvas } from '@/types/schema';

vi.mock('@/cli/context', async () => {
  const actual = await vi.importActual('@/cli/context');
  return {
    ...actual,
    loadContext: vi.fn().mockResolvedValue({ fs: null, bridgeUrl: null }),
  };
});

enablePatches();

const seedData: Canvas = {
  project: { name: 'SearchTest' },
  nodes: [
    { id: 'svc-api', type: 'compute/service', displayName: 'API Service' },
    { id: 'svc-db', type: 'data/database', displayName: 'Main Database' },
    { id: 'order-worker', type: 'compute/worker', displayName: 'Order Worker' },
  ],
  edges: [
    { from: { node: 'svc-api' }, to: { node: 'svc-db' }, label: 'reads from' },
    { from: { node: 'svc-api' }, to: { node: 'order-worker' }, label: 'dispatches orders' },
  ],
  entities: [
    { name: 'Order', description: 'An order entity' },
    { name: 'User', description: 'A user record' },
  ],
};

const childCanvasData: Canvas = {
  id: 'child-canvas',
  type: 'compute/service',
  nodes: [
    { id: 'inner-api', type: 'compute/function', displayName: 'Inner API Handler' },
  ],
  edges: [],
  entities: [
    { name: 'InternalEvent', description: 'An internal event' },
  ],
};

async function setupStores(): Promise<void> {
  useFileStore.setState({
    project: null,
    dirtyCanvases: new Set(),
    status: 'idle',
    error: null,
  });

  const fs = new InMemoryFileSystem();
  // Add a ref node to the root so the child canvas gets loaded
  const rootData: Canvas = {
    ...seedData,
    nodes: [
      ...(seedData.nodes ?? []),
      { id: 'child-ref', ref: 'child-canvas.yaml' },
    ],
  };
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas(rootData),
    '.archcanvas/child-canvas.yaml': serializeCanvas(childCanvasData),
  });

  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

function captureStdout(): { output: string; restore: () => void } {
  let output = '';
  const original = process.stdout.write.bind(process.stdout);
  const mockWrite = vi.fn((chunk: string | Uint8Array) => {
    output += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    return true;
  });
  process.stdout.write = mockWrite as unknown as typeof process.stdout.write;
  return {
    get output() { return output; },
    restore: () => { process.stdout.write = original; },
  };
}

describe('searchCommand', () => {
  beforeEach(async () => {
    await setupStores();
  });

  // C5h.1: searches across all loaded scopes
  it('finds nodes across all loaded scopes', async () => {
    const capture = captureStdout();
    try {
      // "api" should match in root (svc-api) and child (inner-api)
      await searchCommand('api', {}, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      const nodeResults = result.results.filter((r: Record<string, unknown>) => r.type === 'node');
      // svc-api from root + inner-api from child
      expect(nodeResults.length).toBeGreaterThanOrEqual(2);
      const scopes = nodeResults.map((r: Record<string, unknown>) => r.scope);
      expect(scopes).toContain(ROOT_CANVAS_KEY);
      expect(scopes).toContain('child-ref');
    } finally {
      capture.restore();
    }
  });

  // C5h.2: matches on node IDs
  it('matches on node ID', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('svc-db', { type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].item.id).toBe('svc-db');
    } finally {
      capture.restore();
    }
  });

  // C5h.2: matches on displayName
  it('matches on displayName', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('Order Worker', {}, { json: true });
      const result = JSON.parse(capture.output);
      const nodeResults = result.results.filter((r: Record<string, unknown>) => r.type === 'node');
      expect(nodeResults.some((r: Record<string, unknown>) =>
        (r.item as Record<string, unknown>).id === 'order-worker',
      )).toBe(true);
    } finally {
      capture.restore();
    }
  });

  // C5h.2: matches on type
  it('matches on node type', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('compute/service', { type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(result.results.every((r: Record<string, unknown>) =>
        ((r.item as Record<string, unknown>).type as string).includes('compute/service'),
      )).toBe(true);
    } finally {
      capture.restore();
    }
  });

  // C5h.2: matches on entity names
  it('matches on entity name', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('Order', { type: 'entities' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].item.name).toBe('Order');
    } finally {
      capture.restore();
    }
  });

  // C5h.2: matches on edge labels
  it('matches on edge label', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('dispatches', { type: 'edges' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].item.label).toBe('dispatches orders');
    } finally {
      capture.restore();
    }
  });

  // C5h.3: case-insensitive substring matching
  it('case-insensitive matching', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('MAIN DATABASE', { type: 'nodes' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(result.results[0].item.id).toBe('svc-db');
    } finally {
      capture.restore();
    }
  });

  // C5h.4: results include scope
  it('results include scope (canvasId)', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('inner-api', {}, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].scope).toBe('child-ref');
    } finally {
      capture.restore();
    }
  });

  // C5h.5: JSON output shape
  it('json output has { results: [{ type, scope, item }] }', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('api', {}, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.results)).toBe(true);
      for (const r of result.results) {
        expect(r).toHaveProperty('type');
        expect(r).toHaveProperty('scope');
        expect(r).toHaveProperty('item');
      }
    } finally {
      capture.restore();
    }
  });

  // Type filter works
  it('filters by type flag', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('order', { type: 'entities' }, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.results.every((r: Record<string, unknown>) => r.type === 'entity')).toBe(true);
    } finally {
      capture.restore();
    }
  });

  // No matches returns empty results
  it('returns empty results for non-matching query', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('zzznonexistent', {}, { json: true });
      const result = JSON.parse(capture.output);
      expect(result.ok).toBe(true);
      expect(result.results).toHaveLength(0);
    } finally {
      capture.restore();
    }
  });

  // C11.2: search does NOT save
  it('does not call saveAll (read-only)', async () => {
    const saveAllSpy = vi.spyOn(useFileStore.getState(), 'saveAll');
    const capture = captureStdout();
    try {
      await searchCommand('api', {}, { json: true });
      expect(saveAllSpy).not.toHaveBeenCalled();
    } finally {
      capture.restore();
      saveAllSpy.mockRestore();
    }
  });

  // Edge matching on endpoint node names
  it('matches on edge endpoint node names', async () => {
    const capture = captureStdout();
    try {
      await searchCommand('svc-api', { type: 'edges' }, { json: true });
      const result = JSON.parse(capture.output);
      // svc-api is the from node on 2 edges
      expect(result.results.length).toBe(2);
    } finally {
      capture.restore();
    }
  });
});
