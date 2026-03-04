/**
 * HTTP API Integration Tests (Feature #315).
 *
 * Tests the HTTP REST server:
 *   - CRUD: create architecture via POST, read via GET, verify consistency
 *   - Auto-save: mutation → restart server → verify data persisted
 *   - Error responses: 404 for missing nodes, 400 for invalid input
 *   - Concurrent access: multiple agents hitting the server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHttpServer, type HttpServerOptions } from '@/cli/server/httpServer';
import { GraphContext } from '@/cli/context';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Helper: start HTTP server on a random-ish port
async function startServer(ctx: GraphContext, port = 0): Promise<{ server: Server; baseUrl: string }> {
  const options: HttpServerOptions = { port, host: '127.0.0.1', cors: false };
  const server = createHttpServer(ctx, options);

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
      } else {
        reject(new Error('Could not get server address'));
      }
    });
  });
}

// Helper: close server
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

// Helper: HTTP request
async function httpRequest(
  url: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; data: unknown; text: string }> {
  const opts: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: resp.status, data, text };
}

describe('HTTP API Integration', () => {
  let tmpDir: string;
  let archcFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-http-integration-'));
    archcFile = path.join(tmpDir, 'test.archc');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Step 1: CRUD via HTTP ───

  it('creates architecture via POST, reads via GET, verifies consistency', async () => {
    const ctx = GraphContext.createNew('HTTP CRUD Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Health check
      const health = await httpRequest(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      expect((health.data as Record<string, unknown>).status).toBe('ok');

      // Info (query routes use { data, meta } envelope)
      const info = await httpRequest(`${baseUrl}/api/info`);
      expect(info.status).toBe(200);
      const infoEnv = info.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(infoEnv.data.name).toBe('HTTP CRUD Test');
      expect(infoEnv.meta.timestamp).toBeDefined();

      // Create node 1
      const create1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'WebAPI',
      });
      expect(create1.status).toBe(201);
      const node1 = create1.data as Record<string, unknown>;
      expect(node1.id).toBeDefined();
      expect(node1.displayName).toBe('WebAPI');

      // Create node 2
      const create2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'data/database',
        displayName: 'PostgresDB',
      });
      expect(create2.status).toBe(201);
      const node2 = create2.data as Record<string, unknown>;

      // List nodes (envelope)
      const listNodes = await httpRequest(`${baseUrl}/api/nodes`);
      expect(listNodes.status).toBe(200);
      const nodesEnv = listNodes.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(2);
      expect(nodesEnv.meta.count).toBe(2);

      // Get specific node (envelope)
      const getNode = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`);
      expect(getNode.status).toBe(200);
      expect((getNode.data as { data: Record<string, unknown> }).data.displayName).toBe('WebAPI');

      // Create edge
      const createEdge = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: node1.id,
        toNode: node2.id,
        type: 'sync',
        label: 'SQL queries',
      });
      expect(createEdge.status).toBe(201);
      const edge = createEdge.data as Record<string, unknown>;
      expect(edge.id).toBeDefined();

      // List edges (envelope)
      const listEdges = await httpRequest(`${baseUrl}/api/edges`);
      expect(listEdges.status).toBe(200);
      const edgesEnv = listEdges.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      const edges = edgesEnv.data;
      expect(edges).toHaveLength(1);

      // Update node
      const updateNode = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`, 'PATCH', {
        displayName: 'UpdatedWebAPI',
      });
      expect(updateNode.status).toBe(200);

      // Verify update (envelope)
      const getUpdated = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`);
      expect((getUpdated.data as { data: Record<string, unknown> }).data.displayName).toBe('UpdatedWebAPI');

      // Add note
      const addNote = await httpRequest(`${baseUrl}/api/nodes/${node1.id}/notes`, 'POST', {
        content: 'Test note for HTTP integration',
        author: 'integration-test',
      });
      expect(addNote.status).toBe(201);
      const note = addNote.data as Record<string, unknown>;
      expect(note.id).toBeDefined();

      // Delete edge
      const deleteEdge = await httpRequest(`${baseUrl}/api/edges/${edge.id}`, 'DELETE');
      expect(deleteEdge.status).toBe(200);

      // Verify edge deleted (envelope)
      const listEdgesAfter = await httpRequest(`${baseUrl}/api/edges`);
      expect((listEdgesAfter.data as { data: Array<unknown> }).data).toHaveLength(0);

      // Delete node
      const deleteNode = await httpRequest(`${baseUrl}/api/nodes/${node2.id}`, 'DELETE');
      expect(deleteNode.status).toBe(200);

      // Verify node deleted (envelope)
      const listNodesAfter = await httpRequest(`${baseUrl}/api/nodes`);
      expect((listNodesAfter.data as { data: Array<unknown> }).data).toHaveLength(1);

      // Search (envelope)
      const search = await httpRequest(`${baseUrl}/api/search?q=Updated`);
      expect(search.status).toBe(200);
      const searchEnv = search.data as { data: Array<unknown>; meta: Record<string, unknown> };
      expect(searchEnv.data.length).toBeGreaterThan(0);
      expect(searchEnv.meta.query).toBe('Updated');

      // Export markdown
      const exportMd = await httpRequest(`${baseUrl}/api/export/markdown`);
      expect(exportMd.status).toBe(200);
      expect(exportMd.text).toContain('UpdatedWebAPI');

      // Export mermaid
      const exportMermaid = await httpRequest(`${baseUrl}/api/export/mermaid`);
      expect(exportMermaid.status).toBe(200);
      expect(typeof exportMermaid.text).toBe('string');

      // Describe (envelope with scope/format params)
      const desc = await httpRequest(`${baseUrl}/api/describe?format=structured`);
      expect(desc.status).toBe(200);
      const descEnv = desc.data as { data: unknown; meta: Record<string, unknown> };
      expect(descEnv.meta.format).toBe('structured');
      expect(descEnv.meta.scope).toBe('full');

      // Describe backward compat with style param
      const descStyle = await httpRequest(`${baseUrl}/api/describe?style=human`);
      expect(descStyle.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  // ─── Step 2: Auto-save — mutation → close → reload → verify ───

  it('mutations auto-save to .archc file and persist across server restarts', async () => {
    const ctx = GraphContext.createNew('AutoSave Test');
    await ctx.saveAs(archcFile);
    const ctx1 = await GraphContext.loadFromFile(archcFile);
    const { server: server1, baseUrl: baseUrl1 } = await startServer(ctx1);

    let nodeId: string;
    try {
      // Create a node via HTTP
      const create = await httpRequest(`${baseUrl1}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'AutoSaveNode',
      });
      expect(create.status).toBe(201);
      nodeId = (create.data as Record<string, unknown>).id as string;
    } finally {
      await closeServer(server1);
    }

    // Reload from file and start a new server
    const ctx2 = await GraphContext.loadFromFile(archcFile);
    const { server: server2, baseUrl: baseUrl2 } = await startServer(ctx2);

    try {
      // Verify node persisted (envelope)
      const listNodes = await httpRequest(`${baseUrl2}/api/nodes`);
      expect(listNodes.status).toBe(200);
      const nodesEnv = listNodes.data as { data: Array<Record<string, unknown>> };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].displayName).toBe('AutoSaveNode');
      expect(nodes[0].id).toBe(nodeId);
    } finally {
      await closeServer(server2);
    }
  });

  // ─── Step 3: Error responses ───

  describe('Error responses', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ctx = GraphContext.createNew('Error Test');
      await ctx.saveAs(archcFile);
      const reloaded = await GraphContext.loadFromFile(archcFile);
      const s = await startServer(reloaded);
      server = s.server;
      baseUrl = s.baseUrl;
    });

    afterEach(async () => {
      await closeServer(server);
    });

    it('returns 404 for non-existent node', async () => {
      const result = await httpRequest(`${baseUrl}/api/nodes/nonexistent-id-999`);
      expect(result.status).toBe(404);
      expect((result.data as Record<string, unknown>).error).toContain('not found');
    });

    it('returns 404 for non-existent route', async () => {
      const result = await httpRequest(`${baseUrl}/api/nonexistent`);
      expect(result.status).toBe(404);
    });

    it('returns 400 for POST nodes without required fields', async () => {
      const result = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('type');
    });

    it('returns 400 for POST edges without required fields', async () => {
      const result = await httpRequest(`${baseUrl}/api/edges`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('fromNode');
    });

    it('returns 400 for search without query', async () => {
      const result = await httpRequest(`${baseUrl}/api/search`);
      expect(result.status).toBe(400);
      const errData = result.data as Record<string, unknown>;
      expect(errData.error).toContain('q');
    });

    it('returns 400 for describe with scope=node but no nodeId', async () => {
      const result = await httpRequest(`${baseUrl}/api/describe?scope=node`);
      expect(result.status).toBe(400);
      const errData = result.data as Record<string, unknown>;
      expect(errData.error).toContain('nodeId');
    });

    it('returns 200 for deleting non-existent node (no-op, filter-based removal)', async () => {
      // removeNode uses filter — non-existent IDs are silently ignored
      const result = await httpRequest(`${baseUrl}/api/nodes/fake-id`, 'DELETE');
      expect(result.status).toBe(200);
    });

    it('returns 200 for deleting non-existent edge (no-op, filter-based removal)', async () => {
      // removeEdge uses filter — non-existent IDs are silently ignored
      const result = await httpRequest(`${baseUrl}/api/edges/fake-id`, 'DELETE');
      expect(result.status).toBe(200);
    });

    it('returns 400 for PATCH node without body', async () => {
      // First create a node
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'TestNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id;

      // PATCH with empty body (no JSON at all)
      const resp = await fetch(`${baseUrl}/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      // Should get 400 since body is empty/undefined
      expect(resp.status).toBe(400);
    });

    it('returns 400 for POST notes without content', async () => {
      // Create a node
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'NoteTarget',
      });
      const nodeId = (create.data as Record<string, unknown>).id;

      const result = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('content');
    });
  });

  // ─── Step 4: Concurrent access patterns ───

  it('handles concurrent requests from multiple agents', async () => {
    const ctx = GraphContext.createNew('Concurrent Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Fire multiple concurrent POST requests to create nodes
      const promises = Array.from({ length: 5 }, (_, i) =>
        httpRequest(`${baseUrl}/api/nodes`, 'POST', {
          type: 'compute/service',
          displayName: `ConcurrentNode_${i}`,
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.status).toBe(201);
        expect((result.data as Record<string, unknown>).id).toBeDefined();
      }

      // Verify all nodes were created (envelope)
      const listResult = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = listResult.data as { data: Array<Record<string, unknown>> };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(5);

      // All IDs should be unique
      const ids = nodes.map(n => n.id);
      expect(new Set(ids).size).toBe(5);

      // Fire concurrent reads while writing
      const mixedPromises = [
        httpRequest(`${baseUrl}/api/nodes`, 'POST', {
          type: 'data/database',
          displayName: 'ConcurrentDB',
        }),
        httpRequest(`${baseUrl}/api/nodes`),
        httpRequest(`${baseUrl}/api/describe?style=structured`),
        httpRequest(`${baseUrl}/api/search?q=Concurrent`),
        httpRequest(`${baseUrl}/health`),
      ];

      const mixedResults = await Promise.all(mixedPromises);
      // All should succeed (no 500 errors)
      for (const result of mixedResults) {
        expect(result.status).toBeLessThan(500);
      }
    } finally {
      await closeServer(server);
    }
  });

  // ─── Step 5: Query endpoint envelope and features (Feature #311) ───

  describe('Query endpoints (Feature #311)', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ctx = GraphContext.createNew('Query Test');
      await ctx.saveAs(archcFile);
      const reloaded = await GraphContext.loadFromFile(archcFile);

      // Add some nodes to work with
      reloaded.textApi.addNode({ type: 'compute/service', displayName: 'AuthService' });
      const dbNode = reloaded.textApi.addNode({ type: 'data/database', displayName: 'UserDB' });
      reloaded.textApi.addNode({ type: 'messaging/message-queue', displayName: 'EventQueue' });
      reloaded.textApi.addEdge({ fromNode: reloaded.textApi.listNodes()[0].id, toNode: dbNode.id, type: 'sync', label: 'SQL' });
      await reloaded.save(true);

      const s = await startServer(reloaded);
      server = s.server;
      baseUrl = s.baseUrl;
    });

    afterEach(async () => {
      await closeServer(server);
    });

    it('GET /api/info returns { data, meta } envelope with metadata', async () => {
      const res = await httpRequest(`${baseUrl}/api/info`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
      expect(body.meta.timestamp).toBeDefined();
      expect(body.data.name).toBe('Query Test');
      expect(body.data.nodeCount).toBe(3);
      expect(body.data.edgeCount).toBe(1);
    });

    it('GET /api/describe with scope=full and format=structured', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?scope=full&format=structured`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
      expect(body.meta.scope).toBe('full');
      expect(body.meta.format).toBe('structured');
    });

    it('GET /api/describe with scope=full and format=human', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?format=human`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(typeof body.data).toBe('string');
      expect(body.meta.format).toBe('human');
    });

    it('GET /api/describe with scope=full and format=ai', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?format=ai`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(typeof body.data).toBe('string');
      expect(body.meta.format).toBe('ai');
    });

    it('GET /api/describe backward-compatible with ?style= parameter', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?style=structured`);
      expect(res.status).toBe(200);
      const body = res.data as { data: unknown; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
    });

    it('GET /api/describe with scope=node and nodeId', async () => {
      // Get a node ID first
      const nodesRes = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = nodesRes.data as { data: Array<Record<string, unknown>> };
      const nodeId = nodesEnv.data[0].id;

      const res = await httpRequest(`${baseUrl}/api/describe?scope=node&nodeId=${nodeId}&format=structured`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(body.meta.scope).toBe('node');
    });

    it('GET /api/nodes returns NodeSummary[] in envelope with count', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
      // Verify NodeSummary shape
      const node = body.data[0];
      expect(node.id).toBeDefined();
      expect(node.type).toBeDefined();
      expect(node.displayName).toBeDefined();
    });

    it('GET /api/nodes/:id returns NodeDetail in envelope', async () => {
      // Get a node ID
      const nodesRes = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = nodesRes.data as { data: Array<Record<string, unknown>> };
      const authNode = nodesEnv.data.find((n) => n.displayName === 'AuthService')!;

      const res = await httpRequest(`${baseUrl}/api/nodes/${authNode.id}`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(body.data.displayName).toBe('AuthService');
      expect(body.data.type).toBe('compute/service');
      expect(body.meta.timestamp).toBeDefined();
    });

    it('GET /api/nodes/:id returns 404 for non-existent node', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes/nonexistent-xyz`);
      expect(res.status).toBe(404);
      const body = res.data as { error: string };
      expect(body.error).toContain('not found');
    });

    it('GET /api/edges returns EdgeSummary[] in envelope with count', async () => {
      const res = await httpRequest(`${baseUrl}/api/edges`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data).toHaveLength(1);
      expect(body.meta.count).toBe(1);
      // Verify EdgeSummary shape
      const edge = body.data[0];
      expect(edge.id).toBeDefined();
      expect(edge.fromNode).toBeDefined();
      expect(edge.toNode).toBeDefined();
      expect(edge.type).toBeDefined();
    });

    it('GET /api/search?q=<query> returns SearchResult[] in envelope', async () => {
      const res = await httpRequest(`${baseUrl}/api/search?q=Auth`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.query).toBe('Auth');
      expect(body.meta.count).toBe(body.data.length);
    });

    it('GET /api/search without q returns 400', async () => {
      const res = await httpRequest(`${baseUrl}/api/search`);
      expect(res.status).toBe(400);
    });

    it('GET /api/nodedefs returns all nodedefs in envelope', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.count).toBe(body.data.length);
      // Verify nodedef summary shape
      const def = body.data[0];
      expect(def.type).toBeDefined();
      expect(def.displayName).toBeDefined();
      expect(def.namespace).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.icon).toBeDefined();
    });

    it('GET /api/nodedefs?namespace=compute filters by namespace', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=compute`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.namespace).toBe('compute');
      // All should be compute namespace
      for (const def of body.data) {
        expect(def.namespace).toBe('compute');
      }
    });

    it('GET /api/nodedefs?namespace=data filters by data namespace', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=data`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
      expect(body.data.length).toBeGreaterThan(0);
      for (const def of body.data) {
        expect(def.namespace).toBe('data');
      }
    });

    it('GET /api/nodedefs?namespace=nonexistent returns empty array', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=nonexistent`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<unknown>; meta: Record<string, unknown> };
      expect(body.data).toHaveLength(0);
      expect(body.meta.count).toBe(0);
    });

    it('all query endpoints have consistent { data, meta } envelope', async () => {
      const endpoints = [
        '/api/info',
        '/api/describe',
        '/api/nodes',
        '/api/edges',
        '/api/search?q=test',
        '/api/nodedefs',
      ];

      for (const endpoint of endpoints) {
        const res = await httpRequest(`${baseUrl}${endpoint}`);
        expect(res.status).toBeLessThan(500);
        const body = res.data as Record<string, unknown>;
        expect(body.data).toBeDefined();
        expect(body.meta).toBeDefined();
        expect((body.meta as Record<string, unknown>).timestamp).toBeDefined();
      }
    });
  });

  // ─── Step 6: Export endpoints ───

  it('export endpoints return valid content', async () => {
    const ctx = GraphContext.createNew('Export Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Add some data first
      await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service', displayName: 'ExportSvc',
      });

      // Markdown
      const md = await httpRequest(`${baseUrl}/api/export/markdown`);
      expect(md.status).toBe(200);
      expect(md.text).toContain('ExportSvc');

      // Mermaid
      const mermaid = await httpRequest(`${baseUrl}/api/export/mermaid`);
      expect(mermaid.status).toBe(200);
      expect(mermaid.text).toContain('graph');

      // Summary (markdown + mermaid)
      const summary = await httpRequest(`${baseUrl}/api/export/summary`);
      expect(summary.status).toBe(200);
      expect(summary.text).toContain('ExportSvc');
    } finally {
      await closeServer(server);
    }
  });
});
